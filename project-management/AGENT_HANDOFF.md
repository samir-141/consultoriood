# Traspaso entre agentes

## Ciclo inicial del 2026-11-23

GPT es coordinador. El proyecto de Orca apunta a `D:\rim\consultorioDENTAL`. La aplicación está en fase de diseño. Los documentos de producto están en [docs](../docs/) y los criterios por tarea en [TASKS.md](TASKS.md).

| Tarea | Agente | Resultado | Evidencia |
| --- | --- | --- | --- |
| ADE-001 | GPT | Diagnóstico local completado. | [Estado y verificaciones](CURRENT_STATE.md). |
| ADE-002 | OpenCode con DeepSeek | Revisión documental de solo lectura completada. GPT contrastó cinco hallazgos. | Run `run_7eeaa0fb43b8`, tarea Orca `task_a0d9263f4084`, despacho `ctx_d7a6f3e61028`. |
| ADE-003 | GPT | Consolidación y verificación de la documentación completadas. | [Tareas](TASKS.md) y [decisiones](DECISIONS.md). |

## Registro de selección y uso

| Tarea | Nivel | Modelo | Tokens de entrada y salida | Caché | Costo | Latencia | Reintentos | Resultado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ADE-002 | 1, revisión acotada | `opencode/deepseek-v4.1-flash-free` | Sin telemetría | Sin telemetría | Catálogo gratuito. Facturación sin telemetría | Sin telemetría del proveedor | 0 | Orca reportó tarea completada. Evidencia documental comprobada. |

## Continuidad

GPT retomó la coordinación de Orca en el run `run_0f6c0f42c699`. La carpeta principal de Git está en `D:\rim\consultorioDENTAL`.

| Tarea | Responsable | Resultado | Evidencia |
| --- | --- | --- | --- |
| ADE-004 | GPT | Línea base Git y worktrees aislados verificados. | Commit `5a3edf4`, inventario de Git y Orca. |
| ADE-005 | OpenCode con DeepSeek V4.1 Flash Free y GPT | Base implementada, revisada e integrada. GPT repitió instalación, tipos, lint, build y prueba HTTP. | Tarea Orca `task_4631f97b8af4`, despachos `ctx_2e1d8c39aef6` y `ctx_801cb7e9567e`, integración `6ea2862`. [Informe original](../reports/ade-005-verification.md) |
| ADE-006 | GPT y OpenCode con DeepSeek V4.1 Flash Free | Diseño revisado e integrado. Quedan reglas por acordar y pruebas en PostgreSQL. | Tarea Orca `task_cc4de6d16c05`, despacho `ctx_12f2d4648e43`, integración `6f75a0c`. [Diseño](../docs/database/scheduling-guarantees.md) |
| ADE-006, revisión adicional | Antigravity Chat | Bloqueada por un error del host. Orca confirmó que el trabajador se detuvo y liberó sus recursos. | Tarea Orca `task_6836b32888ad`, despacho `ctx_9f98a80fa733`. |
| ADE-007 | GPT | Matriz de permisos, auditoría y decisiones de retención lista para validación. | [Propuesta](../docs/requirements/clinical-access-proposal.md) |
| ADE-008 | GPT | Flujos de confirmación, pagos, asociaciones y saldos listos para validación. | [Propuesta](../docs/database/appointment-payments-proposal.md) |
| ADE-010 | GPT y Antigravity | GPT simplificó los recorridos de reserva, agenda y ficha. Antigravity creó los SVG de reserva y confirmación en un worktree aislado. | Tarea Orca `task_ee74e07ffc82`, despacho `ctx_e2e0ed03ec82`, commit de ilustraciones `58311da`. [Prototipo](../docs/design/wireframes.html) |

Orca registra los resultados de los trabajadores de ADE-005 y ADE-006. Los mensajes recuperados carecen de cifras verificables de tokens, caché, costo y latencia del proveedor. Se usó OpenCode para ADE-005 con el modelo que ya había completado la revisión de ADE-002 y con Gemini CLI ausente del entorno local.

1. Acordar con el consultorio cancelaciones, no-show, depósitos y el evento que confirma una reserva ordinaria.
2. Validar permisos, auditoría y retención antes de implementar autenticación, relaciones clínicas o el esquema definitivo.
3. Mantener a GPT a cargo de los registros en la carpeta principal. Incorporar la evidencia de cada trabajador y contrastar sus cambios antes de integrar.

## Versión 1.0.1

GPT coordinó el run `run_eb6555b3c912`. Antigravity entregó la landing y sus ilustraciones en `6295d1a`. OpenCode 2 entregó las vistas de clínica y pagos en `7130936`. Claude carecía de sesión y el modelo gratuito de OpenCode alcanzó su límite. Tareas de Codex sustituyeron esas asignaciones y verificaron los contratos entre interfaz y servidor. [Recorridos y pruebas](../README.md)

## Ciclo ADE-012 del 2026-11-24

| Frente | Agente y selección | Entrega y revisión |
| --- | --- | --- |
| Investigación UX y CRO | Codex, agente de investigación con modelo heredado | Benchmark, fuentes de comportamiento y mediciones comparables solo cuando el acceso lo permitió. |
| Reserva y línea base | Codex, agente de reserva con modelo heredado | Captura de la línea base y flujos de fecha, horarios, idempotencia y calendario. Revisados con Playwright y la API integrada. |
| Backend y seguridad | Codex, agente backend con modelo heredado | Límites locales, caducidad, disponibilidad y revisión de permisos. Las regresiones se integraron en la suite de la coordinación. |
| Supervisión independiente | Codex `gpt-6.2-sol`, selección predeterminada de Orca para una revisión acotada de solo lectura | Run `run_eb6555b3c912`, tarea `task_9dadfa953e27`, despacho `ctx_6acc78cc1d1d`. Reportó un bloqueante de reintentos y cuatro observaciones. Se corrigieron y volvieron a comprobar al integrar. |

Se reutilizaron los agentes disponibles para trabajar por módulos independientes. La coordinación conservó la integración y las pruebas como una sola responsabilidad. ImageGen integrado generó la fotografía de la portada. La ejecución no expone telemetría comparable de costo y tokens de los agentes. [Evidencia de QA](QA_REPORT.md)
