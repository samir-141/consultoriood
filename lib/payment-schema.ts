export const paymentSchema = `
  CREATE TABLE IF NOT EXISTS manual_payments (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id),
    appointment_id TEXT REFERENCES appointments(id),
    plan_id TEXT REFERENCES treatment_plans(id),
    entered_by TEXT NOT NULL REFERENCES users(id),
    amount_cents INTEGER NOT NULL CHECK (amount_cents BETWEEN 1 AND 999999999),
    method TEXT NOT NULL CHECK (method IN ('YAPE','PLIN','TRANSFERENCIA')),
    reference TEXT NOT NULL,
    reference_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','REJECTED','REFUNDED')),
    reason TEXT NOT NULL DEFAULT '',
    proof_name TEXT,
    proof_mime TEXT CHECK (proof_mime IN ('application/pdf','image/png','image/jpeg')),
    proof_content BYTEA CHECK (octet_length(proof_content) BETWEEN 1 AND 10485760),
    proof_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (appointment_id IS NULL OR plan_id IS NULL),
    CHECK ((proof_name IS NULL AND proof_mime IS NULL AND proof_hash IS NULL AND proof_content IS NULL)
      OR (proof_name IS NOT NULL AND proof_mime IS NOT NULL AND proof_hash IS NOT NULL AND proof_content IS NOT NULL)),
    UNIQUE (method, reference_key)
  );
  CREATE INDEX IF NOT EXISTS manual_payments_patient ON manual_payments (patient_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS manual_payments_appointment ON manual_payments (appointment_id) WHERE status = 'CONFIRMED';
  CREATE INDEX IF NOT EXISTS manual_payments_plan ON manual_payments (plan_id) WHERE status = 'CONFIRMED';

  CREATE TABLE IF NOT EXISTS manual_payment_events (
    id TEXT PRIMARY KEY,
    payment_id TEXT NOT NULL REFERENCES manual_payments(id),
    actor_id TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL CHECK (status IN ('PENDING','CONFIRMED','REJECTED','REFUNDED')),
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (payment_id, status)
  );
  CREATE OR REPLACE TRIGGER manual_payment_events_append_only BEFORE UPDATE OR DELETE ON manual_payment_events
    FOR EACH ROW EXECUTE FUNCTION reject_clinical_history_change();
`;
