import { statusLabels, type Status } from "../agenda/staff";

export type Patient = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  birthDate?: string;
};

export type Consent = {
  id: string;
  type: string;
  status: string;
  createdAt?: string;
};

type Appointment = {
  id: string;
  date: string;
  time: string;
  serviceName: string;
  status: Status;
  professionalName: string;
  professionalId: string;
};

type ClinicalNote = {
  id: string;
  appointmentId: string;
  reason: string;
  findings?: string;
  procedure?: string;
  instructions?: string;
  amendsId: string | null;
  createdAt?: string;
  authorName?: string;
};

type OdontogramEntry = {
  id: string;
  tooth: number;
  surface: string;
  status: string;
  observation?: string;
  createdAt?: string;
};

type PlanItem = {
  id?: string;
  tooth: number | null;
  procedure: string;
  priceCents: number;
  status?: string;
};

type TreatmentPlan = {
  id: string;
  title: string;
  status?: string;
  totalCents?: number;
  items: PlanItem[];
};

type Attachment = {
  id: string;
  name: string;
  mime?: string;
  size?: number;
  createdAt?: string;
};

type AuditEvent = {
  id: string;
  action: string;
  result: string;
  createdAt?: string;
  actorName?: string;
};

export type PatientRecord = {
  patient: Patient & { background?: string | null; consents?: Consent[] };
  appointments: Appointment[];
  notes: ClinicalNote[];
  odontogram: OdontogramEntry[];
  plans: TreatmentPlan[];
  attachments: Attachment[];
  audit: AuditEvent[];
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
  const date = new Date(value.includes("T") ? value : value + "T12:00:00-05:00");
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: value.includes("T") ? "short" : undefined,
    timeZone: "America/Lima",
  }).format(date);
}

export function formatSize(bytes?: number): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function appointmentLabel(appointment: Appointment): string {
  return [formatDate(appointment.date), appointment.time, appointment.serviceName, statusLabels[appointment.status]].join(" · ");
}

export function patientOption(patient: Patient): string {
  return patient.phone ? `${patient.name} · ${patient.phone}` : patient.name;
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
