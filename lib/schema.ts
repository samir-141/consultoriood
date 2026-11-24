export const baseSchema = `
  CREATE EXTENSION IF NOT EXISTS btree_gist;
  CREATE TABLE IF NOT EXISTS clinic_state (id integer PRIMARY KEY CHECK (id = 1));
  INSERT INTO clinic_state VALUES (1) ON CONFLICT DO NOTHING;
  CREATE TABLE IF NOT EXISTS users (
    id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE, password_hash text NOT NULL,
    role text NOT NULL CHECK (role IN ('ADMIN','RECEPCION','ODONTOLOGO')), professional_id text,
    CHECK ((role = 'ODONTOLOGO') = (professional_id IS NOT NULL))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL
  );
  CREATE TABLE IF NOT EXISTS patients (
    id text PRIMARY KEY, name text NOT NULL, phone text NOT NULL, email text,
    birth_date date, background text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(),
    dni text
  );
  CREATE TABLE IF NOT EXISTS patient_assignments (
    patient_id text NOT NULL REFERENCES patients(id),
    professional_id text NOT NULL, PRIMARY KEY (patient_id, professional_id)
  );
  CREATE TABLE IF NOT EXISTS appointments (
    id text PRIMARY KEY, patient_id text NOT NULL REFERENCES patients(id),
    service_id text NOT NULL, service_name text NOT NULL, professional_id text NOT NULL, professional_name text NOT NULL,
    starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, occupied_until timestamptz NOT NULL,
    hold_expires_at timestamptz, manage_hash text UNIQUE, opt_in boolean NOT NULL DEFAULT false,
    price_cents integer NOT NULL CHECK (price_cents >= 0), previous_id text REFERENCES appointments(id),
    status text NOT NULL CHECK (status IN ('PENDING','CONFIRMED','CANCELLED','EXPIRED','RESCHEDULED','CHECKED_IN','IN_PROGRESS','COMPLETED','NO_SHOW')),
    created_at timestamptz NOT NULL DEFAULT now(),
    hold_request_hash text,
    dni text,
    reason text,
    CHECK (starts_at < ends_at AND ends_at <= occupied_until),
    CHECK (status <> 'PENDING' OR hold_expires_at IS NOT NULL),
    EXCLUDE USING gist (professional_id WITH =, tstzrange(starts_at, occupied_until, '[)') WITH &&)
      WHERE (status IN ('PENDING','CONFIRMED','CHECKED_IN','IN_PROGRESS','COMPLETED'))
  );
  ALTER TABLE appointments ADD COLUMN IF NOT EXISTS hold_request_hash text;
  ALTER TABLE appointments ADD COLUMN IF NOT EXISTS dni text;
  ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reason text;
  ALTER TABLE patients ADD COLUMN IF NOT EXISTS dni text;

  CREATE OR REPLACE VIEW reservas AS
    SELECT id, patient_id, service_id, service_name, professional_id, professional_name,
      starts_at, ends_at, occupied_until, hold_expires_at, manage_hash, opt_in,
      price_cents, previous_id, status, created_at, hold_request_hash, dni, reason
    FROM appointments;

  CREATE INDEX IF NOT EXISTS appointments_by_patient ON appointments(patient_id, starts_at DESC);
  CREATE INDEX IF NOT EXISTS appointments_by_date ON appointments(starts_at, professional_id);
  CREATE TABLE IF NOT EXISTS agenda_blocks (
    id text PRIMARY KEY, professional_id text NOT NULL, reason text NOT NULL,
    starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, CHECK(starts_at < ends_at),
    EXCLUDE USING gist (professional_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
  );
  CREATE TABLE IF NOT EXISTS appointment_events (
    id text PRIMARY KEY, appointment_id text NOT NULL REFERENCES appointments(id),
    actor_id text REFERENCES users(id), action text NOT NULL, reason text,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS whatsapp_jobs (
    id text PRIMARY KEY, appointment_id text NOT NULL REFERENCES appointments(id), kind text NOT NULL
      CHECK (kind IN ('CONFIRMACION','RECORDATORIO')), status text NOT NULL
      CHECK (status IN ('PENDIENTE','CANCELADO','SIMULADO')), available_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (appointment_id, kind)
  );
`;
