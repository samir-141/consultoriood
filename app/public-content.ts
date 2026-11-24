import { clinic, services } from "@/lib/catalog";

export type ServiceId = "evaluacion" | "limpieza" | "control";

const serviceCopy: Record<ServiceId, { intent: string; visit: string }> = {
  evaluacion: {
    intent: "Si es tu primera visita o tienes dudas sobre qué servicio elegir.",
    visit: "Cuéntale al profesional qué te preocupa y qué quieres resolver. Podrás preguntar por las alternativas, los tiempos y el costo antes de decidir.",
  },
  limpieza: {
    intent: "Si quieres agendar una visita preventiva.",
    visit: "Comenta tus dudas sobre el cuidado diario al empezar. El profesional podrá explicar el alcance de la visita y orientarte acerca de los cuidados posteriores.",
  },
  control: {
    intent: "Si vuelves después de una consulta o un tratamiento.",
    visit: "Si recibiste indicaciones en tu visita anterior, tenlas a mano. Usa este espacio para comentar cambios y aclarar los siguientes pasos del seguimiento.",
  },
};

export function isServiceId(value: string): value is ServiceId {
  return Object.hasOwn(serviceCopy, value);
}

export const publicServices = services.flatMap((service) => {
  if (!isServiceId(service.id)) return [];
  return [{ ...service, id: service.id, ...serviceCopy[service.id] }];
});

const money = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });

export function servicePrice(priceCents: number) {
  return money.format(priceCents / 100);
}

export const heroPhoto = "/fotografia/consulta-ilustrativa.webp";

export const publicDescription = `Explora los servicios, consulta horarios y reserva una cita dental en ${clinic.location}.`;
