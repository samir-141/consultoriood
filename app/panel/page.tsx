"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dateLabel, errorMessage, roleLabels, staffFetch, statusLabels, todayLima, useStaff, type Agenda } from "./agenda/staff";
import styles from "./agenda/staff.module.css";

const active = new Set(["CONFIRMED", "CHECKED_IN", "IN_PROGRESS"]);

export default function StaffDashboard() {
  const staff = useStaff();
  const [date] = useState(todayLima);
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ date, days: "1", professionalId: staff.professionalId ?? "any" });
    staffFetch<Agenda>("/api/panel/agenda?" + query, { signal: controller.signal })
      .then(setAgenda)
      .catch((problem) => {
        if (!controller.signal.aborted) setError(errorMessage(problem));
      });
    return () => controller.abort();
  }, [date, staff.professionalId, attempt]);

  const appointments = agenda?.appointments ?? [];
  const pending = appointments.filter((appointment) => active.has(appointment.status))
    .sort((first, second) => first.time.localeCompare(second.time));

  return (
    <div className={styles.stack}>
      <header className={styles.intro}>
        <h1>Hola, {staff.name}</h1>
        <p>{roleLabels[staff.role]} · {dateLabel(date)}</p>
      </header>
      <section className={`${styles.card} ${styles.stack}`} aria-labelledby="today-title">
        <div className={styles.row}>
          <h2 id="today-title">{staff.role === "ODONTOLOGO" ? "Mi agenda de hoy" : "Agenda de hoy"}</h2>
          <Link className={styles.primary} href="/panel/agenda">Abrir agenda</Link>
        </div>
        {error ? (
          <div className={styles.stack}>
            <p className={styles.error} role="alert">{error}</p>
            <button className={styles.secondary} type="button" onClick={() => { setError(""); setAttempt((value) => value + 1); }}>Actualizar</button>
          </div>
        ) : agenda ? (
          <>
            <dl className={styles.metrics}>
              <div><dt>Por atender</dt><dd>{pending.length}</dd></div>
              <div><dt>Completadas</dt><dd>{appointments.filter((appointment) => appointment.status === "COMPLETED").length}</dd></div>
              <div><dt>Bloqueos</dt><dd>{agenda.blocks.length}</dd></div>
            </dl>
            {pending.length > 0 ? (
              <ul className={styles.recordList} aria-label="Citas por atender">
                {pending.slice(0, 4).map((appointment) => (
                  <li className={`${styles.record} ${styles.row}`} key={appointment.id}>
                    <p><strong>{appointment.time}</strong> · {appointment.patientName} · {appointment.serviceName}</p>
                    <span className={styles.pill} data-status={appointment.status}>{statusLabels[appointment.status]}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.muted}>Todavía no hay citas por atender en este día.</p>
            )}
          </>
        ) : (
          <p role="status" className={styles.muted}>Cargando la agenda…</p>
        )}
      </section>
      <div className={styles.shortcuts}>
        <section className={`${styles.card} ${styles.stack}`}>
          <h2>Pacientes</h2>
          <p className={styles.muted}>Consulta los datos de contacto y las fichas a tu cargo.</p>
          <Link className={styles.shortcutLink} href="/panel/pacientes">Ver pacientes</Link>
        </section>
        {staff.role !== "RECEPCION" && (
          <section className={`${styles.card} ${styles.stack}`}>
            <h2>Clínica</h2>
            <p className={styles.muted}>Consulta atenciones, odontograma y planes de tratamiento.</p>
            <Link className={styles.shortcutLink} href="/panel/clinica">Abrir clínica</Link>
          </section>
        )}
        {staff.role !== "ODONTOLOGO" && (
          <section className={`${styles.card} ${styles.stack}`}>
            <h2>Pagos</h2>
            <p className={styles.muted}>Registra abonos y revisa comprobantes pendientes.</p>
            <Link className={styles.shortcutLink} href="/panel/pagos">Abrir pagos</Link>
          </section>
        )}
        {staff.role !== "ODONTOLOGO" && (
          <section className={`${styles.card} ${styles.stack}`}>
            <h2>Mensajes</h2>
            <p className={styles.muted}>Consulta las confirmaciones y los recordatorios de citas.</p>
            <Link className={styles.shortcutLink} href="/panel/mensajes">Abrir mensajes</Link>
          </section>
        )}
      </div>
    </div>
  );
}
