"use client";

import { useEffect, useState } from "react";

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

export function postBooking<T>(path: string, data: object) {
  return bookingRequest<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function reservationPath(token: string) {
  return `/api/reservas/${encodeURIComponent(token)}`;
}

export function bookingMessage(error: unknown) {
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

const isoFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "America/Lima",
});

const priceFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
});

export function todayInLima() {
  return isoFormatter.format(new Date());
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

type AvailabilityResult = { request: string; slots: Slot[]; error: string };

export function useSlots(date: string, serviceId: string, professionalId: string, active: boolean) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<AvailabilityResult | null>(null);
  const query = new URLSearchParams({ date, serviceId, professionalId }).toString();
  const request = active && date && serviceId ? `${query}|${attempt}` : "";

  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();

    bookingRequest<{ slots: Slot[] }>(`/api/disponibilidad?${query}`, { signal: controller.signal })
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
