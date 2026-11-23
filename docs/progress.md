# Progreso del proyecto

**Fase actual:** Base local disponible y diseño del MVP en validación
**Última actualización:** 2026-11-23

## Completado

- [x] Contexto inicial del negocio.
- [x] Decisiones confirmadas: Perú, una sede, varios odontólogos, cobro manual Yape/Plin/transferencia.
- [x] Visión y alcance del MVP.
- [x] Requisitos funcionales P0/P1/P2.
- [x] Reglas de negocio propuestas.
- [x] ADR-001 de arquitectura y stack aprobado.
- [x] Modelo de datos y diagrama ER preliminares.
- [x] Registro de supuestos y preguntas abiertas.
- [x] Línea base Git y espacios aislados en Orca.
- [x] Base de Next.js con instalación reproducible, tipos, lint, build y arranque comprobados.
- [x] Diseño de concurrencia, vencimiento y reprogramación de agenda revisado e integrado.

## En curso

- [ ] Validación del alcance y de las reglas marcadas como propuesta.
- [ ] Validación del modelo de datos preliminar.
- [ ] Recolección de servicios, duraciones, precios y horarios.
- [ ] Validación de las propuestas de [acceso clínico](requirements/clinical-access-proposal.md) y [confirmación de citas y pagos](database/appointment-payments-proposal.md).

## Próximos pasos

1. Confirmar reglas de agenda, cancelación y no-show.
2. Confirmar marca, dominio y titularidad de la cuenta de Meta Business.
3. Validar el modelo de datos y las transiciones de agenda y pagos.
4. Wireframes de reserva, agenda y ficha clínica.
5. Completar el Hito 1 con base de datos, autenticación y migraciones cuando el consultorio valide las políticas pertinentes.
6. Implementar Hito 2: landing + agenda + reserva.
7. Implementar Hito 3: WhatsApp (confirmación y recordatorio).
8. Implementar Hito 4: historia clínica y pagos manuales.

## Bloqueos

- Datos del negocio pendientes (servicios, horarios, políticas).
- Alta de WhatsApp Business y titularidad de la cuenta de Meta Business pendientes de confirmar.

## Verificación ejecutada

Se completaron la auditoría inicial, la revisión de concurrencia de agenda y las verificaciones de la base local integrada. Las pruebas de negocio se ejecutarán con las implementaciones correspondientes. [Estado del proyecto](../project-management/CURRENT_STATE.md)

## Riesgos conocidos

- Doble reserva si no se implementa la restricción de exclusión.
- Exposición de datos clínicos por políticas de acceso mal configuradas.
- Retraso por trámite de WhatsApp Business.
- Crecimiento de alcance antes de validar el MVP.

## Decisiones aprobadas

| Fecha | Decisión |
|---|---|
| 2026-11-23 | Operar en Perú, moneda PEN |
| 2026-11-23 | Una sede con varios odontólogos |
| 2026-11-23 | Cobro manual con comprobante en el MVP |
| 2026-11-23 | Stack: Next.js + Supabase + Vercel |
| 2026-11-23 | Desarrollo: propietario con asistencia del agente |
| 2026-11-23 | WhatsApp: número nuevo dedicado |
