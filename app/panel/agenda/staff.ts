"use client";

import { createContext, useContext } from "react";
import { addDays, limaDate } from "@/lib/clinic-time";

export type Role = "ADMIN" | "RECEPCION" | "ODONTOLOGO";
export type Staff = { id: string; name: string; role: Role; professionalId?: string | null };
export type Professional = { id: string; name: string; title: string; serviceIds: string[] };
export type Service = { id: string; name: string; description: string; duration: number; priceCents: number };
export type Catalog = { services: Service[]; professionals: Professional[] };
export type Patient = { id: string; name: string; phone: string; email?: string | null; birthDate?: string | null };
export type Status = "PENDING" | "CONFIRMED" | "CANCELLED" | "EXPIRED" | "RESCHEDULED"
  | "CHECKED_IN" | "IN_PROGRESS" | "COMPLETED" | "NO_SHOW";
export type Appointment = {
  id: string; date: string; time: string; endTime: string; serviceId: string;
  serviceName: string; professionalId: string; professionalName: string; patientId: string;
  patientName: string; patientPhone?: string | null; status: Status; priceCents: number;
  reminder30mSentAt?: string | null;
};
export type Block = {
  id: string; date: string; time: string; endTime: string;
  professionalId: string; professionalName: string; reason: string;
};
export type Agenda = { appointments: Appointment[]; blocks: Block[] };
export type Slot = { date: string; time: string; professionalId: string; professionalName: string };

export const roleLabels: Record<Role, string> = {
  ADMIN: "Administración", RECEPCION: "Recepción", ODONTOLOGO: "Odontología",
};

export const statusLabels: Record<Status, string> = {
  PENDING: "Retenida", CONFIRMED: "Confirmada", CANCELLED: "Cancelada",
  EXPIRED: "Vencida", RESCHEDULED: "Reprogramada", CHECKED_IN: "Paciente en sede",
  IN_PROGRESS: "En atención", COMPLETED: "Completada", NO_SHOW: "Inasistencia",
};

export const StaffContext = createContext<Staff | null>(null);

export function useStaff() {
  const staff = useContext(StaffContext);
  if (!staff) throw new Error("Se requiere un contexto del panel.");
  return staff;
}

export class StaffRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function staffFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...options });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new StaffRequestError(data?.error ?? "No se pudo completar la solicitud.", response.status);
  }
  return data as T;
}

export function postJson<T>(path: string, fields: object) {
  return staffFetch<T>(path, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields),
  });
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ocurrió un error al completar la solicitud.";
}

const longDate = new Intl.DateTimeFormat("es-PE", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const simpleDate = new Intl.DateTimeFormat("es-PE", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });

export const todayLima = limaDate;

export function dateLabel(date: string, short = false) {
  return (short ? simpleDate : longDate).format(new Date(date + "T12:00:00Z"));
}

export const nextDate = addDays;
