# Auditoría defensiva del backend

Revisión del 24 de noviembre de 2026 sobre la versión local 1.0.1, con base Git `b212eaa`. Cubre los apartados 10–12, 15–19 y 24–28 del encargo maestro. Las comprobaciones usaron registros sintéticos en PGlite en memoria.

## Hallazgos corregidos

| Hallazgo | Corrección y comprobación |
| --- | --- |
| Una retención podía seguir vigente aun después de iniciar el turno. | La vigencia ya termina al primero de dos momentos, diez minutos desde la retención o el inicio del turno. Disponibilidad, lectura y escritura usan el mismo criterio. Se comprobó el rechazo de la confirmación y el registro de la expiración. [Agenda](../../lib/scheduling.ts) |
| La gestión pública podía modificar una cita iniciada y su enlace no tenía término para citas confirmadas. | La cancelación y reprogramación públicas concluyen al iniciar el turno. El enlace deja de dar acceso 24 horas después del fin de la cita. Dentro de su vigencia, repetir una confirmación o cancelación ya aplicada devuelve el estado existente. La bandeja local deja de ofrecer el enlace vencido. [Agenda](../../lib/scheduling.ts) · [Bandeja de mensajes](../../app/api/panel/mensajes/route.ts) |
| Un reintento de reserva con profesional indistinto podía crear una segunda retención. | `Idempotency-Key` admite un UUID v4 opcional. Dos solicitudes simultáneas con la misma referencia y datos equivalentes recuperan la cita, el enlace y el vencimiento iniciales. Una referencia usada con datos diferentes devuelve 409. El UUID es opaco y se vincula a la reserva mediante la clave local existente. Los clientes anteriores pueden omitirlo y conservan el comportamiento previo. [Ingreso de la reserva](../../app/api/reservas/route.ts) · [Agenda](../../lib/scheduling.ts) |
| El analizador JSON dependía del tamaño declarado. La lectura de archivos clínicos ocupaba la transacción mientras llegaban los datos. | Se limita el flujo real de bytes y se valida el tipo del cuerpo antes de interpretarlo. El límite JSON general es de 256 KiB. Las rutas de archivos declaran topes propios para admitir PDF, PNG o JPG de hasta 10 MiB. La lectura, el análisis y la huella del comprobante ocurren antes de la transacción clínica o financiera. Se comprobó que una carga pausada permite consultar disponibilidad. [HTTP](../../lib/http.ts) · [Archivos](../../lib/clinical-files.ts) · [Clínica](../../lib/clinical.ts) · [Pagos](../../lib/payments.ts) |
| Los accesos clínicos anónimos dejaban escrituras de auditoría y el ingreso no tenía un límite local. | La API responde 401 sin abrir la ficha ni registrar un evento clínico anónimo. Los rechazos de cuentas autenticadas siguen auditados. El proceso admite hasta 24 intentos de ingreso y 60 solicitudes de retención por minuto, con 429 y `Retry-After` al llegar al límite. La verificación de contraseña usa scrypt asíncrono y realiza la misma derivación cuando la cuenta no existe. [Clínica](../../lib/clinical.ts) · [Sesiones](../../lib/auth.ts) · [Límites](../../lib/request-limit.ts) |
| Se podía marcar inasistencia antes del turno. Los errores genéricos no llevaban la misma política de caché. | La inasistencia solo se registra a partir de la hora programada. Las respuestas de la capa API llevan `private, no-store`, incluidos errores y conflictos. En escrituras se verifica el origen, y se rechazan solicitudes de otro sitio identificadas por el navegador. [Agenda](../../lib/scheduling.ts) · [HTTP](../../lib/http.ts) |

## Disponibilidad y alcance de permisos

`GET /api/disponibilidad/proxima?serviceId=evaluacion` consulta el primer turno del servicio en las próximas siete fechas calendario de Lima, incluida la fecha local actual. Su respuesta es `{ slot: null }` o un objeto `slot` con `date`, `time`, `professionalId` y `professionalName`. Usa la misma consulta de ocupaciones, duración, margen, bloqueos y profesionales elegibles que la disponibilidad por fecha. La escritura revalida el turno bajo bloqueo transaccional y conserva la restricción de exclusión de PostgreSQL por profesional. [Ruta próxima](../../app/api/disponibilidad/proxima/route.ts) · [Agenda](../../lib/scheduling.ts) · [Esquema](../../lib/schema.ts)

| Rol | Acceso verificado en la API local |
| --- | --- |
| Público | Catálogo y disponibilidad con datos operativos. El enlace opaco habilita la cita correspondiente y excluye el identificador interno del paciente, contacto y expediente. La respuesta incluye el nombre necesario para identificar la cita. |
| Recepción | Agenda, información administrativa del paciente, pagos y bandeja simulada. La ficha y sus adjuntos devuelven 403. |
| Odontología | Agenda propia y expedientes de pacientes asignados. Cambios de estado dentro de su agenda y operaciones clínicas autorizadas. |
| Administración | Operaciones de dirección de la demo, revisión de auditoría y devoluciones. Las notas previas y los eventos permanecen en el historial. |

La sesión usa cookie `HttpOnly` y `SameSite=Strict`, agrega `Secure` sobre HTTPS y guarda el resumen del identificador en el servidor. La salida elimina la sesión. Los archivos requieren autorización del servidor en cada descarga y se entregan con `Content-Disposition: attachment`. [Sesiones](../../lib/auth.ts) · [Clínica](../../lib/clinical.ts) · [Archivos](../../lib/clinical-files.ts) · [Pagos](../../lib/payments.ts)

## Casos de regresión

- El primer turno próximo coincide con la primera opción de la consulta diaria de la misma fecha. Un servicio inválido devuelve 400.
- Dos escrituras con la misma referencia retornan el mismo identificador, enlace y vigencia. Cambiar un dato con esa referencia devuelve 409.
- La huella del contenido original sigue disponible aunque recepción corrija el contacto. Se guarda con HMAC en la columna aditiva y anulable `hold_request_hash`. Los enlaces y citas de la base previa conservan sus identificadores.
- Una retención cuyo turno inició figura como expirada y no puede confirmarse. La gestión rechaza cancelar o reprogramar una cita iniciada y devuelve 410 para un enlace vencido.
- Un intento clínico anónimo devuelve 401 sin insertar auditoría. Recepción obtiene 403 y queda registrado el intento autenticado.
- Se comprueba la asignación antes de leer el cuerpo clínico y se vuelve a verificar con bloqueo al escribir. Un cuerpo inválido de un odontólogo sin asignación recibe 403 y se registra como acceso denegado.
- Un cuerpo superior al límite sin tamaño declarado devuelve 413. Una escritura ajena al origen verificado devuelve 403. El límite local devuelve 429 con `Retry-After`.
- En el servidor HTTP local, el 413 cierra la conexión para impedir la reutilización de un flujo de entrada que se rechazó sin consumirlo completo. La siguiente acción válida conserva su respuesta normal.
- Una carga clínica pausada no bloquea la consulta pública de disponibilidad. Al terminar la carga, el adjunto válido se registra normalmente.

## Límites para operar con datos reales

- La aplicación sigue siendo una demo local con credenciales de ejemplo y una instancia de PGlite. Los límites son por proceso y se reinician con él. El paso a una instalación compartida requiere identidad individual, revocación y MFA administrativo, TLS, límites por origen confiable y monitoreo acordado.
- La consulta administra un establecimiento y capacidad por profesional. Sillones, equipos compartidos, descansos, vacaciones, feriados y agenda multisede quedan fuera del modelo actual.
- El almacenamiento local y la autenticación demo requieren un diseño de producción independiente. Quedan por definir permisos de base de datos, copias y restauración, retención, revisión de archivos, gestión de incidentes y canales para ejercer derechos sobre datos personales. La validación legal requiere revisión especializada.
- El enlace de gestión es una credencial temporal. El servidor debe excluirlo de logs de acceso, analítica y reportes externos. La agenda no envía mensajes a terceros. La bandeja representa confirmaciones y recordatorios simulados y respeta la preferencia de contacto.
- El registro de pacientes, el historial y los documentos de prueba deben permanecer sintéticos. La auditoría no incluye resultados de carga, fallos externos, pruebas clínicas en producción ni una declaración de cumplimiento normativo.
