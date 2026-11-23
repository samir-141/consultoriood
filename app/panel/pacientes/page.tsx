"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
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
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<Result>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ patient?: Patient } | null>(null);
  const [notice, setNotice] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const mayEdit = staff.role !== "ODONTOLOGO";
  const query = new URLSearchParams({ q: selectedId === null && linkedId ? linkedId : search });
  const requestKey = query.toString() + "#" + revision;
  const current = result?.key === requestKey ? result : undefined;
  const patients = current?.patients ?? [];
  const patient = patients.find((item) => item.id === (selectedId ?? linkedId));
  const patientId = patient?.id;

  useEffect(() => {
    if (patientId && !editor) detailHeading.current?.focus();
  }, [editor, patientId]);

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
    setSelectedId("");
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
        <p>{mayEdit ? "Busca y actualiza los datos de contacto." : "Consulta a los pacientes asignados a tu atención."}</p>
      </header>
      <section className={`${styles.card} ${styles.stack}`} aria-labelledby="patients-title">
        <div className={styles.row}>
          <h2 id="patients-title" ref={heading} tabIndex={-1}>Directorio</h2>
          {mayEdit && <button className={styles.primary} type="button" onClick={() => { setEditor({}); setNotice(""); }}>Nuevo paciente</button>}
        </div>
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        {editor && <PatientForm key={editor.patient?.id ?? "new"} patient={editor.patient} onSaved={onSaved} onClose={() => {
          setEditor(null);
          heading.current?.focus();
        }} />}
        <form className={styles.search} onSubmit={onSearch}>
          <label className={styles.field}>Por nombre, teléfono o correo
            <input type="search" value={text} onChange={(event) => setText(event.target.value)} maxLength={120} />
          </label>
          <button className={styles.secondary} type="submit">Buscar</button>
          {search && <button className={styles.secondary} type="button" onClick={() => {
            setText(""); setSearch(""); setSelectedId(""); setEditor(null); setNotice("");
          }}>Limpiar filtro</button>}
        </form>
        {!current && <p className={styles.muted} role="status">Cargando pacientes…</p>}
        {current?.error && (
          <div className={styles.stack}>
            <p className={styles.error} role="alert">{current.error}</p>
            <button className={styles.secondary} type="button" onClick={() => setRevision((value) => value + 1)}>Reintentar</button>
          </div>
        )}
        {patient && (
          <section className={`${styles.dayCard} ${styles.stack}`} aria-labelledby="patient-name">
            <div className={styles.row}>
              <h3 id="patient-name" ref={detailHeading} tabIndex={-1}>{patient.name}</h3>
              <button className={styles.secondary} type="button" onClick={() => { setSelectedId(""); heading.current?.focus(); }}>Cerrar datos</button>
            </div>
            <dl className={styles.detailsGrid}>
              <div><dt>Teléfono</dt><dd>{patient.phone || "Sin registrar"}</dd></div>
              <div><dt>Correo</dt><dd>{patient.email || "Sin registrar"}</dd></div>
              <div><dt>Fecha de nacimiento</dt><dd>{patient.birthDate?.slice(0, 10) || "Sin registrar"}</dd></div>
            </dl>
            <div className={styles.actions}>
              {mayEdit && <button className={styles.secondary} type="button" onClick={() => { setEditor({ patient }); setNotice(""); }}>Editar datos</button>}
              {staff.role !== "RECEPCION" && <Link className={styles.shortcutLink} href={`/panel/clinica?paciente=${encodeURIComponent(patient.id)}`}>Abrir ficha clínica</Link>}
              {mayEdit && <Link className={styles.shortcutLink} href={`/panel/pagos?paciente=${encodeURIComponent(patient.id)}`}>Ver pagos</Link>}
            </div>
          </section>
        )}
        {current?.patients?.length === 0 && <p className={styles.muted}>No se encontraron pacientes{search ? " con ese filtro" : ""}.</p>}
        {patients.length > 0 && (
          <ul className={styles.recordList}>
            {patients.map((item) => (
              <li className={`${styles.record} ${styles.row}`} key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  {item.phone && <p className={styles.muted}>{item.phone}</p>}
                </div>
                <button type="button" className={styles.secondary} aria-expanded={patient?.id === item.id}
                  onClick={() => { setSelectedId(item.id); setEditor(null); setNotice(""); }}>Ver datos</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PatientForm({ patient, onSaved, onClose }: {
  patient?: Patient;
  onSaved: (message: string, patient: Patient) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(patient?.name ?? "");
  const [phone, setPhone] = useState(patient?.phone ?? "");
  const [email, setEmail] = useState(patient?.email ?? "");
  const [birthDate, setBirthDate] = useState(patient?.birthDate?.slice(0, 10) ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setBusy(true);
    setError("");
    try {
      const saved = await postJson<{ patient: Patient }>("/api/panel/pacientes", {
        id: patient?.id, name: name.trim(), phone: phone.trim(), email: email.trim() || null, birthDate: birthDate || null,
      });
      onSaved(patient ? "Datos actualizados." : "Paciente registrado.", saved.patient);
    } catch (problem) {
      setError(errorMessage(problem));
      setBusy(false);
    }
  }

  return (
    <form className={`${styles.dayCard} ${styles.stack}`} aria-labelledby="patient-form-title" onSubmit={save}>
      <div className={styles.row}>
        <h3 id="patient-form-title" tabIndex={-1} ref={heading}>{patient ? "Editar datos de contacto" : "Registrar paciente"}</h3>
        <button type="button" className={styles.secondary} onClick={onClose} disabled={busy}>Cerrar</button>
      </div>
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
