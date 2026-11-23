# Estado actual

**Corte del 2026-11-23.** La base local de la aplicación está integrada. El diseño de agenda, acceso clínico y pagos sigue en validación.

## Línea base

- La documentación inicial abarca visión, requisitos, reglas, preguntas, progreso, ADR y modelo de datos. Los diseños de ADE-006 a ADE-008 amplían esa base.
- La arquitectura aprobada en [ADR-001](../docs/decisions/ADR-001-stack-and-architecture.md) es un monolito modular con Next.js, TypeScript estricto, PostgreSQL en Supabase y despliegue previsto en Vercel. Prisma, Tailwind y shadcn/ui forman parte de la decisión documentada.
- El MVP prevé una sede en Perú, varios odontólogos, cobros manuales en PEN y un número de WhatsApp dedicado. El diseño de datos sigue siendo preliminar.
- El repositorio local tiene línea base en `5a3edf4` y worktrees de Orca para ADE-005 y ADE-006. La integración local contiene agenda (`6f75a0c`) y la base Next.js (`6ea2862`).
- La base ejecutable incluye Next.js App Router, TypeScript estricto, Tailwind, una página de arranque en español y scripts reproducibles. Se verificó en Windows con Node.js `v26.12.1` y npm `11.20.0`. [README](../README.md) · [Informe de ADE-005](../reports/ade-005-verification.md)

## Agentes y modelos

| Rol | Evidencia e implicación |
| --- | --- |
| GPT | Codex retomó la coordinación del run `run_0f6c0f42c699` en Orca, integró ADE-005 y preparó las propuestas para ADE-007 y ADE-008. |
| Gemini CLI | Ausente del inventario de agentes locales de Orca y del PATH de Windows. Acceso sin verificar. |
| DeepSeek independiente | Ausente del inventario local como agente separado. OpenCode lista `opencode/deepseek-v4.1-flash-free`. |
| OpenCode | Orca lo lista como agente por defecto y el CLI responde. `auth list` devolvió `No authenticated integrations`. ADE-002 completó una revisión con el modelo gratuito listado. |
| Antigravity Chat | La revisión adicional de ADE-006 falló con un error de Orca. El despacho `ctx_9f98a80fa733` está detenido y liberado. |

## Verificaciones

| Verificación | Resultado |
| --- | --- |
| Lectura de los siete documentos, inventario de carpetas y detección del stack | Ejecutada. |
| Guías de Orca, inventario de agentes, modelo disponible y diagnóstico de credenciales sin valores | Ejecutada. |
| Revisión cruzada del diseño y confirmación del resultado del trabajador | Ejecutada. ADE-002 figura como `completed` en Orca. |
| Enlaces relativos, dependencias y estado de los registros de gestión | Verificados localmente. |
| Git y Orca | Línea base, worktrees, ramas y resultados de los trabajadores contrastados. |
| Base integrada | `npm.cmd ci --no-audit --no-fund`, tipos, lint, build y prueba HTTP de producción. npm advierte que ESLint 9.39.5 está fuera de soporte. |
| Pruebas del MVP | Concurrencia PostgreSQL, permisos, aislamiento, restauración y E2E pendientes de sus implementaciones. |

## Riesgos y decisiones abiertas

- El diseño de agenda especifica el reloj, la expiración, el intervalo ocupado y el bloqueo de sede. Quedan por aprobar el margen de limpieza, las excepciones, la política de cancelación y no-show y las transiciones de reprogramación. [ADE-006](../docs/database/scheduling-guarantees.md)
- El diseño de pagos propone confirmar la reserva ordinaria al finalizar el formulario y verificar el abono en un flujo posterior. Faltan aprobación del flujo, política de depósitos y tratamiento de abonos. [ADE-008](../docs/database/appointment-payments-proposal.md)
- La matriz de acceso clínico cubre el alcance por paciente, adjuntos y auditoría. Faltan aprobación de permisos, responsables, retención y operación con copias y menores. [ADE-007](../docs/requirements/clinical-access-proposal.md)
- Faltan catálogo de servicios, horarios, reglas definitivas de reserva y no-show, datos de marca y titularidad de Meta Business. Las preguntas siguen en [el registro del consultorio](../docs/requirements/assumptions-and-open-questions.md).
- El trabajo con expedientes, políticas de acceso, relaciones críticas, servicios con costos y producción se rige por los límites de autorización del usuario.

El [registro de decisiones](DECISIONS.md) conserva las referencias y límites de los hallazgos revisados.
