"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { professionals } from "@/config/site";
import {
  dateLabel,
  errorMessage,
  postJson,
  staffFetch,
  statusLabels,
  useStaff,
  type Status,
} from "../agenda/staff";
import styles from "../agenda/staff.module.css";

type DoctorLink = { id: string; name: string };

type CitaLinkRow = {
  id: string;
  date: string;
  time: string;
  endTime: string;
  serviceId: string;
  serviceName: string;
  professionalId: string;
  professionalName: string;
  status: Status;
  priceCents: number;
  reminder30mSentAt: string | null;
  patientId: string;
  patientName: string;
  patientPhone: string;
  patientDni: string | null;
  isAssignedToAppointmentDoctor: boolean;
  assignedDoctors: DoctorLink[];
};

type CitasResponse = {
  appointments: CitaLinkRow[];
  summary: { total: number; assigned: number; unassigned: number };
};

type CitasResult = {
  key: string;
  data?: CitasResponse;
  error?: string;
};

export default function CitasDoctoresPage() {
  const staff = useStaff();
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [professionalId, setProfessionalId] = useState("any");
  const [status, setStatus] = useState("ALL");
  const [assignment, setAssignment] = useState<"all" | "assigned" | "unassigned">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<CitasResult>();
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (professionalId !== "any") params.set("professionalId", professionalId);
  if (status !== "ALL") params.set("status", status);
  if (assignment !== "all") params.set("assignment", assignment);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const queryString = params.toString();
  const requestKey = `${queryString}#${revision}`;
  const current = result?.key === requestKey ? result : undefined;
  const loading = staff.role !== "ODONTOLOGO" && !current;
  const data = current?.data ?? null;
  const error = actionError || current?.error || "";

  useEffect(() => {
    if (staff.role === "ODONTOLOGO") return;
    const controller = new AbortController();
    staffFetch<CitasResponse>("/api/panel/citas?" + queryString, { signal: controller.signal })
      .then((res) => {
        if (!controller.signal.aborted) {
          setResult({ key: requestKey, data: res });
        }
      })
      .catch((problem) => {
        if (!controller.signal.aborted) {
          setResult({ key: requestKey, error: errorMessage(problem) });
        }
      });

    return () => controller.abort();
  }, [staff.role, queryString, requestKey]);

  async function toggleAssignment(action: "assign" | "unassign", patientId: string, profId: string, label: string) {
    const key = `${action}:${patientId}:${profId}`;
    setBusyKey(key);
    setNotice("");
    setActionError("");
    try {
      await postJson("/api/panel/asignaciones", { action, patientId, professionalId: profId });
      setNotice(action === "assign" ? `Paciente asignado a ${label}.` : `Asignación con ${label} retirada.`);
      setRevision((v) => v + 1);
    } catch (problem) {
      setActionError(errorMessage(problem));
    } finally {
      setBusyKey(null);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(text.trim());
  }

  if (staff.role === "ODONTOLOGO") {
    return null;
  }

  return (
    <div className={styles.stack}>
      <header className={styles.intro}>
        <h1>Citas, pacientes y doctores</h1>
        <p>
          Vista unificada para Administración y Recepción: verifica qué doctor atiende cada cita y qué pacientes tienen asignación clínica activa.
        </p>
      </header>

      <section className={`${styles.card} ${styles.stack}`} aria-labelledby="citas-resumen-titulo">
        <h2 id="citas-resumen-titulo">Resumen de vinculación</h2>
        <dl className={styles.metrics}>
          <div>
            <dt>Citas listadas</dt>
            <dd>{data?.summary.total ?? 0}</dd>
          </div>
          <div>
            <dt>Con doctor asignado</dt>
            <dd>{data?.summary.assigned ?? 0}</dd>
          </div>
          <div>
            <dt>Sin asignación clínica</dt>
            <dd>{data?.summary.unassigned ?? 0}</dd>
          </div>
        </dl>

        <form className={styles.filtersBar} onSubmit={onSubmit}>
          <label className={styles.field}>
            Buscar paciente, DNI, teléfono o doctor
            <input
              type="search"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setSearch(e.target.value.trim());
              }}
              placeholder="Ej. 75582020 o Samir…"
              maxLength={120}
            />
          </label>
          <label className={styles.field}>
            Doctor asignado
            <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
              <option value="any">Todos los doctores</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              <option value="odonto-b">Odontólogo B (demo)</option>
            </select>
          </label>
          <label className={styles.field}>
            Estado de la cita
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ALL">Todos los estados</option>
              {(Object.keys(statusLabels) as Status[]).map((s) => (
                <option key={s} value={s}>{statusLabels[s]}</option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Cargo clínico
            <select
              value={assignment}
              onChange={(e) => setAssignment(e.target.value as "all" | "assigned" | "unassigned")}
            >
              <option value="all">Todos</option>
              <option value="assigned">Con asignación activa</option>
              <option value="unassigned">Sin asignar a su doctor</option>
            </select>
          </label>
          <label className={styles.field}>
            Desde
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className={styles.field}>
            Hasta
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </label>
        </form>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              setText("");
              setSearch("");
              setProfessionalId("any");
              setStatus("ALL");
              setAssignment("all");
              setFrom("");
              setTo("");
            }}
          >
            Restablecer filtros
          </button>
          <Link className={styles.primary} href="/panel/agenda">Ir a programación de agenda</Link>
        </div>

        {notice && <p className={styles.notice} role="status">{notice}</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {loading && <p className={styles.muted} role="status">Cargando tabla de citas…</p>}

        <div
          tabIndex={0}
          role="region"
          aria-labelledby="citas-doctores-table-title"
          className={styles.tableWrapper}
        >
          <table className={styles.responsiveTable}>
            <caption id="citas-doctores-table-title">
              Relación de citas, pacientes y doctores correspondientes ({data?.appointments.length ?? 0})
            </caption>
            <thead>
              <tr>
                <th scope="col" style={{ width: "20%" }}>Paciente</th>
                <th scope="col" style={{ width: "14%" }}>Fecha y hora</th>
                <th scope="col" style={{ width: "14%" }}>Tratamiento</th>
                <th scope="col" style={{ width: "11%" }}>Estado</th>
                <th scope="col" style={{ width: "14%" }}>Doctor de la cita</th>
                <th scope="col" style={{ width: "15%" }}>Cargo clínico</th>
                <th scope="col" style={{ width: "12%" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data?.appointments.length ? (
                data.appointments.map((row) => {
                  const canAssignDoctor = professionals.some((p) => p.id === row.professionalId);
                  const isBusy = busyKey?.includes(row.patientId) ?? false;
                  return (
                    <tr key={row.id}>
                      <th scope="row">
                        <span className={styles.singleLine} title={row.patientName}>
                          {row.patientName}
                        </span>
                        <small className={styles.muted}>
                          {[row.patientPhone, row.patientDni ? `DNI ${row.patientDni}` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      </th>
                      <td>
                        <div>{dateLabel(row.date, true)}</div>
                        <small className={styles.muted}>{row.time}–{row.endTime}</small>
                      </td>
                      <td>
                        <span className={styles.singleLine} title={row.serviceName}>{row.serviceName}</span>
                      </td>
                      <td>
                        <span className={styles.pill} data-status={row.status}>{statusLabels[row.status]}</span>
                      </td>
                      <td>
                        <span className={styles.singleLine} title={row.professionalName}>{row.professionalName}</span>
                      </td>
                      <td>
                        <div className={styles.stack} style={{ gap: ".35rem" }}>
                          {row.isAssignedToAppointmentDoctor ? (
                            <span className={styles.assignedTag}>Asignado al doctor de la cita</span>
                          ) : (
                            <span className={styles.unassignedTag}>Sin asignación en ficha</span>
                          )}
                          {row.assignedDoctors.length > 0 && (
                            <small className={styles.muted}>
                              A cargo de: {row.assignedDoctors.map((d) => d.name).join(", ")}
                            </small>
                          )}
                          {canAssignDoctor && (
                            <button
                              type="button"
                              className={styles.miniBtn}
                              disabled={isBusy}
                              onClick={() =>
                                void toggleAssignment(
                                  row.isAssignedToAppointmentDoctor ? "unassign" : "assign",
                                  row.patientId,
                                  row.professionalId,
                                  row.professionalName,
                                )
                              }
                            >
                              {row.isAssignedToAppointmentDoctor ? "Quitar vínculo" : "Asignar a este doctor"}
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className={styles.inlineActionBar}>
                          <Link
                            className={styles.miniBtn}
                            href={`/panel/pacientes?paciente=${encodeURIComponent(row.patientId)}`}
                          >
                            Paciente
                          </Link>
                          <Link
                            className={styles.miniBtn}
                            href={`/panel/pagos?paciente=${encodeURIComponent(row.patientId)}`}
                          >
                            Pagos
                          </Link>
                          {staff.role === "ADMIN" && row.isAssignedToAppointmentDoctor && (
                            <Link
                              className={styles.miniBtn}
                              href={`/panel/clinica?paciente=${encodeURIComponent(row.patientId)}`}
                            >
                              Ficha
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7}>
                    <span className={styles.muted}>
                      {loading ? "Consultando registros…" : "No hay citas que coincidan con los filtros actuales."}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
