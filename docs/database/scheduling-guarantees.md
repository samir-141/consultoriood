# Garantías de la agenda del MVP

**Estado.** Propuesta técnica para revisión del consultorio, 2026-11-23.

Aplica a la web, recepción y futuras integraciones que consulten o escriban en la agenda. Desarrolla las garantías técnicas de FR-003 y FR-004 y recoge las decisiones de negocio de BR-AG-01 a BR-AG-11 que aún deben validarse. [ADR-001](../decisions/ADR-001-stack-and-architecture.md) · [Reglas de negocio](../requirements/business-rules.md) · [ER preliminar](er-diagram.md)

## Intervalos y disponibilidad

- Guardar `starts_at`, `ends_at`, el cierre ocupado `occupied_until` y el vencimiento como instantes con zona horaria. Evaluar horarios, feriados y ventanas de reserva en `America/Lima`. Conservar el intervalo de atención y el margen aplicado a cada cita para que un cambio del catálogo solo afecte reservas nuevas.
- Comprobar que `starts_at < ends_at <= occupied_until`. El intervalo ocupado es `[starts_at, occupied_until)`. Una cita puede comenzar exactamente al cerrar la ocupación anterior si su intervalo cabe en el horario disponible.
- Mantener una restricción de exclusión GiST en PostgreSQL por profesional e intervalo ocupado. Aplicarla a `PENDING`, `CONFIRMED`, `CHECKED_IN` e `IN_PROGRESS`. El fin exclusivo y la validación de límites deben comprobarse en la base. [Rangos y exclusión en PostgreSQL 15](https://www.postgresql.org/docs/15/rangetypes.html#RANGETYPES-CONSTRAINT)
- Para ofrecer un turno, comprobar el servicio habilitado, el horario vigente, el intervalo completo con su margen, los bloqueos de sede y profesional y las citas que aún ocupan agenda. Para «cualquier profesional», reevaluar los candidatos habilitados al escribir y elegir uno que siga libre. La lista de turnos es una lectura puntual y cada escritura vuelve a validar el turno.
- El ER preliminar usa `ends_at` en el ejemplo de exclusión. Antes de migrar, precisar `occupied_until`, el estado `EXPIRED`, el vínculo entre citas reprogramadas y el alcance de `availability_rules` y `time_off`. Cada regla o cierre debe indicar la sede y, si su alcance es individual, el profesional de esa sede.

## Hold y reloj de referencia

| Operación | Comportamiento propuesto |
| --- | --- |
| Crear hold | Registrar la cita `PENDING`, su vencimiento a los diez minutos y el evento de creación en la misma transacción. |
| Confirmar | Permitir `PENDING → CONFIRMED` si el instante de decisión es anterior al vencimiento y se cumplen las reglas vigentes. Registrar la confirmación en la misma transacción. El evento de negocio que autoriza confirmar queda para ADE-008. |
| Expirar | Proponer `PENDING → EXPIRED` cuando el instante de decisión alcance o supere el vencimiento. La transición retira la cita del conjunto sujeto a exclusión y conserva su historial. Repetir la operación sobre un hold ya resuelto no genera otro evento. |
| Cancelar | Mantener el flujo de cancelación y su motivo. Registrar la expiración como evento propio para que los holds abandonados puedan distinguirse de las cancelaciones del paciente. |

Las escrituras capturan una vez `clock_timestamp()` en una sentencia posterior al bloqueo de sede. La propuesta evalúa el vencimiento en ese instante de decisión, incluido el límite exacto, y mantiene el bloqueo hasta el commit. Así una transacción que empezó antes y esperó hasta el vencimiento devuelve expiración. La lectura de disponibilidad reúne todas sus condiciones en una sola sentencia con una instantánea de datos y un instante fijo, `statement_timestamp()`. La escritura transiciona los holds vencidos que interfieren con el turno para reconciliar el estado con la restricción GiST. El proceso programado limpia pendientes por lotes y reduce el rezago. [Funciones de fecha y hora en PostgreSQL 15](https://www.postgresql.org/docs/15/functions-datetime.html#FUNCTIONS-DATETIME-CURRENT)

## Orden de las escrituras

1. Abrir una transacción breve en `READ COMMITTED` y tomar primero un bloqueo de fila de la sede con `SELECT … FOR UPDATE`. Usar esa misma fila para serializar reservas, confirmaciones, vencimientos, reprogramaciones, cancelaciones y cambios de calendario que puedan invalidar turnos. Este alcance cubre la sede única y requiere medir la espera del bloqueo si aumenta el volumen.
2. Capturar la hora de decisión, leer el estado vigente y comprobar reintentos. Crear, confirmar, cancelar y reprogramar deben usar una clave única por sede, operación y ámbito del actor o de la sesión. La misma clave y los mismos parámetros normalizados recuperan el resultado original. La misma clave con parámetros distintos devuelve conflicto. Guardar la clave, la huella de parámetros y el resultado durable en la misma transacción. La repetición de una creación conserva el identificador aun si el hold ya venció. La disponibilidad y el estado vigente de la cita se consultan por separado. El trabajo de expiración es idempotente por la transición condicional desde `PENDING`.
3. Resolver vencimientos relevantes y validar las condiciones del turno. Al crear o mover una cita, comprobar `time_off` de la sede y del profesional con el mismo rango ocupado. Al crear un bloqueo, aplicar el mismo protocolo para detectar una cita activa que intersecte. La propuesta devuelve el conflicto a recepción para resolución explícita.
4. Aplicar la transición y escribir el evento correspondiente de forma atómica. La reprogramación conserva la cita previa, la vincula con el reemplazo y registra el motivo. Cuando el nuevo intervalo se solape con el original del mismo profesional, liberar el anterior dentro de la transacción antes de insertar el nuevo. Si el destino falla, el rollback mantiene vigente el turno original. Para una excepción de recepción, persistir el motivo y auditar la acción. La exclusión GiST se aplica también a esa operación.
5. Confirmar la transacción antes de enviar mensajes o esperar pagos. Una violación de la restricción de exclusión devuelve un conflicto de agenda identificable por SQLSTATE `23P01`. Si el intento de confirmación descubre y persiste un vencimiento, devolver el resultado de expiración después del commit.

Todas las rutas de escritura, incluidos los trabajos programados, deben seguir el protocolo de sede. El bloqueo ordena las condiciones que abarcan distintas tablas y la restricción GiST hace cumplir la prohibición de solapar citas activas. Una alternativa futura es registrar citas y cierres en una sola estructura de ocupación con exclusión común. Eso simplificaría la garantía entre tablas a cambio de gestionar el ciclo de vida de ambas fuentes y el alcance de los cierres de sede en una misma estructura. [Bloqueos de fila](https://www.postgresql.org/docs/15/explicit-locking.html#LOCKING-ROWS) · [Aislamiento](https://www.postgresql.org/docs/15/transaction-iso.html#XACT-READ-COMMITTED) · [Códigos SQLSTATE](https://www.postgresql.org/docs/15/errcodes-appendix.html)

## Decisiones abiertas del consultorio

- Confirmar la ventana de reserva, el margen inicial y qué reglas puede exceptuar recepción. Acordar cuándo una cancelación es tardía, cómo afecta a una reprogramación y qué estados pueden reprogramarse. Si se permite cambiar un hold de horario, debe definirse cómo se conserva su vencimiento para evitar renovaciones implícitas.
- Acordar cómo tratar la limpieza si una cita se marca `COMPLETED` antes del cierre ocupado, dado que el ADR excluye estados terminales. Definir también el manejo de un bloqueo de sede que alcance citas activas.
- Acordar con ADE-008 el evento que confirma la cita, el efecto del no-show y la ventana aplicable si se exige depósito, considerando que la validación manual del pago puede tardar días.

## Pruebas de aceptación previstas

Las pruebas de concurrencia usarán conexiones PostgreSQL independientes, tiempos controlados y datos sintéticos. Las transacciones se sincronizarán explícitamente y se verificará el estado final de agenda y del historial.

| Caso | Resultado esperado |
| --- | --- |
| Dos reservas simultáneas del mismo turno y profesional | Solo una crea el hold. Una prueba de la restricción, por separado, comprueba que dos intervalos activos superpuestos son incompatibles incluso si se omite la validación de aplicación. |
| Citas contiguas | Un turno al final exacto de la ocupación es válido. Adelantarlo hasta el intervalo ocupado por el margen devuelve conflicto. |
| Vencido con proceso programado detenido | La agenda ofrece el turno. La primera escritura válida transiciona el hold anterior y puede reservarlo sin esperar al proceso programado. |
| Confirmación en el límite o retenida por un bloqueo | Se acepta antes del vencimiento si cumple las demás reglas. A partir del vencimiento se obtiene el resultado de expiración. El reloj se evalúa después del bloqueo. |
| Reintento y expiración duplicada | Cada operación repetida devuelve el resultado original y sus eventos se registran una vez. Reutilizar la clave con otros parámetros devuelve conflicto. El mismo hold se expira una sola vez si compiten dos trabajos. |
| Reserva simultánea con cierre de sede o de profesional | Si el cierre gana, la reserva falla. Si la reserva gana, la propuesta devuelve el conflicto de cierre a recepción y preserva la cita. |
| Reprogramación y destino en disputa | Dos operaciones compiten por el destino. Si la reprogramación pierde, se conserva la cita original y su ocupación. Si gana, quedan el nuevo turno y el vínculo histórico. Probar además un destino que intersecte únicamente la reserva original del mismo profesional. |
| «Cualquier profesional» y fecha local | Se elige un candidato habilitado con intervalo libre. Un cierre local alrededor de medianoche aplica a los instantes UTC correspondientes. |
| Reglas de negocio por confirmar | Agregar casos para los límites de la ventana, cancelación tardía, no-show con depósito y excepciones de recepción en cuanto el consultorio acuerde sus parámetros. |
