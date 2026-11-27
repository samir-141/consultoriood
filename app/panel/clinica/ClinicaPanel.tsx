"use client";

import { useEffect, useState } from "react";
import { createEmptyClinicalHistory, type ClinicalHistoryData } from "@/lib/clinical-history";
import { useStaff } from "../agenda/staff";
import {
  apiRequest,
  formatDate,
  patientOption,
  type Patient,
  type PatientRecord,
} from "./clinica-data";
import { HistoryEditor } from "./history-editor";
import { HistoryViewer } from "./history-viewer";
import styles from "./clinica.module.css";

type ClinicaPanelProps = Readonly<{
  initialPatientId: string;
  initialMode?: ClinicalMode;
  initialStep?: string;
}>;
type ClinicalMode = "edit" | "view";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}

function updatePatientQuery(id: string) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("paciente", id);
  else url.searchParams.delete("paciente");
  window.history.replaceState(null, "", url);
}

export default function ClinicaPanel({
  initialPatientId,
  initialMode = "edit",
  initialStep = "anamnesis",
}: ClinicaPanelProps) {
  const user = useStaff();
  const [patientQuery, setPatientQuery] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState(initialPatientId);
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [draft, setDraft] = useState<ClinicalHistoryData>(() => createEmptyClinicalHistory());
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<ClinicalMode>(initialMode);
  const [loading, setLoading] = useState(Boolean(initialPatientId));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const eligibleAppointments = (record?.appointments ?? []).filter((appointment) =>
    ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"].includes(appointment.status) &&
    (user.role === "ADMIN" || appointment.professionalId === user.professionalId));

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      apiRequest<{ patients: Patient[] }>(
        `/api/panel/pacientes?q=${encodeURIComponent(patientQuery)}`,
        { signal: controller.signal },
      )
        .then((data) => {
          if (!controller.signal.aborted) setPatients(data.patients ?? []);
        })
        .catch(() => {
          if (!controller.signal.aborted) setPatients([]);
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [patientQuery]);

  async function refreshRecord(id: string, resetDraft = false) {
    const data = await apiRequest<PatientRecord>(`/api/panel/clinica/${encodeURIComponent(id)}`);
    setRecord(data);
    if (resetDraft) {
      setDraft(data.history);
      setDirty(false);
    }
    if (data.patient) setPatientQuery(patientOption(data.patient));
    return data;
  }

  useEffect(() => {
    if (!patientId) return;
    const controller = new AbortController();
    apiRequest<PatientRecord>(`/api/panel/clinica/${encodeURIComponent(patientId)}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        setRecord(data);
        setDraft(data.history);
        setDirty(false);
        if (data.patient) setPatientQuery(patientOption(data.patient));
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setRecord(null);
        setPatientId("");
        setPatientQuery("");
        const msg = errorMessage(reason);
        setError(
          msg.includes("asignado")
            ? "Este paciente aún no está asignado a tu atención (por ejemplo, cita pendiente sin confirmar o de otro profesional)."
            : msg,
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [patientId]);

  function openPatientById(nextId: string, label?: string) {
    if (nextId === patientId) return;
    if (label !== undefined) setPatientQuery(label);
    setPatientId(nextId);
    setRecord(null);
    setDirty(false);
    setLoading(Boolean(nextId));
    setError("");
    setMessage("");
    updatePatientQuery(nextId);
  }

  function selectPatientFromInput(value: string) {
    setPatientQuery(value);
    const match = patients.find((patient) => patientOption(patient) === value);
    if (match) {
      openPatientById(match.id, value);
    } else if (!value.trim()) {
      openPatientById("", "");
    }
  }

  async function postAction(payload: Record<string, unknown>, success: string, resetDraft = false) {
    if (!record || !patientId || saving) return false;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiRequest(`/api/panel/clinica/${encodeURIComponent(patientId)}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await refreshRecord(patientId, resetDraft);
      setMessage(success);
      return true;
    } catch (reason) {
      setError(errorMessage(reason));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveClinicalHistory() {
    return postAction(
      { action: "history", history: draft },
      "Historia clínica guardada correctamente.",
      true,
    );
  }

  async function uploadAttachment(file: File) {
    if (!record || !patientId || saving) return false;
    if (file.size > 10 * 1024 * 1024) {
      setError("Selecciona un archivo de hasta 10 MB.");
      return false;
    }
    setSaving(true);
    setError("");
    setMessage("");
    const body = new FormData();
    body.append("file", file);
    try {
      await apiRequest(`/api/panel/clinica/${encodeURIComponent(patientId)}/adjuntos`, {
        method: "POST",
        body,
      });
      await refreshRecord(patientId, false);
      setMessage("El adjunto quedó guardado.");
      return true;
    } catch (reason) {
      setError(errorMessage(reason));
      return false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.frame}>
      <section className={`${styles.intro} ${styles.noPrint}`}>
        <h1>Historias Clínicas</h1>
        <p>
          Sistema clínico integral basado en el formato oficial de GD DENTAL:
          <strong> 1) Llenado guiado</strong> y <strong>2) Visualización e impresión de ficha</strong>.
        </p>
      </section>

      <div className={`${styles.statusStack} ${styles.noPrint}`}>
        {message ? <p className={styles.notice} role="status">{message}</p> : null}
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        {loading ? <p className={styles.hint} role="status">Cargando expediente…</p> : null}
      </div>

      {/* Selector de paciente */}
      <section className={`${styles.card} ${styles.noPrint}`} aria-labelledby="paciente-titulo">
        <div className={styles.sectionHead}>
          <h2 id="paciente-titulo">Seleccionar paciente</h2>
          {record ? (
            <button
              type="button"
              className={styles.buttonQuiet}
              onClick={() => openPatientById("", "")}
            >
              Cambiar paciente
            </button>
          ) : null}
        </div>
        <label className={styles.field}>
          <span>Buscar por nombre o teléfono</span>
          <input
            className={styles.input}
            list="pacientes-clinica"
            value={patientQuery}
            onChange={(event) => selectPatientFromInput(event.target.value)}
            placeholder="Escribe el nombre o selecciona de los accesos rápidos…"
            autoComplete="off"
            disabled={saving}
          />
          <datalist id="pacientes-clinica">
            {patients.map((patient) => (
              <option key={patient.id} value={patientOption(patient)} />
            ))}
          </datalist>
        </label>

        {patients.length > 0 ? (
          <div className={styles.quickPatients}>
            <span className={styles.meta}>
              {record ? "Cambiar rápido a otro paciente:" : "Pacientes disponibles — abre directamente en Llenado o Visualización:"}
            </span>
            {record ? (
              <div className={styles.quickPatientList}>
                {patients.slice(0, 8).map((patient) => {
                  const selected = patient.id === patientId;
                  return (
                    <button
                      key={patient.id}
                      type="button"
                      aria-pressed={selected}
                      className={`${styles.patientPill} ${selected ? styles.patientPillActive : ""}`}
                      onClick={() => openPatientById(patient.id, patientOption(patient))}
                    >
                      {patient.name}
                      {patient.phone ? ` · ${patient.phone}` : ""}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className={styles.patientDirGrid}>
                {patients.map((patient) => (
                  <article key={patient.id} className={styles.patientDirCard}>
                    <div>
                      <strong>{patient.name}</strong>
                      <span className={styles.meta}>
                        {[patient.phone, patient.dni ? `DNI ${patient.dni}` : null].filter(Boolean).join(" · ") || "Sin teléfono"}
                      </span>
                    </div>
                    <div className={styles.actionsRow}>
                      <button
                        type="button"
                        className={styles.button}
                        onClick={() => {
                          setMode("edit");
                          openPatientById(patient.id, patientOption(patient));
                        }}
                      >
                        1. Llenar historia
                      </button>
                      <button
                        type="button"
                        className={styles.buttonSecondary}
                        onClick={() => {
                          setMode("view");
                          openPatientById(patient.id, patientOption(patient));
                        }}
                      >
                        2. Visualizar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </section>

      {record ? (
        <div className={styles.workspaceArea}>
          {/* Resumen del paciente + Selector principal de los 2 modos */}
          <section className={`${styles.patientBanner} ${styles.noPrint}`} aria-label="Resumen de historia y modo">
            <div className={styles.bannerTop}>
              <div>
                <div className={styles.bannerTitleRow}>
                  <h2>{draft.filiation.fullName || record.patient.name}</h2>
                  {draft.recordNumber ? <span className={styles.hcBadge}>{draft.recordNumber}</span> : null}
                  {draft.background.drugAllergy === "SI" ? (
                    <span className={styles.allergyBadge}>⚠ Alérgico</span>
                  ) : null}
                </div>
                <p className={styles.meta}>
                  {[
                    draft.filiation.dni ? `DNI: ${draft.filiation.dni}` : null,
                    draft.filiation.age || null,
                    draft.filiation.phone ? `Tel: ${draft.filiation.phone}` : null,
                    record.historyMeta ? `Guardado: ${formatDate(record.historyMeta.updatedAt)}` : "Pendiente de primer guardado",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>

              <div role="tablist" aria-label="Modos de historia clínica" className={styles.modeTabList}>
                <button
                  id="mode-tab-edit"
                  type="button"
                  role="tab"
                  aria-selected={mode === "edit"}
                  className={styles.modeTab}
                  onClick={() => setMode("edit")}
                >
                  1. Llenado de Historia
                </button>
                <button
                  id="mode-tab-view"
                  type="button"
                  role="tab"
                  aria-selected={mode === "view"}
                  className={styles.modeTab}
                  onClick={() => setMode("view")}
                >
                  2. Visualizar Datos
                </button>
              </div>
            </div>
          </section>

          <div
            role="tabpanel"
            aria-labelledby="mode-tab-edit"
            hidden={mode !== "edit"}
          >
            {mode === "edit" ? (
              <HistoryEditor
                patientId={patientId}
                record={record}
                draft={draft}
                dirty={dirty}
                saving={saving}
                initialStep={initialStep}
                eligibleAppointments={eligibleAppointments}
                onChange={(next) => {
                  setDraft(next);
                  setDirty(true);
                }}
                onSaveHistory={saveClinicalHistory}
                onSwitchToViewer={() => setMode("view")}
                onPostAction={(payload, success) => postAction(payload, success, false)}
                onUploadAttachment={uploadAttachment}
              />
            ) : null}
          </div>

          <div
            role="tabpanel"
            aria-labelledby="mode-tab-view"
            hidden={mode !== "view"}
          >
            {mode === "view" ? (
              <HistoryViewer
                patientId={patientId}
                record={record}
                history={draft}
                onSwitchToEditor={() => setMode("edit")}
              />
            ) : null}
          </div>

          {user.role === "ADMIN" ? (
            <section className={`${styles.card} ${styles.noPrint}`} aria-labelledby="auditoria-titulo">
              <details className={styles.disclosure}>
                <summary id="auditoria-titulo">Auditoría de accesos y cambios ({record.audit.length})</summary>
                {record.audit.length === 0 ? (
                  <p className={styles.empty}>Sin eventos para mostrar.</p>
                ) : (
                  <ul className={styles.list}>
                    {record.audit.map((event) => (
                      <li className={styles.item} key={event.id}>
                        <strong>{event.action}</strong>
                        <span className={styles.meta}>
                          {event.result} · {formatDate(event.createdAt)} · {event.actorName ?? "Sistema"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            </section>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
