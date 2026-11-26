"use client";

import type { ClinicalHistoryData } from "@/lib/clinical-history";
import { appointmentLabel, formatDate, formatMoney, formatSize, type PatientRecord } from "./clinica-data";
import { OdontogramChart } from "./odontogram-chart";
import styles from "./clinica.module.css";

type HistoryViewerProps = Readonly<{
  patientId: string;
  record: PatientRecord;
  history: ClinicalHistoryData;
  onSwitchToEditor: () => void;
}>;

function show(value?: string | null): string {
  return value && value.trim().length > 0 ? value.trim() : "—";
}

export function HistoryViewer({ patientId, record, history, onSwitchToEditor }: HistoryViewerProps) {
  const budgetTotal = history.budgetItems.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  const paidTotal = history.performedPayments.reduce((sum, item) => sum + item.onAccountCents, 0);
  const balanceTotal = Math.max(0, budgetTotal - paidTotal);

  return (
    <div className={styles.viewerShell}>
      {/* Barra superior de acciones y alerta clínica */}
      <div className={`${styles.viewerToolbar} ${styles.noPrint}`}>
        <div>
          <strong>Modo 2 · Visualización de Historia Clínica</strong>
          <span className={styles.meta}>
            {record.historyMeta
              ? `Última actualización: ${formatDate(record.historyMeta.updatedAt)} · ${record.historyMeta.updatedByName ?? "Equipo clínico"}`
              : "Vista generada con los datos base del paciente (aún sin guardar cambios en el formato completo)."}
          </span>
        </div>
        <div className={styles.actionsRow}>
          <button type="button" className={styles.buttonSecondary} onClick={onSwitchToEditor}>
            Editar en Modo Llenado
          </button>
          <button type="button" className={styles.button} onClick={() => window.print()}>
            Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      {/* Alerta crítica de alergia o medicación */}
      {history.background.drugAllergy === "SI" ? (
        <div className={styles.allergyAlert} role="status">
          <strong>⚠ Alergia a medicamentos reportada:</strong>{" "}
          {history.background.drugAllergyDetail || "Sí (revisar detalle con el paciente antes de prescribir)."}
        </div>
      ) : null}

      {/* Documento estructurado fiel al formato de la clínica */}
      <article className={styles.printSheet}>
        <header className={styles.sheetHeader}>
          <div>
            <p className={styles.sheetClinic}>GÓMEZ DELGADO CLÍNICA DENTAL</p>
            <h2>HISTORIA CLÍNICA ODONTOLÓGICA</h2>
          </div>
          <div className={styles.sheetMeta}>
            <span><strong>N° Historia Clínica:</strong> {show(history.recordNumber)}</span>
            <span><strong>Fecha de Atención:</strong> {history.attentionDate ? formatDate(history.attentionDate) : "—"}</span>
          </div>
        </header>

        {/* I. ANAMNESIS */}
        <section className={styles.sheetSection}>
          <h3>I. ANAMNESIS</h3>
          <h4>A) Filiación</h4>
          <dl className={styles.dataGrid}>
            <div className={styles.colSpan2}><dt>Nombres y apellidos</dt><dd>{show(history.filiation.fullName)}</dd></div>
            <div><dt>Sexo</dt><dd>{show(history.filiation.sex)}</dd></div>
            <div><dt>Edad</dt><dd>{show(history.filiation.age)}</dd></div>
            <div><dt>DNI</dt><dd>{show(history.filiation.dni)}</dd></div>
            <div><dt>Fecha de nacimiento</dt><dd>{history.filiation.birthDate || "—"}</dd></div>
            <div><dt>Lugar de procedencia</dt><dd>{show(history.filiation.originPlace)}</dd></div>
            <div><dt>Domicilio actual</dt><dd>{show(history.filiation.currentAddress)}</dd></div>
            <div><dt>Ocupación</dt><dd>{show(history.filiation.occupation)}</dd></div>
            <div><dt>Teléfono</dt><dd>{show(history.filiation.phone)}</dd></div>
          </dl>

          {history.filiation.isMinor ? (
            <div className={styles.subReadBox}>
              <strong>Para pacientes menores de edad (Apoderado):</strong>{" "}
              {show(history.filiation.guardianName)} · DNI: {show(history.filiation.guardianDni)} · Tel:{" "}
              {show(history.filiation.guardianPhone)}
            </div>
          ) : null}

          <div className={styles.textBlock}>
            <strong>Motivo de consulta</strong>
            <p>{show(history.filiation.chiefComplaint)}</p>
          </div>

          <h4>B) Enfermedad Actual</h4>
          <dl className={styles.dataGrid}>
            <div><dt>Tiempo de la enfermedad</dt><dd>{show(history.currentIllness.duration)}</dd></div>
            <div className={styles.colSpan2}><dt>Signos y síntomas principales</dt><dd>{show(history.currentIllness.signsAndSymptoms)}</dd></div>
          </dl>
          <div className={styles.textBlock}>
            <strong>Relato de la enfermedad</strong>
            <p>{show(history.currentIllness.story)}</p>
          </div>

          <h4>C) Antecedentes</h4>
          <div className={styles.textBlock}>
            <strong>Antecedentes personales</strong>
            <p>{show(history.background.personalHistory)}</p>
          </div>
          <dl className={styles.dataGrid}>
            <div>
              <dt>¿Alérgico a algún medicamento?</dt>
              <dd>
                {history.background.drugAllergy === "SI"
                  ? `Sí — ${history.background.drugAllergyDetail || "Sin detalle"}`
                  : history.background.drugAllergy === "NO"
                    ? "No"
                    : "—"}
              </dd>
            </div>
            <div>
              <dt>¿Ha tomado algún medicamento?</dt>
              <dd>
                {history.background.takingMedication === "SI"
                  ? `Sí — ${history.background.takingMedicationDetail || "Sin detalle"}`
                  : history.background.takingMedication === "NO"
                    ? "No"
                    : "—"}
              </dd>
            </div>
          </dl>
          <div className={styles.textBlock}>
            <strong>Antecedentes familiares</strong>
            <p>{show(history.background.familyHistory)}</p>
          </div>
        </section>

        {/* II. EXAMEN CLÍNICO */}
        <section className={styles.sheetSection}>
          <h3>II. EXAMEN CLÍNICO</h3>
          <h4>A) Examen Clínico General</h4>
          <div className={styles.textBlock}>
            <p>{show(history.generalExam.findings)}</p>
          </div>
          <div className={styles.vitalsSummary}>
            <div><span>P.A.</span><strong>{show(history.generalExam.bloodPressure)}</strong></div>
            <div><span>Pulso</span><strong>{show(history.generalExam.pulse)}</strong></div>
            <div><span>Temp</span><strong>{show(history.generalExam.temperature)}</strong></div>
            <div><span>F.C.</span><strong>{show(history.generalExam.heartRate)}</strong></div>
            <div><span>Frec. Resp.</span><strong>{show(history.generalExam.respiratoryRate)}</strong></div>
          </div>

          <h4>B) Examen Clínico Odontoestomatológico</h4>
          <div className={styles.textBlock}>
            <p>{show(history.stomatologicExam)}</p>
          </div>
        </section>

        {/* III - VII DIAGNÓSTICOS, PLAN, EVOLUCIÓN Y ALTA */}
        <section className={styles.sheetSection}>
          <h3>III – VII. DIAGNÓSTICO, PLAN DE TRATAMIENTO Y ALTA</h3>
          <div className={styles.twoColumns}>
            <div className={styles.textBlock}>
              <strong>III. Diagnóstico Presuntivo</strong>
              <p>{show(history.presumptiveDiagnosis)}</p>
            </div>
            <div className={styles.textBlock}>
              <strong>Resultado de exámenes auxiliares</strong>
              <p>{show(history.auxiliaryExamsResult)}</p>
            </div>
          </div>
          <div className={styles.textBlock}>
            <strong>IV. Diagnóstico Definitivo</strong>
            <p>{show(history.definitiveDiagnosis)}</p>
          </div>
          <div className={styles.textBlock}>
            <strong>V. Plan de Tratamiento</strong>
            <p>{show(history.treatmentPlanNotes)}</p>
          </div>
          <div className={styles.textBlock}>
            <strong>VI. Control y Evolución</strong>
            <p>{show(history.controlAndEvolution)}</p>
          </div>
          <div className={styles.textBlock}>
            <strong>VII. Alta del Paciente</strong>
            <p>{show(history.dischargeSummary)}</p>
          </div>
          <dl className={styles.dataGrid}>
            <div><dt>Fecha del alta</dt><dd>{history.dischargeDate || "—"}</dd></div>
            <div className={styles.colSpan2}><dt>Sello y firma</dt><dd>{show(history.clinicianStamp)}</dd></div>
          </dl>
        </section>

        {/* CONSENTIMIENTO INFORMADO */}
        <section className={styles.sheetSection}>
          <div className={styles.sectionHead}>
            <h3>CONSENTIMIENTO INFORMADO</h3>
            <span className={history.informedConsent.accepted ? styles.badgeAccepted : styles.badgePending}>
              {history.informedConsent.accepted ? "CONFORMIDAD REGISTRADA" : "PENDIENTE DE FIRMA"}
            </span>
          </div>
          <div className={styles.consentDocument}>
            <p>
              Yo <strong>{history.informedConsent.patientName || "______________________"}</strong> con DNI:{" "}
              <strong>{history.informedConsent.patientDni || "__________"}</strong> paciente del consultorio dental{" "}
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
              {history.informedConsent.city || "Ayacucho"} {history.informedConsent.day || "__"} de{" "}
              {history.informedConsent.month || "________"} del {history.informedConsent.year || "____"}
            </p>
          </div>
        </section>

        {/* ODONTOGRAMAS INICIAL Y FINAL */}
        <section className={styles.sheetSection}>
          <h3>ODONTOGRAMA INICIAL Y FINAL</h3>
          <div className={styles.stack}>
            <OdontogramChart title="ODONTOGRAMA INICIAL" snapshot={history.odontogramInitial} editable={false} />
            <OdontogramChart title="ODONTOGRAMA FINAL" snapshot={history.odontogramFinal} editable={false} />
          </div>
        </section>

        {/* PRESUPUESTO Y PAGOS REALIZADOS */}
        <section className={styles.sheetSection}>
          <h3>PRESUPUESTO Y PAGOS REALIZADOS</h3>
          <div className={styles.vitalsSummary}>
            <div><span>Total Presupuesto</span><strong className={styles.money}>{formatMoney(budgetTotal)}</strong></div>
            <div><span>Total A Cuenta</span><strong className={styles.money}>{formatMoney(paidTotal)}</strong></div>
            <div><span>Saldo Pendiente</span><strong className={styles.money}>{formatMoney(balanceTotal)}</strong></div>
          </div>

          <h4>Presupuesto</h4>
          {history.budgetItems.length === 0 ? (
            <p className={styles.empty}>Sin tratamientos presupuestados.</p>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.clinicalTable}>
                <thead>
                  <tr>
                    <th>N°</th>
                    <th>Cantidad</th>
                    <th>Tratamiento</th>
                    <th>Costo unitario</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {history.budgetItems.map((row, idx) => (
                    <tr key={row.id}>
                      <td>{idx + 1}</td>
                      <td>{row.quantity}</td>
                      <td>{row.treatment || "—"}</td>
                      <td className={styles.money}>{formatMoney(row.unitPriceCents)}</td>
                      <td className={styles.money}>{formatMoney(row.quantity * row.unitPriceCents)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={4} style={{ textAlign: "right" }}>TOTAL</th>
                    <th className={styles.money}>{formatMoney(budgetTotal)}</th>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <h4>Pagos y Tratamientos Realizados</h4>
          {history.performedPayments.length === 0 ? (
            <p className={styles.empty}>Sin tratamientos o abonos registrados.</p>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.clinicalTable}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tratamiento efectuado</th>
                    <th>A cuenta</th>
                    <th>Firma del paciente</th>
                  </tr>
                </thead>
                <tbody>
                  {history.performedPayments.map((row) => (
                    <tr key={row.id}>
                      <td>{row.date || "—"}</td>
                      <td>{row.treatmentDone || "—"}</td>
                      <td className={styles.money}>{formatMoney(row.onAccountCents)}</td>
                      <td>{row.patientSigned ? "Conforme / Firmado" : "Pendiente"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* BITÁCORA DE CITAS, NOTAS Y ADJUNTOS */}
        <section className={`${styles.sheetSection} ${styles.noPrint}`}>
          <h3>BITÁCORA DE CITAS, NOTAS Y ADJUNTOS</h3>
          <div className={styles.twoColumns}>
            <div>
              <h4>Notas de evolución por cita ({record.notes.length})</h4>
              {record.notes.length === 0 ? (
                <p className={styles.empty}>Sin notas registradas por cita.</p>
              ) : (
                <ul className={styles.list}>
                  {record.notes.map((note) => (
                    <li key={note.id} className={styles.item}>
                      <strong>{note.reason}</strong>
                      <span className={styles.meta}>
                        {formatDate(note.createdAt)} · {note.authorName ?? "Profesional"}
                      </span>
                      {note.findings ? <p><strong>Hallazgos:</strong> {note.findings}</p> : null}
                      {note.procedure ? <p><strong>Procedimiento:</strong> {note.procedure}</p> : null}
                      {note.instructions ? <p><strong>Indicaciones:</strong> {note.instructions}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4>Adjuntos ({record.attachments.length}) y Citas ({record.appointments.length})</h4>
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
              ) : <p className={styles.empty}>Sin archivos adjuntos.</p>}

              {record.appointments.length > 0 ? (
                <ul className={styles.list} style={{ marginTop: "0.75rem" }}>
                  {record.appointments.slice(0, 5).map((appt) => (
                    <li key={appt.id} className={styles.item}>
                      <span>{appointmentLabel(appt)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </section>
      </article>
    </div>
  );
}
