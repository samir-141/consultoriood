# Consultorio dental — Visión y alcance

**Estado:** borrador para validación
**Fecha:** 2026-11-23
**Última actualización:** 2026-11-23

## 1. Resumen

Plataforma para un consultorio dental en Perú que unifica captación, agenda, atención clínica y comunicación con el paciente. Una sola sede con varios odontólogos. El paciente reserva online; recepción administra la agenda; el odontólogo registra la atención en la historia clínica; WhatsApp envía confirmaciones, recordatorios y controles.

La regla de diseño central: **una sola fuente de verdad para la agenda y para el paciente**. La web, el bot y la recepción no pueden operar agendas separadas.

## 2. Decisiones confirmadas

| Tema | Decisión |
|---|---|
| País | Perú |
| Moneda | Sol (PEN) |
| Sedes | Una sede |
| Profesionales | Varios odontólogos |
| Cobro en MVP | Yape / Plin / transferencia con comprobante y validación manual |
| Canales | Web pública + WhatsApp |
| Registro clínico | Historia clínica electrónica por paciente |
| Tipo de producto | Uso propio del consultorio, no SaaS multi-clínica |

## 3. Usuarios y roles

| Rol | Necesita |
|---|---|
| Paciente | Reservar, confirmar, reprogramar, cancelar, ver su próxima cita y sus indicaciones |
| Recepcionista | Gestionar agenda, pacientes, pagos y comprobantes; no debe leer notas clínicas |
| Odontólogo | Ver su día, sus pacientes y casos pendientes; registrar encuentros, odontograma y planes |
| Administrador | Configurar servicios, profesionales, horarios, usuarios y ver reportes |
| Sistema (bot/cron) | Enviar recordatorios, liberar holds vencidos, registrar respuestas |

Un usuario puede tener más de un rol (por ejemplo, administrador y odontólogo). Los permisos se validan en el servidor, no ocultando botones.

## 4. Objetivos del negocio

1. Captar pacientes con una landing clara y reserva en menos de 2 minutos.
2. Reducir el no-show con confirmaciones y recordatorios accionables.
3. Eliminar la doble reserva y el manejo de agenda en papel o WhatsApp manual.
4. Centralizar la historia clínica y los adjuntos (radiografías, consentimientos).
5. Dar al odontólogo una vista operativa de su día y de sus casos abiertos.
6. Automatizar el recall (control cada 6 meses) y el seguimiento post-tratamiento.

## 5. Alcance del MVP

### Incluido

- Landing pública con servicios, equipo, ubicación, horarios, preguntas frecuentes y CTA de reserva.
- Reserva online con selección de servicio, odontólogo (o "cualquiera disponible"), fecha y hora.
- Agenda real con bloqueos, feriados y reglas de cancelación.
- Confirmación y recordatorio por WhatsApp con acciones (confirmar / reprogramar / cancelar).
- Panel de recepción para crear, mover, cancelar y bloquear citas.
- Ficha de paciente y registro de pagos manuales con comprobante.
- Panel del odontólogo: mi agenda, mis pacientes, casos pendientes.
- Historia clínica: encuentro, nota, odontograma básico, plan de tratamiento y adjuntos privados.
- Roles, permisos y auditoría de accesos clínicos.

### Fuera del MVP

- Facturación electrónica SUNAT.
- Multi-sede y multi-tenant.
- App móvil nativa.
- Diagnóstico o prescripción por IA.
- Integración con seguros o coberturas.
- Firma digital certificada de consentimientos.
- Pasarela de pago con tarjeta.

## 6. Métricas de éxito

| Métrica | Objetivo inicial |
|---|---|
| Conversión visita → reserva | Medir línea base; meta > 8 % |
| Citas reservadas online | > 50 % del total |
| Tasa de no-show | < 10 % |
| Ocupación de agenda | > 70 % de slots ofrecidos |
| Recordatorios con respuesta | > 60 % |
| Tiempo de registro clínico por atención | < 5 minutos |
| Pacientes reactivados por recall | Medir a los 90 días |

## 7. Supuestos

- Un odontólogo atiende una cita a la vez; una silla por odontólogo en el MVP.
- Los servicios tienen duración fija y precio referencial.
- Recepción valida los pagos manualmente contra el ingreso real.
- El consultorio tendrá un número de WhatsApp dedicado y una cuenta de Meta Business verificada.
- La marca, el logo y el dominio se definirán antes de la fase de diseño visual.
- La historia clínica se conserva y no se elimina; las correcciones se registran como enmiendas.
- El consultorio acepta que el MVP no emite comprobantes electrónicos ante SUNAT.

## 8. Riesgos principales

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Doble reserva por concurrencia | Pérdida de confianza | Restricción de exclusión en base de datos y pruebas de concurrencia |
| No-show sin política | Agenda improductiva | Política de cancelación, recordatorios y depósito si reincide |
| Bloqueo o pérdida del número de WhatsApp | Pérdida del canal | API oficial, número dedicado, cuenta de Meta en propiedad del consultorio |
| Historia clínica mal protegida | Riesgo legal y reputacional | Datos sensibles, auditoría, adjuntos privados, retención normativa |
| Bot que diagnostica o promete precios exactos | Riesgo clínico y legal | Alcance informativo y transaccional, derivación a humano |
| Alcance creciente | Retraso del MVP | Prioridades P0/P1/P2 y entregas por hitos |

## 9. Referencias legales a validar

- Ley N.° 29733 de Protección de Datos Personales y su reglamento vigente (datos de salud son sensibles).
- Norma técnica de gestión de la historia clínica vigente en Perú y normas del colegio profesional.
- Obligaciones de comprobantes de pago y tributación aplicables a servicios odontológicos (validar con contador).
- Términos y condiciones, política de privacidad y consentimiento informado del consultorio.

Este documento no constituye asesoría legal. Las decisiones de retención, consentimiento y facturación deben validarse con un profesional competente.
