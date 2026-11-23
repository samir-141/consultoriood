# Tareas del proyecto

Actualizado el 2026-11-23. Las dependencias se refieren a los identificadores de esta lista.

## ADE-001 · Auditar el proyecto y el entorno

- **Estado y prioridad.** Completada, P0.
- **Objetivo y contexto.** Establecer la línea base de un proyecto en descubrimiento y comprobar la capacidad local de Orca.
- **Responsable.** GPT.
- **Archivos y módulos.** `docs/`, configuración de la carpeta y herramientas locales.
- **Dependencias.** Ninguna.
- **Criterios de aceptación.** Inventario de archivos, Git, stack, scripts, skills y agentes con evidencia del entorno.
- **Riesgos.** Confundir una decisión escrita con una implementación o un CLI instalado con acceso operativo.
- **Verificación.** Lectura de siete documentos, `git status`, `orca worktree current`, `orca agent installed` e inventario de OpenCode.

## ADE-002 · Revisar el diseño de forma independiente

- **Estado y prioridad.** Completada, P0.
- **Objetivo y contexto.** Contrastar el ADR, progreso, requisitos, reglas y ER preliminar antes de construir el MVP.
- **Responsable.** OpenCode ejecuta la revisión con DeepSeek V4.1 Flash. GPT contrasta los hallazgos.
- **Archivos y módulos.** Lectura de `docs/`.
- **Dependencias.** ADE-001.
- **Criterios de aceptación.** Hallazgos priorizados, referenciados y contrastados con el texto de origen.
- **Riesgos.** Contar un modelo ejecutado dentro de OpenCode como un segundo revisor independiente.
- **Verificación.** Revisión cruzada de documentos y comprobación de las referencias del trabajador.

## ADE-003 · Registrar estado, decisiones y traspaso

- **Estado y prioridad.** Completada, P0.
- **Objetivo y contexto.** Dejar una referencia común para el inicio del desarrollo y reconciliar estados documentales verificables.
- **Responsable.** GPT.
- **Archivos y módulos.** `project-management/`, `docs/progress.md` y `docs/requirements/assumptions-and-open-questions.md`.
- **Dependencias.** ADE-001 y ADE-002.
- **Criterios de aceptación.** Cuatro registros de gestión coherentes con las fuentes, con estados sustentados y asuntos abiertos trazables.
- **Riesgos.** Cerrar prematuramente una pregunta parcialmente resuelta.
- **Verificación.** Lectura cruzada de estados, enlaces relativos y referencias a tareas.

## ADE-004 · Establecer la línea base Git y el aislamiento de cambios

- **Estado y prioridad.** Completada, P0.
- **Objetivo y contexto.** Establecer un commit base local y habilitar worktrees de implementación en Orca.
- **Responsable.** GPT.
- **Archivos y módulos.** Metadatos Git, configuración del proyecto en Orca y reglas de exclusión de archivos locales.
- **Dependencias.** ADE-003.
- **Criterios de aceptación.** Línea base revisada en Git, selección inequívoca del proyecto en Orca y capacidad de crear una rama aislada.
- **Riesgos.** Incluir secretos, datos privados o archivos ajenos al proyecto en el commit inicial.
- **Verificación.** Commit base `5a3edf4`, reglas en `.gitignore` y worktrees `ade-005-base-next` y `ade-006-diseno-agenda` comprobados en Git y Orca.

## ADE-005 · Construir la base local de la aplicación

- **Estado y prioridad.** Completada, P0.
- **Objetivo y contexto.** Establecer un punto de partida ejecutable con Next.js y TypeScript estricto según ADR-001.
- **Responsable.** OpenCode con DeepSeek V4.1 Flash Free implementó la base. GPT revisó e integró. Gemini CLI sigue sin detectarse en el entorno local.
- **Archivos y módulos.** `app/`, manifiesto, lockfile y configuración del proyecto.
- **Dependencias.** ADE-004.
- **Criterios de aceptación.** Instalación reproducible, página de arranque local y scripts de tipos, lint y build.
- **Riesgos.** Elegir versiones incompatibles o requerir servicios remotos para arrancar localmente.
- **Verificación.** Instalación desde lockfile, tipos, lint, compilación y arranque verificados. [Informe del trabajador](../reports/ade-005-verification.md) · [Estado y verificación de integración](CURRENT_STATE.md)

## ADE-006 · Diseñar las garantías de agenda

- **Estado y prioridad.** Diseño completado e integrado, P0. Reglas del consultorio y pruebas PostgreSQL pendientes.
- **Objetivo y contexto.** Precisar la exclusión de solapamientos, el vencimiento de holds y el manejo de tiempos para FR-003, FR-004 y BR-AG-01 a BR-AG-11.
- **Responsable.** GPT redactó e incorporó los hallazgos de OpenCode con DeepSeek V4.1 Flash Free. El intento de revisión adicional con Antigravity Chat quedó bloqueado.
- **Archivos y módulos.** `docs/database/` y diseño de `scheduling`.
- **Dependencias.** ADE-003. ADE-004 precede los cambios versionados. La ejecución de reglas críticas propuestas depende de validación del consultorio.
- **Criterios de aceptación.** Diseño que cubra simultaneidad, expiración, reprogramación, trabajos reintentados y reglas que deban confirmarse.
- **Riesgos.** Doble reserva, vencimiento visto de forma diferente por la disponibilidad y la escritura, y pérdida de historial.
- **Verificación.** Casos de aceptación documentados para concurrencia, tiempos, reintentos y reprogramación. [Diseño integrado en `6f75a0c`](../docs/database/scheduling-guarantees.md)

## ADE-007 · Validar acceso clínico, auditoría y retención

- **Estado y prioridad.** Propuesta lista para validación con el consultorio, P0.
- **Objetivo y contexto.** Precisar qué puede ver cada rol y en qué circunstancias, además de acordar retención, acceso a adjuntos y trazabilidad.
- **Responsable.** GPT prepara la propuesta. El consultorio valida las políticas.
- **Archivos y módulos.** `docs/requirements/`, `docs/database/`, diseño de `identity` y `clinical`.
- **Dependencias.** ADE-003 y autorización explícita antes de implementar cambios de permisos, autenticación o integridad de datos.
- **Criterios de aceptación.** Matriz de rol, recurso y acción con casos de acceso denegado, alcance aprobado y cuestiones de retención resueltas antes del esquema definitivo.
- **Riesgos.** Exponer datos clínicos o introducir reglas de retención sin validar.
- **Verificación.** Matriz, decisiones y casos de prueba por API, almacenamiento y auditoría documentados. [Propuesta de acceso clínico](../docs/requirements/clinical-access-proposal.md)

## ADE-008 · Precisar confirmación de cita y registro de pagos

- **Estado y prioridad.** Propuesta lista para validación con el consultorio, P0.
- **Objetivo y contexto.** Definir la relación entre reserva y pago manual, el registro de abonos y el cálculo de saldos por cita o plan según FR-014 y BR-PAY-01 a BR-PAY-04.
- **Responsable.** GPT preparó la propuesta. El consultorio valida las reglas críticas.
- **Archivos y módulos.** `docs/requirements/`, `docs/database/`, diseño de `scheduling` y `payments`.
- **Dependencias.** ADE-003. Coordinar las transiciones con ADE-006 y completar ADE-004 antes de cambios versionados.
- **Criterios de aceptación.** Eventos de confirmación y validación manual definidos, asociaciones y cálculo de saldos documentados. Si el precio histórico es un requisito, precisar dónde se conserva.
- **Riesgos.** Expirar reservas a la espera de revisión manual, acreditar comprobantes sin validar o recalcular saldos con precios vigentes.
- **Verificación.** Casos previstos de confirmación con pago pendiente, vencimiento, rechazo, abono parcial, duplicados y cambio de precio. [Propuesta de confirmación y pagos](../docs/database/appointment-payments-proposal.md)

## ADE-009 · Prototipar reserva, agenda y ficha clínica

- **Estado y prioridad.** Prototipo completado, P0. Revisión del consultorio pendiente.
- **Responsable.** GPT.
- **Objetivo.** Permitir que el consultorio evalúe los recorridos de paciente, recepción y odontólogo con datos sintéticos.
- **Archivos.** [Wireframes navegables](../docs/design/wireframes.html).
- **Dependencias.** ADE-006 y la propuesta de alcance clínico de ADE-007. Las políticas definitivas se validan en las tareas correspondientes.
- **Verificación.** Confirmación y vencimiento de reserva, reprogramación con motivo, cancelación, bloqueo, filtros de agenda y borrador de atención probados en el navegador de Orca. Revisión de las tres vistas a 390 px.
