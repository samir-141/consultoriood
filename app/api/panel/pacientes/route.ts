import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { limaDate, validDate } from "@/lib/clinic-time";
import { getDb } from "@/lib/db";
import { api, HttpError, optionalField, readJson } from "@/lib/http";
import { patientFields } from "@/lib/scheduling";

const projection = `p.id, p.name, p.phone, p.email, p.dni, to_char(p.birth_date, 'YYYY-MM-DD') AS "birthDate"`;

export function GET(request: Request) {
  return api(async () => {
    const user = await requireUser(request);
    const rawQ = new URL(request.url).searchParams.get("q") ?? "";
    if (rawQ.includes("\0")) {
      throw new HttpError(400, "El texto de búsqueda contiene caracteres no válidos.");
    }
    const query = rawQ.trim().slice(0, 120);
    const { rows } = await (await getDb()).query(`
      SELECT ${projection},
        COALESCE(
          (SELECT array_agg(pa.professional_id ORDER BY pa.professional_id)
           FROM patient_assignments pa WHERE pa.patient_id = p.id),
          ARRAY[]::text[]
        ) AS "assignedProfessionalIds"
      FROM patients p
      WHERE ($1 = '' OR p.id=$1 OR strpos(lower(p.name), lower($1)) > 0 OR strpos(p.phone,$1) > 0
        OR strpos(COALESCE(p.dni,''), $1) > 0
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
    const hasDniKey = Object.hasOwn(body, "dni");
    const dni = optionalField(body.dni, "DNI", 20);
    if (dni && !/^[A-Za-z0-9-]{6,20}$/.test(dni)) {
      throw new HttpError(400, "Ingresa un DNI o documento válido.");
    }
    const birth = optionalField(body.birthDate, "fecha de nacimiento", 10);
    if (birth && (!validDate(birth) || birth > limaDate())) {
      throw new HttpError(400, "Ingresa una fecha de nacimiento válida.");
    }
    const id = optionalField(body.id, "paciente", 80);
    if (id && !/^[A-Za-z0-9_-]+$/.test(id)) {
      throw new HttpError(400, "Identificador de paciente no válido.");
    }
    const db = await getDb();
    if (!id && dni) {
      const dup = await db.query<{ id: string }>("SELECT id FROM patients WHERE dni = $1 LIMIT 1", [dni]);
      if (dup.rows.length) {
        throw new HttpError(409, "Ya existe un paciente registrado con ese DNI.");
      }
    }
    const values = [id ?? randomUUID(), patient.name, patient.phone, patient.email, dni, birth];
    const query = id
      ? `UPDATE patients p SET name=$2,phone=$3,email=$4,dni=${hasDniKey ? "$5" : "COALESCE($5, p.dni)"},birth_date=$6 WHERE p.id=$1`
      : "INSERT INTO patients AS p (id,name,phone,email,dni,birth_date) VALUES ($1,$2,$3,$4,$5,$6)";
    const { rows } = await db.query(query + " RETURNING " + projection, values);
    if (!rows.length) throw new HttpError(404, "No encontramos el paciente.");
    if (id && hasDniKey) {
      await db.query(
        "UPDATE appointments SET dni = $2 WHERE patient_id = $1 AND status IN ('PENDING','CONFIRMED','CHECKED_IN','IN_PROGRESS')",
        [id, dni],
      );
    }
    return Response.json({ patient: rows[0] }, { status: id ? 200 : 201 });
  });
}
