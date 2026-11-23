# Reglas de negocio

**Estado:** propuesta para validación
**Fecha:** 2026-11-23

Las reglas marcadas como **(propuesta)** requieren confirmación del consultorio.

## 1. Agenda y reservas

- **BR-AG-01 — Zona horaria.** Se almacena en UTC y se presenta en `America/Lima`. Toda regla de horario se evalúa en hora local.
- **BR-AG-02 — Duración.** La duración de la cita depende del servicio. Se suma un margen de limpieza configurable (propuesta: 10 minutos) que también ocupa agenda.
- **BR-AG-03 — Sin solapamiento.** Un profesional no puede tener dos citas activas superpuestas. Se garantiza con una restricción de exclusión en PostgreSQL, no solo con lógica de aplicación.
- **BR-AG-04 — Hold temporal.** Al iniciar la reserva se crea una cita en estado `PENDING` con vencimiento a 10 minutos. Un proceso programado libera los holds vencidos.
- **BR-AG-05 — Ventana de reserva.** Se puede reservar desde 2 horas hasta 90 días hacia adelante. **(propuesta)**
- **BR-AG-06 — Cancelación.** Cancelación sin penalidad hasta 24 horas antes. Después se marca como cancelación tardía. **(propuesta)**
- **BR-AG-07 — No-show.** Dos inasistencias sin aviso obligan a dejar un depósito para la siguiente reserva. **(propuesta)**
- **BR-AG-08 — Reprogramación.** Mover una cita conserva históricamente la original y registra el motivo; no se elimina.
- **BR-AG-09 — Excepciones.** Recepción puede crear o mover citas fuera de las reglas con un motivo obligatorio; la acción queda auditada.
- **BR-AG-10 — "Cualquier profesional".** La asignación automática solo considera profesionales habilitados para el servicio y con el slot libre.
- **BR-AG-11 — Bloqueos.** Feriados, vacaciones y bloqueos puntuales impiden ofrecer slots en ese rango.

## 2. Pagos

- **BR-PAY-01 — Comprobante no es pago.** Un archivo subido por el paciente no confirma el ingreso. Solo un usuario autorizado marca el pago como confirmado.
- **BR-PAY-02 — Precisión.** Los montos se guardan como `numeric(12,2)` en PEN. Nunca en punto flotante.
- **BR-PAY-03 — Pagos parciales.** Se permiten abonos; el saldo se calcula a partir de los pagos confirmados.
- **BR-PAY-04 — Asociación.** Un pago pertenece a un paciente y puede referenciar una cita o un plan de tratamiento.
- **BR-PAY-05 — Reembolsos.** Requieren rol administrador, motivo y registro de auditoría.
- **BR-PAY-06 — Datos sensibles.** No se almacenan números de tarjeta ni credenciales bancarias. Solo referencia de operación y comprobante.
- **BR-PAY-07 — Comprobante interno.** El MVP emite un comprobante interno numerado. La boleta/factura electrónica ante SUNAT queda para P2 y se valida con contador.

## 3. Historia clínica

- **BR-CL-01 — Append-only.** Las notas clínicas no se editan destructivamente. Una corrección crea una enmienda con autor, fecha y motivo.
- **BR-CL-02 — Acceso por rol.** Recepción no lee notas clínicas. El odontólogo accede a sus pacientes y a los que tenga asignados; administración accede según permiso explícito.
- **BR-CL-03 — Consentimiento.** Todo procedimiento invasivo requiere consentimiento registrado antes de la atención.
- **BR-CL-04 — Adjuntos privados.** Radiografías y documentos van a un bucket privado; el acceso usa URLs firmadas de corta duración.
- **BR-CL-05 — Auditoría.** Cada lectura y escritura del expediente clínico genera un registro con actor, fecha, recurso y resultado.
- **BR-CL-06 — Retención.** No se elimina la historia clínica. Se conserva por el plazo mínimo que exija la norma vigente (propuesta operativa: no menos de 5 años desde la última atención), a validar legalmente.
- **BR-CL-07 — Copia al paciente.** El paciente puede solicitar una copia de su expediente; la entrega se registra y se verifica identidad.

## 4. WhatsApp y bot

- **BR-WA-01 — Opt-in.** Todo mensaje proactivo requiere consentimiento registrado con fecha y origen. El paciente puede revocarlo.
- **BR-WA-02 — Plantillas.** Fuera de la ventana de 24 horas solo se envían plantillas aprobadas por Meta. Dentro de la ventana se permite respuesta libre.
- **BR-WA-03 — Sin diagnóstico.** El bot no diagnostica, no receta ni interpreta estudios. Ante dolor agudo, sangrado o trauma, deriva a llamada o atención inmediata.
- **BR-WA-04 — Idempotencia.** El webhook valida firma y evita procesar dos veces el mismo mensaje.
- **BR-WA-05 — Handoff humano.** El bot deriva a recepción cuando el paciente lo pide, cuando no entiende o cuando la consulta es clínica.
- **BR-WA-06 — Propiedad del canal.** El número y la cuenta de Meta pertenecen al consultorio. Las credenciales viven en un gestor de secretos, nunca en el repositorio.

## 5. Seguridad y datos

- **BR-SEC-01 — Autorización en servidor.** Ningún permiso se aplica solo en la interfaz.
- **BR-SEC-02 — Mínimo dato.** No se solicita información personal que no se use para la atención o la facturación.
- **BR-SEC-03 — Secretos.** Variables de entorno por ambiente; `.env.example` sin valores reales.
- **BR-SEC-04 — Respaldos.** Respaldo diario de base de datos y prueba de restauración documentada antes de producción.
- **BR-SEC-05 — Auditoría administrativa.** Cambios de precios, servicios, usuarios y permisos quedan registrados.
