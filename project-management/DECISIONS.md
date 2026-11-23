# Registro de decisiones

## ADE-D001 · Usar el ADR aprobado como referencia del stack

- **Fecha y responsable.** 2026-11-23. GPT registró la decisión previa del propietario y el responsable técnico.
- **Motivación.** El ADR declara la aprobación y la tabla de aprobaciones de progreso la corrobora. Algunos estados narrativos de progreso conservaban la etapa previa.
- **Alternativas.** Mantener la aprobación pendiente o reconciliar el estado con la evidencia explícita.
- **Resultado.** Se alineó progreso con el ADR y se marcó el ER como preliminar. Q-02 y Q-08 quedaron parciales porque la titularidad y alta de Meta Business y la responsabilidad de mantenimiento siguen pendientes. El número dedicado y la modalidad de desarrollo constan como aprobados.
- **Evidencia.** [ADR-001](../docs/decisions/ADR-001-stack-and-architecture.md) y [progreso](../docs/progress.md).

## ADE-D002 · Revisar documentos con un trabajador de Orca

- **Fecha y responsables.** 2026-11-23. GPT coordinó. OpenCode con DeepSeek V4.1 Flash recibió ADE-002.
- **Motivación.** La revisión documental es acotada y permite comprobar un modelo ligero con evidencias de origen. Orca y OpenCode fueron verificados en la máquina local.
- **Alternativas.** Revisión exclusiva de GPT, otro modelo del catálogo gratuito o un agente separado con acceso verificado.
- **Resultado.** Se completó una revisión de solo lectura con `opencode/deepseek-v4.1-flash-free`. Cuenta como una única ejecución de revisión independiente del coordinador. El espacio actual sirvió para leer los documentos porque todavía carece de Git y el trabajador recibió una tarea sin escritura.
- **Evidencia.** `orca agent installed`, `opencode models`, ayuda de `orca orchestration worker-start` y recibo del despacho `ctx_d7a6f3e61028`.

## ADE-D003 · Registrar selección y desempeño de modelos

- **Fecha y responsable.** 2026-11-23. GPT.
- **Motivación.** La elección depende de qué agente está disponible, del riesgo de la tarea y de sus criterios de aceptación.
- **Alternativas.** Usar un modelo fijo o seleccionar por tarea según el inventario verificado.
- **Resultado.** Para tareas simples se empieza con un modelo ligero. Para tareas intermedias se valora el costo total de implementación y corrección. Para tareas críticas se escala cuando la complejidad o las pruebas lo justifican. La falta de acceso de un proveedor se trata como una condición del entorno. Cada evaluación registra los datos que exponga el proveedor y su evidencia de calidad.
- **Evidencia.** [Registro de trabajo y uso](AGENT_HANDOFF.md).

## ADE-D004 · Resolver las transiciones de agenda y pagos antes del esquema definitivo

- **Fecha y responsables.** 2026-11-23. OpenCode con DeepSeek propuso los hallazgos. GPT contrastó las fuentes y priorizó las salidas de diseño.
- **Motivación y evidencia.** La revisión acordó registrar los siguientes hallazgos.
  1. El `EXCLUDE` de ejemplo incluye `PENDING`. El modelo y BR-AG-04 describen vencimiento y liberación programada, pero no detallan la transición del hold ni qué sucede entre el vencimiento y la liberación. [Modelo de datos](../docs/database/er-diagram.md), [reglas de negocio](../docs/requirements/business-rules.md).
  2. Los documentos fijan un hold de diez minutos y contemplan que la verificación manual tome días. Queda por definir si la cita se confirma independientemente del pago y qué ocurre si hay un depósito requerido. [FR-004 y FR-014](../docs/requirements/functional-requirements.md), [supuestos operativos](../docs/requirements/assumptions-and-open-questions.md).
  3. Se verificó la aprobación del ADR frente a estados desactualizados. El ajuste documental se registró en ADE-D001. [ADR-001](../docs/decisions/ADR-001-stack-and-architecture.md), [progreso](../docs/progress.md).
  4. El SQL ilustrativo compara rangos de citas. Queda por demostrar cómo incorpora los márgenes de limpieza, los bloqueos de `time_off` y la validación de límites temporales. El diccionario ya especifica `starts_at < ends_at`. [Modelo de datos](../docs/database/er-diagram.md), [BR-AG-02 y BR-AG-11](../docs/requirements/business-rules.md).
  5. BR-PAY-04 permite asociar un pago a una cita o plan. El ER resumido solo muestra la relación a paciente y el comprobante. Queda por precisar asociaciones, saldos y si se debe conservar el precio histórico. [Modelo de datos](../docs/database/er-diagram.md), [BR-PAY-03 y BR-PAY-04](../docs/requirements/business-rules.md).
- **Alternativas.** Evaluar un estado de expiración o una entidad separada para holds. Comparar la confirmación independiente de la cita con una ventana de pago explícita si el consultorio requiere depósito.
- **Resultado.** ADE-006 y ADE-008 registran los criterios de diseño y casos de regresión. Las reglas críticas y las relaciones se mantienen como decisiones pendientes de validación. La evidencia es documental.
