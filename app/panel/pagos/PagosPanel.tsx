"use client";

import { useEffect, useState, type FormEvent } from "react";
import { parseSoles } from "@/lib/clinical-money";
import { useStaff } from "../agenda/staff";
import {
  apiRequest,
  errorMessage,
  fileToBase64,
  formatDate,
  formatMoney,
  patientOption,
  statusLabel,
  type Balance,
  type Patient,
  type Payment,
} from "./pagos-data";
import styles from "./pagos.module.css";

type PagosPanelProps = Readonly<{ initialPatientId: string }>;

type RegisterForm = {
  amount: string;
  method: "YAPE" | "PLIN" | "TRANSFERENCIA";
  reference: string;
  target: string;
  proof: File | null;
};

const emptyRegister: RegisterForm = {
  amount: "",
  method: "YAPE",
  reference: "",
  target: "",
  proof: null,
};

const methodLabels: Record<RegisterForm["method"], string> = {
  YAPE: "Yape",
  PLIN: "Plin",
  TRANSFERENCIA: "Transferencia",
};

function updatePatientQuery(id: string) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("paciente", id);
  else url.searchParams.delete("paciente");
  window.history.replaceState(null, "", url);
}

function statusClass(status: string): string {
  switch (status.toUpperCase()) {
    case "PENDING": return styles.pending;
    case "CONFIRMED": return styles.confirmed;
    case "REJECTED": return styles.rejected;
    case "REFUNDED": return styles.refunded;
    default: return "";
  }
}

export default function PagosPanel({ initialPatientId }: PagosPanelProps) {
  const user = useStaff();
  const [patientQuery, setPatientQuery] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientFilter, setPatientFilter] = useState(initialPatientId);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [registerForm, setRegisterForm] = useState<RegisterForm>(emptyRegister);

  const isAdmin = user.role === "ADMIN";

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      apiRequest<{ patients: Patient[] }>(
        `/api/panel/pacientes?q=${encodeURIComponent(patientQuery)}`,
        { signal: controller.signal },
      )
        .then((data) => {
          if (controller.signal.aborted) return;
          setPatients(data.patients ?? []);
          if (patientFilter) {
            const match = (data.patients ?? []).find((patient) => patient.id === patientFilter);
            if (match) setPatientQuery((current) => current || patientOption(match));
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) setPatients([]);
        });
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [patientFilter, patientQuery]);

  async function refreshPayments(id: string) {
    const query = id ? `?patientId=${encodeURIComponent(id)}` : "";
    const data = await apiRequest<{ payments: Payment[]; balances: Balance[] }>(`/api/panel/pagos${query}`);
    setPayments(data.payments ?? []);
    setBalances(data.balances ?? []);
  }

  useEffect(() => {
    const controller = new AbortController();
    const query = patientFilter ? `?patientId=${encodeURIComponent(patientFilter)}` : "";
    apiRequest<{ payments: Payment[]; balances: Balance[] }>(`/api/panel/pagos${query}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        setPayments(data.payments ?? []);
        setBalances(data.balances ?? []);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setPayments([]);
        setBalances([]);
        setError(errorMessage(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [patientFilter]);

  function selectPatient(value: string) {
    setPatientQuery(value);
    const match = patients.find((patient) => patientOption(patient) === value);
    const nextId = match?.id ?? "";
    if (nextId === patientFilter) return;
    setPatientFilter(nextId);
    setRegisterForm(emptyRegister);
    setLoading(true);
    setError("");
    setMessage("");
    updatePatientQuery(nextId);
  }

  async function submitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || loading) return;
    const form = event.currentTarget;
    if (!patientFilter) {
      setError("Elige un paciente de la lista antes de registrar el abono.");
      return;
    }
    const amountCents = parseSoles(registerForm.amount);
    if (amountCents === null || amountCents <= 0) {
      setError("Indica un monto en soles con hasta dos decimales.");
      return;
    }
    if (!registerForm.reference.trim()) {
      setError("Indica la referencia de la operación.");
      return;
    }
    if (registerForm.proof && registerForm.proof.size > 10 * 1024 * 1024) {
      setError("Selecciona un comprobante de hasta 10 MB.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload: Record<string, unknown> = {
        action: "register",
        patientId: patientFilter,
        amountCents,
        method: registerForm.method,
        reference: registerForm.reference.trim(),
      };
      const [kind, id] = registerForm.target.split(":");
      if (kind === "APPOINTMENT") payload.appointmentId = id;
      if (kind === "PLAN") payload.planId = id;
      if (registerForm.proof) {
        const proofBase64 = await fileToBase64(registerForm.proof);
        if (proofBase64) {
          payload.proofName = registerForm.proof.name;
          payload.proofMime = registerForm.proof.type || "application/octet-stream";
          payload.proofBase64 = proofBase64;
        }
      }
      await apiRequest("/api/panel/pagos", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await refreshPayments(patientFilter);
      form.reset();
      setRegisterForm(emptyRegister);
      setMessage("El abono se registró y quedó pendiente de revisión.");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function updatePayment(payment: Payment, action: "approve" | "reject" | "refund") {
    if (saving || loading) return;
    const reason = (reasons[payment.id] ?? "").trim();
    if (!reason && action !== "approve") {
      setError("Indica el motivo de la operación.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiRequest("/api/panel/pagos", {
        method: "POST",
        body: JSON.stringify({
          action,
          id: payment.id,
          reason: reason || "Abono aprobado desde el panel",
        }),
      });
      await refreshPayments(patientFilter);
      setReasons((current) => ({ ...current, [payment.id]: "" }));
      const labels = {
        approve: "El abono quedó confirmado.",
        reject: "El abono quedó rechazado.",
        refund: "La devolución quedó registrada.",
      };
      setMessage(labels[action]);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  const selectedPatientName =
    patients.find((patient) => patient.id === patientFilter)?.name ??
    payments.find((payment) => payment.patientId === patientFilter)?.patientName ??
    balances.find((balance) => balance.patientId === patientFilter)?.patientName ??
    patientQuery;
  const availableCharges = balances.filter((balance) => balance.patientId === patientFilter && balance.balanceCents > 0);
  const sortedPayments = [...payments].sort((first, second) =>
    (second.createdAt ?? "").localeCompare(first.createdAt ?? ""),
  );

  return (
    <section className={styles.frame}>
      <section className={styles.intro}>
        <h1>Pagos y saldos</h1>
        <p>Registra abonos manuales, revisa los comprobantes y consulta el saldo de cada paciente.</p>
      </section>

      <div className={styles.statusStack}>
        <p className={styles.notice} role="status">{message}</p>
        <p className={styles.error} role="alert">{error}</p>
        {loading ? <p className={styles.hint}>Actualizando información…</p> : null}
      </div>

      <div className={styles.layout}>
        <section className={styles.card} aria-labelledby="abonos-titulo">
          <div className={styles.sectionHead}>
            <h2 id="abonos-titulo">Abonos</h2>
            <span className={styles.meta}>{payments.length} registros</span>
          </div>
          <div className={styles.stack}>
            {sortedPayments.length === 0 ? (
              <p className={styles.empty}>No hay abonos para este paciente.</p>
            ) : (
              <ul className={styles.list}>
                {sortedPayments.map((payment) => {
                  const canReview =
                    payment.status.toUpperCase() === "PENDING" ||
                    (payment.status.toUpperCase() === "CONFIRMED" && isAdmin);
                  return (
                    <li className={styles.item} key={payment.id}>
                      <div className={styles.itemHead}>
                        <strong>{payment.patientName ?? "Paciente sin nombre"}</strong>
                        <span className={`${styles.tag} ${statusClass(payment.status)}`}>
                          {statusLabel(payment.status)}
                        </span>
                      </div>
                      <span className={styles.meta}>
                        {formatMoney(payment.amountCents)} · {methodLabels[payment.method as RegisterForm["method"]] ?? payment.method} · {formatDate(payment.createdAt)}
                      </span>
                      {payment.reference ? <span className={styles.meta}>Referencia: {payment.reference}</span> : null}
                      {payment.reason ? <span className={styles.meta}>Motivo: {payment.reason}</span> : null}
                      {payment.proofName ? (
                        <div className={styles.actions}>
                          <a
                            className={styles.buttonQuiet}
                            href={`/api/panel/pagos/${encodeURIComponent(payment.id)}/comprobante`}
                            download={payment.proofName}
                          >
                            Descargar comprobante
                          </a>
                        </div>
                      ) : null}
                      {canReview ? (
                        <details className={styles.disclosure}>
                          <summary>Revisar abono</summary>
                          <div className={styles.stack}>
                            <label className={styles.field}>
                              <span>Motivo</span>
                              <input
                                className={styles.input}
                                value={reasons[payment.id] ?? ""}
                                onChange={(event) => setReasons({ ...reasons, [payment.id]: event.target.value })}
                                placeholder="Ej. Revisado en el banco"
                              />
                            </label>
                            <div className={styles.actions}>
                              {payment.status.toUpperCase() === "PENDING" ? (
                                <>
                                  <button
                                    type="button"
                                    className={styles.button}
                                    onClick={() => void updatePayment(payment, "approve")}
                                    disabled={saving || loading}
                                  >
                                    Confirmar
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.buttonSecondary}
                                    onClick={() => void updatePayment(payment, "reject")}
                                    disabled={saving || loading}
                                  >
                                    Rechazar
                                  </button>
                                </>
                              ) : null}
                              {payment.status.toUpperCase() === "CONFIRMED" && isAdmin ? (
                                <button
                                  type="button"
                                  className={styles.buttonSecondary}
                                  onClick={() => void updatePayment(payment, "refund")}
                                  disabled={saving || loading}
                                >
                                  Devolver
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </details>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <aside className={styles.stack}>
          <section className={styles.card} aria-labelledby="paciente-titulo">
            <h2 id="paciente-titulo">Paciente</h2>
            <label className={styles.field}>
              <span>Buscar por nombre o teléfono</span>
              <input
                className={styles.input}
                list="pacientes-pagos"
                value={patientQuery}
                onChange={(event) => selectPatient(event.target.value)}
                placeholder="Escribe para buscar"
                autoComplete="off"
                disabled={saving}
              />
              <datalist id="pacientes-pagos">
                {patients.map((patient) => (
                  <option key={patient.id} value={patientOption(patient)} />
                ))}
              </datalist>
            </label>
            <p className={styles.hint}>Este paciente filtra la lista y será el destino del abono.</p>
          </section>

          <section className={styles.card} aria-labelledby="saldos-titulo">
            <div className={styles.sectionHead}>
              <h2 id="saldos-titulo">Saldos</h2>
              <span className={styles.meta}>{balances.length} cargos</span>
            </div>
            <div className={styles.stack}>
              {balances.length === 0 ? (
                <p className={styles.empty}>No hay saldos registrados.</p>
              ) : (
                <ul className={styles.list}>
                  {balances.map((balance) => (
                    <li className={styles.item} key={balance.id}>
                      <div className={styles.itemHead}>
                        <strong>{balance.label}</strong>
                        <span className={styles.tag}>{balance.kind === "APPOINTMENT" ? "Cita" : "Plan"}</span>
                      </div>
                      {balance.patientName ? (
                        <span className={styles.meta}>{balance.patientName}</span>
                      ) : null}
                      <div className={styles.balanceGrid}>
                        <span className={styles.meta}>Total</span>
                        <span className={styles.money}>{formatMoney(balance.totalCents)}</span>
                        <span className={styles.meta}>Abonado</span>
                        <span className={styles.money}>{formatMoney(balance.paidCents)}</span>
                        <span className={styles.meta}>Pendiente</span>
                        <span className={styles.money}>{formatMoney(balance.balanceCents)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className={styles.card} aria-labelledby="registro-titulo">
            <details className={styles.disclosure}>
              <summary id="registro-titulo">Registrar abono</summary>
              <form key={patientFilter} className={styles.stack} onSubmit={submitRegister}>
                <p className={styles.hint}>
                  Paciente: {selectedPatientName || "Selecciona un paciente en el buscador."}
                </p>
                <div className={styles.twoColumns}>
                  <label className={styles.field}>
                    <span>Monto en soles</span>
                    <input
                      className={styles.input}
                      inputMode="decimal"
                      value={registerForm.amount}
                      onChange={(event) => setRegisterForm({ ...registerForm, amount: event.target.value })}
                      placeholder="80,00"
                      required
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Método</span>
                    <select
                      className={styles.select}
                      value={registerForm.method}
                      onChange={(event) => setRegisterForm({
                        ...registerForm,
                        method: event.target.value as RegisterForm["method"],
                      })}
                    >
                      <option value="YAPE">Yape</option>
                      <option value="PLIN">Plin</option>
                      <option value="TRANSFERENCIA">Transferencia</option>
                    </select>
                  </label>
                </div>
                <label className={styles.field}>
                  <span>Referencia</span>
                  <input
                    className={styles.input}
                    value={registerForm.reference}
                    onChange={(event) => setRegisterForm({ ...registerForm, reference: event.target.value })}
                    placeholder="Número de operación"
                    required
                  />
                </label>
                <details className={styles.disclosure}>
                  <summary>Asociación y comprobante</summary>
                  <div className={styles.stack}>
                    <label className={styles.field}>
                      <span>Cargo asociado</span>
                      <select
                        className={styles.select}
                        value={registerForm.target}
                        onChange={(event) => setRegisterForm({ ...registerForm, target: event.target.value })}
                      >
                        <option value="">Sin cargo asociado</option>
                        {availableCharges.map((balance) => (
                          <option key={balance.kind + balance.id} value={balance.kind + ":" + balance.id}>
                            {balance.kind === "APPOINTMENT" ? "Cita" : "Plan"} · {balance.label} · {formatMoney(balance.balanceCents)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span>Archivo del comprobante</span>
                      <input
                        className={styles.input}
                        type="file"
                        accept="application/pdf,image/png,image/jpeg"
                        onChange={(event) => setRegisterForm({
                          ...registerForm,
                          proof: event.target.files?.[0] ?? null,
                        })}
                      />
                    </label>
                    <p className={styles.hint}>El comprobante se guarda de forma privada y se consulta desde cada abono.</p>
                  </div>
                </details>
                <button className={styles.button} type="submit" disabled={!patientFilter || saving || loading}>Registrar abono</button>
              </form>
            </details>
          </section>
        </aside>
      </div>
    </section>
  );
}
