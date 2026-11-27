import { z } from "zod";
import { validDate } from "./clinic-time";
import { HttpError } from "./http";

const noNullByte = (value: string) => !value.includes("\0");

export const ReservasQuerySchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener el formato YYYY-MM-DD").refine(validDate, "Ingresa una fecha válida.").optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener el formato YYYY-MM-DD").refine(validDate, "Ingresa una fecha válida.").optional(),
  mes: z.string().regex(/^\d{4}-\d{2}$/, "El mes debe tener el formato YYYY-MM").optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/, "El mes debe tener el formato YYYY-MM").optional(),
  servicio: z.string().max(80).optional(),
  serviceId: z.string().max(80).optional(),
  profesional: z.string().max(80).optional(),
  professionalId: z.string().max(80).optional(),
});

export const ReservasCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha requerida con formato YYYY-MM-DD").refine(validDate, "Ingresa una fecha válida.").optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha requerida con formato YYYY-MM-DD").refine(validDate, "Ingresa una fecha válida.").optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Hora requerida con formato HH:MM").optional(),
  hora: z.string().regex(/^\d{2}:\d{2}$/, "Hora requerida con formato HH:MM").optional(),
  serviceId: z.string().max(80).optional(),
  servicio: z.string().max(80).optional(),
  professionalId: z.string().max(80).optional(),
  profesional: z.string().max(80).optional(),
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(120).refine(noNullByte, "Revisa el nombre.").optional(),
  nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(120).refine(noNullByte, "Revisa el nombre.").optional(),
  phone: z.string().trim().min(7, "Ingresa un teléfono válido de 7 a 15 dígitos").max(30).refine(noNullByte, "Revisa el teléfono.").optional(),
  telefono: z.string().trim().min(7, "Ingresa un teléfono válido de 7 a 15 dígitos").max(30).refine(noNullByte, "Revisa el teléfono.").optional(),
  dni: z.string().trim().max(20).refine(noNullByte, "Revisa el DNI.").optional(),
  email: z.union([z.string().trim().max(160).email("Ingresa un correo válido").refine(noNullByte, "Revisa el correo."), z.literal("")]).optional(),
  correo: z.union([z.string().trim().max(160).email("Ingresa un correo válido").refine(noNullByte, "Revisa el correo."), z.literal("")]).optional(),
  reason: z.string().trim().max(500).refine(noNullByte, "Revisa el motivo.").optional(),
  motivo: z.string().trim().max(500).refine(noNullByte, "Revisa el motivo.").optional(),
  whatsappOptIn: z.boolean().optional(),
  confirmNow: z.boolean().optional(),
}).refine(data => Boolean(data.date || data.fecha), {
  message: "La fecha es obligatoria (formato YYYY-MM-DD).",
  path: ["fecha"],
}).refine(data => Boolean(data.time || data.hora), {
  message: "La hora es obligatoria (formato HH:MM).",
  path: ["hora"],
}).refine(data => Boolean(data.name || data.nombre), {
  message: "El nombre es obligatorio.",
  path: ["nombre"],
}).refine(data => Boolean(data.phone || data.telefono || (data.dni && /^\d{8}$/.test(data.dni))), {
  message: "Ingresa un teléfono válido o DNI de 8 dígitos.",
  path: ["telefono"],
});

export type NormalizedBookingInput = {
  date: string;
  time: string;
  serviceId: string;
  professionalId: string;
  name: string;
  phone: string;
  dni?: string | null;
  email?: string | null;
  reason?: string | null;
  whatsappOptIn: boolean;
  confirmNow: boolean;
};

export function validateReservasQuery(searchParams: URLSearchParams) {
  const raw = {
    fecha: searchParams.get("fecha") ?? undefined,
    date: searchParams.get("date") ?? undefined,
    mes: searchParams.get("mes") ?? undefined,
    month: searchParams.get("month") ?? undefined,
    servicio: searchParams.get("servicio") ?? undefined,
    serviceId: searchParams.get("serviceId") ?? undefined,
    profesional: searchParams.get("profesional") ?? undefined,
    professionalId: searchParams.get("professionalId") ?? undefined,
  };

  const parsed = ReservasQuerySchema.safeParse(raw);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new HttpError(400, firstIssue.message);
  }

  const date = parsed.data.fecha || parsed.data.date;
  const month = parsed.data.mes || parsed.data.month;
  if (month && !validDate(`${month}-01`)) {
    throw new HttpError(400, "El mes debe ser válido y tener formato YYYY-MM.");
  }
  const serviceId = parsed.data.servicio || parsed.data.serviceId || "evaluacion";
  const professionalId = parsed.data.profesional || parsed.data.professionalId || "any";

  return { date, month, serviceId, professionalId };
}

export function validateReservasCreate(body: unknown): NormalizedBookingInput {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "Envía los datos de la reserva en formato JSON.");
  }

  const parsed = ReservasCreateSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new HttpError(400, firstIssue.message);
  }

  const d = parsed.data;
  const date = (d.date || d.fecha)!;
  const time = (d.time || d.hora)!;
  const name = (d.name || d.nombre)!;
  const phone = (d.phone || d.telefono || d.dni)!;
  const serviceId = d.serviceId || d.servicio || "evaluacion";
  const professionalId = d.professionalId || d.profesional || "any";
  const dni = d.dni || (/^\d{8}$/.test(phone) ? phone : null);
  const rawEmail = d.email || d.correo;
  const email = rawEmail && rawEmail.length > 0 ? rawEmail.toLowerCase() : null;
  const reason = d.reason || d.motivo || null;
  const whatsappOptIn = d.whatsappOptIn === true;
  const confirmNow = d.confirmNow === true;

  return {
    date,
    time,
    serviceId,
    professionalId,
    name,
    phone,
    dni,
    email,
    reason,
    whatsappOptIn,
    confirmNow,
  };
}
