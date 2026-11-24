"use client";

import { useEffect, useState } from "react";
import { addDays, atLima, limaDate, validDate } from "@/lib/clinic-time";

export type Service = {
  id: string;
  name: string;
  description: string;
  duration: number;
  priceCents: number;
};

export type Professional = {
  id: string;
  name: string;
  title: string;
  serviceIds: string[];
};

export type Catalog = { services: Service[]; professionals: Professional[] };

export type Slot = {
  date: string;
  time: string;
  professionalId: string;
  professionalName: string;
};

export type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "EXPIRED"
  | "RESCHEDULED"
  | "CHECKED_IN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "NO_SHOW";

export type Appointment = Slot & {
  id: string;
  endTime: string;
  serviceId: string;
  serviceName: string;
  patientName: string;
  status: AppointmentStatus;
  priceCents: number;
};

export type Hold = {
  appointment: Appointment;
  token: string;
  expiresAt: string;
};

export class BookingError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function bookingRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...options });
  const data = await response.json().catch(() => null);

  if (!response.ok || data === null) {
    throw new BookingError(
      typeof data?.error === "string"
        ? data.error
        : "No pudimos completar la solicitud. Intenta de nuevo.",
      response.status,
    );
  }

  return data as T;
}

export function postBooking<T>(path: string, data: object, idempotencyKey?: string) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
  return bookingRequest<T>(path, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
}

export function reservationPath(token: string) {
  return `/api/reservas/${encodeURIComponent(token)}`;
}

export function bookingMessage(error: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "Se perdió la conexión. Vuelve a intentarlo cuando tengas internet.";
  }
  return error instanceof BookingError
    ? error.message
    : "No pudimos conectar con el consultorio. Intenta de nuevo.";
}

const dateFormatter = new Intl.DateTimeFormat("es-PE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Lima",
});

const priceFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
});

export function todayInLima() {
  return limaDate();
}

export function lastBookingDay(today: string) {
  return addDays(today, 90);
}

export function isBookingDay(date: string, today: string) {
  return validDate(date) && date >= today && date <= lastBookingDay(today);
}

export function readableDate(date: string) {
  return dateFormatter.format(new Date(`${date}T12:00:00-05:00`));
}

export function price(cents: number) {
  return priceFormatter.format(cents / 100);
}

export function slotKey(slot: Slot) {
  return `${slot.time}|${slot.professionalId}`;
}

export function appointmentDuration(appointment: Pick<Appointment, "date" | "time" | "endTime">) {
  return (atLima(appointment.date, appointment.endTime).getTime() - atLima(appointment.date, appointment.time).getTime()) / 60_000;
}

export function appointmentHasStarted(appointment: Pick<Appointment, "date" | "time">) {
  return atLima(appointment.date, appointment.time).getTime() <= Date.now();
}

export function calendarHref(appointment: Pick<Appointment, "id" | "date" | "time" | "endTime">) {
  const utc = (date: Date) => date.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Gomez Delgado//Citas//ES",
    "BEGIN:VEVENT",
    `UID:${appointment.id.replace(/[^a-z0-9-]/gi, "")}@citas.local`,
    `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(atLima(appointment.date, appointment.time))}`,
    `DTEND:${utc(atLima(appointment.date, appointment.endTime))}`,
    "SUMMARY:Cita dental",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

type AvailabilityResult = { request: string; slots: Slot[]; error: string };

function availabilityQuery(date: string, serviceId: string, professionalId: string) {
  return new URLSearchParams({ date, serviceId, professionalId }).toString();
}

function fetchSlots(query: string, signal: AbortSignal) {
  return bookingRequest<{ slots: Slot[] }>(`/api/disponibilidad?${query}`, { signal });
}

export async function nextDayWithSlots(
  from: string,
  serviceId: string,
  professionalId: string,
  signal: AbortSignal,
) {
  const last = lastBookingDay(todayInLima());
  for (let offset = 1; offset <= 7; offset++) {
    const date = addDays(from, offset);
    if (date > last) break;
    const { slots } = await fetchSlots(availabilityQuery(date, serviceId, professionalId), signal);
    if (slots.length) return date;
  }
  return null;
}

export function useSlots(date: string, serviceId: string, professionalId: string, active: boolean) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<AvailabilityResult | null>(null);
  const query = availabilityQuery(date, serviceId, professionalId);
  const request = active && serviceId && isBookingDay(date, todayInLima()) ? `${query}|${attempt}` : "";

  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();

    fetchSlots(query, controller.signal)
      .then(({ slots }) => {
        if (!controller.signal.aborted) setResult({ request, slots, error: "" });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ request, slots: [], error: bookingMessage(error) });
      });

    return () => controller.abort();
  }, [query, request]);

  const matching = request && result?.request === request ? result : null;

  return {
    slots: matching?.slots ?? [],
    error: matching?.error ?? "",
    loading: Boolean(request && !matching),
    refresh: () => setAttempt((value) => value + 1),
  };
}

export function useHoldClock(expiresAt: string | undefined) {
  const [clock, setClock] = useState<{ expiresAt: string; seconds: number } | null>(null);

  useEffect(() => {
    if (!expiresAt) return;
    const expiration = expiresAt;
    const deadline = Date.parse(expiration);
    let timer: ReturnType<typeof setTimeout>;

    function tick() {
      const remaining = deadline - Date.now();
      setClock({ expiresAt: expiration, seconds: Math.max(0, Math.ceil(remaining / 1000)) });
      if (remaining > 0) timer = setTimeout(tick, remaining % 1000 || 1000);
    }

    timer = setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }, [expiresAt]);

  return clock && clock.expiresAt === expiresAt ? clock.seconds : null;
}
