export type Patient = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  birthDate?: string;
};

export type Payment = {
  id: string;
  patientId?: string;
  patientName?: string;
  appointmentId?: string;
  planId?: string;
  amountCents: number;
  method: string;
  reference?: string;
  status: string;
  proofName?: string;
  createdAt?: string;
  reason?: string;
};

export type Balance = {
  id: string;
  kind: "APPOINTMENT" | "PLAN";
  label: string;
  patientId?: string;
  patientName?: string;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
};

const moneyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
});

export function formatMoney(cents: number): string {
  return moneyFormatter.format(cents / 100);
}

export function formatDate(value?: string): string {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: value.includes("T") ? "short" : undefined,
    timeZone: "America/Lima",
  }).format(date);
}

export function patientOption(patient: Patient): string {
  return patient.phone ? `${patient.name} · ${patient.phone}` : patient.name;
}

export function statusLabel(status: string): string {
  switch (status.toUpperCase()) {
    case "PENDING": return "Pendiente";
    case "CONFIRMED": return "Confirmado";
    case "REJECTED": return "Rechazado";
    case "REFUNDED": return "Reembolsado";
    default: return status;
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}

export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const headers = new Headers(init?.headers);
  if (init?.body && !isForm && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, { ...init, headers, credentials: "same-origin" });
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const error =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `No se pudo completar la solicitud (${response.status}).`;
    throw new Error(error);
  }

  return payload as T;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("No se pudo leer el comprobante."));
        return;
      }
      resolve(reader.result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("No se pudo leer el comprobante."));
    reader.readAsDataURL(file);
  });
}
