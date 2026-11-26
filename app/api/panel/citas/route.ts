import { requireUser } from "@/lib/auth";
import { professionals } from "@/lib/catalog";
import { limaDate, limaTime, validDate } from "@/lib/clinic-time";
import { getDb } from "@/lib/db";
import { api, HttpError } from "@/lib/http";

const VALID_STATUSES = new Set([
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "EXPIRED",
  "RESCHEDULED",
  "CHECKED_IN",
  "IN_PROGRESS",
  "COMPLETED",
  "NO_SHOW",
]);

type AppointmentLinkRow = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  serviceId: string;
  serviceName: string;
  professionalId: string;
  professionalName: string;
  status: string;
  expiresAt: Date | null;
  priceCents: number;
  reminder30mSentAt: Date | null;
  patientId: string;
  patientName: string;
  patientPhone: string;
  patientDni: string | null;
  isAssignedToAppointmentDoctor: boolean;
  assignedProfessionalIds: string[] | null;
};

export function GET(request: Request) {
  return api(async () => {
    await requireUser(request, ["ADMIN", "RECEPCION"]);
    const params = new URL(request.url).searchParams;
    const rawQ = params.get("q") ?? "";
    if (rawQ.includes("\0")) {
      throw new HttpError(400, "El texto de búsqueda contiene caracteres no válidos.");
    }
    const q = rawQ.trim().slice(0, 120);

    const professionalIdParam = params.get("professionalId")?.trim() || null;
    if (
      professionalIdParam &&
      professionalIdParam !== "any" &&
      !professionals.some((p) => p.id === professionalIdParam) &&
      professionalIdParam !== "odonto-b"
    ) {
      throw new HttpError(400, "Profesional inválido.");
    }
    const professionalFilter = professionalIdParam && professionalIdParam !== "any" ? professionalIdParam : null;

    const statusParam = params.get("status")?.trim() || null;
    if (statusParam && statusParam !== "ALL" && !VALID_STATUSES.has(statusParam)) {
      throw new HttpError(400, "Estado de cita inválido.");
    }
    const statusFilter = statusParam && statusParam !== "ALL" ? statusParam : null;

    const assignmentParam = params.get("assignment")?.trim() || "all";
    if (!["all", "assigned", "unassigned"].includes(assignmentParam)) {
      throw new HttpError(400, "Filtro de asignación inválido.");
    }

    const fromParam = params.get("from")?.trim() || null;
    const toParam = params.get("to")?.trim() || null;
    if (fromParam && !validDate(fromParam)) {
      throw new HttpError(400, "Fecha inicial inválida.");
    }
    if (toParam && !validDate(toParam)) {
      throw new HttpError(400, "Fecha final inválida.");
    }
    if (fromParam && toParam && fromParam > toParam) {
      throw new HttpError(400, "La fecha inicial no puede ser posterior a la fecha final.");
    }

    const limitRaw = params.get("limit");
    let limit = 150;
    if (limitRaw !== null && limitRaw !== "") {
      const parsed = Number(limitRaw);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 300) {
        throw new HttpError(400, "El límite debe estar entre 1 y 300.");
      }
      limit = parsed;
    }

    const db = await getDb();
    const { rows } = await db.query<AppointmentLinkRow>(`
      SELECT
        a.id,
        a.starts_at AS "startsAt",
        a.ends_at AS "endsAt",
        a.service_id AS "serviceId",
        a.service_name AS "serviceName",
        a.professional_id AS "professionalId",
        a.professional_name AS "professionalName",
        a.status,
        a.hold_expires_at AS "expiresAt",
        a.price_cents AS "priceCents",
        a.reminder_30m_sent_at AS "reminder30mSentAt",
        p.id AS "patientId",
        p.name AS "patientName",
        p.phone AS "patientPhone",
        COALESCE(p.dni, a.dni) AS "patientDni",
        EXISTS (
          SELECT 1 FROM patient_assignments pa
          WHERE pa.patient_id = a.patient_id AND pa.professional_id = a.professional_id
        ) AS "isAssignedToAppointmentDoctor",
        COALESCE(
          (SELECT array_agg(pa.professional_id ORDER BY pa.professional_id)
           FROM patient_assignments pa WHERE pa.patient_id = a.patient_id),
          ARRAY[]::text[]
        ) AS "assignedProfessionalIds"
      FROM appointments a
      JOIN patients p ON p.id = a.patient_id
      WHERE ($1 = '' OR a.id = $1 OR p.id = $1
             OR strpos(lower(p.name), lower($1)) > 0
             OR strpos(p.phone, $1) > 0
             OR strpos(COALESCE(p.dni, a.dni, ''), $1) > 0
             OR strpos(lower(a.professional_name), lower($1)) > 0)
        AND ($2::text IS NULL OR a.professional_id = $2)
        AND ($3::text IS NULL OR a.status = $3)
        AND ($4::text IS NULL OR a.starts_at >= ($4 || 'T00:00:00-05:00')::timestamptz)
        AND ($5::text IS NULL OR a.starts_at < (($5::date + 1)::text || 'T00:00:00-05:00')::timestamptz)
        AND ($6 = 'all'
             OR ($6 = 'assigned' AND EXISTS (
               SELECT 1 FROM patient_assignments pa
               WHERE pa.patient_id = a.patient_id AND pa.professional_id = a.professional_id
             ))
             OR ($6 = 'unassigned' AND NOT EXISTS (
               SELECT 1 FROM patient_assignments pa
               WHERE pa.patient_id = a.patient_id AND pa.professional_id = a.professional_id
             )))
      ORDER BY a.starts_at DESC, a.id DESC
      LIMIT $7
    `, [q, professionalFilter, statusFilter, fromParam, toParam, assignmentParam, limit]);

    const now = new Date();
    const profMap = new Map(professionals.map((pr) => [pr.id, pr.name]));
    profMap.set("odonto-b", "Odontólogo B");

    const appointments = rows.map((row) => {
      const deadline = row.expiresAt
        ? new Date(Math.min(row.expiresAt.getTime(), row.startsAt.getTime()))
        : null;
      const effectiveStatus = row.status === "PENDING" && deadline && deadline <= now ? "EXPIRED" : row.status;
      const assignedDoctors = (row.assignedProfessionalIds ?? []).map((id) => ({
        id,
        name: profMap.get(id) ?? id,
      }));
      return {
        id: row.id,
        date: limaDate(row.startsAt),
        time: limaTime(row.startsAt),
        endTime: limaTime(row.endsAt),
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        professionalId: row.professionalId,
        professionalName: row.professionalName,
        status: effectiveStatus,
        priceCents: row.priceCents,
        reminder30mSentAt: row.reminder30mSentAt,
        patientId: row.patientId,
        patientName: row.patientName,
        patientPhone: row.patientPhone,
        patientDni: row.patientDni,
        isAssignedToAppointmentDoctor: row.isAssignedToAppointmentDoctor,
        assignedDoctors,
      };
    });

    const summary = {
      total: appointments.length,
      assigned: appointments.filter((a) => a.isAssignedToAppointmentDoctor).length,
      unassigned: appointments.filter((a) => !a.isAssignedToAppointmentDoctor).length,
    };

    return Response.json({ appointments, summary });
  });
}
