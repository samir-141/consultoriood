import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { limaDate, validDate } from "@/lib/clinic-time";
import { getDb } from "@/lib/db";
import { api, HttpError, optionalField, readJson } from "@/lib/http";
import { patientFields } from "@/lib/scheduling";

const projection = `id, name, phone, email, to_char(birth_date, 'YYYY-MM-DD') AS "birthDate"`;

export function GET(request: Request) {
  return api(async () => {
    const user = await requireUser(request);
    const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 120) ?? "";
    const { rows } = await (await getDb()).query(`
      SELECT ${projection} FROM patients p
      WHERE ($1 = '' OR p.id=$1 OR strpos(lower(p.name), lower($1)) > 0 OR strpos(p.phone,$1) > 0
        OR strpos(lower(COALESCE(p.email,'')),lower($1)) > 0)
        AND ($2::text IS NULL OR EXISTS (SELECT 1 FROM patient_assignments pa
          WHERE pa.patient_id=p.id AND pa.professional_id=$2))
      ORDER BY p.name, p.id LIMIT 200
    `, [query, user.role === "ODONTOLOGO" ? user.professionalId : null]);
    return Response.json({ patients: rows });
  });
}

export function POST(request: Request) {
  return api(async () => {
    await requireUser(request, ["ADMIN", "RECEPCION"]);
    const body = await readJson(request);
    const patient = patientFields(body);
    const birth = optionalField(body.birthDate, "fecha de nacimiento", 10);
    if (birth && (!validDate(birth) || birth > limaDate())) {
      throw new HttpError(400, "Ingresa una fecha de nacimiento válida.");
    }
    const id = optionalField(body.id, "paciente", 80);
    const db = await getDb();
    const values = [id ?? randomUUID(), patient.name, patient.phone, patient.email, birth];
    const query = id
      ? "UPDATE patients SET name=$2,phone=$3,email=$4,birth_date=$5 WHERE id=$1"
      : "INSERT INTO patients (id,name,phone,email,birth_date) VALUES ($1,$2,$3,$4,$5)";
    const { rows } = await db.query(query + " RETURNING " + projection, values);
    if (!rows.length) throw new HttpError(404, "No encontramos el paciente.");
    return Response.json({ patient: rows[0] }, { status: id ? 200 : 201 });
  });
}
