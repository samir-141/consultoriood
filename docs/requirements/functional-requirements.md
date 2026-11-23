# Requisitos funcionales

**Estado:** borrador para validación
**Fecha:** 2026-11-23

Prioridades: **P0** indispensable para operar, **P1** importante para el MVP ampliado, **P2** evolución posterior.

## P0 — Núcleo del MVP

| ID | Requisito | Criterio de aceptación |
|---|---|---|
| FR-001 | Landing pública responsive con servicios, equipo, ubicación, horarios y CTA de reserva | Carga en móvil y escritorio; datos de contacto visibles; botón de reserva en todas las secciones |
| FR-002 | Catálogo de servicios con duración y precio referencial | Cada servicio tiene nombre, duración, precio referencial y profesionales habilitados |
| FR-003 | Reserva online en flujo único | El paciente elige servicio, profesional o "cualquiera", fecha y hora, y confirma en menos de 2 minutos |
| FR-004 | Bloqueo antidual y hold temporal | Dos solicitudes simultáneas del mismo slot: solo una se confirma; el hold expira a los 10 minutos |
| FR-005 | Confirmación por WhatsApp con enlace de gestión | El paciente recibe confirmación y un enlace tokenizado para ver o gestionar su cita |
| FR-006 | Recordatorio 24 h con acciones | El mensaje permite confirmar, reprogramar o cancelar; la respuesta actualiza el estado de la cita |
| FR-007 | Agenda de recepción | Vista día/semana; crear, mover, cancelar y bloquear citas; ver disponibilidad real |
| FR-008 | Ficha de paciente | Datos de contacto, fecha de nacimiento, antecedentes generales, consentimientos y citas |
| FR-009 | Panel del odontólogo | Ve su agenda del día, sus pacientes y casos pendientes; no ve la agenda de otros salvo permiso |
| FR-010 | Encuentro clínico y nota | Registro por cita con motivo, hallazgos, procedimiento, indicaciones y próxima cita |
| FR-011 | Odontograma básico | Registro por pieza y superficie (FDI) con estado y observación; historial de cambios |
| FR-012 | Plan de tratamiento | Ítems con pieza, procedimiento, precio, estado y avance; el plan pertenece al paciente |
| FR-013 | Adjuntos clínicos privados | Radiografías y documentos en almacenamiento privado, acceso por URL firmada de corta duración |
| FR-014 | Registro de pagos manuales | Registrar monto, método, referencia y comprobante; recepción confirma o rechaza; saldo calculado |
| FR-015 | Roles y permisos en servidor | Cada endpoint valida rol y recurso; recepción no accede a notas clínicas |
| FR-016 | Auditoría clínica | Se registra actor, fecha, acción, recurso y resultado en cada lectura/escritura clínica |

## P1 — Ampliación del MVP

| ID | Requisito | Criterio de aceptación |
|---|---|---|
| FR-101 | Bot de WhatsApp para FAQ y autoservicio | Responde horarios, ubicación, preparación y precios referenciales; agenda y reprograma; deriva a humano |
| FR-102 | Recall y campañas con opt-in | Recordatorio de control cada 6 meses; el paciente puede aceptar o rechazar futuros mensajes |
| FR-103 | Lista de espera | Si se libera un slot, se ofrece al primer paciente compatible de la lista |
| FR-104 | Presupuesto enviado y aceptado online | El paciente recibe el plan, lo acepta o rechaza, y queda registrado con fecha y versión |
| FR-105 | Sincronización con Google Calendar | El odontólogo ve sus citas en su calendario; los cambios se reflejan en un máximo de 5 minutos |
| FR-106 | Reportes operativos | Ocupación, no-show, citas por servicio, ingresos registrados y conversión de reservas |
| FR-107 | Portal del paciente | Ver próximas citas, indicaciones, presupuestos y pagos con enlace seguro sin contraseña |
| FR-108 | Exportación de historia clínica | Generar un PDF/expediente del paciente autorizado, con registro de auditoría |

## P2 — Evolución

| ID | Requisito | Criterio de aceptación |
|---|---|---|
| FR-201 | Multi-sede | Agenda, precios y reportes separados por sede |
| FR-202 | Facturación electrónica SUNAT | Emisión de boleta/factura mediante OSE autorizado |
| FR-203 | Seguros y coberturas | Registrar póliza, cobertura y copago por atención |
| FR-204 | Firma digital de consentimientos | Firma con evidencia de identidad y sello de tiempo |
| FR-205 | Integración con laboratorios e imagenología | Órdenes y resultados adjuntos al expediente |

## Trazabilidad

Cada requisito debe tener al menos una prueba asociada antes de considerarse terminado. Las pruebas de concurrencia de agenda y de permisos clínicos son obligatorias para el MVP.
