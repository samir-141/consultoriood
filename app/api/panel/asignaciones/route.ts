import { requireUser } from "@/lib/auth";
import { professionals } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { api, field, HttpError, readJson } from "@/lib/http";

export function POST(request: Request) {
  return api(async () => {
    await requireUser(request, ["ADMIN", "RECEPCION"]);
    const body = await readJson(request);
    const action = field(body.action, "acción", 20);
    if (action !== "assign" && action !== "unassign") {
      throw new HttpError(400, "Selecciona una acción válida (assign o unassign).");
    }
    const patientId = field(body.patientId, "paciente", 120);
    if (!/^[A-Za-z0-9_-]+$/.test(patientId)) {
      throw new HttpError(400, "Identificador de paciente no válido.");
    }
    const professionalId = field(body.professionalId, "profesional", 60);
    if (!professionals.some((p) => p.id === professionalId)) {
      throw new HttpError(400, "Profesional inválido.");
    }

    const db = await getDb();
    const { rows: patientRows } = await db.query<{ id: string }>(
      "SELECT id FROM patients WHERE id = $1",
      [patientId],
    );
    if (!patientRows.length) {
      throw new HttpError(404, "No encontramos al paciente.");
    }

    if (action === "assign") {
      await db.query(
        "INSERT INTO patient_assignments (patient_id, professional_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [patientId, professionalId],
      );
    } else {
      await db.query(
        "DELETE FROM patient_assignments WHERE patient_id = $1 AND professional_id = $2",
        [patientId, professionalId],
      );
    }

    const { rows: assignments } = await db.query<{ professionalId: string }>(
      'SELECT professional_id AS "professionalId" FROM patient_assignments WHERE patient_id = $1 ORDER BY professional_id',
      [patientId],
    );
    return Response.json({
      ok: true,
      patientId,
      assignedProfessionalIds: assignments.map((a) => a.professionalId),
    });
  });
}
