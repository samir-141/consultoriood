"use client";

import { useRef, useState, type FormEvent } from "react";
import { lookupDniReniec } from "@/app/components/reniec-lookup";
import type { ClinicalHistoryData } from "@/lib/clinical-history";
import { parseSoles } from "@/lib/clinical-money";
import { appointmentLabel, formatDate, formatMoney, formatSize, type PatientRecord } from "./clinica-data";
import { OdontogramChart } from "./odontogram-chart";
import styles from "./clinica.module.css";

type EditorStepId =
  | "anamnesis"
  | "examen"
  | "odontograma"
  | "plan"
  | "presupuesto"
  | "consentimiento";

const EDITOR_STEPS: { id: EditorStepId; label: string; shortLabel: string }[] = [
  { id: "anamnesis", label: "I. Anamnesis y Filiación", shortLabel: "1. Anamnesis" },
  { id: "examen", label: "II–IV. Examen y Diagnóstico", shortLabel: "2. Examen y Dx" },
  { id: "odontograma", label: "Odontograma (Inicial y Final)", shortLabel: "3. Odontograma" },
  { id: "plan", label: "V–VII. Plan, Evolución y Alta", shortLabel: "4. Plan y Alta" },
  { id: "presupuesto", label: "Presupuesto y Pagos", shortLabel: "5. Presupuesto" },
  { id: "consentimiento", label: "Consentimiento y Adjuntos", shortLabel: "6. Consentimiento" },
];

type EligibleAppointment = PatientRecord["appointments"][number];

type HistoryEditorProps = Readonly<{
  patientId: string;
  record: PatientRecord;
  draft: ClinicalHistoryData;
  dirty: boolean;
  saving: boolean;
  initialStep?: string;
  eligibleAppointments: EligibleAppointment[];
  onChange: (next: ClinicalHistoryData) => void;
  onSaveHistory: () => Promise<boolean>;
  onSwitchToViewer: () => void;
  onPostAction: (payload: Record<string, unknown>, success: string) => Promise<boolean>;
  onUploadAttachment: (file: File) => Promise<boolean>;
}>;

function solesInput(cents: number): string {
  if (!cents) return "";
  return (cents / 100).toFixed(2);
}

function resolveInitialStep(value?: string): EditorStepId {
  return EDITOR_STEPS.some((item) => item.id === value) ? (value as EditorStepId) : "anamnesis";
}

export function HistoryEditor({
  patientId,
  record,
  draft,
  dirty,
  saving,
  initialStep,
  eligibleAppointments,
  onChange,
  onSaveHistory,
  onSwitchToViewer,
  onPostAction,
  onUploadAttachment,
}: HistoryEditorProps) {
  const [step, setStep] = useState<EditorStepId>(() => resolveInitialStep(initialStep));
  const [odonTab, setOdonTab] = useState<"initial" | "final">("initial");
  const [reniecBusy, setReniecBusy] = useState(false);
  const [reniecMsg, setReniecMsg] = useState("");
  const [noteForm, setNoteForm] = useState({
    appointmentId: eligibleAppointments[0]?.id ?? "",
    reason: "",
    findings: "",
    procedure: "",
    instructions: "",
    amendsId: "",
  });
  const [localError, setLocalError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  const stepIndex = EDITOR_STEPS.findIndex((s) => s.id === step);

  function goToStep(nextStep: EditorStepId) {
    setStep(nextStep);
    setLocalError("");
    requestAnimationFrame(() => stepHeadingRef.current?.focus());
  }

  function updateFiliation<K extends keyof ClinicalHistoryData["filiation"]>(
    key: K,
    value: ClinicalHistoryData["filiation"][K],
  ) {
    const nextFiliation = { ...draft.filiation, [key]: value };
    onChange({
      ...draft,
      filiation: nextFiliation,
      ...(key === "fullName" ? { informedConsent: { ...draft.informedConsent, patientName: String(value) } } : {}),
      ...(key === "dni" ? { informedConsent: { ...draft.informedConsent, patientDni: String(value) } } : {}),
    });
  }

  async function consultReniecForHistory(rawDni: string, overwriteName: boolean) {
    const clean = rawDni.replace(/\D/g, "").slice(0, 8);
    if (clean.length !== 8) {
      setReniecMsg("Ingresa 8 dígitos de DNI para consultar RENIEC.");
      return;
    }
    setReniecBusy(true);
    setReniecMsg("");
    try {
      const res = await lookupDniReniec(clean);
      if (res.ok && res.fullName) {
        if (overwriteName || !draft.filiation.fullName.trim()) {
          onChange({
            ...draft,
            filiation: { ...draft.filiation, dni: clean, fullName: res.fullName },
            informedConsent: { ...draft.informedConsent, patientDni: clean, patientName: res.fullName },
          });
        }
        setReniecMsg("✓ Nombre completado desde RENIEC.");
      } else {
        setReniecMsg(res.message ?? res.error ?? "No se encontró el DNI en RENIEC.");
      }
    } catch {
      setReniecMsg("No se pudo conectar con RENIEC.");
    } finally {
      setReniecBusy(false);
    }
  }

  function addBudgetRow() {
    onChange({
      ...draft,
      budgetItems: [
        ...draft.budgetItems,
        { id: `b-${Date.now()}`, quantity: 1, treatment: "", unitPriceCents: 0 },
      ],
    });
  }

  function addPaymentRow() {
    onChange({
      ...draft,
      performedPayments: [
        ...draft.performedPayments,
        {
          id: `p-${Date.now()}`,
          date: draft.attentionDate || new Date().toISOString().slice(0, 10),
          treatmentDone: "",
          onAccountCents: 0,
          patientSigned: false,
        },
      ],
    });
  }

  async function handleSave(event?: FormEvent) {
    event?.preventDefault();
    setLocalError("");
    await onSaveHistory();
  }

  async function submitQuickNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!noteForm.appointmentId || !noteForm.reason.trim()) {
      setLocalError("Elige una cita e indica el motivo de la nota.");
      return;
    }
    setLocalError("");
    const ok = await onPostAction(
      {
        action: "note",
        appointmentId: noteForm.appointmentId,
        reason: noteForm.reason.trim(),
        findings: noteForm.findings.trim(),
        procedure: noteForm.procedure.trim(),
        instructions: noteForm.instructions.trim(),
        ...(noteForm.amendsId ? { amendsId: noteForm.amendsId } : {}),
      },
      noteForm.amendsId ? "Enmienda registrada." : "Nota de evolución registrada.",
    );
    if (ok) {
      setNoteForm({ appointmentId: eligibleAppointments[0]?.id ?? "", reason: "", findings: "", procedure: "", instructions: "", amendsId: "" });
    }
  }

  async function handleFileUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setLocalError("Selecciona un archivo PDF, PNG o JPG.");
      return;
    }
    const ok = await onUploadAttachment(file);
    if (ok && fileInputRef.current) fileInputRef.current.value = "";
  }

  const budgetGrandTotalCents = draft.budgetItems.reduce(
    (acc, item) => acc + item.quantity * item.unitPriceCents,
    0,
  );
  const totalPaidCents = draft.performedPayments.reduce((acc, row) => acc + row.onAccountCents, 0);

  return (
    <div className={styles.editorShell}>
      <div className={styles.stickySaveBar}>
        <div className={styles.saveBarInfo}>
          <strong>Modo 1 · Llenado de Historia Clínica</strong>
          <span className={dirty ? styles.dirtyBadge : styles.savedBadge}>
            {dirty ? "Cambios sin guardar" : "Al día"}
          </span>
        </div>
        <div className={styles.actionsRow}>
          <button type="button" className={styles.buttonSecondary} onClick={onSwitchToViewer}>
            Visualizar ficha completa
          </button>
          <button type="button" className={styles.button} disabled={saving} onClick={() => void handleSave()}>
            {saving ? "Guardando…" : "Guardar historia clínica"}
          </button>
        </div>
      </div>

      {/* Stepper / Section Tabs */}
      <nav aria-label="Secciones de la historia clínica" className={styles.stepTabs}>
        <div role="tablist" aria-label="Pasos de llenado" className={styles.stepTabList}>
          {EDITOR_STEPS.map((item) => {
            const active = item.id === step;
            return (
              <button
                key={item.id}
                id={`tab-step-${item.id}`}
                type="button"
                role="tab"
                aria-selected={active}
                className={styles.stepTabBtn}
                onClick={() => goToStep(item.id)}
              >
                {item.shortLabel}
              </button>
            );
          })}
        </div>
      </nav>

      {localError ? <p className={styles.error} role="alert">{localError}</p> : null}

      <form className={styles.card} onSubmit={handleSave}>
        {/* STEP 1: I. ANAMNESIS */}
        {step === "anamnesis" ? (
          <div role="tabpanel" aria-labelledby="tab-step-anamnesis" className={styles.stack}>
            <div className={styles.sectionHead}>
              <h2 ref={stepHeadingRef} tabIndex={-1}>I. Anamnesis</h2>
              <span className={styles.meta}>Encabezado, Filiación, Enfermedad Actual y Antecedentes</span>
            </div>

            <div className={styles.twoColumns}>
              <label className={styles.field}>
                <span>N° Historia Clínica</span>
                <input
                  className={styles.input}
                  value={draft.recordNumber}
                  onChange={(e) => onChange({ ...draft, recordNumber: e.target.value })}
                  placeholder="Ej. HC-0042"
                />
              </label>
              <label className={styles.field}>
                <span>Fecha de Atención</span>
                <input
                  type="date"
                  className={styles.input}
                  value={draft.attentionDate}
                  onChange={(e) => onChange({ ...draft, attentionDate: e.target.value })}
                />
              </label>
            </div>

            <fieldset className={styles.fieldset}>
              <legend>A) Filiación</legend>
              <div className={styles.formGrid}>
                <label className={`${styles.field} ${styles.colSpan2}`}>
                  <span>Nombres y apellidos</span>
                  <input
                    className={styles.input}
                    value={draft.filiation.fullName}
                    onChange={(e) => updateFiliation("fullName", e.target.value)}
                    placeholder="Nombre completo del paciente"
                  />
                </label>
                <label className={styles.field}>
                  <span>Sexo</span>
                  <select
                    className={styles.select}
                    value={draft.filiation.sex}
                    onChange={(e) => updateFiliation("sex", e.target.value as ClinicalHistoryData["filiation"]["sex"])}
                  >
                    <option value="">Seleccionar</option>
                    <option value="F">Femenino</option>
                    <option value="M">Masculino</option>
                    <option value="Otro">Otro</option>
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Edad</span>
                  <input
                    className={styles.input}
                    value={draft.filiation.age}
                    onChange={(e) => updateFiliation("age", e.target.value)}
                    placeholder="Ej. 32 años"
                  />
                </label>
                <div className={styles.field}>
                  <span>DNI (autocompleta con RENIEC)</span>
                  <div className={styles.actionsRow}>
                    <input
                      className={styles.input}
                      inputMode="numeric"
                      maxLength={20}
                      value={draft.filiation.dni}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateFiliation("dni", val);
                        if (/^\d{8}$/.test(val.trim()) && !draft.filiation.fullName.trim()) {
                          void consultReniecForHistory(val, false);
                        }
                      }}
                      placeholder="8 dígitos"
                    />
                    <button
                      type="button"
                      className={styles.buttonSecondary}
                      disabled={reniecBusy || draft.filiation.dni.replace(/\D/g, "").length !== 8}
                      onClick={() => void consultReniecForHistory(draft.filiation.dni, true)}
                    >
                      {reniecBusy ? "Buscando…" : "RENIEC"}
                    </button>
                  </div>
                  {reniecMsg ? <span className={styles.meta}>{reniecMsg}</span> : null}
                </div>
                <label className={styles.field}>
                  <span>Fecha de nacimiento</span>
                  <input
                    type="date"
                    className={styles.input}
                    value={draft.filiation.birthDate}
                    onChange={(e) => updateFiliation("birthDate", e.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span>Lugar de procedencia</span>
                  <input
                    className={styles.input}
                    value={draft.filiation.originPlace}
                    onChange={(e) => updateFiliation("originPlace", e.target.value)}
                    placeholder="Ej. Huamanga, Ayacucho"
                  />
                </label>
                <label className={styles.field}>
                  <span>Domicilio actual</span>
                  <input
                    className={styles.input}
                    value={draft.filiation.currentAddress}
                    onChange={(e) => updateFiliation("currentAddress", e.target.value)}
                    placeholder="Dirección actual"
                  />
                </label>
                <label className={styles.field}>
                  <span>Ocupación</span>
                  <input
                    className={styles.input}
                    value={draft.filiation.occupation}
                    onChange={(e) => updateFiliation("occupation", e.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span>Teléfono</span>
                  <input
                    type="tel"
                    className={styles.input}
                    value={draft.filiation.phone}
                    onChange={(e) => updateFiliation("phone", e.target.value)}
                  />
                </label>
              </div>

              <label className={styles.checkboxLine}>
                <input
                  type="checkbox"
                  checked={draft.filiation.isMinor}
                  onChange={(e) => updateFiliation("isMinor", e.target.checked)}
                />
                <span>Paciente menor de edad (registrar datos del apoderado)</span>
              </label>

              {draft.filiation.isMinor ? (
                <div className={styles.threeColumns}>
                  <label className={styles.field}>
                    <span>Nombre del apoderado</span>
                    <input
                      className={styles.input}
                      value={draft.filiation.guardianName}
                      onChange={(e) => updateFiliation("guardianName", e.target.value)}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>DNI del apoderado</span>
                    <input
                      className={styles.input}
                      inputMode="numeric"
                      value={draft.filiation.guardianDni}
                      onChange={(e) => updateFiliation("guardianDni", e.target.value)}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Teléfono del apoderado</span>
                    <input
                      type="tel"
                      className={styles.input}
                      value={draft.filiation.guardianPhone}
                      onChange={(e) => updateFiliation("guardianPhone", e.target.value)}
                    />
                  </label>
                </div>
              ) : null}

              <label className={styles.field}>
                <span>Motivo de consulta</span>
                <textarea
                  className={styles.textarea}
                  rows={2}
                  value={draft.filiation.chiefComplaint}
                  onChange={(e) => updateFiliation("chiefComplaint", e.target.value)}
                  placeholder="Motivo principal por el que acude el paciente..."
                />
              </label>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend>B) Enfermedad Actual</legend>
              <div className={styles.twoColumns}>
                <label className={styles.field}>
                  <span>Tiempo de la enfermedad</span>
                  <input
                    className={styles.input}
                    value={draft.currentIllness.duration}
                    onChange={(e) => onChange({ ...draft, currentIllness: { ...draft.currentIllness, duration: e.target.value } })}
                    placeholder="Ej. 5 días / 2 semanas"
                  />
                </label>
                <label className={styles.field}>
                  <span>Signos y síntomas principales</span>
                  <input
                    className={styles.input}
                    value={draft.currentIllness.signsAndSymptoms}
                    onChange={(e) => onChange({ ...draft, currentIllness: { ...draft.currentIllness, signsAndSymptoms: e.target.value } })}
                    placeholder="Ej. Dolor pulsátil al frío, inflamación gingival"
                  />
                </label>
              </div>
              <label className={styles.field}>
                <span>Relato de la enfermedad</span>
                <textarea
                  className={styles.textarea}
                  rows={3}
                  value={draft.currentIllness.story}
                  onChange={(e) => onChange({ ...draft, currentIllness: { ...draft.currentIllness, story: e.target.value } })}
                  placeholder="Descripción cronológica del cuadro clínico..."
                />
              </label>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend>C) Antecedentes</legend>
              <label className={styles.field}>
                <span>Antecedentes personales</span>
                <textarea
                  className={styles.textarea}
                  rows={2}
                  value={draft.background.personalHistory}
                  onChange={(e) => onChange({ ...draft, background: { ...draft.background, personalHistory: e.target.value } })}
                  placeholder="Hipertensión, diabetes, cirugías previas, hábitos..."
                />
              </label>

              <div className={styles.twoColumns}>
                <div className={styles.subBox}>
                  <span className={styles.subLabel}>¿Es alérgico a algún medicamento?</span>
                  <div className={styles.radioRow}>
                    {(["NO", "SI"] as const).map((val) => (
                      <label key={val} className={styles.radioPill}>
                        <input
                          type="radio"
                          name="drugAllergy"
                          checked={draft.background.drugAllergy === val}
                          onChange={() => onChange({ ...draft, background: { ...draft.background, drugAllergy: val } })}
                        />
                        <span>{val === "SI" ? "Sí" : "No"}</span>
                      </label>
                    ))}
                  </div>
                  <input
                    className={styles.input}
                    value={draft.background.drugAllergyDetail}
                    onChange={(e) => onChange({ ...draft, background: { ...draft.background, drugAllergyDetail: e.target.value } })}
                    placeholder="Especificar medicamento o reacción (si aplica)"
                  />
                </div>

                <div className={styles.subBox}>
                  <span className={styles.subLabel}>¿Ha tomado algún medicamento recientemente?</span>
                  <div className={styles.radioRow}>
                    {(["NO", "SI"] as const).map((val) => (
                      <label key={val} className={styles.radioPill}>
                        <input
                          type="radio"
                          name="takingMedication"
                          checked={draft.background.takingMedication === val}
                          onChange={() => onChange({ ...draft, background: { ...draft.background, takingMedication: val } })}
                        />
                        <span>{val === "SI" ? "Sí" : "No"}</span>
                      </label>
                    ))}
                  </div>
                  <input
                    className={styles.input}
                    value={draft.background.takingMedicationDetail}
                    onChange={(e) => onChange({ ...draft, background: { ...draft.background, takingMedicationDetail: e.target.value } })}
                    placeholder="Nombre del medicamento y dosis (si aplica)"
                  />
                </div>
              </div>

              <label className={styles.field}>
                <span>Antecedentes familiares</span>
                <textarea
                  className={styles.textarea}
                  rows={2}
                  value={draft.background.familyHistory}
                  onChange={(e) => onChange({ ...draft, background: { ...draft.background, familyHistory: e.target.value } })}
                />
              </label>
            </fieldset>
          </div>
        ) : null}

        {/* STEP 2: II-IV EXAMEN Y DIAGNÓSTICO */}
        {step === "examen" ? (
          <div role="tabpanel" aria-labelledby="tab-step-examen" className={styles.stack}>
            <div className={styles.sectionHead}>
              <h2 ref={stepHeadingRef} tabIndex={-1}>II. Examen Clínico y Diagnóstico</h2>
              <span className={styles.meta}>Examen General, Signos Vitales, Estomatológico y Diagnósticos</span>
            </div>

            <fieldset className={styles.fieldset}>
              <legend>A) Examen Clínico General y Signos Vitales</legend>
              <label className={styles.field}>
                <span>Descripción del examen clínico general</span>
                <textarea
                  className={styles.textarea}
                  rows={3}
                  value={draft.generalExam.findings}
                  onChange={(e) => onChange({ ...draft, generalExam: { ...draft.generalExam, findings: e.target.value } })}
                  placeholder="Estado general, fascies, biotipo, marcha..."
                />
              </label>

              <div className={styles.vitalsGrid}>
                <label className={styles.field}>
                  <span>P.A.</span>
                  <input
                    className={styles.input}
                    value={draft.generalExam.bloodPressure}
                    onChange={(e) => onChange({ ...draft, generalExam: { ...draft.generalExam, bloodPressure: e.target.value } })}
                    placeholder="120/80 mmHg"
                  />
                </label>
                <label className={styles.field}>
                  <span>Pulso</span>
                  <input
                    className={styles.input}
                    value={draft.generalExam.pulse}
                    onChange={(e) => onChange({ ...draft, generalExam: { ...draft.generalExam, pulse: e.target.value } })}
                    placeholder="72 lpm"
                  />
                </label>
                <label className={styles.field}>
                  <span>Temp</span>
                  <input
                    className={styles.input}
                    value={draft.generalExam.temperature}
                    onChange={(e) => onChange({ ...draft, generalExam: { ...draft.generalExam, temperature: e.target.value } })}
                    placeholder="36.6 °C"
                  />
                </label>
                <label className={styles.field}>
                  <span>F.C.</span>
                  <input
                    className={styles.input}
                    value={draft.generalExam.heartRate}
                    onChange={(e) => onChange({ ...draft, generalExam: { ...draft.generalExam, heartRate: e.target.value } })}
                    placeholder="72 lpm"
                  />
                </label>
                <label className={styles.field}>
                  <span>Frec. Resp.</span>
                  <input
                    className={styles.input}
                    value={draft.generalExam.respiratoryRate}
                    onChange={(e) => onChange({ ...draft, generalExam: { ...draft.generalExam, respiratoryRate: e.target.value } })}
                    placeholder="18 rpm"
                  />
                </label>
              </div>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend>B) Examen Clínico Odontoestomatológico</legend>
              <label className={styles.field}>
                <span>Hallazgos extraorales e intraorales</span>
                <textarea
                  className={styles.textarea}
                  rows={4}
                  value={draft.stomatologicExam}
                  onChange={(e) => onChange({ ...draft, stomatologicExam: e.target.value })}
                  placeholder="ATM, ganglios, labios, mucosa oral, encías, lengua, paladar, oclusión..."
                />
              </label>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend>III – IV. Diagnósticos y Exámenes Auxiliares</legend>
              <label className={styles.field}>
                <span>III. Diagnóstico Presuntivo</span>
                <textarea
                  className={styles.textarea}
                  rows={2}
                  value={draft.presumptiveDiagnosis}
                  onChange={(e) => onChange({ ...draft, presumptiveDiagnosis: e.target.value })}
                />
              </label>
              <label className={styles.field}>
                <span>Resultado de exámenes auxiliares</span>
                <textarea
                  className={styles.textarea}
                  rows={2}
                  value={draft.auxiliaryExamsResult}
                  onChange={(e) => onChange({ ...draft, auxiliaryExamsResult: e.target.value })}
                  placeholder="Radiografía periapical, panorámica, análisis de laboratorio..."
                />
              </label>
              <label className={styles.field}>
                <span>IV. Diagnóstico Definitivo</span>
                <textarea
                  className={styles.textarea}
                  rows={2}
                  value={draft.definitiveDiagnosis}
                  onChange={(e) => onChange({ ...draft, definitiveDiagnosis: e.target.value })}
                />
              </label>
            </fieldset>
          </div>
        ) : null}

        {/* STEP 3: ODONTOGRAMA */}
        {step === "odontograma" ? (
          <div role="tabpanel" aria-labelledby="tab-step-odontograma" className={styles.stack}>
            <div className={styles.sectionHead}>
              <h2 ref={stepHeadingRef} tabIndex={-1}>Odontograma (NTS N° 188-MINSA)</h2>
              <div className={styles.actionsRow}>
                <button
                  type="button"
                  className={odonTab === "initial" ? styles.button : styles.buttonSecondary}
                  onClick={() => setOdonTab("initial")}
                >
                  Odontograma Inicial
                </button>
                <button
                  type="button"
                  className={odonTab === "final" ? styles.button : styles.buttonSecondary}
                  onClick={() => setOdonTab("final")}
                >
                  Odontograma Final
                </button>
                <button
                  type="button"
                  className={styles.buttonQuiet}
                  onClick={() => {
                    onChange({
                      ...draft,
                      odontogramFinal: {
                        ...draft.odontogramInitial,
                        date: draft.odontogramFinal.date || draft.attentionDate,
                        teeth: structuredClone(draft.odontogramInitial.teeth),
                      },
                    });
                    setOdonTab("final");
                  }}
                >
                  Copiar Inicial → Final
                </button>
              </div>
            </div>

            {odonTab === "initial" ? (
              <OdontogramChart
                title="ODONTOGRAMA INICIAL"
                snapshot={draft.odontogramInitial}
                editable
                onChange={(next) => onChange({ ...draft, odontogramInitial: next })}
              />
            ) : (
              <OdontogramChart
                title="ODONTOGRAMA FINAL"
                snapshot={draft.odontogramFinal}
                editable
                onChange={(next) => onChange({ ...draft, odontogramFinal: next })}
              />
            )}
          </div>
        ) : null}

        {/* STEP 4: V-VII PLAN, EVOLUCIÓN Y ALTA */}
        {step === "plan" ? (
          <div role="tabpanel" aria-labelledby="tab-step-plan" className={styles.stack}>
            <div className={styles.sectionHead}>
              <h2 ref={stepHeadingRef} tabIndex={-1}>V–VII. Plan de Tratamiento, Evolución y Alta</h2>
            </div>

            <label className={styles.field}>
              <span>V. Plan de Tratamiento</span>
              <textarea
                className={styles.textarea}
                rows={4}
                value={draft.treatmentPlanNotes}
                onChange={(e) => onChange({ ...draft, treatmentPlanNotes: e.target.value })}
                placeholder="Fases preventiva, restauradora, quirúrgica, rehabilitadora..."
              />
            </label>

            <label className={styles.field}>
              <span>VI. Control y Evolución (resumen general)</span>
              <textarea
                className={styles.textarea}
                rows={4}
                value={draft.controlAndEvolution}
                onChange={(e) => onChange({ ...draft, controlAndEvolution: e.target.value })}
                placeholder="Evolución clínica en controles..."
              />
            </label>

            <fieldset className={styles.fieldset}>
              <legend>VII. Alta del Paciente</legend>
              <label className={styles.field}>
                <span>Indicaciones y condiciones del alta</span>
                <textarea
                  className={styles.textarea}
                  rows={3}
                  value={draft.dischargeSummary}
                  onChange={(e) => onChange({ ...draft, dischargeSummary: e.target.value })}
                />
              </label>
              <div className={styles.twoColumns}>
                <label className={styles.field}>
                  <span>Fecha del alta</span>
                  <input
                    type="date"
                    className={styles.input}
                    value={draft.dischargeDate}
                    onChange={(e) => onChange({ ...draft, dischargeDate: e.target.value })}
                  />
                </label>
                <label className={styles.field}>
                  <span>Sello y firma del profesional</span>
                  <input
                    className={styles.input}
                    value={draft.clinicianStamp}
                    onChange={(e) => onChange({ ...draft, clinicianStamp: e.target.value })}
                    placeholder="Nombre y COP del odontólogo"
                  />
                </label>
              </div>
            </fieldset>
          </div>
        ) : null}

        {/* STEP 5: PRESUPUESTO Y PAGOS */}
        {step === "presupuesto" ? (
          <div role="tabpanel" aria-labelledby="tab-step-presupuesto" className={styles.stack}>
            <div className={styles.sectionHead}>
              <h2 ref={stepHeadingRef} tabIndex={-1}>Presupuesto y Pagos Realizados</h2>
              <span className={styles.meta}>
                Presupuesto total: <strong className={styles.money}>{formatMoney(budgetGrandTotalCents)}</strong> · A cuenta: <strong className={styles.money}>{formatMoney(totalPaidCents)}</strong>
              </span>
            </div>

            <fieldset className={styles.fieldset}>
              <legend>Presupuesto</legend>
              {draft.budgetItems.length === 0 ? (
                <p className={styles.empty}>Aún no hay ítems en el presupuesto.</p>
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={styles.clinicalTable}>
                    <thead>
                      <tr>
                        <th>N°</th>
                        <th>Cantidad</th>
                        <th>Tratamiento</th>
                        <th>Costo unitario (S/)</th>
                        <th>Total</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.budgetItems.map((row, idx) => (
                        <tr key={row.id}>
                          <td>{idx + 1}</td>
                          <td>
                            <input
                              type="number"
                              min={1}
                              max={999}
                              className={styles.inputCompact}
                              value={row.quantity}
                              onChange={(e) => {
                                const next = [...draft.budgetItems];
                                next[idx] = { ...row, quantity: Math.max(1, Number(e.target.value) || 1) };
                                onChange({ ...draft, budgetItems: next });
                              }}
                              aria-label={`Cantidad ítem ${idx + 1}`}
                            />
                          </td>
                          <td>
                            <input
                              className={styles.input}
                              value={row.treatment}
                              onChange={(e) => {
                                const next = [...draft.budgetItems];
                                next[idx] = { ...row, treatment: e.target.value };
                                onChange({ ...draft, budgetItems: next });
                              }}
                              placeholder="Ej. Restauración con resina"
                              aria-label={`Tratamiento ítem ${idx + 1}`}
                            />
                          </td>
                          <td>
                            <input
                              className={styles.inputCompact}
                              inputMode="decimal"
                              defaultValue={solesInput(row.unitPriceCents)}
                              onBlur={(e) => {
                                const parsed = parseSoles(e.target.value);
                                if (parsed !== null) {
                                  const next = [...draft.budgetItems];
                                  next[idx] = { ...row, unitPriceCents: parsed };
                                  onChange({ ...draft, budgetItems: next });
                                }
                              }}
                              placeholder="0.00"
                              aria-label={`Costo unitario ítem ${idx + 1}`}
                            />
                          </td>
                          <td className={styles.money}>{formatMoney(row.quantity * row.unitPriceCents)}</td>
                          <td>
                            <button
                              type="button"
                              className={styles.buttonQuiet}
                              onClick={() => onChange({
                                ...draft,
                                budgetItems: draft.budgetItems.filter((_, i) => i !== idx),
                              })}
                            >
                              Quitar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th colSpan={4} style={{ textAlign: "right" }}>TOTAL</th>
                        <th className={styles.money}>{formatMoney(budgetGrandTotalCents)}</th>
                        <th />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              <button type="button" className={styles.buttonSecondary} onClick={addBudgetRow}>
                + Agregar tratamiento al presupuesto
              </button>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend>Pagos y Tratamientos Realizados</legend>
              {draft.performedPayments.length === 0 ? (
                <p className={styles.empty}>Sin registros de tratamientos efectuados.</p>
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={styles.clinicalTable}>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Tratamiento efectuado</th>
                        <th>A cuenta (S/)</th>
                        <th>Firma paciente</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.performedPayments.map((row, idx) => (
                        <tr key={row.id}>
                          <td>
                            <input
                              type="date"
                              className={styles.inputCompact}
                              value={row.date}
                              onChange={(e) => {
                                const next = [...draft.performedPayments];
                                next[idx] = { ...row, date: e.target.value };
                                onChange({ ...draft, performedPayments: next });
                              }}
                              aria-label={`Fecha registro ${idx + 1}`}
                            />
                          </td>
                          <td>
                            <input
                              className={styles.input}
                              value={row.treatmentDone}
                              onChange={(e) => {
                                const next = [...draft.performedPayments];
                                next[idx] = { ...row, treatmentDone: e.target.value };
                                onChange({ ...draft, performedPayments: next });
                              }}
                              placeholder="Procedimiento efectuado"
                              aria-label={`Tratamiento efectuado ${idx + 1}`}
                            />
                          </td>
                          <td>
                            <input
                              className={styles.inputCompact}
                              inputMode="decimal"
                              defaultValue={solesInput(row.onAccountCents)}
                              onBlur={(e) => {
                                const parsed = parseSoles(e.target.value);
                                if (parsed !== null) {
                                  const next = [...draft.performedPayments];
                                  next[idx] = { ...row, onAccountCents: parsed };
                                  onChange({ ...draft, performedPayments: next });
                                }
                              }}
                              placeholder="0.00"
                              aria-label={`Monto a cuenta ${idx + 1}`}
                            />
                          </td>
                          <td>
                            <label className={styles.checkboxLine}>
                              <input
                                type="checkbox"
                                checked={row.patientSigned}
                                onChange={(e) => {
                                  const next = [...draft.performedPayments];
                                  next[idx] = { ...row, patientSigned: e.target.checked };
                                  onChange({ ...draft, performedPayments: next });
                                }}
                              />
                              <span>Firmó</span>
                            </label>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={styles.buttonQuiet}
                              onClick={() => onChange({
                                ...draft,
                                performedPayments: draft.performedPayments.filter((_, i) => i !== idx),
                              })}
                            >
                              Quitar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <button type="button" className={styles.buttonSecondary} onClick={addPaymentRow}>
                + Registrar tratamiento / abono realizado
              </button>
            </fieldset>
          </div>
        ) : null}

        {/* STEP 6: CONSENTIMIENTO INFORMADO */}
        {step === "consentimiento" ? (
          <div role="tabpanel" aria-labelledby="tab-step-consentimiento" className={styles.stack}>
            <div className={styles.sectionHead}>
              <h2 ref={stepHeadingRef} tabIndex={-1}>Consentimiento Informado (GD DENTAL)</h2>
            </div>

            <div className={styles.consentDocument}>
              <h3>CONSENTIMIENTO INFORMADO</h3>
              <p>
                Yo <strong>{draft.informedConsent.patientName || "______________________"}</strong> con DNI:{" "}
                <strong>{draft.informedConsent.patientDni || "__________"}</strong> paciente del consultorio dental{" "}
                <strong>GD DENTAL</strong>, DECLARO EN FORMA LIBRE; VOLUNTARIA Y CONSCIENTE haber manifestado
                información verídica al personal de salud de este consultorio dental, así mismo de estar informado sobre
                los diagnósticos hechos respecto a mi estado de salud, de la naturaleza de la atención que recibí,
                incluyendo los riesgos más reales y potenciales, efectos colaterales y efectos adversos, así como de los
                beneficios a obtener producto de la misma. De igual manera me comprometo a seguir las indicaciones y
                recomendaciones que requieran.
              </p>
              <p>
                También autorizo a que se obtengan de mi persona fotografías, videos, gráficos, dibujos, entre otros
                durante el tratamiento que sirvan para la obtención del diagnóstico y la planificación y ejecución de mi
                tratamiento, así como para la difusión científica y académica dentro del ámbito de la odontoestomatología.
              </p>
              <p>
                En ese sentido bajo estas condiciones y dando fe de lo arriba vertido, MANIFIESTO MI CONFORMIDAD EXPRESA
                EN EL PRESENTE CONSENTIMIENTO.
              </p>
              <p className={styles.consentDatePreview}>
                {draft.informedConsent.city || "Ayacucho"} {draft.informedConsent.day || "__"} de{" "}
                {draft.informedConsent.month || "________"} del {draft.informedConsent.year || "____"}
              </p>
            </div>

            <div className={styles.twoColumns}>
              <label className={styles.field}>
                <span>Nombre en consentimiento</span>
                <input
                  className={styles.input}
                  value={draft.informedConsent.patientName}
                  onChange={(e) => onChange({
                    ...draft,
                    informedConsent: { ...draft.informedConsent, patientName: e.target.value },
                  })}
                />
              </label>
              <label className={styles.field}>
                <span>DNI en consentimiento</span>
                <input
                  className={styles.input}
                  value={draft.informedConsent.patientDni}
                  onChange={(e) => onChange({
                    ...draft,
                    informedConsent: { ...draft.informedConsent, patientDni: e.target.value },
                  })}
                />
              </label>
            </div>

            <div className={styles.threeColumns}>
              <label className={styles.field}>
                <span>Día</span>
                <input
                  className={styles.input}
                  value={draft.informedConsent.day}
                  onChange={(e) => onChange({ ...draft, informedConsent: { ...draft.informedConsent, day: e.target.value } })}
                />
              </label>
              <label className={styles.field}>
                <span>Mes</span>
                <input
                  className={styles.input}
                  value={draft.informedConsent.month}
                  onChange={(e) => onChange({ ...draft, informedConsent: { ...draft.informedConsent, month: e.target.value } })}
                />
              </label>
              <label className={styles.field}>
                <span>Año</span>
                <input
                  className={styles.input}
                  value={draft.informedConsent.year}
                  onChange={(e) => onChange({ ...draft, informedConsent: { ...draft.informedConsent, year: e.target.value } })}
                />
              </label>
            </div>

            <label className={styles.checkboxLine}>
              <input
                type="checkbox"
                checked={draft.informedConsent.accepted}
                onChange={(e) => onChange({
                  ...draft,
                  informedConsent: { ...draft.informedConsent, accepted: e.target.checked },
                })}
              />
              <span><strong>El paciente firmó y aceptó el consentimiento informado</strong></span>
            </label>
          </div>
        ) : null}

        <div className={styles.stepFooter}>
          <button
            type="button"
            className={styles.buttonSecondary}
            disabled={stepIndex <= 0}
            onClick={() => goToStep(EDITOR_STEPS[stepIndex - 1].id)}
          >
            ← Sección anterior
          </button>
          <div className={styles.actionsRow}>
            <button type="submit" className={styles.button} disabled={saving}>
              {saving ? "Guardando…" : "Guardar historia clínica"}
            </button>
            {stepIndex < EDITOR_STEPS.length - 1 ? (
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={() => goToStep(EDITOR_STEPS[stepIndex + 1].id)}
              >
                Siguiente sección →
              </button>
            ) : null}
          </div>
        </div>
      </form>

      {/* Notas de evolución por cita + Adjuntos clínicos (trazabilidad por cita) */}
      <div className={styles.twoColumns}>
        <section className={styles.card} aria-labelledby="notas-cita-heading">
          <details className={styles.disclosure} open>
            <summary id="notas-cita-heading" className={styles.sectionHead}>Notas por cita (bitácora inmutable)</summary>
            <form className={styles.stack} onSubmit={submitQuickNote}>
              <label className={styles.field}>
                <span>Cita asociada</span>
                <select
                  className={styles.select}
                  value={noteForm.appointmentId}
                  onChange={(e) => setNoteForm({ ...noteForm, appointmentId: e.target.value })}
                  disabled={saving || Boolean(noteForm.amendsId)}
                  required
                >
                  <option value="">Selecciona una cita</option>
                  {eligibleAppointments.map((appt) => (
                    <option key={appt.id} value={appt.id}>{appointmentLabel(appt)}</option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Motivo de la nota</span>
                <input
                  className={styles.input}
                  value={noteForm.reason}
                  onChange={(e) => setNoteForm({ ...noteForm, reason: e.target.value })}
                  placeholder="Ej. Control post-endodoncia"
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Procedimiento realizado</span>
                <textarea
                  className={styles.textarea}
                  rows={2}
                  value={noteForm.procedure}
                  onChange={(e) => setNoteForm({ ...noteForm, procedure: e.target.value })}
                />
              </label>
              <button type="submit" className={styles.buttonSecondary} disabled={saving || !eligibleAppointments.length}>
                Registrar nota en bitácora
              </button>
            </form>
          </details>
        </section>

        <section className={styles.card} aria-labelledby="adjuntos-editor-heading">
          <details className={styles.disclosure} open>
            <summary id="adjuntos-editor-heading" className={styles.sectionHead}>
              Adjuntos clínicos ({record.attachments.length})
            </summary>
            <form className={styles.stack} onSubmit={handleFileUpload}>
              <label className={styles.field}>
                <span>Radiografía / Consentimiento escaneado (PDF, PNG, JPG · máx 10 MB)</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  className={styles.input}
                />
              </label>
              <button type="submit" className={styles.buttonSecondary} disabled={saving}>
                Subir adjunto
              </button>
            </form>
            {record.attachments.length > 0 ? (
              <ul className={styles.list}>
                {record.attachments.map((att) => (
                  <li key={att.id} className={styles.item}>
                    <a
                      className={styles.navLink}
                      href={`/api/panel/clinica/${encodeURIComponent(patientId)}/adjuntos/${encodeURIComponent(att.id)}`}
                      download={att.name}
                    >
                      {att.name}
                    </a>
                    <span className={styles.meta}>
                      {[formatSize(att.size), formatDate(att.createdAt)].filter(Boolean).join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </details>
        </section>
      </div>
    </div>
  );
}
