# Arquitectura de la demostración

La aplicación usa Next.js App Router y TypeScript. Las páginas públicas y los servicios del catálogo se generan como HTML. La reserva recibe un servicio opcional validado en el servidor y consulta la disponibilidad al elegir fecha. La portada hace una consulta al pulsar «Consultar próximo turno». El panel obtiene su sesión por la API y muestra únicamente las secciones del rol.

## Contratos de reserva

| Ruta | Entrada | Resultado |
| --- | --- | --- |
| `GET /api/catalogo` | Sin parámetros | Clínica, servicios y profesionales de la demostración. |
| `GET /api/disponibilidad` | `date`, `serviceId`, `professionalId` opcional | Horas disponibles para esa fecha. La agenda se calcula en Lima y admite hasta 90 días. |
| `GET /api/disponibilidad/proxima` | `serviceId` | Primer turno en siete fechas de Lima, incluida la fecha actual. Devuelve `slot: null` cuando se agota ese rango. |
| `POST /api/reservas` | Servicio, fecha, hora, profesional o `any`, datos de prueba e `Idempotency-Key` opcional | Retención, enlace personal y vencimiento. Los reintentos con la misma referencia y contenido recuperan el estado vigente. |
| `GET /api/reservas/[token]` | Enlace personal | Estado y resumen de la cita sin expediente, teléfono ni identificador interno del paciente. |
| `POST /api/reservas/[token]` | `confirm`, `cancel` o `reschedule` | Estado actualizado si el turno y el enlace admiten la acción. |

La reserva usa una transacción y una exclusión temporal de PostgreSQL por profesional. Citas, bloqueos, jornada, duración, margen y vencimientos se aplican tanto al cálculo como a la escritura. La hora de inicio cierra los cambios de autoservicio y el enlace vence 24 horas después del fin para esta demostración. Un reintento compara la huella del contenido inicial; recepción puede editar el contacto de forma independiente. [Garantías de agenda](../database/scheduling-guarantees.md) · [Auditoría defensiva](../security/SECURITY_AUDIT.md)

## Persistencia y operación

PGlite guarda datos y una clave de enlaces en el directorio local configurado. Cada instancia necesita su propio directorio. Las rutas de clínica, archivos y pagos autorizan en el servidor y envían respuestas privadas. Las notificaciones se representan con una bandeja para simulación. Las fuentes de PGlite y el despliegue previsto se describen en el [ADR de arquitectura](../decisions/ADR-001-stack-and-architecture.md). La [hoja de ruta](../../project-management/IMPLEMENTATION_PLAN.md) recoge las condiciones para operar con datos reales.
