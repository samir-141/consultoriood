# Estado actual

**Corte del 2026-11-23.** El proyecto está en descubrimiento y diseño. El código de la aplicación todavía está pendiente.

## Línea base

- La carpeta contiene siete documentos previos en `docs/`. Se revisaron visión, requisitos, reglas, preguntas, progreso, ADR y modelo de datos.
- La arquitectura aprobada en [ADR-001](../docs/decisions/ADR-001-stack-and-architecture.md) es un monolito modular con Next.js, TypeScript estricto, PostgreSQL en Supabase y despliegue previsto en Vercel. Prisma, Tailwind y shadcn/ui forman parte de la decisión documentada.
- El MVP prevé una sede en Perú, varios odontólogos, cobros manuales en PEN y un número de WhatsApp dedicado. El diseño de datos sigue siendo preliminar.
- Al corte inicial faltaban `AGENTS.md`, `.agents/skills/`, `project-management/`, `.git`, manifiestos, lockfiles y scripts del proyecto. Orca registra esta ubicación como carpeta local. `git status` devolvió `not a git repository`.
- El entorno local reportó Node.js `v26.12.1`, npm `11.20.0`, Git `2.55.0.windows.5`, Orca `1.4.272` y OpenCode `2.2.7`. Las versiones del entorno aún deben contrastarse con el stack al crear la aplicación.

## Agentes y modelos

| Rol | Evidencia e implicación |
| --- | --- |
| GPT | Codex activo como coordinador. Ejecutó el diagnóstico local. |
| Gemini CLI | Ausente del inventario de agentes locales de Orca y del PATH de Windows. Acceso sin verificar. |
| DeepSeek independiente | Ausente del inventario local como agente separado. OpenCode lista `opencode/deepseek-v4.1-flash-free`. |
| OpenCode | Orca lo lista como agente por defecto y el CLI responde. `auth list` devolvió `No authenticated integrations`. ADE-002 completó una revisión con el modelo gratuito listado. |
| Otros agentes | Orca lista OpenCode 2, Claude, Codex y Antigravity. El inventario no acredita autenticación, independencia entre modelos ni equivalencia con Gemini CLI. |

## Verificaciones

| Verificación | Resultado |
| --- | --- |
| Lectura de los siete documentos, inventario de carpetas y detección del stack | Ejecutada. |
| Guías de Orca, inventario de agentes, modelo disponible y diagnóstico de credenciales sin valores | Ejecutada. |
| Revisión cruzada del diseño y confirmación del resultado del trabajador | Ejecutada. ADE-002 figura como `completed` en Orca. |
| Enlaces relativos, dependencias y estado de los registros de gestión | Verificados localmente. |
| `git status`, `git log` y `git worktree list` | Ejecutados. Los tres fallaron porque la carpeta carece de repositorio Git. |
| Tipos, lint, build, pruebas unitarias, integración, E2E, responsive y accesibilidad | Sin ejecutar. La carpeta carece de código, manifiesto y scripts de aplicación. |
| Seguridad | Revisión documental de requisitos y riesgos. Pruebas de permisos, aislamiento y restauración pendientes de implementación. |

## Riesgos y decisiones abiertas

- La exclusión propuesta incluye las citas `PENDING`. El diseño debe precisar la transición al vencer un hold y asegurar consistencia al consultar y escribir disponibilidad. También debe cubrir márgenes de limpieza y bloqueos de agenda.
- El flujo de confirmación de cita debe conciliar el hold de 10 minutos con la posible verificación manual de un pago varios días después. El ER preliminar deja por detallar las asociaciones de pagos a citas o planes y el cálculo de saldos.
- El modelo debe precisar la separación entre datos administrativos y clínicos, la auditoría de accesos y la retención. El ER contiene preguntas abiertas de acceso y relaciones.
- Faltan catálogo de servicios, horarios, reglas definitivas de reserva y no-show, datos de marca y titularidad de Meta Business. Las preguntas siguen en [el registro del consultorio](../docs/requirements/assumptions-and-open-questions.md).
- El trabajo con expedientes, políticas de acceso, relaciones críticas, servicios con costos y producción se rige por los límites de autorización del usuario.

El [registro de decisiones](DECISIONS.md) conserva las referencias y límites de los hallazgos revisados.
