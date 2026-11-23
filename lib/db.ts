import { mkdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { baseSchema } from "./schema";
import { clinicalSchema } from "./clinical-schema";
import { paymentSchema } from "./payment-schema";
import { atLima, demoDay } from "./clinic-time";
import { hashPassword } from "./password";

export type Sql = Pick<PGlite, "query" | "exec">;
const state = globalThis as typeof globalThis & { dentalDatabase101?: Promise<PGlite> };

export const demoAccounts = [
  { id: "demo-admin", name: "Administración Demo", email: "admin@demo.test", role: "ADMIN", professional: null },
  { id: "demo-frontdesk", name: "Recepción Demo", email: "recepcion@demo.test", role: "RECEPCION", professional: null },
  { id: "demo-dentist", name: "Odontóloga A", email: "odontologia@demo.test", role: "ODONTOLOGO", professional: "odonto-a" },
] as const;

async function seed(sql: Sql) {
  const existing = await sql.query("SELECT 1 FROM users LIMIT 1");
  if (existing.rows.length) return;
  for (const user of demoAccounts) {
    await sql.query(
      "INSERT INTO users (id, name, email, role, professional_id, password_hash) VALUES ($1,$2,$3,$4,$5,$6)",
      [user.id, user.name, user.email, user.role, user.professional, hashPassword("DemoDental!101")],
    );
  }
  await sql.exec(`
    INSERT INTO patients (id, name, phone, email, birth_date) VALUES
      ('paciente-demo-1','Paciente Ejemplo','900000001','paciente@example.test','1990-06-12'),
      ('paciente-demo-2','Paciente de Prueba','900000002','otro@example.test','1988-02-21');
    INSERT INTO patient_assignments VALUES ('paciente-demo-1','odonto-a'), ('paciente-demo-2','odonto-b');
  `);
  const day = demoDay();
  const sessionSeeds = [
    ["cita-demo-1", "paciente-demo-1", "odonto-a", "Odontóloga A", "09:00", "09:30", "09:40"],
    ["cita-demo-2", "paciente-demo-2", "odonto-b", "Odontólogo B", "10:30", "11:00", "11:10"],
  ];
  for (const [id, patient, professional, name, start, end, occupied] of sessionSeeds) {
    await sql.query(`
      INSERT INTO appointments (id,patient_id,service_id,service_name,professional_id,professional_name,
        starts_at,ends_at,occupied_until,price_cents,status)
      VALUES ($1,$2,'evaluacion','Evaluación dental',$3,$4,$5,$6,$7,8000,'CONFIRMED')
    `, [id, patient, professional, name, atLima(day, start), atLima(day, end), atLima(day, occupied)]);
  }
}

async function initialize() {
  const directory = process.env.DENTAL_DATA_DIR ?? path.join(process.cwd(), ".dental-local", "postgres");
  if (directory !== "memory://") await mkdir(path.dirname(path.resolve(/* turbopackIgnore: true */ directory)), { recursive: true });
  const db = new PGlite(directory, { extensions: { btree_gist } });
  try {
    await db.transaction(async (tx) => {
      await tx.exec(baseSchema);
      await tx.exec(clinicalSchema);
      await tx.exec(paymentSchema);
      await seed(tx);
    });
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

export function getDb() {
  state.dentalDatabase101 ??= initialize().catch((error) => {
    delete state.dentalDatabase101;
    throw error;
  });
  return state.dentalDatabase101;
}
