# Hoja de ruta del rediseño

Fecha de diagnóstico 2026-11-24. El punto de partida es `b212eaa`, con portada, reservas, agenda, pacientes, ficha, pagos y bandeja de mensajes operativos en PGlite para datos de prueba.

| Prioridad | Trabajo | Condición de aceptación |
| --- | --- | --- |
| P0 | Integridad de turnos y manejo de reintentos | Dos solicitudes de un mismo turno se resuelven con una sola reserva. Un reintento idéntico conserva la referencia y un turno vencido se libera. Las acciones de enlace se limitan según la hora de cita. |
| P0 | Reducir exposición de datos en flujos operativos | Probar alcances por rol, respuestas privadas, límites de entrada y lectura de adjuntos. La demo solo usa datos ficticios. |
| P1 | Portada, servicios y experiencia móvil | La reserva es visible al entrar, los servicios dan duración y precio referencial, y la portada consulta datos actuales de la agenda. El contenido se lee por teclado y en pantallas estrechas. |
| P1 | Metadatos, rendimiento y verificación | Documentar medidas locales comparables. Verificar estados, accesibilidad básica y navegación. La demo bloquea indexación. |
| P0 para datos reales | Aprobar reglas de clínica y diseñar operación | Validar roles, retención, restauración, autenticación, auditoría, bloqueo de recursos, configuración de sede y ventana de gestión. Preparar PostgreSQL compartido y respaldo probado antes de recibir datos reales. |
| P1 posterior | Datos públicos y configuración de operación | Confirmar dirección, contacto, credenciales, catálogo, precios, reglas de agenda, medios de pago y contenidos clínicos. Definir quién mantiene cada dato antes de habilitar edición y SEO público. |
| P2 posterior | Comunicaciones y medición de conversiones | Definir consentimiento, proveedor y operación de recordatorios. Registrar eventos agregados sin nombres, teléfonos, enlaces ni motivos clínicos. Medir demanda y abandono antes de ensayar variantes. |

Registro canónico de decisiones en [DECISIONS.md](DECISIONS.md). La evidencia de ejecución queda en [QA_REPORT.md](QA_REPORT.md). El proyecto sigue enfocado en una sede y un conjunto pequeño de servicios hasta confirmar la operación real.
