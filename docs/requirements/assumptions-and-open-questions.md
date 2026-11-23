# Supuestos y preguntas abiertas

**Estado:** vivo — se actualiza con cada respuesta del consultorio
**Fecha:** 2026-11-23

## Preguntas abiertas

| ID | Pregunta | Default propuesto | Impacto | Estado |
|---|---|---|---|---|
| Q-01 | ¿Marca, logo y dominio existen? | Definir antes del diseño visual | Medio | Abierta |
| Q-02 | ¿El número de WhatsApp será nuevo y dedicado? ¿Quién es dueño de la cuenta de Meta Business? | Cuenta del consultorio | Alto | Parcial. Número nuevo dedicado aprobado en ADR-001. Titularidad y alta pendientes. |
| Q-03 | ¿Lista de servicios, duraciones y precios referenciales? | Cargar 6–10 servicios iniciales | Alto | Abierta |
| Q-04 | ¿Horarios por día, feriados y vacaciones? | L–S con bloque de almuerzo | Alto | Abierta |
| Q-05 | ¿Política de cancelación y no-show? | 24 h libre; 2 no-shows exigen depósito | Alto | Abierta |
| Q-06 | ¿Quién valida los pagos y en qué horario? | Recepción en horario de atención | Medio | Abierta |
| Q-07 | ¿Quién redacta y aprueba el consentimiento informado? | Odontólogo responsable + revisión legal | Alto | Abierta |
| Q-08 | ¿Quién desarrolla y mantiene el sistema? | Responsable de mantenimiento por definir | Alto | Parcial. El propietario desarrollará con asistencia del agente según ADR-001. |
| Q-09 | ¿Se requiere sincronización con Google Calendar? | P1, solo lectura/salida | Medio | Abierta |
| Q-10 | ¿Cuándo se necesita facturación electrónica SUNAT? | P2; validar con contador | Medio | Abierta |
| Q-11 | ¿Alcance del bot: solo FAQ o también agendar? | FAQ + agendar/reprogramar con handoff | Medio | Abierta |
| Q-12 | ¿Plazo de retención de historia clínica? | No eliminar; mínimo 5 años, validar normativa | Alto | Abierta |
| Q-13 | ¿Se atienden menores de edad? ¿Se requiere tutor? | Sí; registrar tutor y consentimiento | Medio | Abierta |
| Q-14 | ¿Se manejan convenios con empresas o seguros? | No en MVP | Bajo | Abierta |

## Supuestos operativos

1. La agenda se gestiona por odontólogo y silla; en el MVP una silla por odontólogo.
2. Recepción trabaja en el mismo local y tiene acceso a la agenda completa.
3. Los odontólogos usan el panel desde computadora o tablet; el paciente usa móvil.
4. El consultorio puede esperar unos días entre la reserva y la confirmación de pago manual.
5. Los comprobantes se suben como imagen o PDF de hasta 10 MB.
6. El bot responde en español, con tono cordial y sin prometer resultados clínicos.

## Decisiones que no se tomarán sin aprobación

- Cambiar de stack o de proveedor de base de datos.
- Habilitar cobro automático con tarjeta.
- Exponer historia clínica a un tercero.
- Usar un modelo de lenguaje para responder consultas clínicas.
- Eliminar o anonimizar registros clínicos.
- Compartir el número de WhatsApp con otra empresa.
