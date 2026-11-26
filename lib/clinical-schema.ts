export const clinicalSchema = `
  CREATE TABLE IF NOT EXISTS clinical_notes (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id),
    appointment_id TEXT NOT NULL REFERENCES appointments(id),
    author_id TEXT NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL,
    findings TEXT NOT NULL,
    procedure TEXT NOT NULL,
    instructions TEXT NOT NULL,
    amends_id TEXT UNIQUE REFERENCES clinical_notes(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS clinical_notes_original
    ON clinical_notes (appointment_id) WHERE amends_id IS NULL;
  CREATE INDEX IF NOT EXISTS clinical_notes_patient ON clinical_notes (patient_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS clinical_odontogram (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id),
    author_id TEXT NOT NULL REFERENCES users(id),
    tooth SMALLINT NOT NULL,
    surface TEXT NOT NULL,
    status TEXT NOT NULL,
    observation TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS clinical_odontogram_patient ON clinical_odontogram (patient_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS treatment_plans (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id),
    author_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('DRAFT', 'PROPOSED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS treatment_plans_patient ON treatment_plans (patient_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS treatment_plan_items (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES treatment_plans(id),
    position INTEGER NOT NULL,
    tooth SMALLINT,
    procedure TEXT NOT NULL,
    price_cents INTEGER NOT NULL CHECK (price_cents BETWEEN 0 AND 999999999),
    status TEXT NOT NULL,
    UNIQUE (plan_id, position)
  );

  CREATE TABLE IF NOT EXISTS clinical_consents (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id),
    author_id TEXT NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS clinical_consents_patient ON clinical_consents (patient_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS clinical_attachments (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id),
    author_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    mime TEXT NOT NULL CHECK (mime IN ('application/pdf', 'image/png', 'image/jpeg')),
    size INTEGER NOT NULL CHECK (size BETWEEN 1 AND 10485760),
    content BYTEA NOT NULL CHECK (octet_length(content) = size),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS clinical_attachments_patient ON clinical_attachments (patient_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS clinical_audit (
    id TEXT PRIMARY KEY,
    actor_id TEXT REFERENCES users(id),
    patient_id TEXT,
    resource_id TEXT,
    action TEXT NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('OK', 'DENIED', 'ERROR')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS clinical_audit_patient ON clinical_audit (patient_id, created_at DESC);

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

  CREATE OR REPLACE FUNCTION reject_clinical_history_change() RETURNS trigger
  LANGUAGE plpgsql AS $$
  BEGIN
    RAISE EXCEPTION 'Clinical history is append-only';
  END;
  $$;

  CREATE OR REPLACE TRIGGER clinical_notes_append_only BEFORE UPDATE OR DELETE ON clinical_notes
    FOR EACH ROW EXECUTE FUNCTION reject_clinical_history_change();
  CREATE OR REPLACE TRIGGER clinical_odontogram_append_only BEFORE UPDATE OR DELETE ON clinical_odontogram
    FOR EACH ROW EXECUTE FUNCTION reject_clinical_history_change();
  CREATE OR REPLACE TRIGGER clinical_consents_append_only BEFORE UPDATE OR DELETE ON clinical_consents
    FOR EACH ROW EXECUTE FUNCTION reject_clinical_history_change();
  CREATE OR REPLACE TRIGGER clinical_audit_append_only BEFORE UPDATE OR DELETE ON clinical_audit
    FOR EACH ROW EXECUTE FUNCTION reject_clinical_history_change();
  CREATE OR REPLACE TRIGGER clinical_history_revisions_append_only BEFORE UPDATE OR DELETE ON clinical_history_revisions
    FOR EACH ROW EXECUTE FUNCTION reject_clinical_history_change();

  CREATE INDEX IF NOT EXISTS clinical_notes_appt_idx ON clinical_notes (appointment_id);
  CREATE INDEX IF NOT EXISTS clinical_notes_author_idx ON clinical_notes (author_id);
  CREATE INDEX IF NOT EXISTS clinical_odontogram_author_idx ON clinical_odontogram (author_id);
  CREATE INDEX IF NOT EXISTS treatment_plans_author_idx ON treatment_plans (author_id);
  CREATE INDEX IF NOT EXISTS clinical_consents_author_idx ON clinical_consents (author_id);
  CREATE INDEX IF NOT EXISTS clinical_attachments_author_idx ON clinical_attachments (author_id);
  CREATE INDEX IF NOT EXISTS clinical_audit_actor_idx ON clinical_audit (actor_id);
  CREATE INDEX IF NOT EXISTS clinical_histories_updated_by_idx ON clinical_histories (updated_by);
  CREATE INDEX IF NOT EXISTS clinical_history_revisions_author_idx ON clinical_history_revisions (author_id);
`;
