import { createHash, randomUUID } from "node:crypto";
import type { Transaction } from "@electric-sql/pglite";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { privateDownload, privateJson, readPaymentBody, readPaymentProof, type PrivateFile } from "@/lib/clinical-files";
import { integerBetween, oneOf, optionalId, optionalText, requiredId, requiredText } from "@/lib/clinical-validation";

type Staff = Awaited<ReturnType<typeof requireUser>>;
type PaymentStatus = "PENDING" | "CONFIRMED" | "REJECTED" | "REFUNDED";
type Payment = {
  id: string; patientId: string; patientName: string; appointmentId: string | null; planId: string | null;
  amountCents: number; method: string; reference: string; status: PaymentStatus;
  proofName: string | null; createdAt: Date; reason: string;
};
type PaymentForReview = Payment & { proofHash: string | null; proofMime: string | null };
type Amounts = { totalCents: string; paidCents: string };
type BalanceRow = Amounts & {
  id: string; kind: "APPOINTMENT" | "PLAN"; label: string; patientId: string; patientName: string;
};

const methods = ["YAPE", "PLIN", "TRANSFERENCIA"] as const;
const reviewActions = ["register", "approve", "reject", "refund"] as const;
const paymentProjection = `
  m.id, m.patient_id AS "patientId", p.name AS "patientName", m.appointment_id AS "appointmentId",
  m.plan_id AS "planId", m.amount_cents AS "amountCents", m.method, m.reference, m.status,
  m.proof_name AS "proofName", m.created_at AS "createdAt", m.reason
`;

export async function readPayments(request: Request) {
  await requireUser(request, ["ADMIN", "RECEPCION"]);
  const patientId = optionalId(new URL(request.url).searchParams.get("patientId"), "el paciente");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const { rows: payments } = await tx.query<Payment>(`
      SELECT ${paymentProjection} FROM manual_payments m JOIN patients p ON p.id = m.patient_id
      WHERE ($1::text IS NULL OR m.patient_id = $1) ORDER BY m.created_at DESC, m.id LIMIT 300
    `, [patientId]);
    const { rows: amounts } = await tx.query<BalanceRow>(`
      WITH charged_items AS (
        SELECT id, patient_id, 'APPOINTMENT' AS kind,
          service_name || ' · ' || to_char(starts_at AT TIME ZONE 'America/Lima', 'DD/MM/YYYY') AS label,
          price_cents::bigint AS total_cents, starts_at AS sort_date
        FROM appointments a
        WHERE status NOT IN ('PENDING','EXPIRED','CANCELLED','RESCHEDULED')
          OR EXISTS (SELECT 1 FROM manual_payments m WHERE m.appointment_id = a.id)
        UNION ALL
        SELECT q.id, q.patient_id, 'PLAN', q.title, COALESCE(sum(i.price_cents), 0), q.created_at
        FROM treatment_plans q LEFT JOIN treatment_plan_items i ON i.plan_id = q.id
        WHERE q.status NOT IN ('DRAFT', 'CANCELLED')
          OR EXISTS (SELECT 1 FROM manual_payments m WHERE m.plan_id = q.id)
        GROUP BY q.id
      ), posted_payments AS (
        SELECT COALESCE(appointment_id, plan_id) AS target,
          CASE WHEN appointment_id IS NOT NULL THEN 'APPOINTMENT' ELSE 'PLAN' END AS kind,
          sum(amount_cents) AS paid_cents
        FROM manual_payments WHERE status = 'CONFIRMED' AND (appointment_id IS NOT NULL OR plan_id IS NOT NULL)
        GROUP BY target, kind
      )
      SELECT c.id, c.kind, c.label, c.patient_id AS "patientId", p.name AS "patientName",
        c.total_cents::text AS "totalCents", COALESCE(pay.paid_cents, 0)::text AS "paidCents"
      FROM charged_items c JOIN patients p ON p.id = c.patient_id
      LEFT JOIN posted_payments pay ON pay.target = c.id AND pay.kind = c.kind
      WHERE ($1::text IS NULL OR c.patient_id = $1) ORDER BY c.sort_date DESC, c.id LIMIT 300
    `, [patientId]);
    const balances = amounts.map((row) => {
      const totalCents = Number(row.totalCents);
      const paidCents = Number(row.paidCents);
      return { ...row, totalCents, paidCents, balanceCents: totalCents - paidCents };
    });
    return privateJson({ payments, balances });
  });
}

async function addPaymentEvent(
  tx: Transaction,
  id: string,
  user: Staff,
  status: PaymentStatus,
  reason: string,
) {
  await tx.query(`
    INSERT INTO manual_payment_events (id,payment_id,actor_id,status,reason)
    VALUES ($1,$2,$3,$4,$5)
  `, [randomUUID(), id, user.id, status, reason]);
}

async function registerPayment(
  tx: Transaction, user: Staff, body: Record<string, unknown>, proof: PrivateFile | null, proofHash: string | null,
) {
  const patientId = requiredId(body.patientId, "el paciente");
  const appointmentId = optionalId(body.appointmentId, "la cita");
  const planId = optionalId(body.planId, "el plan");
  if (appointmentId && planId) throw new HttpError(400, "Asocia el pago a una cita o a un plan.");
  const amountCents = integerBetween(body.amountCents, "el monto en céntimos", 1, 999_999_999);
  const method = oneOf(body.method, methods, "el método de pago");
  const reference = requiredText(body.reference, "la referencia del pago", 120);
  const referenceKey = reference.normalize("NFKC").toLowerCase().replace(/\s+/g, "");

  const { rows: patients } = await tx.query("SELECT 1 FROM patients WHERE id = $1", [patientId]);
  if (!patients.length) throw new HttpError(404, "No se encontró al paciente.");
  if (appointmentId) {
    const { rows } = await tx.query(`
      SELECT 1 FROM appointments WHERE id = $1 AND patient_id = $2
      AND status NOT IN ('PENDING', 'EXPIRED') FOR SHARE
    `, [appointmentId, patientId]);
    if (!rows.length) throw new HttpError(400, "Selecciona una cita válida del paciente.");
  }
  if (planId) {
    const { rows } = await tx.query(`
      SELECT 1 FROM treatment_plans WHERE id = $1 AND patient_id = $2 AND status <> 'DRAFT' FOR SHARE
    `, [planId, patientId]);
    if (!rows.length) throw new HttpError(400, "Selecciona un plan válido del paciente.");
  }

  const id = randomUUID();
  const { rows: inserted } = await tx.query(`
    INSERT INTO manual_payments (
      id,patient_id,appointment_id,plan_id,entered_by,amount_cents,method,reference,reference_key,
      proof_name,proof_mime,proof_content,proof_hash
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    ON CONFLICT (method, reference_key) DO NOTHING RETURNING id
  `, [
    id, patientId, appointmentId, planId, user.id, amountCents, method, reference, referenceKey,
    proof?.name ?? null, proof?.mime ?? null, proof?.content ?? null, proofHash,
  ]);
  const { rows } = await tx.query<PaymentForReview>(`
    SELECT ${paymentProjection}, m.proof_hash AS "proofHash", m.proof_mime AS "proofMime"
    FROM manual_payments m JOIN patients p ON p.id = m.patient_id
    WHERE m.method = $1 AND m.reference_key = $2
  `, [method, referenceKey]);
  const { proofHash: storedHash, proofMime: storedMime, ...payment } = rows[0];
  if (inserted.length) {
    await addPaymentEvent(tx, id, user, "PENDING", "");
    return privateJson({ payment }, 201);
  }
  if (payment.patientId !== patientId || payment.appointmentId !== appointmentId || payment.planId !== planId
      || payment.amountCents !== amountCents || storedHash !== proofHash || storedMime !== (proof?.mime ?? null)
      || payment.proofName !== (proof?.name ?? null)) {
    throw new HttpError(409, "La referencia ya está registrada con datos distintos.");
  }
  return privateJson({ payment: { ...payment, status: "PENDING", reason: "" } });
}

async function checkPaymentLimit(tx: Transaction, payment: Payment) {
  if (!payment.appointmentId && !payment.planId) return;
  if (payment.appointmentId) {
    await tx.query("SELECT id FROM appointments WHERE id = $1 FOR UPDATE", [payment.appointmentId]);
  } else {
    await tx.query("SELECT id FROM treatment_plans WHERE id = $1 FOR UPDATE", [payment.planId]);
  }
  const { rows } = payment.appointmentId
    ? await tx.query<Amounts>(`
        SELECT a.price_cents::text AS "totalCents",
          (SELECT COALESCE(sum(amount_cents),0)::text FROM manual_payments
            WHERE appointment_id = a.id AND status = 'CONFIRMED') AS "paidCents"
        FROM appointments a WHERE a.id = $1
      `, [payment.appointmentId])
    : await tx.query<Amounts>(`
        SELECT (SELECT COALESCE(sum(price_cents),0)::text FROM treatment_plan_items WHERE plan_id = p.id) AS "totalCents",
          (SELECT COALESCE(sum(amount_cents),0)::text FROM manual_payments
            WHERE plan_id = p.id AND status = 'CONFIRMED') AS "paidCents"
        FROM treatment_plans p WHERE p.id = $1
      `, [payment.planId]);
  const charge = rows[0];
  if (!charge || Number(charge.paidCents) + payment.amountCents > Number(charge.totalCents)) {
    throw new HttpError(409, "El importe supera el saldo pendiente del cargo.");
  }
}

async function reviewPayment(
  tx: Transaction,
  user: Staff,
  action: Exclude<(typeof reviewActions)[number], "register">,
  body: Record<string, unknown>,
) {
  if (action === "refund" && user.role !== "ADMIN") {
    throw new HttpError(403, "Solo administración puede registrar una devolución.");
  }
  const id = requiredId(body.id, "el pago");
  const reason = action === "approve" ? optionalText(body.reason, "el motivo", 500) : requiredText(body.reason, "el motivo", 500);
  const destination = { approve: "CONFIRMED", reject: "REJECTED", refund: "REFUNDED" }[action] as PaymentStatus;
  const { rows } = await tx.query<Payment>(`
    SELECT ${paymentProjection} FROM manual_payments m JOIN patients p ON p.id = m.patient_id
    WHERE m.id = $1 FOR UPDATE OF m
  `, [id]);
  const payment = rows[0];
  if (!payment) throw new HttpError(404, "No se encontró el pago.");

  const { rows: existing } = await tx.query<{ reason: string }>(`
    SELECT reason FROM manual_payment_events WHERE payment_id = $1 AND status = $2
  `, [id, destination]);
  if (existing[0]) {
    if (existing[0].reason !== reason) throw new HttpError(409, "El movimiento ya se registró con otro motivo.");
    return privateJson({ payment: { ...payment, status: destination, reason } });
  }
  if (payment.status !== (action === "refund" ? "CONFIRMED" : "PENDING")) {
    throw new HttpError(409, "El estado del pago no admite esta operación.");
  }
  if (action === "approve") await checkPaymentLimit(tx, payment);
  await tx.query("UPDATE manual_payments SET status = $2, reason = $3 WHERE id = $1", [id, destination, reason]);
  await addPaymentEvent(tx, id, user, destination, reason);
  return privateJson({ payment: { ...payment, status: destination, reason } });
}

export async function writePayment(request: Request) {
  const user = await requireUser(request, ["ADMIN", "RECEPCION"]);
  const body = await readPaymentBody(request);
  const action = oneOf(body.action, reviewActions, "la operación del pago");
  const db = await getDb();
  if (action !== "register") return db.transaction((tx) => reviewPayment(tx, user, action, body));
  const proof = readPaymentProof(body);
  const proofHash = proof ? createHash("sha256").update(proof.content).digest("hex") : null;
  return db.transaction((tx) => registerPayment(tx, user, body, proof, proofHash));
}

export async function downloadPaymentProof(request: Request, value: string) {
  await requireUser(request, ["ADMIN", "RECEPCION"]);
  const id = requiredId(value, "el pago");
  const db = await getDb();
  const { rows } = await db.query<PrivateFile>(`
    SELECT proof_name AS name, proof_mime AS mime, proof_content AS content
    FROM manual_payments WHERE id = $1 AND proof_content IS NOT NULL
  `, [id]);
  if (!rows[0]) throw new HttpError(404, "El pago no tiene comprobante.");
  return privateDownload(rows[0]);
}
