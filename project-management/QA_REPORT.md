# Verificación de ADE-012

El 24 de noviembre de 2026 se comparó la demostración 1.0.1 de `b212eaa` con la compilación candidata. La línea base era funcional y conservaba el catálogo, el panel y la persistencia de prueba. Los hallazgos principales fueron la falta de acceso contextual desde el catálogo, la lista de horas sin agrupar y los límites de retención y autoservicio. [Línea base](../docs/performance/BASELINE_REPORT.md) · [Auditoría UX](../docs/design/UX_AUDIT.md)

## Verificado

| Frente | Prueba y resultado |
| --- | --- |
| Calidad | `npm.cmd run typecheck`, `npm.cmd run lint` y `npm.cmd run build` pasaron en Windows con Node.js 26.12.1. |
| Rutas y recursos | `npm.cmd run verify` pasó sus ocho grupos de pruebas en PGlite temporal. Revisó portada, WebP, SVG de Gomita, páginas de servicios, ruta desconocida, privacidad y directivas de indexación. |
| Reserva | La suite verificó que la consulta de la portada coincide con la agenda, que solo se confirma una transacción para un turno y que dos reintentos equivalentes comparten referencia. Cambiar el contacto desde recepción no invalida un reintento con los datos originales. |
| Plazos y privacidad | La suite verificó vencimiento de la retención y enlace, rechazo de una inasistencia futura, permisos por rol, comprobantes y adjuntos privados, límites de cuerpo, cancelación, reprogramación y persistencia después del reinicio. |
| Interfaz pública | Playwright en Chrome comprobó la portada a 320, 390, 768, 1024 y 1440 px, la imagen adaptativa, el enlace de salto, el acordeón con Enter, la consulta de turno y el servicio precargado. |
| Recorrido completo | El navegador reservó, confirmó, generó calendario sin nombre ni enlace, reprogramó y canceló con el backend local. El panel se comprobó con Administración, Recepción y Odontología a 390 px, incluyendo accesos restringidos. Los guiones detectaron cero excepciones JavaScript. |
| Casos límite de interfaz | Con respuestas controladas, se verificó que no se anuncia un horario retirado entre la búsqueda y la actualización, que el rango del calendario llega a 90 días y que el flujo conserva los datos tras un fallo de conexión. La ilustración permanece estática con movimiento reducido. |

## Rendimiento y decisiones de diseño

La comparación usa Lighthouse 13.6 y los mismos perfiles móvil y escritorio que la línea base. El presupuesto de la imagen principal se validó sobre un WebP de 107.518 bytes. La guía de pruebas y los resultados por ruta están en el [informe de rendimiento](../docs/performance/OPTIMIZATION_REPORT.md). [Core Web Vitals](https://web.dev/articles/vitals)

Se conservaron la marca y la mascota en la reserva. La portada ahora muestra una imagen original, servicios con duración y precio referencial, preguntas frecuentes y acceso a privacidad. La política de no indexación protege esta demostración de resultados de búsqueda. [Decisiones](DECISIONS.md) · [SEO](../docs/performance/SEO_REPORT.md)

## Revisión de agentes

Tres agentes de Codex trabajaron sobre investigación, reserva y seguridad. Un cuarto Codex con `gpt-6.2-sol`, seleccionado por Orca para una revisión acotada, detectó el fallo de reintento y cuatro observaciones. El coordinador mantuvo la huella de la reserva en una columna aditiva, anticipó la verificación de asignación clínica, corrigió el aviso obsoleto de horarios, ocultó la inasistencia hasta el inicio y enlazó la privacidad junto al formulario. [Registro de agentes](AGENT_HANDOFF.md) · [Código de aplicación](../app/) · [Backend](../lib/) · [Regresiones](../scripts/verify-local.mjs)

## Pendiente para datos reales

El resultado se comprobó con datos sintéticos. Quedan pendientes las pruebas con pacientes y lectores de pantalla, las métricas de campo de Core Web Vitals, la aprobación de reglas y contenido del consultorio, los datos de contacto y las integraciones de identidad, base de datos y WhatsApp. El entorno local y las cuentas demo sirven para evaluación. [Hoja de ruta](IMPLEMENTATION_PLAN.md) · [Privacidad](../docs/security/DATA_PRIVACY.md)
