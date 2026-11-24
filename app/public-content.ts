import { clinic, services } from "@/lib/catalog";

export const publicServices = services;

const money = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });

export function servicePrice(priceCents: number) {
  return money.format(priceCents / 100);
}

export const heroPhoto = "/fotografia/consulta-ilustrativa.webp";

export const publicDescription = `Conoce la atención de Edu Gómez Delgado y reserva una cita dental en ${clinic.location}.`;
