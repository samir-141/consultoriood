import { HttpError } from "@/lib/http";
import { optionalText } from "@/lib/clinical-validation";

export type ToothSurface = "O" | "M" | "D" | "V" | "L";

export type ToothConditionColor = "red" | "blue" | "neutral";

export type ToothRecord = {
  surfaces?: Partial<Record<ToothSurface, ToothConditionColor>>;
  code?: string;
  color?: ToothConditionColor;
  note?: string;
};

export type OdontogramSnapshot = {
  date: string;
  teeth: Record<string, ToothRecord>;
  specifications: string;
  observations: string;
};

export type BudgetItemRow = {
  id: string;
  quantity: number;
  treatment: string;
  unitPriceCents: number;
};

export type PerformedPaymentRow = {
  id: string;
  date: string;
  treatmentDone: string;
  onAccountCents: number;
  patientSigned: boolean;
};

export type ClinicalHistoryData = {
  recordNumber: string;
  attentionDate: string;
  filiation: {
    fullName: string;
    sex: "" | "F" | "M" | "Otro";
    age: string;
    dni: string;
    birthDate: string;
    originPlace: string;
    currentAddress: string;
    occupation: string;
    phone: string;
    isMinor: boolean;
    guardianName: string;
    guardianDni: string;
    guardianPhone: string;
    chiefComplaint: string;
  };
  currentIllness: {
    duration: string;
    signsAndSymptoms: string;
    story: string;
  };
  background: {
    personalHistory: string;
    drugAllergy: "" | "NO" | "SI";
    drugAllergyDetail: string;
    takingMedication: "" | "NO" | "SI";
    takingMedicationDetail: string;
    familyHistory: string;
  };
  generalExam: {
    findings: string;
    bloodPressure: string;
    pulse: string;
    temperature: string;
    heartRate: string;
    respiratoryRate: string;
  };
  stomatologicExam: string;
  presumptiveDiagnosis: string;
  auxiliaryExamsResult: string;
  definitiveDiagnosis: string;
  treatmentPlanNotes: string;
  controlAndEvolution: string;
  dischargeSummary: string;
  dischargeDate: string;
  clinicianStamp: string;
  informedConsent: {
    patientName: string;
    patientDni: string;
    accepted: boolean;
    city: string;
    day: string;
    month: string;
    year: string;
  };
  odontogramInitial: OdontogramSnapshot;
  odontogramFinal: OdontogramSnapshot;
  budgetItems: BudgetItemRow[];
  performedPayments: PerformedPaymentRow[];
};

const monthNamesEs = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function computeAgeText(birthDate?: string | null): string {
  if (!birthDate) return "";
  const parsed = new Date(birthDate.slice(0, 10) + "T12:00:00Z");
  if (Number.isNaN(parsed.getTime())) return "";
  const now = new Date();
  let age = now.getUTCFullYear() - parsed.getUTCFullYear();
  const m = now.getUTCMonth() - parsed.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < parsed.getUTCDate())) age -= 1;
  return age >= 0 && age <= 125 ? `${age} años` : "";
}

export function createEmptyClinicalHistory(patient?: {
  id?: string;
  name?: string;
  phone?: string | null;
  dni?: string | null;
  birthDate?: string | null;
  background?: string | null;
}): ClinicalHistoryData {
  const now = new Date();
  const limaIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [year, month, day] = limaIso.split("-");
  const monthLabel = monthNamesEs[Math.max(0, Number(month) - 1)] ?? "";
  const suffix = patient?.id ? patient.id.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase() : "0001";

  return {
    recordNumber: suffix ? `HC-${suffix}` : "",
    attentionDate: limaIso,
    filiation: {
      fullName: patient?.name ?? "",
      sex: "",
      age: computeAgeText(patient?.birthDate),
      dni: patient?.dni ?? "",
      birthDate: patient?.birthDate?.slice(0, 10) ?? "",
      originPlace: "",
      currentAddress: "",
      occupation: "",
      phone: patient?.phone ?? "",
      isMinor: false,
      guardianName: "",
      guardianDni: "",
      guardianPhone: "",
      chiefComplaint: "",
    },
    currentIllness: {
      duration: "",
      signsAndSymptoms: "",
      story: "",
    },
    background: {
      personalHistory: patient?.background ?? "",
      drugAllergy: "",
      drugAllergyDetail: "",
      takingMedication: "",
      takingMedicationDetail: "",
      familyHistory: "",
    },
    generalExam: {
      findings: "",
      bloodPressure: "",
      pulse: "",
      temperature: "",
      heartRate: "",
      respiratoryRate: "",
    },
    stomatologicExam: "",
    presumptiveDiagnosis: "",
    auxiliaryExamsResult: "",
    definitiveDiagnosis: "",
    treatmentPlanNotes: "",
    controlAndEvolution: "",
    dischargeSummary: "",
    dischargeDate: "",
    clinicianStamp: "",
    informedConsent: {
      patientName: patient?.name ?? "",
      patientDni: patient?.dni ?? "",
      accepted: false,
      city: "Ayacucho",
      day: String(Number(day)),
      month: monthLabel,
      year,
    },
    odontogramInitial: {
      date: limaIso,
      teeth: {},
      specifications: "",
      observations: "",
    },
    odontogramFinal: {
      date: "",
      teeth: {},
      specifications: "",
      observations: "",
    },
    budgetItems: [],
    performedPayments: [],
  };
}

export function mergeClinicalHistory(
  saved: Partial<ClinicalHistoryData> | null | undefined,
  patient?: Parameters<typeof createEmptyClinicalHistory>[0],
): ClinicalHistoryData {
  const base = createEmptyClinicalHistory(patient);
  if (!saved || typeof saved !== "object") return base;

  return {
    ...base,
    ...saved,
    filiation: { ...base.filiation, ...(saved.filiation ?? {}) },
    currentIllness: { ...base.currentIllness, ...(saved.currentIllness ?? {}) },
    background: { ...base.background, ...(saved.background ?? {}) },
    generalExam: { ...base.generalExam, ...(saved.generalExam ?? {}) },
    informedConsent: { ...base.informedConsent, ...(saved.informedConsent ?? {}) },
    odontogramInitial: {
      ...base.odontogramInitial,
      ...(saved.odontogramInitial ?? {}),
      teeth: { ...(saved.odontogramInitial?.teeth ?? {}) },
    },
    odontogramFinal: {
      ...base.odontogramFinal,
      ...(saved.odontogramFinal ?? {}),
      teeth: { ...(saved.odontogramFinal?.teeth ?? {}) },
    },
    budgetItems: Array.isArray(saved.budgetItems) ? saved.budgetItems : base.budgetItems,
    performedPayments: Array.isArray(saved.performedPayments) ? saved.performedPayments : base.performedPayments,
  };
}

const VALID_FDI_TEETH = new Set<string>([
  ...Array.from({ length: 8 }, (_, i) => String(11 + i)),
  ...Array.from({ length: 8 }, (_, i) => String(21 + i)),
  ...Array.from({ length: 8 }, (_, i) => String(31 + i)),
  ...Array.from({ length: 8 }, (_, i) => String(41 + i)),
  ...Array.from({ length: 5 }, (_, i) => String(51 + i)),
  ...Array.from({ length: 5 }, (_, i) => String(61 + i)),
  ...Array.from({ length: 5 }, (_, i) => String(71 + i)),
  ...Array.from({ length: 5 }, (_, i) => String(81 + i)),
]);

const VALID_SURFACES = new Set<ToothSurface>(["O", "M", "D", "V", "L"]);
const VALID_COLORS = new Set<ToothConditionColor>(["red", "blue", "neutral"]);

function cleanDate(value: unknown, label: string): string {
  const text = optionalText(value, label, 20);
  if (!text) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new HttpError(400, `Revisa ${label}. Usa formato AAAA-MM-DD.`);
  }
  return text;
}

function cleanOdontogramSnapshot(raw: unknown, label: string): OdontogramSnapshot {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const teethRaw = obj.teeth && typeof obj.teeth === "object" && !Array.isArray(obj.teeth)
    ? (obj.teeth as Record<string, unknown>)
    : {};
  const teeth: Record<string, ToothRecord> = {};

  for (const [toothId, val] of Object.entries(teethRaw)) {
    if (!VALID_FDI_TEETH.has(toothId) || !val || typeof val !== "object" || Array.isArray(val)) continue;
    const entry = val as Record<string, unknown>;
    const surfaces: Partial<Record<ToothSurface, ToothConditionColor>> = {};
    if (entry.surfaces && typeof entry.surfaces === "object" && !Array.isArray(entry.surfaces)) {
      for (const [surf, col] of Object.entries(entry.surfaces as Record<string, unknown>)) {
        if (VALID_SURFACES.has(surf as ToothSurface) && VALID_COLORS.has(col as ToothConditionColor)) {
          surfaces[surf as ToothSurface] = col as ToothConditionColor;
        }
      }
    }
    const code = optionalText(entry.code, "el código de pieza", 12);
    const color = VALID_COLORS.has(entry.color as ToothConditionColor) ? (entry.color as ToothConditionColor) : undefined;
    const note = optionalText(entry.note, "la nota de pieza", 250);
    if (Object.keys(surfaces).length > 0 || code || note) {
      teeth[toothId] = {
        ...(Object.keys(surfaces).length > 0 ? { surfaces } : {}),
        ...(code ? { code } : {}),
        ...(color ? { color } : {}),
        ...(note ? { note } : {}),
      };
    }
  }

  return {
    date: cleanDate(obj.date, `la fecha de ${label}`),
    teeth,
    specifications: optionalText(obj.specifications, `las especificaciones de ${label}`, 2000),
    observations: optionalText(obj.observations, `las observaciones de ${label}`, 2000),
  };
}

export function validateClinicalHistoryPayload(raw: unknown): ClinicalHistoryData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new HttpError(400, "Envía los datos de la historia clínica.");
  }
  const body = raw as Record<string, unknown>;
  const fil = (body.filiation ?? {}) as Record<string, unknown>;
  const cur = (body.currentIllness ?? {}) as Record<string, unknown>;
  const bg = (body.background ?? {}) as Record<string, unknown>;
  const gen = (body.generalExam ?? {}) as Record<string, unknown>;
  const con = (body.informedConsent ?? {}) as Record<string, unknown>;

  const sexRaw = optionalText(fil.sex, "el sexo", 10);
  const sex = (["", "F", "M", "Otro"] as const).includes(sexRaw as "" | "F" | "M" | "Otro")
    ? (sexRaw as "" | "F" | "M" | "Otro")
    : "";

  const drugAllergyRaw = optionalText(bg.drugAllergy, "la alergia a medicamentos", 5);
  const drugAllergy = (["", "NO", "SI"] as const).includes(drugAllergyRaw as "" | "NO" | "SI")
    ? (drugAllergyRaw as "" | "NO" | "SI")
    : "";

  const takingMedRaw = optionalText(bg.takingMedication, "el uso de medicamentos", 5);
  const takingMedication = (["", "NO", "SI"] as const).includes(takingMedRaw as "" | "NO" | "SI")
    ? (takingMedRaw as "" | "NO" | "SI")
    : "";

  const budgetRaw = Array.isArray(body.budgetItems) ? body.budgetItems.slice(0, 30) : [];
  const budgetItems: BudgetItemRow[] = budgetRaw.map((item, idx) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const quantity = typeof row.quantity === "number" && Number.isFinite(row.quantity)
      ? Math.max(1, Math.min(999, Math.round(row.quantity)))
      : 1;
    const unitPriceCents = typeof row.unitPriceCents === "number" && Number.isFinite(row.unitPriceCents)
      ? Math.max(0, Math.min(99_999_999, Math.round(row.unitPriceCents)))
      : 0;
    return {
      id: optionalText(row.id, "el identificador de presupuesto", 80) || `b-${idx + 1}`,
      quantity,
      treatment: optionalText(row.treatment, "el tratamiento del presupuesto", 300),
      unitPriceCents,
    };
  }).filter((row) => row.treatment.length > 0 || row.unitPriceCents > 0);

  const paymentsRaw = Array.isArray(body.performedPayments) ? body.performedPayments.slice(0, 60) : [];
  const performedPayments: PerformedPaymentRow[] = paymentsRaw.map((item, idx) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const onAccountCents = typeof row.onAccountCents === "number" && Number.isFinite(row.onAccountCents)
      ? Math.max(0, Math.min(99_999_999, Math.round(row.onAccountCents)))
      : 0;
    return {
      id: optionalText(row.id, "el identificador de pago", 80) || `p-${idx + 1}`,
      date: cleanDate(row.date, "la fecha de tratamiento realizado"),
      treatmentDone: optionalText(row.treatmentDone, "el tratamiento efectuado", 300),
      onAccountCents,
      patientSigned: row.patientSigned === true,
    };
  }).filter((row) => row.treatmentDone.length > 0 || row.onAccountCents > 0 || row.date.length > 0);

  return {
    recordNumber: optionalText(body.recordNumber, "el N° de historia clínica", 40),
    attentionDate: cleanDate(body.attentionDate, "la fecha de atención"),
    filiation: {
      fullName: optionalText(fil.fullName, "los nombres y apellidos", 160),
      sex,
      age: optionalText(fil.age, "la edad", 40),
      dni: optionalText(fil.dni, "el DNI", 20),
      birthDate: cleanDate(fil.birthDate, "la fecha de nacimiento"),
      originPlace: optionalText(fil.originPlace, "el lugar de procedencia", 120),
      currentAddress: optionalText(fil.currentAddress, "el domicilio actual", 240),
      occupation: optionalText(fil.occupation, "la ocupación", 120),
      phone: optionalText(fil.phone, "el teléfono", 40),
      isMinor: fil.isMinor === true,
      guardianName: optionalText(fil.guardianName, "el nombre del apoderado", 160),
      guardianDni: optionalText(fil.guardianDni, "el DNI del apoderado", 20),
      guardianPhone: optionalText(fil.guardianPhone, "el teléfono del apoderado", 40),
      chiefComplaint: optionalText(fil.chiefComplaint, "el motivo de consulta", 2000),
    },
    currentIllness: {
      duration: optionalText(cur.duration, "el tiempo de enfermedad", 200),
      signsAndSymptoms: optionalText(cur.signsAndSymptoms, "los signos y síntomas", 1000),
      story: optionalText(cur.story, "el relato de la enfermedad", 3000),
    },
    background: {
      personalHistory: optionalText(bg.personalHistory, "los antecedentes personales", 3000),
      drugAllergy,
      drugAllergyDetail: optionalText(bg.drugAllergyDetail, "el detalle de alergias", 600),
      takingMedication,
      takingMedicationDetail: optionalText(bg.takingMedicationDetail, "el medicamento actual", 600),
      familyHistory: optionalText(bg.familyHistory, "los antecedentes familiares", 3000),
    },
    generalExam: {
      findings: optionalText(gen.findings, "el examen clínico general", 3000),
      bloodPressure: optionalText(gen.bloodPressure, "la presión arterial", 30),
      pulse: optionalText(gen.pulse, "el pulso", 30),
      temperature: optionalText(gen.temperature, "la temperatura", 30),
      heartRate: optionalText(gen.heartRate, "la frecuencia cardíaca", 30),
      respiratoryRate: optionalText(gen.respiratoryRate, "la frecuencia respiratoria", 30),
    },
    stomatologicExam: optionalText(body.stomatologicExam, "el examen clínico odontoestomatológico", 4000),
    presumptiveDiagnosis: optionalText(body.presumptiveDiagnosis, "el diagnóstico presuntivo", 2000),
    auxiliaryExamsResult: optionalText(body.auxiliaryExamsResult, "el resultado de exámenes auxiliares", 2000),
    definitiveDiagnosis: optionalText(body.definitiveDiagnosis, "el diagnóstico definitivo", 2000),
    treatmentPlanNotes: optionalText(body.treatmentPlanNotes, "el plan de tratamiento", 3000),
    controlAndEvolution: optionalText(body.controlAndEvolution, "el control y evolución", 4000),
    dischargeSummary: optionalText(body.dischargeSummary, "el alta del paciente", 2000),
    dischargeDate: cleanDate(body.dischargeDate, "la fecha del alta"),
    clinicianStamp: optionalText(body.clinicianStamp, "el sello y firma", 160),
    informedConsent: {
      patientName: optionalText(con.patientName, "el nombre en consentimiento", 160),
      patientDni: optionalText(con.patientDni, "el DNI en consentimiento", 20),
      accepted: con.accepted === true,
      city: optionalText(con.city, "la ciudad del consentimiento", 60) || "Ayacucho",
      day: optionalText(con.day, "el día del consentimiento", 10),
      month: optionalText(con.month, "el mes del consentimiento", 30),
      year: optionalText(con.year, "el año del consentimiento", 10),
    },
    odontogramInitial: cleanOdontogramSnapshot(body.odontogramInitial, "odontograma inicial"),
    odontogramFinal: cleanOdontogramSnapshot(body.odontogramFinal, "odontograma final"),
    budgetItems,
    performedPayments,
  };
}
