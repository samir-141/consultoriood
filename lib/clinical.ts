import { randomUUID } from "node:crypto";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { HttpError, readJson } from "@/lib/http";
import { privateDownload, privateJson, readClinicalUpload, type PrivateFile } from "@/lib/clinical-files";
import { mergeClinicalHistory, validateClinicalHistoryPayload, type ClinicalHistoryData } from "@/lib/clinical-history";
import { integerBetween, oneOf, optionalId, optionalText, requiredId, requiredText, toothNumber } from "@/lib/clinical-validation";

type Staff = Awaited<ReturnType<typeof requireUser>>;
type Query = Pick<PGlite, "query">;
type Patient = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  dni: string | null;
  birthDate: string | null;
  background: string;
};
type PlanItem = { id: string; tooth: number | null; procedure: string; priceCents: number; status: string; planId: string };
type Plan = { id: string; title: string; status: string; createdAt: Date };
type ClinicalResult = { response: Response; resourceId?: string };
type AuditResult = "OK" | "DENIED" | "ERROR";

const planStatuses = ["DRAFT", "PROPOSED", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
const clinicalActions = ["note", "odontogram", "plan", "plan-status", "consent", "background", "history"] as const;
const noBody = () => null;
let historySchemaReady: Promise<void> | null = null;

async function ensureHistorySchema(db: PGlite) {
  historySchemaReady ??= (async () => {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS clinical_histories (
        patient_id TEXT PRIMARY KEY REFERENCES patients(id),
        record_number TEXT NOT NULL DEFAULT '',
        attention_date DATE,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_by TEXT REFERENCES users(id),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS clinical_history_revisions (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL REFERENCES patients(id),
        author_id TEXT NOT NULL REFERENCES users(id),
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS clinical_history_revisions_patient
        ON clinical_history_revisions (patient_id, created_at DESC);
    `);
  })().catch((err) => {
    historySchemaReady = null;
    throw err;
  });
  await historySchemaReady;
}

async function recordAudit(
  db: Query,
  actorId: string | null,
  patientId: string,
  action: string,
  result: AuditResult,
  resourceId: string | null,
) {
  await db.query(`
    INSERT INTO clinical_audit (id, actor_id, patient_id, action, result, resource_id)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [randomUUID(), actorId, patientId, action, result, resourceId]);
}

async function requireAssignment(db: Query, user: Staff, patientId: string, lock = false) {
  if (user.role !== "ODONTOLOGO") return;
  const assignment = await db.query(`
    SELECT 1 FROM patient_assignments
    WHERE patient_id = $1 AND professional_id = $2
    ${lock ? "FOR SHARE" : ""}
  `, [patientId, user.professionalId]);
  if (!assignment.rows.length) throw new HttpError(403, "El paciente no está asignado a tu atención.");
}

async function withClinicalRecord<T>(
  request: Request,
  id: string,
  action: string,
  prepare: () => T | Promise<T>,
  work: (tx: Transaction, user: Staff, patient: Patient, input: T) => Promise<ClinicalResult>,
  resourceId: string | null = null,
) {
  let actorId: string | null = null;
  let patientId: string | null = null;
  let patientExists = false;
  try {
    const user = await requireUser(request);
    actorId = user.id;
    if (user.role !== "ADMIN" && user.role !== "ODONTOLOGO") {
      throw new HttpError(403, "Tu rol no tiene acceso a la ficha clínica.");
    }
    patientId = requiredId(id, "el paciente");
    const db = await getDb();
    await ensureHistorySchema(db);
    if (prepare !== noBody) {
      const existsPre = await db.query("SELECT 1 FROM patients WHERE id = $1", [patientId]);
      if (!existsPre.rows.length) throw new HttpError(404, "No se encontró al paciente.");
      patientExists = true;
      await requireAssignment(db, user, patientId);
    }
    const input = await prepare();
    return await db.transaction(async (tx) => {
      const { rows } = await tx.query<Patient>(`
        SELECT id, name, phone, email, dni, birth_date::text AS "birthDate", background
        FROM patients WHERE id = $1
      `, [patientId]);
      const patient = rows[0];
      if (!patient) throw new HttpError(404, "No se encontró al paciente.");
      patientExists = true;
      await requireAssignment(tx, user, patientId!, true);
      const result = await work(tx, user, patient, input);
      await recordAudit(tx, actorId, patientId!, action, "OK", result.resourceId ?? resourceId);
      return result.response;
    });
  } catch (error) {
    if (actorId && patientId && patientExists) {
      const denial = error instanceof HttpError && error.status === 403;
      await recordAudit(await getDb(), actorId, patientId, action, denial ? "DENIED" : "ERROR", resourceId)
        .catch(() => undefined);
    }
    throw error;
  }
}

export async function readClinicalRecord(request: Request, id: string) {
  return withClinicalRecord(request, id, "READ_RECORD", noBody, async (tx, user, patient) => {
    const args = [patient.id];
    const { rows: appointments } = await tx.query(`
      SELECT id, patient_id AS "patientId", $2::text AS "patientName",
        professional_id AS "professionalId", professional_name AS "professionalName",
        service_id AS "serviceId", service_name AS "serviceName",
        to_char(starts_at AT TIME ZONE 'America/Lima', 'YYYY-MM-DD') AS date,
        to_char(starts_at AT TIME ZONE 'America/Lima', 'HH24:MI') AS time,
        to_char(ends_at AT TIME ZONE 'America/Lima', 'HH24:MI') AS "endTime",
        status, price_cents AS "priceCents"
      FROM appointments WHERE patient_id = $1 AND status NOT IN ('PENDING', 'EXPIRED')
      ORDER BY starts_at DESC
    `, [patient.id, patient.name]);
    const { rows: notes } = await tx.query(`
      SELECT n.id, n.appointment_id AS "appointmentId", n.reason, n.findings, n.procedure, n.instructions,
        n.amends_id AS "amendsId", n.created_at AS "createdAt", u.name AS "authorName"
      FROM clinical_notes n JOIN users u ON u.id = n.author_id
      WHERE n.patient_id = $1 ORDER BY n.created_at DESC, n.id
    `, args);
    const { rows: odontogram } = await tx.query(`
      SELECT id, tooth, surface, status, observation, created_at AS "createdAt"
      FROM clinical_odontogram WHERE patient_id = $1 ORDER BY created_at DESC, id
    `, args);
    const { rows: planRows } = await tx.query<Plan>(`
      SELECT id, title, status, created_at AS "createdAt"
      FROM treatment_plans WHERE patient_id = $1 ORDER BY created_at DESC, id
    `, args);
    const { rows: planItems } = await tx.query<PlanItem>(`
      SELECT i.id, plan_id AS "planId", tooth, procedure, price_cents AS "priceCents", i.status
      FROM treatment_plan_items i JOIN treatment_plans p ON p.id = i.plan_id
      WHERE p.patient_id = $1 ORDER BY i.position
    `, args);
    const plans = planRows.map((plan) => {
      const items = planItems.filter((item) => item.planId === plan.id);
      return { ...plan, totalCents: items.reduce((total, item) => total + item.priceCents, 0), items };
    });
    const { rows: consents } = await tx.query(`
      SELECT id, type, status, created_at AS "createdAt"
      FROM clinical_consents WHERE patient_id = $1 ORDER BY created_at DESC, id
    `, args);
    const { rows: attachments } = await tx.query(`
      SELECT id, name, mime, size, created_at AS "createdAt"
      FROM clinical_attachments WHERE patient_id = $1 ORDER BY created_at DESC, id
    `, args);
    const { rows: historyRows } = await tx.query<{
      data: Partial<ClinicalHistoryData>;
      updatedAt: string;
      updatedByName: string | null;
    }>(`
      SELECT h.data, h.updated_at AS "updatedAt", u.name AS "updatedByName"
      FROM clinical_histories h
      LEFT JOIN users u ON u.id = h.updated_by
      WHERE h.patient_id = $1
    `, args);
    const savedHistory = historyRows[0];
    const history = mergeClinicalHistory(savedHistory?.data, patient);
    const audit = user.role === "ADMIN" ? (await tx.query(`
      SELECT a.id, a.action, a.result, a.created_at AS "createdAt", COALESCE(u.name, 'Sin sesión') AS "actorName"
      FROM clinical_audit a LEFT JOIN users u ON u.id = a.actor_id
      WHERE a.patient_id = $1 ORDER BY a.created_at DESC, a.id LIMIT 100
    `, args)).rows : [];
    return {
      response: privateJson({
        patient: { ...patient, consents },
        history,
        historyMeta: savedHistory
          ? { updatedAt: savedHistory.updatedAt, updatedByName: savedHistory.updatedByName }
          : null,
        appointments,
        notes,
        odontogram,
        plans,
        attachments,
        audit,
      }),
    };
  });
}

async function storeNote(tx: Transaction, user: Staff, patient: Patient, body: Record<string, unknown>) {
  const appointmentId = requiredId(body.appointmentId, "la cita");
  const amendsId = optionalId(body.amendsId, "la nota anterior");
  const reason = requiredText(body.reason, "el motivo de atención", 800);
  const findings = optionalText(body.findings, "los hallazgos", 3000);
  const procedure = optionalText(body.procedure, "el procedimiento", 3000);
  const instructions = optionalText(body.instructions, "las indicaciones", 3000);
  const { rows: appointments } = await tx.query<{ professionalId: string; status: string }>(`
    SELECT professional_id AS "professionalId", status
    FROM appointments WHERE id = $1 AND patient_id = $2 FOR UPDATE
  `, [appointmentId, patient.id]);
  const appointment = appointments[0];
  if (!appointment) throw new HttpError(404, "La cita no pertenece al paciente.");
  if (user.role === "ODONTOLOGO" && appointment.professionalId !== user.professionalId) {
    throw new HttpError(403, "Solo puedes registrar notas en tus citas.");
  }
  if (["PENDING", "EXPIRED", "CANCELLED", "RESCHEDULED", "NO_SHOW"].includes(appointment.status)) {
    throw new HttpError(409, "La cita no admite una nota de atención.");
  }

  if (amendsId) {
    const { rows } = await tx.query(`
      SELECT 1 FROM clinical_notes n
      WHERE n.id = $1 AND n.patient_id = $2 AND n.appointment_id = $3
      AND NOT EXISTS (SELECT 1 FROM clinical_notes newer WHERE newer.amends_id = n.id)
    `, [amendsId, patient.id, appointmentId]);
    if (!rows.length) throw new HttpError(409, "La enmienda debe referirse a la última nota de esta cita.");
  } else {
    const { rows } = await tx.query("SELECT 1 FROM clinical_notes WHERE appointment_id = $1", [appointmentId]);
    if (rows.length) throw new HttpError(409, "La cita ya tiene una nota. Registra una enmienda.");
  }

  const id = randomUUID();
  await tx.query(`
    INSERT INTO clinical_notes (id, patient_id, appointment_id, author_id, reason, findings, procedure, instructions, amends_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  `, [id, patient.id, appointmentId, user.id, reason, findings, procedure, instructions, amendsId]);
  return id;
}

async function storePlan(tx: Transaction, user: Staff, patient: Patient, body: Record<string, unknown>) {
  const title = requiredText(body.title, "el título del plan", 160);
  const status = oneOf(body.status ?? "PROPOSED", planStatuses, "el estado del plan");
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 40) {
    throw new HttpError(400, "Agrega entre 1 y 40 tratamientos al plan.");
  }
  const items = body.items.map((raw: unknown) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new HttpError(400, "Revisa los tratamientos del plan.");
    const item = raw as Record<string, unknown>;
    return {
      tooth: item.tooth == null || item.tooth === "" ? null : toothNumber(item.tooth),
      procedure: requiredText(item.procedure, "el tratamiento", 250),
      priceCents: integerBetween(item.priceCents, "el precio en céntimos", 0, 999_999_999),
      status: optionalText(item.status, "el estado del tratamiento", 40) || "PENDING",
    };
  });
  const id = randomUUID();
  await tx.query(`
    INSERT INTO treatment_plans (id, patient_id, author_id, title, status)
    VALUES ($1, $2, $3, $4, $5)
  `, [id, patient.id, user.id, title, status]);
  for (const [position, item] of items.entries()) {
    await tx.query(`
      INSERT INTO treatment_plan_items (id, plan_id, position, tooth, procedure, price_cents, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [randomUUID(), id, position, item.tooth, item.procedure, item.priceCents, item.status]);
  }
  return id;
}

export async function writeClinicalRecord(request: Request, id: string) {
  return withClinicalRecord(request, id, "WRITE_RECORD", () => readJson(request), async (tx, user, patient, body) => {
    const action = oneOf(body.action, clinicalActions, "la operación clínica");
    let resourceId: string = randomUUID();
    switch (action) {
      case "note":
        resourceId = await storeNote(tx, user, patient, body);
        break;
      case "odontogram":
        await tx.query(`
          INSERT INTO clinical_odontogram (id,patient_id,author_id,tooth,surface,status,observation)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
        `, [resourceId, patient.id, user.id, toothNumber(body.tooth), requiredText(body.surface, "la superficie", 50),
          requiredText(body.status, "el estado de la pieza", 50), optionalText(body.observation, "la observación", 1200)]);
        break;
      case "plan":
        resourceId = await storePlan(tx, user, patient, body);
        break;
      case "plan-status": {
        resourceId = requiredId(body.planId, "el plan");
        const status = oneOf(body.status, planStatuses, "el estado del plan");
        const { rows } = await tx.query(`
          UPDATE treatment_plans SET status = $3 WHERE id = $1 AND patient_id = $2 RETURNING id
        `, [resourceId, patient.id, status]);
        if (!rows.length) throw new HttpError(404, "No se encontró el plan.");
        break;
      }
      case "consent":
        await tx.query(`
          INSERT INTO clinical_consents (id,patient_id,author_id,type,status) VALUES ($1,$2,$3,$4,$5)
        `, [resourceId, patient.id, user.id, requiredText(body.type, "el tipo de consentimiento", 100),
          requiredText(body.status, "el estado del consentimiento", 50)]);
        break;
      case "background":
        resourceId = patient.id;
        await tx.query("UPDATE patients SET background = $2 WHERE id = $1", [
          patient.id, optionalText(body.background, "los antecedentes clínicos", 5000),
        ]);
        break;
      case "history": {
        const validated = validateClinicalHistoryPayload(body.history);
        const revisionId = randomUUID();
        resourceId = revisionId;
        await tx.query(`
          INSERT INTO clinical_histories (patient_id, record_number, attention_date, data, updated_by, updated_at)
          VALUES ($1, $2, NULLIF($3, '')::date, $4::jsonb, $5, now())
          ON CONFLICT (patient_id) DO UPDATE SET
            record_number = EXCLUDED.record_number,
            attention_date = EXCLUDED.attention_date,
            data = EXCLUDED.data,
            updated_by = EXCLUDED.updated_by,
            updated_at = now()
        `, [
          patient.id,
          validated.recordNumber,
          validated.attentionDate,
          JSON.stringify(validated),
          user.id,
        ]);
        await tx.query(`
          INSERT INTO clinical_history_revisions (id, patient_id, author_id, data)
          VALUES ($1, $2, $3, $4::jsonb)
        `, [revisionId, patient.id, user.id, JSON.stringify(validated)]);

        if (validated.filiation.dni || validated.background.personalHistory) {
          await tx.query(`
            UPDATE patients
            SET
              dni = COALESCE(NULLIF($2, ''), dni),
              background = COALESCE(NULLIF($3, ''), background)
            WHERE id = $1
          `, [patient.id, validated.filiation.dni, validated.background.personalHistory]);
        }
        break;
      }
    }
    return { response: privateJson({ id: resourceId }, 201), resourceId };
  });
}

export async function uploadClinicalAttachment(request: Request, id: string) {
  return withClinicalRecord(request, id, "UPLOAD_ATTACHMENT", () => readClinicalUpload(request), async (tx, user, patient, file) => {
    const resourceId = randomUUID();
    await tx.query(`
      INSERT INTO clinical_attachments (id,patient_id,author_id,name,mime,size,content)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [resourceId, patient.id, user.id, file.name, file.mime, file.content.length, file.content]);
    return { response: privateJson({ id: resourceId, name: file.name }, 201), resourceId };
  });
}

export async function downloadClinicalAttachment(request: Request, id: string, value: string) {
  return withClinicalRecord(request, id, "DOWNLOAD_ATTACHMENT", noBody, async (tx, _user, patient) => {
    const attachmentId = requiredId(value, "el adjunto");
    const { rows } = await tx.query<PrivateFile>(`
      SELECT name, mime, content FROM clinical_attachments WHERE id = $1 AND patient_id = $2
    `, [attachmentId, patient.id]);
    if (!rows[0]) throw new HttpError(404, "No se encontró el adjunto.");
    return { response: privateDownload(rows[0]), resourceId: attachmentId };
  });
}
