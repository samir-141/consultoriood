# Acceso clínico, auditoría y retención

**Estado.** Propuesta de ADE-007 para validación del consultorio, 2026-11-23.

Los permisos se comprueban en el servidor para cada acción y cada paciente. La ficha administrativa reúne los datos de contacto, los datos de identificación indispensables y las citas. Los antecedentes, diagnósticos, notas, odontograma, consentimientos y adjuntos clínicos requieren acceso al expediente. La agenda puede mostrar que falta un consentimiento cuando recepción necesita coordinarlo, sin mostrar su contenido.

## Matriz propuesta

| Recurso y acción | Recepción | Odontólogo | Administración |
| --- | --- | --- | --- |
| Consultar datos administrativos y citas | Sí, para gestionar la atención de la sede | Sí, para pacientes bajo su atención o asignación | Mediante permiso administrativo explícito |
| Crear o corregir datos administrativos | Sí, con registro de cambios | Mediante permiso administrativo explícito | Mediante permiso administrativo explícito |
| Leer antecedentes, notas, diagnósticos y odontograma | Denegado | Sí, para pacientes bajo su atención o asignación vigente | Mediante permiso clínico explícito y acotado al recurso |
| Registrar hallazgos, firmar notas o enmendarlas | Denegado | Sí, dentro de su atención o asignación. La enmienda referencia la nota, con autor, fecha y motivo | Requiere además un rol clínico y su ámbito |
| Registrar o consultar consentimiento clínico | Puede consultar el indicador operativo si se aprueba | Sí, dentro de su atención o asignación | Mediante permiso clínico explícito y acotado al recurso |
| Cargar o leer adjuntos clínicos | Denegado | Sí, dentro de su atención o asignación | Lectura con permiso clínico explícito. Carga sujeta también al rol clínico |
| Consultar auditoría o entregar una copia al paciente | Puede canalizar la solicitud | Puede participar con permiso específico para la acción | Mediante permisos separados de auditoría y entrega |

La sede y la relación profesional–paciente se comprueban con datos del servidor. El consultorio debe elegir quién puede asignar o revocar esa relación, qué eventos la abren y cuánto dura. Un enlace de gestión de cita queda limitado a esa cita. La solicitud de copia del expediente exige verificar la identidad del paciente o de su representante y registrar la preparación y la entrega.

## Adjuntos y trazabilidad

- Guardar archivos clínicos en un bucket privado. Autorizar cada carga o apertura al resolver el recurso y su paciente desde el servidor. Para auditar cada descarga y aplicar revocación tras emitir un acceso, servir la descarga por un endpoint autorizado. Si se aprueba la entrega directa por URL firmada breve, registrar la emisión y acreditar la descarga efectiva con registros de almacenamiento antes de dar por cumplido FR-016.
- Registrar cada lectura y escritura clínica, incluida la consulta de adjuntos y exportaciones. Guardar actor, fecha, acción, identificador del recurso y resultado. Excluir texto de notas, documentos, credenciales y enlaces firmados del evento. Los intentos denegados llevan los detalles que el servidor haya podido comprobar.
- Conservar la auditoría como registro de solo inserción. La mutación clínica y su evento exitoso se guardan en una transacción. Si la auditoría de una lectura autorizada falla, devolver un error antes de entregar el contenido. El acceso a la auditoría requiere un permiso propio.

## Decisiones para aprobar

1. Confirmar el alcance de recepción, incluido el indicador de consentimiento y los datos administrativos necesarios para atender.
2. Designar quién asigna pacientes y autoriza accesos excepcionales, cómo se revocan y quién revisa la auditoría y autoriza copias. Confirmar la operación con menores y sus representantes.
3. Validar los plazos y sus fechas de inicio para expedientes, adjuntos, auditoría y copias de respaldo. Confirmar custodia y procedimiento de entrega antes de fijar reglas de retención en el esquema.

## Casos de aceptación previstos

| Caso con datos sintéticos | Resultado esperado |
| --- | --- |
| Recepción consulta la agenda e intenta abrir una nota o forjar una solicitud de adjunto | Agenda disponible. Solicitudes clínicas denegadas mediante API y almacenamiento, con registro del intento |
| Odontólogo consulta un paciente asignado, otro sin asignación y vuelve a intentar tras una revocación | Solo se entrega el expediente cuando existe una asignación vigente. Los tres intentos dejan trazabilidad |
| Administrador con permiso general solicita un expediente o la exportación de auditoría | Denegado salvo permiso específico para el recurso y la acción |
| Reutilización de un acceso a adjunto | Se respetan vencimiento y alcance. Con descarga mediada, la revocación impide un nuevo acceso |
| Enmienda a una nota firmada | La nota original se conserva. La enmienda queda vinculada con autor, fecha, motivo y evento |
| Falla de auditoría al leer o guardar | La respuesta de lectura carece de contenido clínico y la escritura se revierte |
| Entrega de copia del expediente | Identidad verificada, alcance aprobado y entrega registrada. El enlace de cita por sí solo no habilita la copia |

[FR-008 a FR-016](functional-requirements.md) · [BR-CL-01 a BR-CL-07 y BR-SEC-01](business-rules.md) · [Preguntas Q-07, Q-12 y Q-13](assumptions-and-open-questions.md)
