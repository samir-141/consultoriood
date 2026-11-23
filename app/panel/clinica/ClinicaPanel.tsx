"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { parseSoles } from "@/lib/clinical-money";
import { useStaff } from "../agenda/staff";
import {
  apiRequest,
  appointmentLabel,
  formatDate,
  formatMoney,
  formatSize,
  patientOption,
  type Patient,
  type PatientRecord,
} from "./clinica-data";
import styles from "./clinica.module.css";

type ClinicaPanelProps = Readonly<{ initialPatientId: string }>;

type NoteForm = {
  appointmentId: string;
  reason: string;
  findings: string;
  procedure: string;
  instructions: string;
  amendsId: string;
};

type OdontogramForm = {
  tooth: string;
  surface: string;
  status: string;
  observation: string;
};

type PlanItemForm = {
  tooth: string;
  procedure: string;
  price: string;
  status: string;
};

type PlanForm = { title: string; items: PlanItemForm[] };

type ConsentForm = { type: string; status: string };

const emptyNote: NoteForm = {
  appointmentId: "",
  reason: "",
  findings: "",
  procedure: "",
  instructions: "",
  amendsId: "",
};

const emptyOdontogram: OdontogramForm = {
  tooth: "",
  surface: "",
  status: "",
  observation: "",
};

const emptyPlanItem: PlanItemForm = { tooth: "", procedure: "", price: "", status: "" };

const emptyConsent: ConsentForm = { type: "", status: "PENDIENTE" };
const planLabels: Record<string, string> = {
  DRAFT: "Borrador",
  PROPOSED: "Propuesto",
  ACCEPTED: "Aceptado",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

const toothNumbers = Array.from({ length: 8 }, (_, index) => index + 1)
  .flatMap((quadrant) => Array.from({ length: quadrant <= 4 ? 8 : 5 }, (_, index) => String(quadrant * 10 + index + 1)));

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}

function updatePatientQuery(id: string) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("paciente", id);
  else url.searchParams.delete("paciente");
  window.history.replaceState(null, "", url);
}

export default function ClinicaPanel({ initialPatientId }: ClinicaPanelProps) {
  const user = useStaff();
  const [patientQuery, setPatientQuery] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState(initialPatientId);
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [loading, setLoading] = useState(Boolean(initialPatientId));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [noteForm, setNoteForm] = useState<NoteForm>(emptyNote);
  const [odontogramForm, setOdontogramForm] = useState<OdontogramForm>(emptyOdontogram);
  const [planForm, setPlanForm] = useState<PlanForm>({ title: "", items: [emptyPlanItem] });
  const [consentForm, setConsentForm] = useState<ConsentForm>(emptyConsent);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [patientQuery]);

  async function refreshRecord(id: string) {
    const data = await apiRequest<PatientRecord>(`/api/panel/clinica/${encodeURIComponent(id)}`);
    setRecord(data);
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
        if (data.patient) setPatientQuery(patientOption(data.patient));
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setRecord(null);
        setError(errorMessage(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [patientId]);

  function selectPatient(value: string) {
    setPatientQuery(value);
    const match = patients.find((patient) => patientOption(patient) === value);
    const nextId = match?.id ?? "";
    if (nextId === patientId) return;
    setPatientId(nextId);
    setRecord(null);
    setNoteForm(emptyNote);
    setOdontogramForm(emptyOdontogram);
    setPlanForm({ title: "", items: [emptyPlanItem] });
    setConsentForm(emptyConsent);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setLoading(Boolean(nextId));
    setError("");
    setMessage("");
    updatePatientQuery(nextId);
  }

  async function postAction(payload: Record<string, unknown>, success: string) {
    if (!record || !patientId || saving) return false;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiRequest(`/api/panel/clinica/${encodeURIComponent(patientId)}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await refreshRecord(patientId);
      setMessage(success);
      return true;
    } catch (reason) {
      setError(errorMessage(reason));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!noteForm.appointmentId || !noteForm.reason.trim()) {
      setError("Elige la cita e indica el motivo de la nota.");
      return;
    }
    const amendsId = noteForm.amendsId || undefined;
    const saved = await postAction(
      {
        action: "note",
        appointmentId: noteForm.appointmentId,
        reason: noteForm.reason.trim(),
        findings: noteForm.findings.trim(),
        procedure: noteForm.procedure.trim(),
        instructions: noteForm.instructions.trim(),
        ...(amendsId ? { amendsId } : {}),
      },
      amendsId ? "La enmienda quedó registrada." : "La nota quedó registrada.",
    );
    if (saved) setNoteForm(emptyNote);
  }

  function startAmend(item: PatientRecord["notes"][number]) {
    setNoteForm({
      ...emptyNote,
      appointmentId: item.appointmentId,
      amendsId: item.id,
    });
    const form = document.getElementById("nota-clinica-form");
    if (form instanceof HTMLDetailsElement) form.open = true;
    document.getElementById("motivo-clinico")?.focus();
  }

  async function submitOdontogram(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!toothNumbers.includes(odontogramForm.tooth.trim()) || !odontogramForm.surface.trim() || !odontogramForm.status.trim()) {
      setError("Elige una pieza FDI válida e indica la superficie y el estado.");
      return;
    }
    const saved = await postAction(
      {
        action: "odontogram",
        tooth: odontogramForm.tooth.trim(),
        surface: odontogramForm.surface.trim(),
        status: odontogramForm.status.trim(),
        observation: odontogramForm.observation.trim(),
      },
      "El odontograma se actualizó.",
    );
    if (saved) setOdontogramForm(emptyOdontogram);
  }

  async function submitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!planForm.title.trim()) {
      setError("Indica el título del plan de tratamiento.");
      return;
    }
    const items: { tooth?: string; procedure: string; priceCents: number; status?: string }[] = [];
    for (const item of planForm.items) {
      if (!item.procedure.trim() && !item.tooth.trim() && !item.price.trim()) continue;
      if (!item.procedure.trim()) {
        setError("Indica el procedimiento de cada ítem del plan.");
        return;
      }
      if (item.tooth.trim() && !toothNumbers.includes(item.tooth.trim())) {
        setError("Selecciona una pieza FDI válida para cada procedimiento.");
        return;
      }
      const priceCents = parseSoles(item.price);
      if (priceCents === null) {
        setError("Indica el precio en soles con hasta dos decimales.");
        return;
      }
      items.push({
        ...(item.tooth.trim() ? { tooth: item.tooth.trim() } : {}),
        procedure: item.procedure.trim(),
        priceCents,
        ...(item.status.trim() ? { status: item.status.trim() } : {}),
      });
    }
    if (!items.length) {
      setError("Agrega al menos un procedimiento al plan.");
      return;
    }
    const saved = await postAction(
      { action: "plan", title: planForm.title.trim(), items },
      "El plan de tratamiento quedó registrado.",
    );
    if (saved) setPlanForm({ title: "", items: [emptyPlanItem] });
  }

  async function submitConsent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consentForm.type.trim() || !consentForm.status.trim()) {
      setError("Indica el tipo y el estado del consentimiento.");
      return;
    }
    const saved = await postAction(
      {
        action: "consent",
        type: consentForm.type.trim(),
        status: consentForm.status.trim(),
      },
      "El consentimiento se actualizó.",
    );
    if (saved) setConsentForm(emptyConsent);
  }

  async function submitAttachment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = fileInputRef.current;
    const file = input?.files?.[0];
    if (!file || !record || !patientId || saving) {
      setError("Selecciona un archivo para adjuntar.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Selecciona un archivo de hasta 10 MB.");
      return;
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
      await refreshRecord(patientId);
      setMessage("El adjunto quedó guardado.");
      if (input) input.value = "";
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.frame}>
      <section className={styles.intro}>
        <h1>Ficha clínica</h1>
        <p>Selecciona un paciente para consultar su historia, registrar notas y administrar su plan de tratamiento.</p>
      </section>

      <div className={styles.statusStack}>
        <p className={styles.notice} role="status">{message}</p>
        <p className={styles.error} role="alert">{error}</p>
        {loading ? <p className={styles.hint}>Cargando expediente…</p> : null}
      </div>

      <section className={styles.card} aria-labelledby="paciente-titulo">
        <h2 id="paciente-titulo">Paciente</h2>
        <label className={styles.field}>
          <span>Buscar por nombre o teléfono</span>
          <input
            className={styles.input}
            list="pacientes-clinica"
            value={patientQuery}
            onChange={(event) => selectPatient(event.target.value)}
            autoComplete="off"
            disabled={saving}
          />
          <datalist id="pacientes-clinica">
            {patients.map((patient) => (
              <option key={patient.id} value={patientOption(patient)} />
            ))}
          </datalist>
        </label>
        <p className={styles.hint}>Elige un paciente de la lista para abrir su ficha.</p>
      </section>

      <div className={styles.layout}>
        <div className={styles.stack} hidden={!record}>
          <section className={styles.card} id="nota-clinica" aria-labelledby="nota-titulo">
            <details className={styles.disclosure} id="nota-clinica-form" open>
              <summary className={styles.sectionHead} id="nota-titulo">Notas de atención</summary>
              <form className={styles.stack} onSubmit={submitNote}>
                <label className={styles.field}>
                  <span>Cita asociada</span>
                  <select
                    className={styles.select}
                    value={noteForm.appointmentId}
                    onChange={(event) => setNoteForm({ ...noteForm, appointmentId: event.target.value })}
                    disabled={saving || Boolean(noteForm.amendsId)}
                    required
                  >
                    <option value="">Selecciona una cita</option>
                    {eligibleAppointments.map((appointment) => (
                      <option key={appointment.id} value={appointment.id}>
                        {appointmentLabel(appointment)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Motivo</span>
                  <textarea
                    id="motivo-clinico"
                    className={styles.textarea}
                    rows={2}
                    value={noteForm.reason}
                    onChange={(event) => setNoteForm({ ...noteForm, reason: event.target.value })}
                    placeholder="Ej. Control programado"
                    required
                  />
                </label>
                {noteForm.amendsId ? (
                  <p className={styles.notice}>
                    La enmienda se añadirá al historial de esta cita.
                    {" "}
                    <button
                      type="button"
                      className={styles.buttonQuiet}
                      onClick={() => setNoteForm({ ...noteForm, amendsId: "", reason: "" })}
                    >
                      Cancelar enmienda
                    </button>
                  </p>
                ) : null}
                <details className={styles.disclosure}>
                  <summary>Hallazgos, procedimiento e indicaciones</summary>
                  <div className={styles.stack}>
                    <label className={styles.field}>
                      <span>Hallazgos</span>
                      <textarea
                        className={styles.textarea}
                        rows={2}
                        value={noteForm.findings}
                        onChange={(event) => setNoteForm({ ...noteForm, findings: event.target.value })}
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Procedimiento</span>
                      <textarea
                        className={styles.textarea}
                        rows={2}
                        value={noteForm.procedure}
                        onChange={(event) => setNoteForm({ ...noteForm, procedure: event.target.value })}
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Indicaciones y próxima cita</span>
                      <textarea
                        className={styles.textarea}
                        rows={2}
                        value={noteForm.instructions}
                        onChange={(event) => setNoteForm({ ...noteForm, instructions: event.target.value })}
                      />
                    </label>
                  </div>
                </details>
                <button className={styles.button} type="submit" disabled={saving || !eligibleAppointments.length}>
                  {noteForm.amendsId ? "Guardar enmienda" : "Guardar nota"}
                </button>
              </form>
            </details>

            <div className={styles.listWrap}>
              {(record?.notes ?? []).length === 0 ? (
                <p className={styles.empty}>Aún no hay notas registradas para este paciente.</p>
              ) : (
                <ul className={styles.list}>
                  {record?.notes.map((item, index) => (
                    <li key={item.id}>
                      <details className={styles.item} open={index === 0}>
                        <summary>
                          {item.reason || "Nota clínica"}
                          {item.amendsId ? <span className={styles.tag}> Enmienda</span> : null}
                        </summary>
                        <div className={styles.itemBody}>
                          <span className={styles.meta}>
                            {formatDate(item.createdAt)} · {item.authorName ?? "Autor sin registro"}
                          </span>
                          {item.findings ? <p><strong>Hallazgos</strong>{item.findings}</p> : null}
                          {item.procedure ? <p><strong>Procedimiento</strong>{item.procedure}</p> : null}
                          {item.instructions ? <p><strong>Indicaciones</strong>{item.instructions}</p> : null}
                          {eligibleAppointments.some((appointment) => appointment.id === item.appointmentId)
                            && !record?.notes.some((note) => note.amendsId === item.id) ? (
                              <button type="button" className={styles.buttonQuiet} disabled={saving} onClick={() => startAmend(item)}>
                                Enmendar esta nota
                              </button>
                            ) : null}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className={styles.card} aria-labelledby="odontograma-titulo">
            <div className={styles.sectionHead}>
              <h2 id="odontograma-titulo">Odontograma</h2>
              <span className={styles.meta}>{(record?.odontogram ?? []).length} registros</span>
            </div>
            <div className={styles.listWrap}>
              {(record?.odontogram ?? []).length === 0 ? (
                <p className={styles.empty}>Sin hallazgos registrados.</p>
              ) : (
                <ul className={styles.list}>
                  {record?.odontogram.map((entry) => (
                    <li className={styles.item} key={entry.id}>
                      <strong>Pieza {entry.tooth} · {entry.surface}</strong>
                      <span className={styles.meta}>{entry.status} · {formatDate(entry.createdAt)}</span>
                      {entry.observation ? <p>{entry.observation}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <details className={styles.disclosure}>
              <summary>Registrar hallazgo</summary>
              <form className={styles.stack} onSubmit={submitOdontogram}>
                <div className={styles.twoColumns}>
                  <label className={styles.field}>
                    <span>Pieza</span>
                    <input
                      className={styles.input}
                      list="piezas-dentales"
                      value={odontogramForm.tooth}
                      onChange={(event) => setOdontogramForm({ ...odontogramForm, tooth: event.target.value })}
                      placeholder="Ej. 16"
                      required
                    />
                    <datalist id="piezas-dentales">
                      {toothNumbers.map((tooth) => <option key={tooth} value={tooth} />)}
                    </datalist>
                  </label>
                  <label className={styles.field}>
                    <span>Superficie</span>
                    <input
                      className={styles.input}
                      list="superficies"
                      value={odontogramForm.surface}
                      onChange={(event) => setOdontogramForm({ ...odontogramForm, surface: event.target.value })}
                      placeholder="Ej. OCLUSAL"
                      required
                    />
                    <datalist id="superficies">
                      {["OCLUSAL", "VESTIBULAR", "LINGUAL", "MESIAL", "DISTAL", "GENERAL"].map((surface) => (
                        <option key={surface} value={surface} />
                      ))}
                    </datalist>
                  </label>
                </div>
                <label className={styles.field}>
                  <span>Estado</span>
                  <input
                    className={styles.input}
                    list="estados-pieza"
                    value={odontogramForm.status}
                    onChange={(event) => setOdontogramForm({ ...odontogramForm, status: event.target.value })}
                    placeholder="Ej. CARIES"
                    required
                  />
                  <datalist id="estados-pieza">
                    {["SANO", "CARIES", "RESTAURADO", "ENDODONCIA", "CORONA", "EXTRACCION", "IMPLANTE"].map((status) => (
                      <option key={status} value={status} />
                    ))}
                  </datalist>
                </label>
                <label className={styles.field}>
                  <span>Observación</span>
                  <textarea
                    className={styles.textarea}
                    rows={2}
                    value={odontogramForm.observation}
                    onChange={(event) => setOdontogramForm({ ...odontogramForm, observation: event.target.value })}
                  />
                </label>
                <button className={styles.button} type="submit" disabled={saving}>Guardar hallazgo</button>
              </form>
            </details>
          </section>

          <section className={styles.card} aria-labelledby="planes-titulo">
            <div className={styles.sectionHead}>
              <h2 id="planes-titulo">Planes de tratamiento</h2>
              <span className={styles.meta}>{(record?.plans ?? []).length} planes</span>
            </div>
            <div className={styles.listWrap}>
              {(record?.plans ?? []).length === 0 ? (
                <p className={styles.empty}>Todavía no hay planes para este paciente.</p>
              ) : (
                <ul className={styles.list}>
                  {record?.plans.map((plan) => (
                    <li key={plan.id}>
                      <details className={styles.item}>
                        <summary>{plan.title}</summary>
                        <div className={styles.itemBody}>
                          <span className={styles.meta}>
                            {plan.status ? (planLabels[plan.status] ?? plan.status) : "Sin estado"} · {formatMoney(plan.totalCents ?? 0)}
                          </span>
                          {(plan.items ?? []).map((item) => (
                            <p key={item.id ?? `${item.tooth}-${item.procedure}`}>
                              {item.tooth ? `Pieza ${item.tooth} · ` : ""}{item.procedure}
                              {" · "}
                              <span className={styles.money}>{formatMoney(item.priceCents)}</span>
                              {item.status ? ` · ${item.status}` : ""}
                            </p>
                          ))}
                          {plan.status === "PROPOSED" ? (
                            <button type="button" className={styles.buttonSecondary} disabled={saving}
                              onClick={() => void postAction(
                                { action: "plan-status", planId: plan.id, status: "ACCEPTED" },
                                "La aceptación del plan quedó registrada.",
                              )}>Registrar aceptación</button>
                          ) : null}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <details className={styles.disclosure}>
              <summary>Nuevo plan</summary>
              <form className={styles.stack} onSubmit={submitPlan}>
                <label className={styles.field}>
                  <span>Título</span>
                  <input
                    className={styles.input}
                    value={planForm.title}
                    onChange={(event) => setPlanForm({ ...planForm, title: event.target.value })}
                    placeholder="Ej. Rehabilitación del sector 1"
                    required
                  />
                </label>
                <div className={styles.stack}>
                  {planForm.items.map((item, index) => (
                    <div className={styles.itemRow} key={index}>
                      <label className={styles.field}>
                        <span>Pieza</span>
                        <input
                          className={styles.input}
                          value={item.tooth}
                          onChange={(event) => {
                            const items = [...planForm.items];
                            items[index] = { ...item, tooth: event.target.value };
                            setPlanForm({ ...planForm, items });
                          }}
                          placeholder="16"
                        />
                      </label>
                      <label className={styles.field}>
                        <span>Procedimiento</span>
                        <input
                          className={styles.input}
                          value={item.procedure}
                          onChange={(event) => {
                            const items = [...planForm.items];
                            items[index] = { ...item, procedure: event.target.value };
                            setPlanForm({ ...planForm, items });
                          }}
                          placeholder="Empaste"
                        />
                      </label>
                      <label className={styles.field}>
                        <span>Precio en soles</span>
                        <input
                          className={styles.input}
                          inputMode="decimal"
                          value={item.price}
                          onChange={(event) => {
                            const items = [...planForm.items];
                            items[index] = { ...item, price: event.target.value };
                            setPlanForm({ ...planForm, items });
                          }}
                          placeholder="80,00"
                        />
                      </label>
                      {planForm.items.length > 1 ? (
                        <button
                          type="button"
                          className={styles.buttonQuiet}
                          onClick={() => setPlanForm({
                            ...planForm,
                            items: planForm.items.filter((_, itemIndex) => itemIndex !== index),
                          })}
                        >
                          Quitar
                        </button>
                      ) : <span />}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className={styles.buttonSecondary}
                  onClick={() => setPlanForm({ ...planForm, items: [...planForm.items, emptyPlanItem] })}
                >
                  Agregar procedimiento
                </button>
                <button className={styles.button} type="submit" disabled={saving}>Guardar plan</button>
              </form>
            </details>
          </section>

          <section className={styles.card} aria-labelledby="adjuntos-titulo">
            <div className={styles.sectionHead}>
              <h2 id="adjuntos-titulo">Adjuntos clínicos</h2>
              <span className={styles.meta}>{(record?.attachments ?? []).length} archivos</span>
            </div>
            <div className={styles.listWrap}>
              {(record?.attachments ?? []).length === 0 ? (
                <p className={styles.empty}>No hay archivos adjuntos.</p>
              ) : (
                <ul className={styles.list}>
                  {record?.attachments.map((attachment) => (
                    <li className={styles.item} key={attachment.id}>
                      <a
                        className={styles.navLink}
                        href={`/api/panel/clinica/${encodeURIComponent(patientId)}/adjuntos/${encodeURIComponent(attachment.id)}`}
                        download={attachment.name}
                      >
                        {attachment.name}
                      </a>
                      <span className={styles.meta}>
                        {[attachment.mime, formatSize(attachment.size), formatDate(attachment.createdAt)]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <details className={styles.disclosure}>
              <summary>Adjuntar archivo</summary>
              <form className={styles.stack} onSubmit={submitAttachment}>
                <label className={styles.field}>
                  <span>Archivo</span>
                  <input
                    ref={fileInputRef}
                    className={styles.input}
                    type="file"
                    accept="application/pdf,image/png,image/jpeg"
                    onChange={() => {
                      setError("");
                      setMessage("");
                    }}
                    required
                  />
                </label>
                <button className={styles.button} type="submit" disabled={saving}>Guardar adjunto</button>
              </form>
            </details>
          </section>
        </div>

        <aside className={styles.sidebar} hidden={!record}>
          {record ? (
            <>
              <section className={styles.card} aria-labelledby="datos-titulo">
                <div className={styles.sectionHead}>
                  <h2 id="datos-titulo">{record.patient.name}</h2>
                </div>
                <dl>
                  {record.patient.phone ? <div><dt className={styles.meta}>Teléfono</dt><dd>{record.patient.phone}</dd></div> : null}
                  {record.patient.email ? <div><dt className={styles.meta}>Correo</dt><dd>{record.patient.email}</dd></div> : null}
                  {record.patient.birthDate ? <div><dt className={styles.meta}>Nacimiento</dt><dd>{formatDate(record.patient.birthDate)}</dd></div> : null}
                </dl>
                <details className={styles.disclosure}>
                  <summary>Antecedentes</summary>
                  <form key={record.patient.id} className={styles.stack} onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    void postAction({ action: "background", background: form.get("background") }, "Los antecedentes se actualizaron.");
                  }}>
                    <label className={styles.field}>
                      <span>Antecedentes clínicos</span>
                      <textarea className={styles.textarea} name="background" rows={3}
                        maxLength={5000} defaultValue={record.patient.background ?? ""} />
                    </label>
                    <button className={styles.buttonSecondary} type="submit" disabled={saving}>Guardar antecedentes</button>
                  </form>
                </details>
                <details className={styles.disclosure}>
                  <summary>Consentimientos ({(record.patient.consents ?? []).length})</summary>
                  <div className={styles.stack}>
                    {(record.patient.consents ?? []).length === 0 ? (
                      <p className={styles.empty}>Sin consentimientos registrados.</p>
                    ) : (
                      <ul className={styles.list}>
                        {record.patient.consents?.map((consent) => (
                          <li className={styles.item} key={consent.id}>
                            <strong>{consent.type}</strong>
                            <span className={styles.meta}>{consent.status} · {formatDate(consent.createdAt)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <form className={styles.stack} onSubmit={submitConsent}>
                      <label className={styles.field}>
                        <span>Tipo</span>
                        <input
                          className={styles.input}
                          list="tipos-consentimiento"
                          value={consentForm.type}
                          onChange={(event) => setConsentForm({ ...consentForm, type: event.target.value })}
                          placeholder="Ej. TRATAMIENTO"
                          required
                        />
                        <datalist id="tipos-consentimiento">
                          {["TRATAMIENTO", "EXTRACCION", "ANESTESIA", "IMAGENES", "DATOS"].map((type) => (
                            <option key={type} value={type} />
                          ))}
                        </datalist>
                      </label>
                      <label className={styles.field}>
                        <span>Estado</span>
                        <select
                          className={styles.select}
                          value={consentForm.status}
                          onChange={(event) => setConsentForm({ ...consentForm, status: event.target.value })}
                        >
                          {["PENDIENTE", "ACEPTADO", "RECHAZADO", "REVOCADO"].map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </label>
                      <button className={styles.buttonSecondary} type="submit" disabled={saving}>Registrar consentimiento</button>
                    </form>
                  </div>
                </details>
              </section>

              <section className={styles.card} aria-labelledby="citas-titulo">
                <h2 id="citas-titulo">Citas</h2>
                {(record.appointments ?? []).length === 0 ? (
                  <p className={styles.empty}>Este paciente no tiene citas registradas.</p>
                ) : (
                  <ul className={styles.list}>
                    {record.appointments.map((appointment) => (
                      <li className={styles.item} key={appointment.id}>
                        <span>{appointmentLabel(appointment) || "Cita sin detalle"}</span>
                        {appointment.professionalName ? (
                          <span className={styles.meta}>{appointment.professionalName}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className={styles.card} aria-labelledby="auditoria-titulo">
                <details className={styles.disclosure}>
                  <summary id="auditoria-titulo">Auditoría ({(record.audit ?? []).length})</summary>
                  {(record.audit ?? []).length === 0 ? (
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
            </>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
