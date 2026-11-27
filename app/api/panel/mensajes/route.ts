import { requireUser } from "@/lib/auth";
import { bookingToken } from "@/lib/booking-token";
import { getDb } from "@/lib/db";
import { api, field, HttpError, readJson } from "@/lib/http";
import { manageLinkGraceSeconds } from "@/lib/scheduling";

type Job = {
  id: string; kind: string; status: string; availableAt: Date; patientName: string; serviceName: string;
  appointmentAt: Date; patientId: string; canManage: boolean; canSimulate: boolean;
};

export function GET(request: Request) {
  return api(async () => {
    await requireUser(request, ["ADMIN", "RECEPCION"]);
    const { rows } = await (await getDb()).query<Job>(`
      SELECT j.id, j.kind, j.status, j.available_at AS "availableAt", p.name AS "patientName",
        a.service_name AS "serviceName", a.starts_at AS "appointmentAt", p.id AS "patientId",
        (a.manage_hash IS NOT NULL AND a.ends_at + $1::int * interval '1 second' > now()
          AND a.status IN ('CONFIRMED','CHECKED_IN','IN_PROGRESS')) AS "canManage",
        (j.status='PENDIENTE' AND j.available_at <= now()) AS "canSimulate"
      FROM whatsapp_jobs j JOIN appointments a ON a.id=j.appointment_id
        JOIN patients p ON p.id=a.patient_id
      ORDER BY j.available_at DESC LIMIT 100
    `, [manageLinkGraceSeconds]);
    const messages = await Promise.all(rows.map(async ({ patientId, canManage, ...job }) => ({
      ...job,
      managePath: canManage ? "/mi-cita/" + await bookingToken(patientId) : null,
    })));
    return Response.json({ messages });
  });
}

export function POST(request: Request) {
  return api(async () => {
    await requireUser(request, ["ADMIN", "RECEPCION"]);
    const { id } = await readJson(request);
    const jobId = field(id, "mensaje", 80);
    const db = await getDb();
    const { rows } = await db.query(`
      UPDATE whatsapp_jobs SET status='SIMULADO'
       WHERE id=$1 AND status='PENDIENTE' AND available_at <= now()
       RETURNING id
    `, [jobId]);
    if (!rows.length) {
      const existing = await db.query("SELECT 1 FROM whatsapp_jobs WHERE id=$1", [jobId]);
      if (!existing.rows.length) throw new HttpError(404, "No se encontró el mensaje solicitado.");
      throw new HttpError(409, "El mensaje ya fue procesado o aún no está listo.");
    }
    return Response.json({ ok: true });
  });
}
