# Progreso del proyecto

**Fase actual:** Versión web local 1.0.1 disponible para validación del consultorio
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
- [x] [Prototipo navegable de reserva, agenda y ficha clínica](design/wireframes.html) con datos sintéticos, reserva guiada y acciones secundarias bajo demanda.
- [x] Landing, catálogo y flujo de reserva con enlace de gestión.
- [x] Agenda diaria y semanal, pacientes, sesiones y permisos por rol.
- [x] Ficha clínica con historial, adjuntos privados, auditoría, pagos manuales y saldos.
- [x] Bandeja local de confirmaciones y recordatorios de WhatsApp en modo simulación.

## En curso

- [ ] Validación del alcance y de las reglas marcadas como propuesta.
- [ ] Validación del modelo de datos preliminar.
- [ ] Recolección de servicios, duraciones, precios y horarios.
- [ ] Validación de las propuestas de [acceso clínico](requirements/clinical-access-proposal.md) y [confirmación de citas y pagos](database/appointment-payments-proposal.md).
- [ ] Revisión de los flujos del prototipo con recepción y odontología.

## Próximos pasos

1. Confirmar reglas de agenda, cancelación y no-show.
2. Confirmar marca, dominio y titularidad de la cuenta de Meta Business.
3. Validar el modelo de datos y las transiciones de agenda y pagos.
4. Configurar Supabase, autenticación de producción y las migraciones correspondientes cuando el consultorio apruebe las políticas.
5. Configurar Meta WhatsApp y validar envíos con un entorno y un número autorizados.

## Bloqueos

- Datos del negocio pendientes (servicios, horarios, políticas).
- Alta de WhatsApp Business y titularidad de la cuenta de Meta Business pendientes de confirmar.

## Verificación ejecutada

La prueba de integración reproduce reservas concurrentes, vencimiento, permisos, adjuntos privados, pagos y persistencia tras reiniciar. [Arranque y verificación](../README.md)

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
