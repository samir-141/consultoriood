"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { atLima, validDate } from "@/lib/clinic-time";
import {
  dateLabel, errorMessage, nextDate, postJson, staffFetch, statusLabels, todayLima, useStaff,
  StaffRequestError,
  type Agenda, type Appointment, type Block, type Catalog, type Patient, type Slot, type Status,
} from "./staff";
import styles from "./staff.module.css";

type Entry = { kind: "appointment"; value: Appointment } | { kind: "block"; value: Block };
type Selection = Entry | { kind: "create"; defaultTime?: string } | { kind: "new-block"; defaultStart?: string };
type CalendarResult = { key: string; agenda?: Agenda; error?: string };
type StatusFilter = "ALL" | "BLOCKS" | Status;

const transitions: Partial<Record<Status, Status[]>> = {
  CONFIRMED: ["CHECKED_IN", "NO_SHOW"],
  CHECKED_IN: ["IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED"],
};

const QUICK_HOURS = ["09:00", "10:00", "11:00", "15:00", "16:00"];

export default function AgendaPage() {
  const staff = useStaff();
  const [date, setDate] = useState(todayLima);
  const [range, setRange] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [professional, setProfessional] = useState(staff.professionalId ?? "any");
  const [catalog, setCatalog] = useState<Catalog>({ services: [], professionals: [] });
  const [catalogError, setCatalogError] = useState("");
  const [result, setResult] = useState<CalendarResult>();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [inlineBusyId, setInlineBusyId] = useState<string | null>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const mayManage = staff.role !== "ODONTOLOGO";

  const query = new URLSearchParams({ date, days: String(range), professionalId: professional });
  const calendarKey = query.toString() + "#" + revision;
  const calendar = result?.key === calendarKey ? result : undefined;

  useEffect(() => {
    const controller = new AbortController();
    staffFetch<Catalog>("/api/catalogo", { signal: controller.signal })
      .then(setCatalog)
      .catch((problem) => {
        if (!controller.signal.aborted) setCatalogError(errorMessage(problem));
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const apiQuery = calendarKey.split("#")[0];
    staffFetch<Agenda>("/api/panel/agenda?" + apiQuery, { signal: controller.signal })
      .then((agenda) => {
        if (!controller.signal.aborted) setResult({ key: calendarKey, agenda });
      })
      .catch((problem) => {
        if (!controller.signal.aborted) setResult({ key: calendarKey, error: errorMessage(problem) });
      });
    return () => controller.abort();
  }, [calendarKey]);

  function open(value: Selection, trigger?: HTMLElement | null) {
    lastTrigger.current = trigger ?? null;
    setNotice("");
    setSelection(value);
  }

  function close() {
    setSelection(null);
    lastTrigger.current?.focus();
  }

  function finish(message: string, when?: string) {
    setNotice(message);
    setSelection(null);
    if (when) setDate(when);
    setRevision((value) => value + 1);
    heading.current?.focus();
  }

  const [inlineError, setInlineError] = useState("");

  async function quickStatus(appointmentId: string, status: Status, msg: string) {
    setInlineBusyId(appointmentId);
    setNotice("");
    setInlineError("");
    try {
      await postJson("/api/panel/agenda", { action: "status", appointmentId, status });
      setNotice(msg);
      setRevision((value) => value + 1);
    } catch (problem) {
      setInlineError(errorMessage(problem));
    } finally {
      setInlineBusyId(null);
    }
  }

  const days = Array.from({ length: range }, (_, index) => nextDate(date, index));
  const previous = nextDate(date, -range);
  const upcoming = nextDate(date, range);
  const allEntries: Entry[] = calendar?.agenda ? [
    ...calendar.agenda.appointments.map((value): Entry => ({ kind: "appointment", value })),
    ...calendar.agenda.blocks.map((value): Entry => ({ kind: "block", value })),
  ] : [];
  allEntries.sort((one, two) => one.value.time.localeCompare(two.value.time));

  const entries = allEntries.filter((entry) => {
    if (statusFilter === "ALL") return true;
    if (statusFilter === "BLOCKS") return entry.kind === "block";
    return entry.kind === "appointment" && entry.value.status === statusFilter;
  });

  const activeMode = statusFilter === "BLOCKS" ? "blocks" : range === 7 ? "week" : "day";

  return (
    <div className={styles.stack}>
      <header className={styles.intro}>
        <h1>{mayManage ? "Agenda" : "Mi agenda"}</h1>
        <p>Horario de Lima · Navega entre días, filtra estados y gestiona turnos o bloqueos en vivo.</p>
      </header>

      <section className={`${styles.card} ${styles.stack} ${styles.masterDetailContainer}`} aria-labelledby="agenda-title" aria-busy={!calendar}>
        {/* Barra de navegación rápida y acciones principales */}
        <div className={styles.agendaNavBar}>
          <div className={styles.stack} style={{ gap: "0.45rem" }}>
            <h2 id="agenda-title" ref={heading} tabIndex={-1}>
              {range === 1 ? "Programación del día" : "Programación de la semana"}
            </h2>
            <div className={styles.segmentedGroup} role="group" aria-label="Vistas rápidas de agenda">
              <button
                type="button"
                className={`${styles.segBtn} ${activeMode === "day" ? styles.segBtnActive : ""}`}
                onClick={() => { setRange(1); setStatusFilter("ALL"); setSelection(null); }}
              >
                Vista día
              </button>
              <button
                type="button"
                className={`${styles.segBtn} ${activeMode === "week" ? styles.segBtnActive : ""}`}
                onClick={() => { setRange(7); setStatusFilter("ALL"); setSelection(null); }}
              >
                Vista semana
              </button>
              <button
                type="button"
                className={`${styles.segBtn} ${activeMode === "blocks" ? styles.segBtnActive : ""}`}
                onClick={() => { setStatusFilter(statusFilter === "BLOCKS" ? "ALL" : "BLOCKS"); setSelection(null); }}
              >
                Bloqueos / Días libres ({allEntries.filter((e) => e.kind === "block").length})
              </button>
            </div>
          </div>

          <div className={styles.actions}>
            {mayManage && (
              <button className={styles.primary} type="button" onClick={(event) => open({ kind: "create" }, event.currentTarget)}>
                Nueva cita
              </button>
            )}
            <button
              className={styles.secondary}
              type="button"
              onClick={(event) => open({ kind: "new-block" }, event.currentTarget)}
            >
              {mayManage ? "Cirugía / Día libre / Bloqueo" : "Tomar día u horas libres"}
            </button>
          </div>
        </div>

        {/* Filtros siempre visibles cuando hay espacio */}
        <div className={styles.filtersBar} aria-label="Filtros de agenda">
          <label className={styles.field}>Periodo
            <select value={range} onChange={(event) => { setSelection(null); setRange(Number(event.target.value)); }}>
              <option value={1}>Por día</option>
              <option value={7}>Semana a partir de la fecha</option>
            </select>
          </label>
          <label className={styles.field}>Fecha
            <input type="date" min="1900-01-01" max="2100-12-31" value={date} onChange={(event) => {
              if (validDate(event.target.value)) { setSelection(null); setDate(event.target.value); }
            }} />
          </label>
          {mayManage && (
            <label className={styles.field}>Profesional
              <select value={professional} onChange={(event) => { setSelection(null); setProfessional(event.target.value); }}>
                <option value="any">Todos</option>
                {catalog.professionals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          )}
          <label className={styles.field}>Estado
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="ALL">Todos ({allEntries.length})</option>
              <option value="CONFIRMED">Confirmadas</option>
              <option value="CHECKED_IN">En sede / sala</option>
              <option value="IN_PROGRESS">En atención</option>
              <option value="COMPLETED">Completadas</option>
              <option value="PENDING">Retenidas</option>
              <option value="BLOCKS">Bloqueos / Días libres</option>
            </select>
          </label>
          <div className={styles.actions} aria-label="Navegación por fechas">
            <button className={styles.secondary} type="button" aria-label={range === 1 ? "Día anterior" : "Semana anterior"}
              disabled={!validDate(previous)} onClick={() => { setSelection(null); setDate(previous); }}>← Anterior</button>
            <button className={styles.secondary} type="button"
              onClick={() => { setSelection(null); setDate(todayLima()); }}>Hoy</button>
            <button className={styles.secondary} type="button" aria-label={range === 1 ? "Día siguiente" : "Semana siguiente"}
              disabled={!validDate(upcoming)} onClick={() => { setSelection(null); setDate(upcoming); }}>Siguiente →</button>
          </div>
        </div>

        {notice && <p className={styles.notice} role="status">{notice}</p>}
        {inlineError && <p className={styles.error} role="alert">{inlineError}</p>}
        {catalogError && <p className={styles.error} role="alert">{catalogError}</p>}
        {calendar?.error && (
          <div className={styles.stack}>
            <p className={styles.error} role="alert">{calendar.error}</p>
            <button className={styles.secondary} type="button" onClick={() => setRevision((value) => value + 1)}>Reintentar</button>
          </div>
        )}
        {!calendar && <p className={styles.muted} role="status">Cargando la agenda…</p>}

        {calendar?.agenda && (
          <div className={styles.masterDetail}>
            {/* Columna izquierda: listado dinámico */}
            <div className={`${styles.dayList} ${range === 7 ? styles.weekList : ""}`}>
              {days.map((day) => (
                <AgendaDay
                  key={day}
                  day={day}
                  week={range === 7}
                  entries={entries.filter((entry) => entry.value.date === day)}
                  selected={selection && "value" in selection ? selection.value.id : null}
                  mayManage={mayManage}
                  busyId={inlineBusyId}
                  onOpen={open}
                  onQuickStatus={quickStatus}
                  onQuickSlot={(hour) => open(
                    mayManage ? { kind: "create", defaultTime: hour } : { kind: "new-block", defaultStart: hour },
                  )}
                />
              ))}
            </div>

            {/* Columna derecha: panel lateral de detalle o creación */}
            <div className={styles.stickyCanvas}>
              {selection ? (
                <AgendaDetail
                  key={
                    selection.kind === "appointment" || selection.kind === "block"
                      ? selection.value.id
                      : `${selection.kind}-${"defaultTime" in selection ? selection.defaultTime ?? "" : ""}-${"defaultStart" in selection ? selection.defaultStart ?? "" : ""}`
                  }
                  selection={selection}
                  mayManage={mayManage}
                  staffProfessionalId={staff.professionalId ?? null}
                  catalog={catalog}
                  date={date}
                  professional={professional}
                  onClose={close}
                  onSaved={finish}
                />
              ) : (
                <div className={styles.stack}>
                  <h3>Detalle y acciones rápidas</h3>
                  <p className={styles.muted}>
                    Haz clic en cualquier cita o bloqueo de la lista para ver sus detalles, cambiar su estado, reprogramar o abrir la ficha del paciente.
                  </p>
                  <div className={styles.actions}>
                    {mayManage && (
                      <button type="button" className={styles.primary} onClick={(e) => open({ kind: "create" }, e.currentTarget)}>
                        Agendar nueva cita
                      </button>
                    )}
                    <button type="button" className={styles.secondary} onClick={(e) => open({ kind: "new-block" }, e.currentTarget)}>
                      {mayManage ? "Bloquear horario / día" : "Registrar día u horas libres"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function AgendaDay({ day, week, entries, selected, mayManage, busyId, onOpen, onQuickStatus, onQuickSlot }: {
  day: string;
  week: boolean;
  entries: Entry[];
  selected: string | null;
  mayManage: boolean;
  busyId: string | null;
  onOpen: (entry: Entry, trigger: HTMLElement) => void;
  onQuickStatus: (appointmentId: string, status: Status, message: string) => void;
  onQuickSlot: (hour: string) => void;
}) {
  const orderMap = new Map(
    entries
      .filter(
        (entry) =>
          entry.kind === "appointment" &&
          !["CANCELLED", "EXPIRED", "RESCHEDULED"].includes(entry.value.status),
      )
      .map((entry, idx) => [entry.value.id, idx + 1]),
  );

  return (
    <section className={styles.dayCard} aria-labelledby={`day-${day}`}>
      <div className={styles.row} style={{ marginBottom: "0.55rem" }}>
        <h3 id={`day-${day}`} style={{ marginBottom: 0 }}><time dateTime={day}>{dateLabel(day, week)}</time></h3>
        <span className={styles.meta}>{entries.length} {entries.length === 1 ? "registro" : "registros"}</span>
      </div>
      {entries.length ? (
        <ul className={styles.eventList}>
          {entries.map((entry) => {
            const { value } = entry;
            const orderNum = entry.kind === "appointment" ? orderMap.get(value.id) : undefined;
            const orderTag = orderNum ? `#${orderNum}` : null;
            const isAppointment = entry.kind === "appointment";
            const appt = isAppointment ? entry.value : null;

            return (
              <li key={value.id}>
                <button
                  type="button"
                  className={`${styles.event} ${selected === value.id ? styles.eventSelected : ""}`}
                  aria-expanded={selected === value.id}
                  onClick={(event) => onOpen(entry, event.currentTarget)}
                >
                  <time>{orderTag ? `${orderTag} · ` : ""}{value.time}</time>
                  <span className={styles.eventTitle}>
                    <strong>{isAppointment ? entry.value.patientName : entry.value.reason}</strong>
                    <small>
                      {isAppointment
                        ? `${entry.value.serviceName}${entry.value.patientPhone ? ` · ${entry.value.patientPhone}` : ""} · `
                        : "Bloqueo · "}
                      {value.professionalName}
                    </small>
                  </span>
                  <span className={styles.pill} data-status={isAppointment ? entry.value.status : undefined}>
                    {isAppointment ? statusLabels[entry.value.status] : "Bloqueado"}
                  </span>
                </button>
                {appt && ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS"].includes(appt.status) && (
                  <div className={styles.inlineActionBar}>
                    {appt.status === "CONFIRMED" && (
                      <button
                        type="button"
                        className={styles.miniBtn}
                        disabled={busyId === appt.id}
                        onClick={() => onQuickStatus(appt.id, "CHECKED_IN", "Paciente marcado en sede.")}
                      >
                        Marcar en sede
                      </button>
                    )}
                    {appt.status === "CHECKED_IN" && (
                      <button
                        type="button"
                        className={styles.miniBtn}
                        disabled={busyId === appt.id}
                        onClick={() => onQuickStatus(appt.id, "IN_PROGRESS", "Atención iniciada.")}
                      >
                        Iniciar atención
                      </button>
                    )}
                    {appt.status === "IN_PROGRESS" && (
                      <button
                        type="button"
                        className={styles.miniBtn}
                        disabled={busyId === appt.id}
                        onClick={() => onQuickStatus(appt.id, "COMPLETED", "Cita completada.")}
                      >
                        Completar
                      </button>
                    )}
                    {!mayManage && (
                      <Link className={styles.miniBtn} href={`/panel/clinica?paciente=${encodeURIComponent(appt.patientId)}`}>
                        Abrir ficha
                      </Link>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className={styles.stack} style={{ gap: "0.55rem" }}>
          <p className={styles.muted}>
            {mayManage ? "Día despejado. Selecciona una hora para agendar rápido:" : "Día despejado. Elige una franja si necesitas bloquear horas:"}
          </p>
          <div className={styles.quickChipRow}>
            {QUICK_HOURS.map((hour) => (
              <button
                key={hour}
                type="button"
                className={styles.chipBtn}
                onClick={() => onQuickSlot(hour)}
              >
                {mayManage ? `+ Cita ${hour}` : `Bloquear ${hour}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function AgendaDetail({ selection, mayManage, staffProfessionalId, catalog, date, professional, onClose, onSaved }: {
  selection: Selection; mayManage: boolean; staffProfessionalId: string | null;
  catalog: Catalog; date: string; professional: string;
  onClose: () => void; onSaved: (message: string, date?: string) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [moving, setMoving] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { heading.current?.focus(); }, []);

  async function mutate(fields: object, message: string) {
    setBusy(true);
    setError("");
    try {
      await postJson("/api/panel/agenda", fields);
      onSaved(message);
    } catch (problem) {
      setError(errorMessage(problem));
      setBusy(false);
    }
  }

  const appointment = selection.kind === "appointment" ? selection.value : null;
  const block = selection.kind === "block" ? selection.value : null;
  const title = appointment?.patientName ?? (selection.kind === "create" ? "Nueva cita" : block ? "Bloqueo / Cirugía / Día libre" : "Programar cirugía o tiempo libre");
  const mayMove = appointment && mayManage && appointment.status === "CONFIRMED";
  const mayCancel = appointment && mayManage && !moving && ["PENDING", "CONFIRMED"].includes(appointment.status);
  const mayUnblock = block && (mayManage || (staffProfessionalId !== null && block.professionalId === staffProfessionalId));

  return (
    <section className={`${styles.stack} ${styles.detail}`} aria-labelledby="appointment-detail-title">
      <div className={styles.row}>
        <h3 ref={heading} tabIndex={-1} id="appointment-detail-title">{title}</h3>
        <button className={styles.secondary} type="button" onClick={onClose} disabled={busy}>Cerrar</button>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {appointment && (
        <>
          <dl className={styles.detailsGrid}>
            <div><dt>Servicio</dt><dd>{appointment.serviceName}</dd></div>
            <div><dt>Profesional</dt><dd>{appointment.professionalName}</dd></div>
            <div><dt>Fecha y hora</dt><dd>{dateLabel(appointment.date)} · {appointment.time}–{appointment.endTime}</dd></div>
            <div><dt>Estado</dt><dd>{statusLabels[appointment.status]}</dd></div>
            <div><dt>Teléfono</dt><dd>{appointment.patientPhone || "No registrado"}</dd></div>
            <div>
              <dt>Aviso 30m antes</dt>
              <dd>{appointment.reminder30mSentAt ? "Gestionado por asistente" : "Pendiente"}</dd>
            </div>
          </dl>
          <div className={styles.actions}>
            {(mayManage || appointment.patientAssigned !== false) && (
              <Link className={styles.shortcutLink} href={`/panel/pacientes?paciente=${encodeURIComponent(appointment.patientId)}`}>
                Datos del paciente
              </Link>
            )}
            {!mayManage && appointment.patientAssigned !== false && !["PENDING", "EXPIRED"].includes(appointment.status) && (
              <Link className={styles.shortcutLink} href={`/panel/clinica?paciente=${encodeURIComponent(appointment.patientId)}`}>
                Ficha clínica
              </Link>
            )}
            {mayManage && appointment.status === "CONFIRMED" && !appointment.reminder30mSentAt && (
              <button
                type="button"
                className={styles.secondary}
                disabled={busy}
                onClick={() => mutate({ action: "mark_reminder_30m", appointmentId: appointment.id }, "Recordatorio de 30 min registrado.")}
              >
                Marcar aviso 30m enviado
              </button>
            )}
          </div>
          {!moving && transitions[appointment.status]?.length ? (
            <AppointmentStatusForm appointment={appointment} busy={busy} onSave={(status) => mutate(
              { action: "status", appointmentId: appointment.id, status }, "Estado de la cita actualizado.",
            )} />
          ) : null}
        </>
      )}
      {mayMove && (
        <>
          {!moving && <button className={styles.secondary} type="button" onClick={() => setMoving(true)} disabled={busy}>Reprogramar cita</button>}
          {moving && (
            <>
              <AppointmentForm catalog={catalog} date={appointment.date} professional={appointment.professionalId} appointment={appointment} onSaved={onSaved} />
              <button className={styles.secondary} type="button" onClick={() => setMoving(false)}>Volver a la cita</button>
            </>
          )}
        </>
      )}
      {mayCancel && (
        <details className={styles.options}>
          <summary>Cancelar cita</summary>
          <form className={styles.stack} onSubmit={(event) => {
            event.preventDefault();
            if (reason.trim()) void mutate({ action: "cancel", appointmentId: appointment.id, reason: reason.trim() }, "Cita cancelada.");
          }}>
            <label className={styles.field}>Motivo
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={240} required />
            </label>
            <button className={styles.secondary} type="submit" disabled={busy || !reason.trim()}>Confirmar cancelación</button>
          </form>
        </details>
      )}
      {block && (
        <>
          <dl className={styles.detailsGrid}>
            <div><dt>Profesional</dt><dd>{block.professionalName}</dd></div>
            <div><dt>Horario</dt><dd>{dateLabel(block.date)} · {block.time}–{block.endTime}</dd></div>
            <div><dt>Motivo</dt><dd>{block.reason}</dd></div>
          </dl>
          {mayUnblock && (
            <details className={styles.options}>
              <summary>Quitar bloqueo</summary>
              <button className={styles.secondary} type="button" disabled={busy} onClick={() => mutate({ action: "unblock", blockId: block.id }, "Bloqueo retirado.")}>Confirmar desbloqueo</button>
            </details>
          )}
        </>
      )}
      {selection.kind === "create" && <AppointmentForm catalog={catalog} date={date} professional={professional} defaultTime={selection.defaultTime} onSaved={onSaved} />}
      {selection.kind === "new-block" && (
        <BlockForm
          catalog={catalog}
          date={date}
          professional={staffProfessionalId ?? professional}
          defaultStart={selection.defaultStart}
          lockProfessional={!mayManage && Boolean(staffProfessionalId)}
          onSaved={onSaved}
        />
      )}
    </section>
  );
}

function AppointmentStatusForm({ appointment, busy, onSave }: {
  appointment: Appointment; busy: boolean; onSave: (status: Status) => void;
}) {
  const [nextStatus, setNextStatus] = useState("");
  const [clock, setClock] = useState(Date.now);
  const untilStart = atLima(appointment.date, appointment.time).getTime() - clock;
  const statuses = (transitions[appointment.status] ?? []).filter((status) => status !== "NO_SHOW" || untilStart <= 0);

  useEffect(() => {
    if (appointment.status !== "CONFIRMED" || untilStart <= 0) return;
    const timer = setTimeout(() => setClock(Date.now()), Math.min(untilStart, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [appointment.status, untilStart]);

  return (
    <form className={styles.search} onSubmit={(event) => {
      event.preventDefault();
      if (nextStatus) onSave(nextStatus as Status);
    }}>
      <label className={styles.field}>Nuevo estado
        <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} required>
          <option value="">Selecciona un estado</option>
          {statuses.map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}
        </select>
      </label>
      <button className={styles.secondary} type="submit" disabled={busy || !nextStatus}>Guardar estado</button>
    </form>
  );
}

type SlotResult = { key: string; slots?: Slot[]; error?: string };
type PatientResult = { key: string; patients?: Patient[]; error?: string };

function AppointmentForm({ catalog, date, professional, defaultTime, appointment, onSaved }: {
  catalog: Catalog; date: string; professional: string; defaultTime?: string; appointment?: Appointment;
  onSaved: (message: string, date?: string) => void;
}) {
  const [serviceId, setServiceId] = useState(appointment?.serviceId ?? catalog.services[0]?.id ?? "");
  const [preference, setPreference] = useState(professional);
  const [scheduledDate, setScheduledDate] = useState(date);
  const [slotId, setSlotId] = useState("");
  const [slotRevision, setSlotRevision] = useState(0);
  const [patientId, setPatientId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [reason, setReason] = useState("");
  const [slotResult, setSlotResult] = useState<SlotResult>();
  const [patientResult, setPatientResult] = useState<PatientResult>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const eligible = catalog.professionals.filter((item) => !serviceId || item.serviceIds.includes(serviceId));
  const professionalId = eligible.some((item) => item.id === preference) ? preference : "any";
  const query = scheduledDate && serviceId
    ? new URLSearchParams({ date: scheduledDate, serviceId, professionalId }).toString() : "";
  const slotKeyWithRevision = query + "#" + slotRevision;
  const slots = slotResult?.key === slotKeyWithRevision ? slotResult.slots : undefined;
  const slotError = slotResult?.key === slotKeyWithRevision ? slotResult.error : undefined;
  const patients = patientResult?.key === patientSearch ? patientResult.patients : undefined;
  const patientError = patientResult?.key === patientSearch ? patientResult.error : undefined;

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    staffFetch<{ slots: Slot[] }>("/api/disponibilidad?" + query, { signal: controller.signal })
      .then(({ slots }) => {
        if (controller.signal.aborted) return;
        setSlotResult({ key: slotKeyWithRevision, slots });
        if (defaultTime && !slotId) {
          const match = slots.find((s) => s.time === defaultTime);
          if (match) setSlotId(`${match.time}|${match.professionalId}`);
        }
      })
      .catch((problem) => {
        if (!controller.signal.aborted) setSlotResult({ key: slotKeyWithRevision, error: errorMessage(problem) });
      });
    return () => controller.abort();
  }, [query, slotKeyWithRevision, defaultTime, slotId]);

  useEffect(() => {
    if (appointment) return;
    const controller = new AbortController();
    staffFetch<{ patients: Patient[] }>("/api/panel/pacientes?" + new URLSearchParams({ q: patientSearch }), { signal: controller.signal })
      .then(({ patients }) => {
        if (!controller.signal.aborted) setPatientResult({ key: patientSearch, patients });
      })
      .catch((problem) => {
        if (!controller.signal.aborted) setPatientResult({ key: patientSearch, error: errorMessage(problem) });
      });
    return () => controller.abort();
  }, [appointment, patientSearch]);

  function slotKey(slot: Slot) {
    return `${slot.time}|${slot.professionalId}`;
  }

  const slot = slots?.find((item) => slotKey(item) === slotId);

  function findPatient() {
    setPatientId("");
    setPatientSearch(searchText.trim());
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slot || (appointment ? !reason.trim() : !patientId)) return;
    setBusy(true);
    setError("");
    const turn = { date: slot.date, time: slot.time, professionalId: slot.professionalId };
    try {
      await postJson("/api/panel/agenda", appointment ? {
        action: "reschedule", appointmentId: appointment.id, reason: reason.trim(), ...turn,
      } : { action: "create", patientId, serviceId, ...turn });
      onSaved(appointment ? "Cita reprogramada." : "Cita creada.", slot.date);
    } catch (problem) {
      setError(errorMessage(problem));
      setBusy(false);
      if (problem instanceof StaffRequestError && problem.status === 409) {
        setSlotId("");
        setSlotRevision((value) => value + 1);
      }
    }
  }

  return (
    <form className={styles.stack} onSubmit={save}>
      {!appointment && (
        <div className={styles.stack}>
          <div className={styles.search}>
            <label className={styles.field}>Buscar paciente
              <input type="search" value={searchText} onChange={(event) => setSearchText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") { event.preventDefault(); findPatient(); }
                }} />
            </label>
            <button className={styles.secondary} type="button" onClick={findPatient}>Buscar</button>
          </div>
          <label className={styles.field}>Paciente
            <select value={patientId} onChange={(event) => setPatientId(event.target.value)} required disabled={!patients?.length}>
              <option value="">{patients ? "Selecciona un paciente" : "Cargando pacientes…"}</option>
              {(patients ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.phone}</option>)}
            </select>
          </label>
          {patients?.length === 0 && <p className={styles.muted}>No se encontraron pacientes. <Link href="/panel/pacientes" className={styles.shortcutLink}>Registrar paciente</Link></p>}
          {patientError && <p className={styles.error} role="alert">{patientError}</p>}
          <label className={styles.field}>Servicio
            <select value={serviceId} onChange={(event) => { setSlotId(""); setServiceId(event.target.value); }} required>
              <option value="">Selecciona un servicio</option>
              {catalog.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
            </select>
          </label>
        </div>
      )}
      <div className={styles.columns}>
        <label className={styles.field}>Profesional
          <select value={professionalId} onChange={(event) => { setSlotId(""); setPreference(event.target.value); }}>
            <option value="any">Cualquier profesional</option>
            {eligible.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className={styles.field}>Fecha
          <input type="date" value={scheduledDate} required onChange={(event) => { setSlotId(""); setScheduledDate(event.target.value); }} />
        </label>
      </div>
      <label className={styles.field}>Hora disponible
        <select value={slotId} onChange={(event) => setSlotId(event.target.value)} required disabled={!slots?.length}>
          <option value="">{!query ? "Elige el servicio y la fecha" : slotError ? "Turnos no disponibles" : !slots ? "Buscando turnos…" : slots.length ? "Selecciona una hora" : "Sin turnos disponibles"}</option>
          {(slots ?? []).map((item) => <option key={slotKey(item)} value={slotKey(item)}>{item.time} · {item.professionalName}</option>)}
        </select>
      </label>
      {slotError && (
        <div className={styles.stack}>
          <p className={styles.error} role="alert">{slotError}</p>
          <button className={styles.secondary} type="button" onClick={() => setSlotRevision((value) => value + 1)}>Volver a buscar turnos</button>
        </div>
      )}
      {appointment && (
        <label className={styles.field}>Motivo del cambio
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} required maxLength={240} />
        </label>
      )}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button className={styles.primary} type="submit" disabled={busy || !slot || (appointment ? !reason.trim() : !patientId)}>
        {busy ? "Guardando…" : appointment ? "Guardar nuevo horario" : "Crear cita"}
      </button>
    </form>
  );
}

function addHour(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${String(Math.min(20, h + 1)).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`;
}

function BlockForm({ catalog, date, professional, defaultStart, lockProfessional = false, onSaved }: {
  catalog: Catalog; date: string; professional: string; defaultStart?: string; lockProfessional?: boolean;
  onSaved: (message: string, date?: string) => void;
}) {
  const defaultWho =
    professional !== "any"
      ? professional
      : catalog.professionals.length === 1
        ? catalog.professionals[0].id
        : "";
  const [when, setWhen] = useState(date);
  const [who, setWho] = useState(defaultWho);
  const [start, setStart] = useState(defaultStart ?? "09:00");
  const [end, setEnd] = useState(defaultStart ? addHour(defaultStart) : "11:00");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function applyPreset(kind: "cirugia" | "dia-libre" | "horas-libres") {
    setError("");
    if (kind === "cirugia") {
      setStart("10:00");
      setEnd("12:00");
      setReason("Cirugía odontológica programada");
    } else if (kind === "dia-libre") {
      setStart("09:00");
      setEnd("17:00");
      setReason("Día libre del profesional (sin atención)");
    } else {
      setStart("14:00");
      setEnd("17:00");
      setReason("Horas libres / permiso del profesional");
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (end <= start) { setError("La hora de fin debe ser posterior a la hora de inicio."); return; }
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await postJson("/api/panel/agenda", {
        action: "block", professionalId: who, date: when, time: start, endTime: end, reason: reason.trim(),
      });
      onSaved("Horario bloqueado en la agenda.", when);
    } catch (problem) {
      setError(errorMessage(problem));
      setBusy(false);
    }
  }

  return (
    <form className={styles.stack} onSubmit={save}>
      <div className={styles.stack}>
        <span className={styles.muted}>Opciones rápidas:</span>
        <div className={styles.presetRow}>
          {!lockProfessional && (
            <button type="button" className={styles.secondary} onClick={() => applyPreset("cirugia")}>
              Cirugía (2h)
            </button>
          )}
          <button type="button" className={styles.secondary} onClick={() => applyPreset("dia-libre")}>
            Día libre completo (09:00–17:00)
          </button>
          <button type="button" className={styles.secondary} onClick={() => applyPreset("horas-libres")}>
            Horas libres / Permiso
          </button>
        </div>
      </div>
      <div className={styles.columns}>
        <label className={styles.field}>Profesional
          <select value={who} onChange={(event) => setWho(event.target.value)} disabled={lockProfessional} required>
            <option value="">Selecciona un profesional</option>
            {catalog.professionals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className={styles.field}>Fecha<input type="date" value={when} onChange={(event) => setWhen(event.target.value)} required /></label>
        <label className={styles.field}>Desde<input type="time" value={start} onChange={(event) => setStart(event.target.value)} required /></label>
        <label className={styles.field}>Hasta<input type="time" value={end} onChange={(event) => setEnd(event.target.value)} required /></label>
      </div>
      <label className={styles.field}>Motivo (cirugía, día libre u otra circunstancia)
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} required maxLength={240} />
      </label>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button className={styles.primary} type="submit" disabled={busy || !who || !when || !start || !end || !reason.trim()}>
        {busy ? "Guardando…" : "Guardar bloqueo en agenda"}
      </button>
    </form>
  );
}
