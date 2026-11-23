# Confirmación de cita y pagos manuales

**Estado.** Propuesta de ADE-008 para validación del consultorio, 2026-11-23.

## Reserva y comprobantes

Con la política propuesta para la reserva ordinaria, el paciente confirma su cita al finalizar el formulario antes de que venza el hold. La agenda valida nuevamente el turno y registra la transición a `CONFIRMED` bajo el bloqueo de sede. Recepción puede comprobar un abono posteriormente. El comprobante conserva su propio estado de revisión.

| Evento | Resultado propuesto |
| --- | --- |
| El paciente termina la reserva antes del vencimiento | Confirmar la cita si el turno y los datos siguen siendo válidos. Registrar la confirmación en la transacción y preparar el aviso después del commit |
| La solicitud llega al instante de decisión con el hold vencido | Expirar el hold. El paciente vuelve a consultar disponibilidad y elige un turno |
| Se adjunta un comprobante | Registrar su envío. El abono entra en revisión y su importe todavía queda fuera del saldo aplicado |
| El responsable autorizado confirma o rechaza el abono | Una transición por intento verificable. Solo la confirmación aplica el importe. La cita conserva su estado |
| La cita requiere un depósito por una política especial | Diseñar un flujo específico una vez que el consultorio defina importe, plazo, liberación del turno y tratamiento de comprobantes que se revisen tarde |

La expiración sigue el mismo reloj de decisión de ADE-006. Adjuntar un comprobante no prorroga el hold. Recepción necesita saber qué hacer si el pago llega o se valida después de la cancelación, el vencimiento o la reprogramación. La propuesta conserva la relación original y deriva la reasignación o devolución a una operación autorizada y auditable.

## Asociación y saldo

- Cada pago registra paciente, monto en PEN, método, referencia cuando exista, estado y quién lo verificó. Puede vincularse a una cita, a un plan o quedar sin asignar mientras se concilia. La cita o plan referenciado debe pertenecer al mismo paciente y clínica. La propuesta usa como máximo un destino por pago en el MVP. El consultorio debe confirmar si necesita repartir una operación entre varios cargos.
- El comprobante se conserva como evidencia del pago en almacenamiento privado con acceso operativo autorizado. El estado de un pago sigue `PENDING → UNDER_REVIEW → CONFIRMED` o `REJECTED`. Para corregir una confirmación o registrar una devolución se conserva el movimiento original y se registra la operación compensatoria. BR-PAY-05 exige administrador y motivo para un reembolso.
- Propuesta de precio histórico. Cuando exista un monto acordado para una cita, conservarlo al acordarlo. Para un plan, conservar el precio de los ítems de la versión aceptada. El precio referencial del catálogo solo alimenta nuevas cotizaciones. Sin importe acordado, el saldo queda por determinar.
- El saldo pendiente se obtiene del importe acordado menos la suma de abonos confirmados netos de devoluciones aplicadas al mismo destino. Usar `numeric(12,2)` y montos positivos. El saldo de un plan cuenta los pagos asignados a ese plan, con independencia de las citas asociadas al tratamiento. Antes de aceptar excedentes, el consultorio debe acordar si se rechazan, se mantienen como crédito o se reasignan.
- La verificación comprueba el estado y aplica el importe de forma atómica. El reintento de la misma operación devuelve el resultado registrado y conserva un solo asiento, incluso ante verificaciones concurrentes. Para dos registros distintos que podrían referir a la misma transferencia, la conciliación usa la referencia junto con el método y el contexto.

## Decisiones para aprobar

1. Confirmar que el paciente puede cerrar una reserva ordinaria antes del vencimiento y que el pago se verifica después. Indicar qué casos exigen depósito y qué pasa si el comprobante llega dentro de plazo y la revisión tarda.
2. Designar a los responsables y el horario de revisión (Q-06). Definir el tratamiento de depósitos y abonos en cancelaciones tardías, inasistencias y cambios de cita.
3. Confirmar la fuente del importe acordado, el momento en que se fija y si se admiten pagos repartidos o créditos. Definir cuándo procede reasignar un abono o devolverlo.

## Casos de aceptación previstos

| Caso con datos sintéticos | Resultado esperado |
| --- | --- |
| Reserva ordinaria con pago pendiente | Cita confirmada si el hold sigue vigente y el turno pasa la validación. El pago pendiente aporta S/ 0,00 al saldo aplicado |
| Confirmación al límite y revisión posterior de comprobante | Hold vencido al alcanzar el límite. Una revisión posterior registra el pago según su flujo y no reabre la cita |
| Comprobante rechazado | Conservar el rechazo y su motivo. No abonar el importe al destino |
| Dos confirmaciones simultáneas del mismo abono de S/ 40,00 a una cita de S/ 120,00 | Una sola aplicación. Saldo de S/ 80,00 |
| Abono de otro paciente o registro con cita y plan a la vez | Rechazar la asociación. Los saldos de ambos destinos quedan intactos |
| Cambio posterior del precio referencial de S/ 120,00 a S/ 150,00 | Una cita con S/ 120,00 acordados conserva su importe y el saldo histórico |
| Cancelación, reprogramación o devolución después de un abono | Conservar los vínculos históricos. Aplicar una devolución autorizada una sola vez y recalcular el saldo del destino correspondiente |

[Garantías de agenda](scheduling-guarantees.md) · [ER preliminar](er-diagram.md) · [FR-014](../requirements/functional-requirements.md) · [BR-PAY-01 a BR-PAY-07](../requirements/business-rules.md)
