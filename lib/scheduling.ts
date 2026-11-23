import { randomUUID } from "node:crypto";
import { bookingToken } from "./booking-token";
import { professionals, services } from "./catalog";
import { addDays, atLima, limaDate, limaTime, validDate, validTime } from "./clinic-time";
import { getDb, type Sql } from "./db";
import { field, HttpError, optionalField } from "./http";
import { digest } from "./password";
import type { User } from "./auth";

type Input = Record<string, unknown>;
type Service = (typeof services)[number];
type Professional = (typeof professionals)[number];
type Appointment = {
  id: string; patientId: string; patientName: string; serviceId: string; serviceName: string;
  professionalId: string; professionalName: string; status: string; priceCents: number;
  startsAt: Date; endsAt: Date; occupiedUntil: Date; expiresAt: Date | null;
  manageHash: string | null; optIn: boolean;
};
type Block = { id: string; professionalId: string; reason: string; startsAt: Date; endsAt: Date };
type Slot = { date: string; time: string; professionalId: string; professionalName: string };

const rowColumns = `
  SELECT a.id, a.patient_id AS "patientId", p.name AS "patientName",
    a.service_id AS "serviceId", a.service_name AS "serviceName",
    a.professional_id AS "professionalId", a.professional_name AS "professionalName", a.status,
    a.price_cents AS "priceCents", a.starts_at AS "startsAt", a.ends_at AS "endsAt",
    a.occupied_until AS "occupiedUntil", a.hold_expires_at AS "expiresAt",
    a.manage_hash AS "manageHash", a.opt_in AS "optIn"
    FROM appointments a JOIN patients p ON p.id = a.patient_id
`;
const activeCondition = `(status IN ('CONFIRMED','CHECKED_IN','IN_PROGRESS','COMPLETED')
  OR (status = 'PENDING' AND hold_expires_at > $4))`;
const minutes = 60_000;

function svc(value: unknown) {
  const selected = services.find((service) => service.id === value);
  if (!selected) throw new HttpError(400, "Selecciona un servicio disponible.");
  return selected;
}

function candidates(value: unknown, service: Service) {
  const available = professionals.filter((professional) => professional.serviceIds.includes(service.id));
  const list = available.filter((professional) => value === "any" || professional.id === value);
  if (!list.length) throw new HttpError(400, "El profesional seleccionado no ofrece este servicio.");
  return list;
}

function validatedDate(value: unknown) {
  const date = field(value, "fecha", 10);
  if (!validDate(date)) throw new HttpError(400, "Selecciona una fecha válida.");
  return date;
}

function validatedTime(value: unknown, label = "hora") {
  const time = field(value, label, 5);
  if (!validTime(time)) throw new HttpError(400, "Selecciona una hora válida.");
  return time;
}

function durationTimes(date: string, time: string, service: Service) {
  const start = atLima(date, time);
  const end = new Date(start.getTime() + service.duration * minutes);
  const occupied = new Date(end.getTime() + 10 * minutes);
  return { start, end, occupied };
}

function withinHours(date: string, start: Date, occupied: Date, now: Date) {
  return date >= limaDate(now) && date <= addDays(limaDate(now), 90)
    && atLima(date).getUTCDay() !== 0 && start >= atLima(date, "09:00")
    && start > now && occupied <= atLima(date, "17:00");
}

function asAppointment(row: Appointment, now = new Date()) {
  const status = row.status === "PENDING" && row.expiresAt && new Date(row.expiresAt) <= now ? "EXPIRED" : row.status;
  return {
    id: row.id, date: limaDate(row.startsAt), time: limaTime(row.startsAt), endTime: limaTime(row.endsAt),
    serviceId: row.serviceId, serviceName: row.serviceName, professionalId: row.professionalId,
    professionalName: row.professionalName, patientId: row.patientId, patientName: row.patientName,
    status, priceCents: row.priceCents, expiresAt: status === "PENDING" ? row.expiresAt : null,
  };
}

function asPublic(row: Appointment) {
  const { patientId, ...appointment } = asAppointment(row);
  void patientId;
  return appointment;
}

async function getAppointment(sql: Sql, column: "a.id" | "a.manage_hash", value: string) {
  const result = await sql.query<Appointment>(rowColumns + " WHERE " + column + " = $1", [value]);
  const row = result.rows[0];
  if (!row) throw new HttpError(404, "No encontramos esa cita o el enlace ya no es válido.");
  return row;
}

async function record(sql: Sql, id: string, actor: User | null, action: string, reason: string | null = null) {
  await sql.query("INSERT INTO appointment_events (id,appointment_id,actor_id,action,reason) VALUES ($1,$2,$3,$4,$5)", [
    randomUUID(), id, actor?.id ?? null, action, reason,
  ]);
}

async function writeSchedule<T>(operation: (sql: Sql, now: Date) => Promise<T>) {
  return (await getDb()).transaction(async (sql) => {
    await sql.query("SELECT id FROM clinic_state WHERE id = 1 FOR UPDATE");
    const { rows } = await sql.query<{ instant: Date }>("SELECT clock_timestamp() AS instant");
    const now = new Date(rows[0].instant);
    await sql.query(`
      WITH expired AS (
        UPDATE appointments SET status='EXPIRED' WHERE status='PENDING' AND hold_expires_at <= $1 RETURNING id
      )
      INSERT INTO appointment_events (id, appointment_id, action)
        SELECT 'exp-' || id, id, 'EXPIRED' FROM expired
    `, [now]);
    return operation(sql, now);
  });
}

async function overlapping(sql: Sql, professionalId: string, start: Date, end: Date, now: Date) {
  const result = await sql.query(`
    SELECT 1 FROM appointments WHERE professional_id = $1 AND starts_at < $3 AND occupied_until > $2
      AND ${activeCondition}
    UNION ALL
    SELECT 1 FROM agenda_blocks WHERE professional_id = $1 AND starts_at < $3 AND ends_at > $2
    LIMIT 1
  `, [professionalId, start, end, now]);
  return result.rows.length > 0;
}

export async function availability(search: URLSearchParams) {
  const service = svc(search.get("serviceId"));
  const possible = candidates(search.get("professionalId") ?? "any", service);
  const date = validatedDate(search.get("date"));
  const now = new Date();
  const starts = atLima(date);
  const ends = atLima(addDays(date, 1));
  if (date < limaDate(now) || date > addDays(limaDate(now), 90) || starts.getUTCDay() === 0) return [];
  type Interval = { professionalId: string; startsAt: Date; endsAt: Date };
  const { rows } = await (await getDb()).query<Interval>(`
    SELECT professional_id AS "professionalId", starts_at AS "startsAt", occupied_until AS "endsAt"
      FROM appointments WHERE professional_id = ANY($1::text[]) AND starts_at < $3 AND occupied_until > $2
        AND ${activeCondition}
    UNION ALL
    SELECT professional_id, starts_at, ends_at FROM agenda_blocks
      WHERE professional_id = ANY($1::text[]) AND starts_at < $3 AND ends_at > $2
  `, [possible.map((professional) => professional.id), starts, ends, now]);
  const slots: Slot[] = [];
  for (let minute = 9 * 60; minute < 17 * 60; minute += 15) {
    const time = String(Math.floor(minute / 60)).padStart(2, "0") + ":" + String(minute % 60).padStart(2, "0");
    const { start, occupied } = durationTimes(date, time, service);
    if (!withinHours(date, start, occupied, now)) continue;
    const professional = possible.find(({ id }) => !rows.some((interval) => interval.professionalId === id
      && start < new Date(interval.endsAt) && occupied > new Date(interval.startsAt)));
    if (professional) slots.push({ date, time, professionalId: professional.id, professionalName: professional.name });
  }
  return slots;
}

async function chooseSlot(sql: Sql, input: Input, service: Service, now: Date) {
  const date = validatedDate(input.date);
  const time = validatedTime(input.time);
  const timing = durationTimes(date, time, service);
  if (!withinHours(date, timing.start, timing.occupied, now) || Number(time.slice(3)) % 15 !== 0) {
    throw new HttpError(409, "Ese turno queda fuera de los horarios de reserva.");
  }
  const list = candidates(input.professionalId ?? "any", service);
  for (const professional of list) {
    if (!await overlapping(sql, professional.id, timing.start, timing.occupied, now)) return { ...timing, professional };
  }
  throw new HttpError(409, "Ese horario ya está ocupado. Elige otro turno.");
}

function phone(value: unknown) {
  const number = field(value, "teléfono", 30).replace(/[\s()-]/g, "");
  if (!/^\+?\d{7,15}$/.test(number)) throw new HttpError(400, "Ingresa un teléfono válido.");
  return number;
}

function email(value: unknown) {
  const address = optionalField(value, "correo", 160);
  if (address && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) throw new HttpError(400, "Ingresa un correo válido.");
  return address?.toLowerCase() ?? null;
}

export function patientFields(input: Input) {
  return { name: field(input.name, "nombre", 120), phone: phone(input.phone), email: email(input.email) };
}

async function assign(sql: Sql, appointment: Appointment) {
  await sql.query("INSERT INTO patient_assignments VALUES ($1,$2) ON CONFLICT DO NOTHING", [
    appointment.patientId, appointment.professionalId,
  ]);
}

async function notifications(sql: Sql, appointment: Appointment, now: Date) {
  if (!appointment.optIn) return;
  const reminder = new Date(new Date(appointment.startsAt).getTime() - 24 * 60 * minutes);
  const jobs = reminder > now
    ? [{ kind: "CONFIRMACION", at: now }, { kind: "RECORDATORIO", at: reminder }]
    : [{ kind: "CONFIRMACION", at: now }];
  for (const job of jobs) {
    await sql.query(`
      INSERT INTO whatsapp_jobs (id,appointment_id,kind,status,available_at)
      VALUES ($1,$2,$3,'PENDIENTE',$4) ON CONFLICT (appointment_id,kind) DO NOTHING
    `, [randomUUID(), appointment.id, job.kind, job.at]);
  }
}

async function insertAppointment(sql: Sql, details: {
  patientId: string; service: Service; timing: { start: Date; end: Date; occupied: Date; professional: Professional };
  status: "CONFIRMED" | "PENDING"; hash?: string | null; expiresAt?: Date; optIn?: boolean; previous?: Appointment;
}) {
  const id = randomUUID();
  const { timing, service, previous } = details;
  await sql.query(`
    INSERT INTO appointments (id,patient_id,service_id,service_name,professional_id,professional_name,
      starts_at,ends_at,occupied_until,price_cents,status,hold_expires_at,manage_hash,opt_in,previous_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
  `, [id, details.patientId, service.id, service.name, timing.professional.id, timing.professional.name,
    timing.start, timing.end, timing.occupied, previous?.priceCents ?? service.priceCents,
    details.status, details.expiresAt ?? null, details.hash ?? null, details.optIn ?? false, previous?.id ?? null]);
  return getAppointment(sql, "a.id", id);
}

export async function hold(input: Input) {
  const patient = patientFields(input);
  const service = svc(input.serviceId);
  return writeSchedule(async (sql, now) => {
    const timing = await chooseSlot(sql, input, service, now);
    const id = randomUUID();
    const token = await bookingToken(id);
    const expiresAt = new Date(now.getTime() + 10 * minutes);
    await sql.query("INSERT INTO patients (id,name,phone,email) VALUES ($1,$2,$3,$4)", [
      id, patient.name, patient.phone, patient.email,
    ]);
    const appointment = await insertAppointment(sql, {
      patientId: id, service, timing, expiresAt, hash: digest(token), optIn: input.whatsappOptIn === true, status: "PENDING",
    });
    await record(sql, appointment.id, null, "PENDING");
    return { appointment: asPublic(appointment), token, expiresAt };
  });
}

function validToken(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new HttpError(404, "El enlace de gestión no es válido.");
  return digest(token);
}

export async function patientAppointment(token: string) {
  const hash = validToken(token);
  return asPublic(await getAppointment(await getDb(), "a.manage_hash", hash));
}

async function cancel(sql: Sql, current: Appointment, user: User | null, reason: string | null) {
  if (current.status === "CANCELLED") return current;
  if (!["PENDING", "CONFIRMED"].includes(current.status)) throw new HttpError(409, "Esta cita ya no se puede cancelar.");
  await sql.query("UPDATE appointments SET status='CANCELLED' WHERE id=$1", [current.id]);
  await sql.query("UPDATE whatsapp_jobs SET status='CANCELADO' WHERE appointment_id=$1 AND status='PENDIENTE'", [current.id]);
  await record(sql, current.id, user, "CANCELLED", reason);
  return getAppointment(sql, "a.id", current.id);
}

async function move(sql: Sql, current: Appointment, input: Input, user: User | null, reason: string, now: Date) {
  if (current.status !== "CONFIRMED") throw new HttpError(409, "Solo puedes reprogramar una cita confirmada.");
  const service = svc(current.serviceId);
  const date = validatedDate(input.date);
  const time = validatedTime(input.time);
  if (date === limaDate(current.startsAt) && time === limaTime(current.startsAt)
      && ["any", current.professionalId, undefined].includes(input.professionalId as string | undefined)) {
    return current;
  }
  await sql.query("UPDATE appointments SET status='RESCHEDULED', manage_hash=NULL WHERE id=$1", [current.id]);
  const timing = await chooseSlot(sql, input, service, now);
  const replacement = await insertAppointment(sql, {
    patientId: current.patientId, service, timing, status: "CONFIRMED",
    hash: current.manageHash, optIn: current.optIn, previous: current,
  });
  await record(sql, current.id, user, "RESCHEDULED", reason);
  await record(sql, replacement.id, user, "CONFIRMED", reason);
  await sql.query("UPDATE whatsapp_jobs SET status='CANCELADO' WHERE appointment_id=$1 AND status='PENDIENTE'", [current.id]);
  await assign(sql, replacement);
  await notifications(sql, replacement, now);
  return replacement;
}

export async function manageAppointment(token: string, input: Input) {
  const hash = validToken(token);
  const updated = await writeSchedule(async (sql, now) => {
    const current = await getAppointment(sql, "a.manage_hash", hash);
    if (current.status === "EXPIRED") return null;
    if (input.action === "cancel") return cancel(sql, current, null, "Gestión del paciente");
    if (input.action === "reschedule") return move(sql, current, input, null, "Solicitud del paciente", now);
    if (input.action !== "confirm") throw new HttpError(400, "Selecciona una acción válida.");
    if (current.status === "CONFIRMED") return current;
    if (current.status !== "PENDING") throw new HttpError(409, "La cita ya no se puede confirmar.");
    await sql.query("UPDATE appointments SET status='CONFIRMED' WHERE id=$1", [current.id]);
    await assign(sql, current);
    await record(sql, current.id, null, "CONFIRMED");
    await notifications(sql, current, now);
    return getAppointment(sql, "a.id", current.id);
  });
  if (!updated) throw new HttpError(410, "La retención del turno venció. Elige otro horario.");
  return asPublic(updated);
}

function staffFilter(search: URLSearchParams, user: User) {
  const professional = user.role === "ODONTOLOGO" ? user.professionalId : search.get("professionalId");
  if (!professional || professional === "any") return null;
  if (!professionals.some((person) => person.id === professional)) throw new HttpError(400, "Profesional inválido.");
  return professional;
}

export async function agenda(search: URLSearchParams, user: User) {
  const date = validatedDate(search.get("date") ?? limaDate());
  const days = search.get("days") === "7" ? 7 : 1;
  const query = [atLima(date), atLima(addDays(date, days)), staffFilter(search, user)];
  const db = await getDb();
  const { rows: appointments } = await db.query<Appointment>(rowColumns + `
    WHERE a.starts_at >= $1 AND a.starts_at < $2 AND ($3::text IS NULL OR a.professional_id=$3)
    ORDER BY a.starts_at, a.professional_id
  `, query);
  const { rows: blocks } = await db.query<Block>(`
    SELECT id, professional_id AS "professionalId", starts_at AS "startsAt", ends_at AS "endsAt", reason
    FROM agenda_blocks WHERE starts_at >= $1 AND starts_at < $2 AND ($3::text IS NULL OR professional_id=$3)
    ORDER BY starts_at
  `, query);
  return {
    appointments: appointments.map((appointment) => asAppointment(appointment)),
    blocks: blocks.map((block) => ({
      id: block.id, professionalId: block.professionalId, reason: block.reason,
      professionalName: professionals.find((person) => person.id === block.professionalId)?.name ?? "",
      date: limaDate(block.startsAt), time: limaTime(block.startsAt), endTime: limaTime(block.endsAt),
    })),
  };
}

const transitions: Record<string, string[]> = {
  CONFIRMED: ["CHECKED_IN", "NO_SHOW"], CHECKED_IN: ["IN_PROGRESS"], IN_PROGRESS: ["COMPLETED"],
};

async function createBlock(sql: Sql, input: Input, now: Date) {
  const professional = professionals.find((person) => person.id === input.professionalId);
  if (!professional) throw new HttpError(400, "Selecciona el profesional del bloqueo.");
  const date = validatedDate(input.date);
  const start = atLima(date, validatedTime(input.time));
  const end = atLima(date, validatedTime(input.endTime, "fin del bloqueo"));
  if (end <= start || end <= now) throw new HttpError(400, "El fin del bloqueo debe ser posterior al inicio y estar vigente.");
  if (await overlapping(sql, professional.id, start, end, now)) {
    throw new HttpError(409, "El bloqueo coincide con una cita o bloqueo existente.");
  }
  const id = randomUUID();
  await sql.query("INSERT INTO agenda_blocks (id,professional_id,reason,starts_at,ends_at) VALUES ($1,$2,$3,$4,$5)", [
    id, professional.id, field(input.reason, "motivo", 240), start, end,
  ]);
  return { id };
}

export async function changeAgenda(input: Input, user: User) {
  const action = field(input.action, "acción", 30);
  if (user.role === "ODONTOLOGO" && action !== "status") {
    throw new HttpError(403, "Recepción o administración gestiona estos cambios de agenda.");
  }
  return writeSchedule(async (sql, now) => {
    if (action === "block") return createBlock(sql, input, now);
    if (action === "unblock") {
      await sql.query("DELETE FROM agenda_blocks WHERE id=$1", [field(input.blockId, "bloqueo")]);
      return { ok: true };
    }
    if (action === "create") {
      const patientId = field(input.patientId, "paciente");
      if (!(await sql.query("SELECT 1 FROM patients WHERE id=$1", [patientId])).rows.length) {
        throw new HttpError(404, "No encontramos el paciente.");
      }
      const service = svc(input.serviceId);
      const timing = await chooseSlot(sql, input, service, now);
      const created = await insertAppointment(sql, { patientId, service, timing, status: "CONFIRMED" });
      await assign(sql, created);
      await record(sql, created.id, user, "CONFIRMED");
      return { appointment: asAppointment(created) };
    }
    const current = await getAppointment(sql, "a.id", field(input.appointmentId, "cita"));
    if (user.role === "ODONTOLOGO" && current.professionalId !== user.professionalId) {
      throw new HttpError(403, "La cita pertenece a otro profesional.");
    }
    if (action === "reschedule") {
      return { appointment: asAppointment(await move(sql, current, input, user, field(input.reason, "motivo", 240), now)) };
    }
    if (action === "cancel") {
      return { appointment: asAppointment(await cancel(sql, current, user, optionalField(input.reason, "motivo", 240))) };
    }
    if (action !== "status") throw new HttpError(400, "Selecciona una acción válida.");
    const status = field(input.status, "estado", 30);
    if (status === current.status) return { appointment: asAppointment(current) };
    if (!transitions[current.status]?.includes(status)) throw new HttpError(409, "Esta cita no admite ese cambio de estado.");
    await sql.query("UPDATE appointments SET status=$1 WHERE id=$2", [status, current.id]);
    if (status === "NO_SHOW") await sql.query(
      "UPDATE whatsapp_jobs SET status='CANCELADO' WHERE appointment_id=$1 AND status='PENDIENTE'", [current.id],
    );
    await record(sql, current.id, user, status);
    return { appointment: asAppointment(await getAppointment(sql, "a.id", current.id)) };
  });
}
