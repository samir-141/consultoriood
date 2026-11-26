import { randomUUID } from "node:crypto";
import { clinic, schedule } from "../config/site";
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
  id: string; patientId: string; patientName: string; patientPhone: string;
  serviceId: string; serviceName: string;
  professionalId: string; professionalName: string; status: string; priceCents: number;
  startsAt: Date; endsAt: Date; occupiedUntil: Date; expiresAt: Date | null;
  manageHash: string | null; holdRequestHash: string | null; optIn: boolean;
  dni?: string | null; reason?: string | null; reminder30mSentAt?: Date | null;
  patientAssigned?: boolean;
};
type Block = { id: string; professionalId: string; reason: string; startsAt: Date; endsAt: Date };
type Slot = { date: string; time: string; professionalId: string; professionalName: string };
type BusyInterval = {
  kind: "appointment" | "block";
  professionalId: string;
  startsAt: Date;
  endsAt: Date;
  reason: string | null;
};
export type IntervalStatus = "available" | "occupied" | "blocked" | "cutoff" | "closed";
export type DayInterval = {
  time: string;
  available: boolean;
  status: IntervalStatus;
  reason: string | null;
  professionalId: string | null;
  professionalName: string | null;
};

const rowColumns = `
  SELECT a.id, a.patient_id AS "patientId", p.name AS "patientName", p.phone AS "patientPhone",
    a.service_id AS "serviceId", a.service_name AS "serviceName",
    a.professional_id AS "professionalId", a.professional_name AS "professionalName", a.status,
    a.price_cents AS "priceCents", a.starts_at AS "startsAt", a.ends_at AS "endsAt",
    a.occupied_until AS "occupiedUntil", a.hold_expires_at AS "expiresAt",
    a.manage_hash AS "manageHash", a.hold_request_hash AS "holdRequestHash", a.opt_in AS "optIn",
    COALESCE(a.dni, p.dni) AS "dni", a.reason AS "reason", a.reminder_30m_sent_at AS "reminder30mSentAt",
    EXISTS (
      SELECT 1 FROM patient_assignments pa
      WHERE pa.patient_id = a.patient_id AND pa.professional_id = a.professional_id
    ) AS "patientAssigned"
    FROM appointments a JOIN patients p ON p.id = a.patient_id
`;
const activeCondition = `(status IN ('CONFIRMED','CHECKED_IN','IN_PROGRESS','COMPLETED')
  OR (status = 'PENDING' AND hold_expires_at > $4 AND starts_at > $4))`;
const minutes = 60_000;
export const manageLinkGraceSeconds = 24 * 60 * 60;

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

const openingTime = `${String(schedule.openingHour).padStart(2, "0")}:00`;
const closingTime = `${String(schedule.closingHour).padStart(2, "0")}:00`;

function durationTimes(date: string, time: string, service: Service) {
  const start = atLima(date, time);
  const end = new Date(start.getTime() + service.duration * minutes);
  const occupied = new Date(end.getTime() + schedule.bufferMinutes * minutes);
  return { start, end, occupied };
}

function minAdvanceInstant(now: Date) {
  return new Date(now.getTime() + schedule.minAdvanceMinutes * minutes);
}

function withinHours(date: string, start: Date, occupied: Date, now: Date) {
  const today = limaDate(now);
  return date >= today
    && date <= addDays(today, schedule.horizonDays)
    && schedule.workingDays.includes(atLima(date).getUTCDay())
    && start >= atLima(date, openingTime)
    && start >= minAdvanceInstant(now)
    && occupied <= atLima(date, closingTime);
}

function dayTimes(stepMinutes: number) {
  const times: string[] = [];
  for (let minute = schedule.openingHour * 60; minute < schedule.closingHour * 60; minute += stepMinutes) {
    times.push(String(Math.floor(minute / 60)).padStart(2, "0") + ":" + String(minute % 60).padStart(2, "0"));
  }
  return times;
}

function isWorkingBookableDate(date: string, now: Date) {
  const today = limaDate(now);
  const horizon = addDays(today, schedule.horizonDays);
  return date >= today && date <= horizon && schedule.workingDays.includes(atLima(date).getUTCDay());
}

function evaluateDayStatus(
  date: string,
  availableCount: number,
  now: Date,
  options: { allDoctorsBlocked?: boolean; hasDoctors?: boolean } = {},
) {
  const today = limaDate(now);
  const horizon = addDays(today, schedule.horizonDays);
  const isWorking = schedule.workingDays.includes(atLima(date).getUTCDay());
  const closing = atLima(date, closingTime);

  if (date < today) {
    return { reservable: false, status: "PAST" as const, walkInAvailable: false, walkInMessage: null };
  }
  if (date > horizon) {
    return { reservable: false, status: "OUT_OF_RANGE" as const, walkInAvailable: false, walkInMessage: null };
  }
  if (!isWorking) {
    return { reservable: false, status: "CLOSED" as const, walkInAvailable: false, walkInMessage: null };
  }
  if (options.hasDoctors === false) {
    return { reservable: false, status: "NO_DOCTORS" as const, walkInAvailable: false, walkInMessage: null };
  }

  const isToday = date === today;
  const clinicStillOpenToday = isToday && now < closing;

  if (availableCount > 0) {
    return {
      reservable: true,
      status: "AVAILABLE" as const,
      walkInAvailable: clinicStillOpenToday,
      walkInMessage: clinicStillOpenToday ? clinic.walkInNotice : null,
    };
  }

  if (options.allDoctorsBlocked) {
    return { reservable: false, status: "NO_DOCTORS" as const, walkInAvailable: false, walkInMessage: null };
  }

  if (isToday) {
    if (clinicStillOpenToday) {
      return {
        reservable: false,
        status: "CUTOFF_WALKIN" as const,
        walkInAvailable: true,
        walkInMessage: clinic.walkInNotice,
      };
    }
    return {
      reservable: false,
      status: "AFTER_HOURS" as const,
      walkInAvailable: false,
      walkInMessage:
        "Las reservas web de hoy finalizaron. En horario de atención también se aceptan consultas presenciales en el consultorio (con posible espera).",
    };
  }

  return { reservable: false, status: "FULL" as const, walkInAvailable: false, walkInMessage: null };
}

function asAppointment(row: Appointment, now = new Date()) {
  const deadline = row.expiresAt ? new Date(Math.min(row.expiresAt.getTime(), row.startsAt.getTime())) : null;
  const status = row.status === "PENDING" && deadline && deadline <= now ? "EXPIRED" : row.status;
  return {
    id: row.id, date: limaDate(row.startsAt), time: limaTime(row.startsAt), endTime: limaTime(row.endsAt),
    serviceId: row.serviceId, serviceName: row.serviceName, professionalId: row.professionalId,
    professionalName: row.professionalName, patientId: row.patientId, patientName: row.patientName,
    patientPhone: row.patientPhone,
    status, priceCents: row.priceCents, expiresAt: status === "PENDING" ? deadline : null,
    dni: row.dni ?? null, reason: row.reason ?? null,
    reminder30mSentAt: row.reminder30mSentAt ?? null,
    patientAssigned: row.patientAssigned ?? false,
  };
}

function asPublic(row: Appointment) {
  const { patientId, patientPhone, reminder30mSentAt, patientAssigned, ...appointment } = asAppointment(row);
  void patientId;
  void patientPhone;
  void reminder30mSentAt;
  void patientAssigned;
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
        UPDATE appointments SET status='EXPIRED'
          WHERE status='PENDING' AND (hold_expires_at <= $1 OR starts_at <= $1) RETURNING id
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

async function fetchBusyIntervals(possible: Professional[], dates: string[], now: Date) {
  const days = dates.filter((date) => isWorkingBookableDate(date, now));
  if (!days.length || !possible.length) return { days, intervals: [] as BusyInterval[] };
  const sortedDays = [...days].sort();
  const starts = atLima(sortedDays[0]);
  const ends = atLima(addDays(sortedDays[sortedDays.length - 1], 1));
  const { rows } = await (await getDb()).query<BusyInterval>(`
    SELECT 'appointment' AS kind, professional_id AS "professionalId", starts_at AS "startsAt",
           occupied_until AS "endsAt", NULL::text AS reason
      FROM appointments WHERE professional_id = ANY($1::text[]) AND starts_at < $3 AND occupied_until > $2
        AND ${activeCondition}
    UNION ALL
    SELECT 'block' AS kind, professional_id AS "professionalId", starts_at AS "startsAt",
           ends_at AS "endsAt", reason
      FROM agenda_blocks WHERE professional_id = ANY($1::text[]) AND starts_at < $3 AND ends_at > $2
  `, [possible.map((professional) => professional.id), starts, ends, now]);
  return { days, intervals: rows };
}

function extractSlotsFromIntervals(
  service: Service,
  possible: Professional[],
  days: string[],
  busyIntervals: BusyInterval[],
  now: Date,
  limit = Infinity,
  stepMinutes = schedule.slotMinutes,
) {
  const slots: Slot[] = [];
  const times = dayTimes(stepMinutes);
  for (const date of days) {
    for (const time of times) {
      const { start, occupied } = durationTimes(date, time, service);
      if (!withinHours(date, start, occupied, now)) continue;
      const professional = possible.find(({ id }) => !busyIntervals.some((interval) => interval.professionalId === id
        && start < interval.endsAt && occupied > interval.startsAt));
      if (professional) slots.push({ date, time, professionalId: professional.id, professionalName: professional.name });
      if (slots.length >= limit) return slots;
    }
  }
  return slots;
}

function isDayFullyBlocked(
  date: string,
  service: Service,
  possible: Professional[],
  busyIntervals: BusyInterval[],
  now: Date,
  stepMinutes: number,
) {
  if (!possible.length) return true;
  const blocks = busyIntervals.filter((interval) => interval.kind === "block");
  if (!blocks.length) return false;
  const appointments = busyIntervals.filter((interval) => interval.kind === "appointment");

  const today = limaDate(now);
  const opening = atLima(date, openingTime);
  const closing = atLima(date, closingTime);
  const minAdvance = minAdvanceInstant(now);

  const validDayTimings = dayTimes(stepMinutes)
    .map((time) => durationTimes(date, time, service))
    .filter(({ start, occupied }) => start >= opening && occupied <= closing);

  if (!validDayTimings.length) return false;

  const bookableTimings = date === today
    ? validDayTimings.filter(({ start }) => start >= minAdvance)
    : validDayTimings;

  const targetTimings = bookableTimings.length > 0 ? bookableTimings : validDayTimings;

  return possible.every((professional) =>
    targetTimings.every(({ start, occupied }) =>
      blocks.some((block) => block.professionalId === professional.id && start < block.endsAt && occupied > block.startsAt)
      && !appointments.some((appt) => appt.professionalId === professional.id && appt.startsAt <= start && start < appt.endsAt),
    ),
  );
}

function buildDayIntervals(
  date: string,
  service: Service,
  possible: Professional[],
  busyIntervals: BusyInterval[],
  now: Date,
  stepMinutes: number,
): DayInterval[] {
  const today = limaDate(now);
  const horizon = addDays(today, schedule.horizonDays);
  const isWorking = schedule.workingDays.includes(atLima(date).getUTCDay());
  const times = dayTimes(stepMinutes);

  if (date < today) {
    return times.map((time) => ({
      time, available: false, status: "closed", reason: "Fecha pasada",
      professionalId: null, professionalName: null,
    }));
  }
  if (date > horizon) {
    return times.map((time) => ({
      time, available: false, status: "closed", reason: "Fuera del horizonte de reservas",
      professionalId: null, professionalName: null,
    }));
  }
  if (!isWorking) {
    return times.map((time) => ({
      time, available: false, status: "closed", reason: "Día no laborable",
      professionalId: null, professionalName: null,
    }));
  }
  if (!possible.length) {
    return times.map((time) => ({
      time, available: false, status: "closed", reason: "Sin profesionales disponibles",
      professionalId: null, professionalName: null,
    }));
  }

  const opening = atLima(date, openingTime);
  const closing = atLima(date, closingTime);
  const minAdvance = minAdvanceInstant(now);
  const possibleIds = new Set(possible.map((professional) => professional.id));

  return times.map((time) => {
    const { start, occupied } = durationTimes(date, time, service);

    if (date === today && start < minAdvance) {
      return {
        time,
        available: false,
        status: "cutoff",
        reason: "Requiere 15 min de anticipación",
        professionalId: null,
        professionalName: null,
      };
    }

    const freeProfessional = possible.find(({ id }) =>
      !busyIntervals.some((interval) =>
        interval.professionalId === id && start < interval.endsAt && occupied > interval.startsAt,
      ),
    );

    if (!freeProfessional) {
      const overlappingIntervals = busyIntervals
        .filter((interval) =>
          possibleIds.has(interval.professionalId) && start < interval.endsAt && occupied > interval.startsAt,
        )
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

      const coveringStart = overlappingIntervals.filter(
        (interval) => interval.startsAt <= start && start < interval.endsAt,
      );
      const relevant = coveringStart.length > 0 ? coveringStart : overlappingIntervals;
      const appointmentHit = relevant.find((interval) => interval.kind === "appointment");
      const blockHit = relevant.find((interval) => interval.kind === "block");

      if (appointmentHit) {
        return {
          time,
          available: false,
          status: "occupied",
          reason: "Horario reservado",
          professionalId: null,
          professionalName: null,
        };
      }
      if (blockHit) {
        return {
          time,
          available: false,
          status: "blocked",
          reason: "Cirugía / Horario bloqueado",
          professionalId: null,
          professionalName: null,
        };
      }
    }

    if (start < opening || occupied > closing) {
      return {
        time,
        available: false,
        status: "cutoff",
        reason: "No alcanza la duración del servicio antes del cierre",
        professionalId: null,
        professionalName: null,
      };
    }

    if (freeProfessional) {
      return {
        time,
        available: true,
        status: "available",
        reason: null,
        professionalId: freeProfessional.id,
        professionalName: freeProfessional.name,
      };
    }

    return {
      time,
      available: false,
      status: "occupied",
      reason: "Horario reservado",
      professionalId: null,
      professionalName: null,
    };
  });
}

async function availableSlots(
  service: Service,
  possible: Professional[],
  dates: string[],
  now: Date,
  limit = Infinity,
  stepMinutes = schedule.slotMinutes,
) {
  const { days, intervals } = await fetchBusyIntervals(possible, dates, now);
  if (!days.length) return [];
  return extractSlotsFromIntervals(service, possible, days, intervals, now, limit, stepMinutes);
}

export async function availability(search: URLSearchParams) {
  const service = svc(search.get("serviceId"));
  const possible = candidates(search.get("professionalId") ?? "any", service);
  const date = validatedDate(search.get("date"));
  return availableSlots(service, possible, [date], new Date());
}

export async function dailyReservasAvailability(search: URLSearchParams) {
  const serviceParam = search.get("servicio") ?? search.get("serviceId") ?? services[0].id;
  const service = svc(serviceParam);
  const preference = search.get("profesional") ?? search.get("professionalId") ?? "any";
  const possible = candidates(preference, service);
  const rawDate = search.get("fecha") ?? search.get("date") ?? limaDate();
  const date = validatedDate(rawDate);
  const now = new Date();
  const stepMinutes = schedule.displayStepMinutes;

  const { days, intervals: busyIntervals } = await fetchBusyIntervals(possible, [date], now);
  const intervalos = buildDayIntervals(date, service, possible, busyIntervals, now, stepMinutes);
  const slots: Slot[] = intervalos
    .filter((item): item is DayInterval & { professionalId: string; professionalName: string } =>
      item.available && item.professionalId !== null && item.professionalName !== null,
    )
    .map((item) => ({
      date,
      time: item.time,
      professionalId: item.professionalId,
      professionalName: item.professionalName,
    }));
  const allDoctorsBlocked = days.length > 0
    ? isDayFullyBlocked(date, service, possible, busyIntervals, now, stepMinutes)
    : false;
  const dayState = evaluateDayStatus(date, slots.length, now, {
    allDoctorsBlocked,
    hasDoctors: possible.length > 0,
  });

  const occupiedSlots = intervalos.filter((item) => !item.available).map((item) => item.time);

  return {
    fecha: date,
    date,
    servicio: service.id,
    serviceId: service.id,
    profesional: preference,
    professionalId: preference,
    reservable: dayState.reservable,
    estadoDia: dayState.status,
    minAdvanceMinutes: schedule.minAdvanceMinutes,
    walkInDisponible: dayState.walkInAvailable,
    mensajeWalkIn: dayState.walkInMessage,
    horariosDisponibles: slots.map((s) => s.time),
    horariosOcupados: occupiedSlots,
    intervalos,
    slots,
  };
}

export async function monthlyReservasAvailability(search: URLSearchParams) {
  const serviceParam = search.get("servicio") ?? search.get("serviceId") ?? services[0].id;
  const service = svc(serviceParam);
  const preference = search.get("profesional") ?? search.get("professionalId") ?? "any";
  const possible = candidates(preference, service);
  const now = new Date();
  const today = limaDate(now);
  const monthParam = search.get("mes") ?? search.get("month") ?? today.slice(0, 7);
  const stepMinutes = schedule.displayStepMinutes;

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) || !validDate(`${monthParam}-01`)) {
    throw new HttpError(400, "El mes debe ser válido y tener formato YYYY-MM.");
  }

  const year = Number(monthParam.slice(0, 4));
  const monthIndex = Number(monthParam.slice(5, 7)) - 1;
  const totalDays = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const monthDates = Array.from({ length: totalDays }, (_, idx) => `${monthParam}-${String(idx + 1).padStart(2, "0")}`);

  const { days: workingMonthDates, intervals: busyIntervals } = await fetchBusyIntervals(possible, monthDates, now);
  const workingSet = new Set(workingMonthDates);
  const monthSlots = extractSlotsFromIntervals(
    service,
    possible,
    workingMonthDates,
    busyIntervals,
    now,
    Infinity,
    stepMinutes,
  );
  const counts = new Map<string, number>();
  for (const slot of monthSlots) {
    counts.set(slot.date, (counts.get(slot.date) ?? 0) + 1);
  }

  const days: Record<
    string,
    { date: string; availableCount: number; reservable: boolean; status: string; walkInAvailable: boolean }
  > = {};

  for (const date of monthDates) {
    const count = counts.get(date) ?? 0;
    let allDoctorsBlocked = false;
    if (count === 0 && workingSet.has(date)) {
      const dayStart = atLima(date);
      const dayEnd = atLima(addDays(date, 1));
      const dayBusy = busyIntervals.filter((interval) => interval.startsAt < dayEnd && interval.endsAt > dayStart);
      allDoctorsBlocked = isDayFullyBlocked(date, service, possible, dayBusy, now, stepMinutes);
    }
    const state = evaluateDayStatus(date, count, now, {
      allDoctorsBlocked,
      hasDoctors: possible.length > 0,
    });
    days[date] = {
      date,
      availableCount: count,
      reservable: state.reservable,
      status: state.status,
      walkInAvailable: state.walkInAvailable,
    };
  }

  let nextAvailableDate =
    monthDates.find((d) => d >= today && (counts.get(d) ?? 0) > 0) ?? null;

  if (!nextAvailableDate) {
    const upcomingDates = Array.from({ length: 30 }, (_, offset) => addDays(today, offset));
    const [nextSlot] = await availableSlots(service, possible, upcomingDates, now, 1, stepMinutes);
    nextAvailableDate = nextSlot?.date ?? null;
  }

  let todayState: ReturnType<typeof evaluateDayStatus>;
  if (days[today]) {
    todayState = evaluateDayStatus(today, days[today].availableCount, now, {
      allDoctorsBlocked: days[today].status === "NO_DOCTORS",
      hasDoctors: possible.length > 0,
    });
  } else {
    const { days: todayWorking, intervals: todayBusy } = await fetchBusyIntervals(possible, [today], now);
    const todaySlots = extractSlotsFromIntervals(service, possible, todayWorking, todayBusy, now, Infinity, stepMinutes);
    const todayAllBlocked = todayWorking.length > 0
      ? isDayFullyBlocked(today, service, possible, todayBusy, now, stepMinutes)
      : false;
    todayState = evaluateDayStatus(today, todaySlots.length, now, {
      allDoctorsBlocked: todayAllBlocked,
      hasDoctors: possible.length > 0,
    });
  }

  return {
    mes: monthParam,
    month: monthParam,
    today,
    servicio: service.id,
    serviceId: service.id,
    profesional: preference,
    professionalId: preference,
    minAdvanceMinutes: schedule.minAdvanceMinutes,
    nextAvailableDate,
    todayStatus: todayState.status,
    walkInToday: todayState.walkInAvailable,
    walkInMessage: todayState.walkInMessage,
    days,
  };
}

export async function nextAvailability(search: URLSearchParams) {
  const service = svc(search.get("serviceId"));
  const now = new Date();
  const today = limaDate(now);
  const dates = Array.from({ length: 7 }, (_, offset) => addDays(today, offset));
  const [slot] = await availableSlots(service, candidates("any", service), dates, now, 1);
  return slot ?? null;
}

async function chooseSlot(sql: Sql, input: Input, service: Service, now: Date) {
  const date = validatedDate(input.date);
  const time = validatedTime(input.time);
  const timing = durationTimes(date, time, service);
  const today = limaDate(now);
  const isWorkingDay = schedule.workingDays.includes(atLima(date).getUTCDay());
  const opening = atLima(date, openingTime);
  const closing = atLima(date, closingTime);
  const minAdvance = minAdvanceInstant(now);

  if (
    date === today
    && isWorkingDay
    && timing.start >= opening
    && timing.occupied <= closing
    && timing.start > now
    && timing.start < minAdvance
  ) {
    throw new HttpError(
      409,
      `Las reservas web requieren al menos ${schedule.minAdvanceMinutes} minutos de anticipación. ${clinic.walkInNotice}`,
    );
  }

  if (!withinHours(date, timing.start, timing.occupied, now) || Number(time.slice(3)) % schedule.slotMinutes !== 0) {
    throw new HttpError(409, "Ese turno queda fuera de los horarios de reserva o el día ya no admite reservas web.");
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
  status: "CONFIRMED" | "PENDING"; hash?: string | null; requestHash?: string | null;
  expiresAt?: Date; optIn?: boolean; previous?: Appointment;
  dni?: string | null; reason?: string | null;
}) {
  const id = randomUUID();
  const { timing, service, previous } = details;
  await sql.query(`
    INSERT INTO appointments (id,patient_id,service_id,service_name,professional_id,professional_name,
      starts_at,ends_at,occupied_until,price_cents,status,hold_expires_at,manage_hash,opt_in,previous_id,hold_request_hash,dni,reason)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
  `, [id, details.patientId, service.id, service.name, timing.professional.id, timing.professional.name,
    timing.start, timing.end, timing.occupied, previous?.priceCents ?? service.priceCents,
    details.status, details.expiresAt ?? null, details.hash ?? null, details.optIn ?? false, previous?.id ?? null,
    details.requestHash ?? null, details.dni ?? null, details.reason ?? null]);
  return getAppointment(sql, "a.id", id);
}

export async function hold(input: Input, idempotencyKey: string | null = null) {
  const patient = patientFields(input);
  const service = svc(input.serviceId);
  const optIn = input.whatsappOptIn === true;
  const date = validatedDate(input.date);
  const time = validatedTime(input.time);
  const preference = input.professionalId ?? "any";
  candidates(preference, service);
  const dniRaw = optionalField(input.dni, "DNI", 20);
  const dni = dniRaw
    ?? (typeof input.phone === "string" && /^\d{8}$/.test(input.phone.trim()) ? input.phone.trim() : null);
  const reason = optionalField(input.reason ?? input.motivo, "motivo", 500);

  if (idempotencyKey !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    throw new HttpError(400, "La referencia de la reserva no es válida.");
  }
  const key = idempotencyKey?.toLowerCase();
  // Keep the request fingerprint independent of later edits to the patient's contact details.
  const patientId = key
    ? "hold-" + await bookingToken("idempotency:" + key)
    : randomUUID();
  const token = await bookingToken(patientId);
  const requestHash = key
    ? await bookingToken("hold-input:" + JSON.stringify([key, service.id, date, time, preference, patient, optIn]))
    : null;
  const hash = digest(token);
  return writeSchedule(async (sql, now) => {
    if (key) {
      const { rows } = await sql.query<Appointment>(rowColumns + " WHERE a.manage_hash=$1", [hash]);
      const prior = rows[0];
      if (prior) {
        if (prior.holdRequestHash === requestHash && prior.expiresAt && (prior.status === "PENDING" || prior.status === "CONFIRMED")) {
          ensureActiveLink(prior, now);
          return { appointment: asPublic(prior), token, expiresAt: prior.expiresAt };
        }
        throw new HttpError(409, "La referencia corresponde a otra reserva o a un turno que ya terminó.");
      }
    }
    const timing = await chooseSlot(sql, input, service, now);
    const expiresAt = new Date(Math.min(now.getTime() + 10 * minutes, timing.start.getTime()));
    await sql.query("INSERT INTO patients (id,name,phone,email,dni) VALUES ($1,$2,$3,$4,$5)", [
      patientId, patient.name, patient.phone, patient.email, dni,
    ]);
    const appointment = await insertAppointment(sql, {
      patientId, service, timing, expiresAt, hash, requestHash, optIn, status: "PENDING", dni, reason,
    });
    await record(sql, appointment.id, null, "PENDING");
    return { appointment: asPublic(appointment), token, expiresAt };
  });
}

function validToken(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new HttpError(404, "El enlace de gestión no es válido.");
  return digest(token);
}

function ensureActiveLink(appointment: Appointment, now: Date) {
  if (now.getTime() >= appointment.endsAt.getTime() + manageLinkGraceSeconds * 1000) {
    throw new HttpError(410, "El enlace de gestión venció. Contacta a recepción si necesitas ayuda.");
  }
}

export async function patientAppointment(token: string) {
  const hash = validToken(token);
  const current = await getAppointment(await getDb(), "a.manage_hash", hash);
  ensureActiveLink(current, new Date());
  return asPublic(current);
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
    dni: current.dni ?? null, reason: current.reason ?? null,
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
    ensureActiveLink(current, now);
    if (current.status === "EXPIRED") return null;
    if (input.action !== "confirm" && input.action !== "cancel" && input.action !== "reschedule") {
      throw new HttpError(400, "Selecciona una acción válida.");
    }
    if ((input.action === "confirm" && current.status === "CONFIRMED")
        || (input.action === "cancel" && current.status === "CANCELLED")) return current;
    if (current.startsAt <= now) throw new HttpError(409, "El turno ya comenzó. Contacta a recepción.");
    if (input.action === "cancel") return cancel(sql, current, null, "Gestión del paciente");
    if (input.action === "reschedule") return move(sql, current, input, null, "Solicitud del paciente", now);
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
  const requested = search.get("professionalId");
  if (user.role === "ODONTOLOGO") {
    if (requested && requested !== "any" && requested !== user.professionalId) {
      if (!professionals.some((person) => person.id === requested)) {
        throw new HttpError(400, "Profesional inválido.");
      }
      throw new HttpError(403, "No puedes consultar la agenda de otro profesional.");
    }
    if (!user.professionalId || !professionals.some((person) => person.id === user.professionalId)) {
      throw new HttpError(403, "Tu cuenta no tiene una agenda profesional asignada.");
    }
    return user.professionalId;
  }
  if (!requested || requested === "any") return null;
  if (!professionals.some((person) => person.id === requested)) throw new HttpError(400, "Profesional inválido.");
  return requested;
}

export async function agenda(search: URLSearchParams, user: User) {
  const date = validatedDate(search.get("date") ?? limaDate());
  const daysParam = search.get("days");
  if (daysParam !== null && daysParam !== "1" && daysParam !== "7") {
    throw new HttpError(400, "Rango de días inválido.");
  }
  const days = daysParam === "7" ? 7 : 1;
  const professionalId = staffFilter(search, user);
  const query = [atLima(date), atLima(addDays(date, days)), professionalId];
  const db = await getDb();
  const assignmentScope = user.role === "ODONTOLOGO"
    ? `AND a.status NOT IN ('PENDING', 'EXPIRED')
       AND EXISTS (
         SELECT 1 FROM patient_assignments pa
         WHERE pa.patient_id = a.patient_id AND pa.professional_id = a.professional_id
       )`
    : "";
  const { rows: appointments } = await db.query<Appointment>(rowColumns + `
    WHERE a.starts_at >= $1 AND a.starts_at < $2 AND ($3::text IS NULL OR a.professional_id=$3)
      ${assignmentScope}
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

const agendaActions = new Set(["block", "unblock", "create", "reschedule", "cancel", "mark_reminder_30m", "status"]);
const validStatuses = new Set([
  "PENDING", "CONFIRMED", "CANCELLED", "EXPIRED", "RESCHEDULED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "NO_SHOW",
]);

export async function changeAgenda(input: Input, user: User) {
  const action = field(input.action, "acción", 30);
  if (!agendaActions.has(action)) {
    throw new HttpError(400, "Selecciona una acción válida.");
  }
  if (user.role === "ODONTOLOGO" && !["status", "block", "unblock", "mark_reminder_30m"].includes(action)) {
    throw new HttpError(403, "Recepción o administración gestiona estos cambios de agenda.");
  }
  return writeSchedule(async (sql, now) => {
    if (action === "block") {
      if (user.role === "ODONTOLOGO" && (!user.professionalId || input.professionalId !== user.professionalId)) {
        throw new HttpError(403, "Solo puedes bloquear tu propia agenda.");
      }
      return createBlock(sql, input, now);
    }
    if (action === "unblock") {
      const blockId = field(input.blockId, "bloqueo");
      if (user.role === "ODONTOLOGO") {
        const { rows } = await sql.query<{ professionalId: string }>(
          'SELECT professional_id AS "professionalId" FROM agenda_blocks WHERE id = $1',
          [blockId],
        );
        if (!rows.length) {
          throw new HttpError(404, "No encontramos el bloqueo.");
        }
        if (rows[0].professionalId !== user.professionalId) {
          throw new HttpError(403, "El bloqueo pertenece a otro profesional.");
        }
      }
      await sql.query("DELETE FROM agenda_blocks WHERE id=$1", [blockId]);
      return { ok: true };
    }
    if (action === "create") {
      const patientId = field(input.patientId, "paciente", 120);
      if (!/^[A-Za-z0-9_-]+$/.test(patientId)) {
        throw new HttpError(400, "Identificador de paciente no válido.");
      }
      const { rows: patientRows } = await sql.query<{ dni: string | null }>(
        "SELECT dni FROM patients WHERE id=$1",
        [patientId],
      );
      if (!patientRows.length) {
        throw new HttpError(404, "No encontramos el paciente.");
      }
      const service = svc(input.serviceId);
      const timing = await chooseSlot(sql, input, service, now);
      const reason = optionalField(input.reason, "motivo", 500);
      const created = await insertAppointment(sql, {
        patientId, service, timing, status: "CONFIRMED", dni: patientRows[0].dni, reason,
      });
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
    if (action === "mark_reminder_30m") {
      if (["CANCELLED", "EXPIRED", "RESCHEDULED", "NO_SHOW", "COMPLETED"].includes(current.status)) {
        throw new HttpError(409, "Esta cita ya no admite aviso de recordatorio.");
      }
      await sql.query(
        "UPDATE appointments SET reminder_30m_sent_at = COALESCE(reminder_30m_sent_at, $1) WHERE id = $2",
        [now, current.id],
      );
      if (!current.reminder30mSentAt) {
        await record(sql, current.id, user, "REMINDER_30M");
      }
      return { appointment: asAppointment(await getAppointment(sql, "a.id", current.id)) };
    }
    const status = field(input.status, "estado", 30);
    if (!validStatuses.has(status)) {
      throw new HttpError(400, "Estado de cita no válido.");
    }
    if (status === current.status) return { appointment: asAppointment(current) };
    if (!transitions[current.status]?.includes(status)) throw new HttpError(409, "Esta cita no admite ese cambio de estado.");
    if (status === "NO_SHOW" && current.startsAt > now) {
      throw new HttpError(409, "La inasistencia se registra a partir de la hora de la cita.");
    }
    await sql.query("UPDATE appointments SET status=$1 WHERE id=$2", [status, current.id]);
    if (status === "NO_SHOW") await sql.query(
      "UPDATE whatsapp_jobs SET status='CANCELADO' WHERE appointment_id=$1 AND status='PENDIENTE'", [current.id],
    );
    await record(sql, current.id, user, status);
    return { appointment: asAppointment(await getAppointment(sql, "a.id", current.id)) };
  });
}
