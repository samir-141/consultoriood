"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { professionals } from "@/config/site";
import { lookupDniReniec } from "@/app/components/reniec-lookup";
import { errorMessage, postJson, staffFetch, todayLima, useStaff, type Patient } from "../agenda/staff";
import styles from "../agenda/staff.module.css";

type Result = { key: string; patients?: Patient[]; error?: string };

export default function PatientsPage() {
  return (
    <Suspense fallback={<p role="status">Cargando pacientes…</p>}>
      <PatientDirectory />
    </Suspense>
  );
}

function PatientDirectory() {
  const staff = useStaff();
  const params = useSearchParams();
  const linkedId = params.get("paciente") ?? "";
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [ignoreLinked, setIgnoreLinked] = useState(false);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<Result>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ patient?: Patient } | null>(null);
  const [notice, setNotice] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const mayEdit = staff.role !== "ODONTOLOGO";
  const effectiveLinked = !ignoreLinked && !search && selectedId === null ? linkedId : "";
  const query = new URLSearchParams({ q: effectiveLinked || search });
  const requestKey = query.toString() + "#" + revision;
  const current = result?.key === requestKey ? result : undefined;
  const patients = current?.patients ?? [];
  const activeId = selectedId ?? (linkedId || patients[0]?.id || "");
  const patient = patients.find((item) => item.id === activeId);
  const patientId = patient?.id;

  useEffect(() => {
    if (selectedId && !editor) detailHeading.current?.focus();
  }, [editor, selectedId, patientId]);

  useEffect(() => {
    const controller = new AbortController();
    staffFetch<{ patients: Patient[] }>("/api/panel/pacientes?" + requestKey.split("#")[0], { signal: controller.signal })
      .then(({ patients }) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, patients });
      })
      .catch((problem) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, error: errorMessage(problem) });
      });
    return () => controller.abort();
  }, [requestKey]);

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(text.trim());
    setSelectedId(null);
    setEditor(null);
    setNotice("");
  }

  function onSaved(message: string, saved: Patient) {
    setEditor(null);
    setNotice(message);
    setSearch("");
    setText("");
    setSelectedId(saved.id);
    setRevision((value) => value + 1);
    heading.current?.focus();
  }

  return (
    <div className={styles.stack}>
      <header className={styles.intro}>
        <h1>{mayEdit ? "Pacientes" : "Mis pacientes"}</h1>
        <p>
          {mayEdit
            ? "Selecciona un paciente del listado para consultar o editar sus datos al costado."
            : "Selecciona un paciente del listado para consultar su información en el panel lateral."}
        </p>
      </header>

      <section className={`${styles.card} ${styles.stack} ${styles.masterDetailContainer}`} aria-labelledby="patients-title">
        <div className={styles.row}>
          <div>
            <h2 id="patients-title" ref={heading} tabIndex={-1}>
              Directorio {current ? `(${patients.length})` : ""}
            </h2>
          </div>
          {mayEdit && (
            <button
              className={styles.primary}
              type="button"
              onClick={() => { setEditor({}); setNotice(""); }}
            >
              Nuevo paciente
            </button>
          )}
        </div>

        {notice && <p className={styles.notice} role="status">{notice}</p>}

        <form className={styles.search} onSubmit={onSearch}>
          <label className={styles.field}>Por nombre, DNI, teléfono o correo
            <input
              type="search"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setSearch(event.target.value.trim());
              }}
              placeholder="Ej. 72345678 o María…"
              maxLength={120}
            />
          </label>
          <button className={styles.secondary} type="submit">Buscar</button>
          {(search || effectiveLinked) && (
            <button
              className={styles.secondary}
              type="button"
              onClick={() => {
                setIgnoreLinked(true);
                setText(""); setSearch(""); setSelectedId(null); setEditor(null); setNotice("");
              }}
            >
              Limpiar filtro
            </button>
          )}
        </form>

        {!current && <p className={styles.muted} role="status">Cargando pacientes…</p>}
        {current?.error && (
          <div className={styles.stack}>
            <p className={styles.error} role="alert">{current.error}</p>
            <button className={styles.secondary} type="button" onClick={() => setRevision((value) => value + 1)}>Reintentar</button>
          </div>
        )}

        <div className={styles.masterDetail}>
          {/* Columna izquierda: listado desplazable que escala para 100+ pacientes */}
          <div>
            {current?.patients?.length === 0 ? (
              <p className={styles.muted}>No se encontraron pacientes{search ? " con ese filtro" : ""}.</p>
            ) : (
              <ul className={styles.scrollList} aria-label="Listado de pacientes">
                {patients.map((item) => {
                  const isActive = !editor && patient?.id === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        aria-pressed={isActive}
                        className={`${styles.patientRowButton} ${isActive ? styles.patientRowActive : ""}`}
                        onClick={() => {
                          setSelectedId(item.id);
                          setEditor(null);
                          setNotice("");
                        }}
                      >
                        <div>
                          <strong>{item.name}</strong>
                          <p className={styles.muted}>
                            {[item.phone, item.dni ? `DNI ${item.dni}` : null].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <span className={styles.pill}>{isActive ? "Viendo" : "Ver →"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Columna derecha: canvas lateral fijo (se adapta al tamaño de pantalla) */}
          <div className={styles.stickyCanvas}>
            {editor ? (
              <PatientForm
                key={editor.patient?.id ?? "new"}
                patient={editor.patient}
                onSaved={onSaved}
                onClose={() => {
                  setEditor(null);
                  heading.current?.focus();
                }}
              />
            ) : patient ? (
              <section className={styles.stack} aria-labelledby="patient-name">
                <div className={styles.row}>
                  <h3 id="patient-name" ref={detailHeading} tabIndex={-1}>{patient.name}</h3>
                  <span className={styles.pill}>Ficha activa</span>
                </div>
                <dl className={styles.detailsGrid}>
                  <div><dt>DNI</dt><dd>{patient.dni || "Sin registrar"}</dd></div>
                  <div><dt>Teléfono</dt><dd>{patient.phone || "Sin registrar"}</dd></div>
                  <div><dt>Correo</dt><dd>{patient.email || "Sin registrar"}</dd></div>
                  <div><dt>Fecha de nacimiento</dt><dd>{patient.birthDate?.slice(0, 10) || "Sin registrar"}</dd></div>
                  <div>
                    <dt>Odontólogos asignados</dt>
                    <dd>
                      {patient.assignedProfessionalIds?.length
                        ? patient.assignedProfessionalIds
                          .map((pid) => professionals.find((pr) => pr.id === pid)?.name ?? pid)
                          .join(", ")
                        : "Sin asignación clínica"}
                    </dd>
                  </div>
                </dl>
                {mayEdit && (
                  <div className={styles.actions}>
                    {professionals.map((prof) => {
                      const assigned = patient.assignedProfessionalIds?.includes(prof.id) ?? false;
                      return (
                        <button
                          key={prof.id}
                          type="button"
                          className={styles.miniBtn}
                          disabled={assignBusy}
                          onClick={async () => {
                            setAssignBusy(true);
                            setNotice("");
                            try {
                              await postJson("/api/panel/asignaciones", {
                                action: assigned ? "unassign" : "assign",
                                patientId: patient.id,
                                professionalId: prof.id,
                              });
                              setNotice(assigned ? `Se retiró el vínculo con ${prof.name}.` : `Paciente asignado a ${prof.name}.`);
                              setRevision((v) => v + 1);
                            } catch (problem) {
                              setNotice(errorMessage(problem));
                            } finally {
                              setAssignBusy(false);
                            }
                          }}
                        >
                          {assigned ? `Quitar cargo (${prof.name})` : `Asignar a ${prof.name}`}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className={styles.actions}>
                  {mayEdit && (
                    <button
                      className={styles.secondary}
                      type="button"
                      onClick={() => { setEditor({ patient }); setNotice(""); }}
                    >
                      Editar datos
                    </button>
                  )}
                  {staff.role !== "RECEPCION" && (
                    <Link
                      className={styles.primary}
                      href={`/panel/clinica?paciente=${encodeURIComponent(patient.id)}`}
                    >
                      Abrir ficha clínica
                    </Link>
                  )}
                  {mayEdit && (
                    <Link
                      className={styles.shortcutLink}
                      href={`/panel/pagos?paciente=${encodeURIComponent(patient.id)}`}
                    >
                      Ver pagos
                    </Link>
                  )}
                </div>
              </section>
            ) : (
              <div className={styles.stack}>
                <h3>Información del paciente</h3>
                <p className={styles.muted}>
                  Selecciona cualquier paciente de la lista para visualizar su información completa, editar sus datos o abrir su historia clínica sin perder tu posición en el directorio.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function PatientForm({ patient, onSaved, onClose }: {
  patient?: Patient;
  onSaved: (message: string, patient: Patient) => void;
  onClose: () => void;
}) {
  const [dni, setDni] = useState(patient?.dni ?? "");
  const [name, setName] = useState(patient?.name ?? "");
  const [phone, setPhone] = useState(patient?.phone ?? "");
  const [email, setEmail] = useState(patient?.email ?? "");
  const [birthDate, setBirthDate] = useState(patient?.birthDate?.slice(0, 10) ?? "");
  const [reniecBusy, setReniecBusy] = useState(false);
  const [reniecNote, setReniecNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);

  async function consultReniec(targetDni: string, overwriteName: boolean) {
    const clean = targetDni.replace(/\D/g, "").slice(0, 8);
    if (clean.length !== 8) {
      setReniecNote("Ingresa 8 dígitos para consultar en RENIEC.");
      return;
    }
    setReniecBusy(true);
    setReniecNote("");
    try {
      const res = await lookupDniReniec(clean);
      if (res.ok && res.fullName) {
        if (overwriteName || !name.trim()) setName(res.fullName);
        setReniecNote("✓ Nombre completado desde RENIEC.");
      } else {
        setReniecNote(res.message ?? res.error ?? "No se encontró el DNI en RENIEC.");
      }
    } catch {
      setReniecNote("No se pudo conectar con RENIEC.");
    } finally {
      setReniecBusy(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setBusy(true);
    setError("");
    try {
      const saved = await postJson<{ patient: Patient }>("/api/panel/pacientes", {
        id: patient?.id,
        name: name.trim(),
        phone: phone.trim(),
        dni: dni.trim() || null,
        email: email.trim() || null,
        birthDate: birthDate || null,
      });
      onSaved(patient ? "Datos actualizados." : "Paciente registrado.", saved.patient);
    } catch (problem) {
      setError(errorMessage(problem));
      setBusy(false);
    }
  }

  return (
    <form className={styles.stack} aria-labelledby="patient-form-title" onSubmit={save}>
      <div className={styles.row}>
        <h3 id="patient-form-title" tabIndex={-1} ref={heading}>{patient ? "Editar datos de contacto" : "Registrar paciente"}</h3>
        <button type="button" className={styles.secondary} onClick={onClose} disabled={busy}>Cerrar</button>
      </div>
      <div className={styles.reniecRow}>
        <label className={styles.field}>DNI (autocompletado RENIEC)
          <input
            inputMode="numeric"
            maxLength={8}
            value={dni}
            placeholder="8 dígitos"
            onChange={(event) => {
              const val = event.target.value.replace(/\D/g, "").slice(0, 8);
              setDni(val);
              if (val.length === 8 && !name.trim()) void consultReniec(val, false);
            }}
          />
        </label>
        <button
          type="button"
          className={styles.secondary}
          disabled={reniecBusy || dni.length !== 8}
          onClick={() => void consultReniec(dni, true)}
        >
          {reniecBusy ? "Buscando…" : "Consultar RENIEC"}
        </button>
      </div>
      {reniecNote && <p className={reniecNote.startsWith("✓") ? styles.reniecHint : styles.muted}>{reniecNote}</p>}
      <div className={styles.columns}>
        <label className={styles.field}>Nombre completo<input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className={styles.field}>Teléfono<input type="tel" required maxLength={28} value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
        <label className={styles.field}>Correo electrónico<input type="email" maxLength={180} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label className={styles.field}>Fecha de nacimiento<input type="date" max={todayLima()} value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></label>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button type="submit" className={styles.primary} disabled={busy || !name.trim() || !phone.trim()}>{busy ? "Guardando…" : "Guardar paciente"}</button>
    </form>
  );
}
