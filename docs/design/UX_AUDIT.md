# Auditoría y rediseño de la experiencia dental

Línea base `b212eaa`, demostración 1.0.1, revisada el 24 de noviembre de 2026. El objetivo principal de la portada es que una persona entienda qué puede reservar, cuánto dura y cómo gestionar una cita existente.

| Superficie | Hallazgo de partida | Cambio o decisión |
| --- | --- | --- |
| Portada | Gomita ocupaba toda la imagen inicial. Las tarjetas mostraban los servicios pero el paciente debía identificarlos de nuevo al comenzar la reserva. | La imagen editorial acompaña el título, con texto fuera de la foto y prioridad en «Reservar cita». Los servicios enlazan a un detalle y conservan el servicio elegido al reservar. |
| Ubicación y equipo | Horario, ciudad y perfiles de ejemplo mezclaban información práctica con ilustraciones que repetían texto. | Franja práctica con ciudad, horario y gestión de cita. Los perfiles siguen identificados como demostración. Dirección, teléfono, credenciales y mapa dependen de aprobación. |
| Primera visita y ayuda | La portada no tenía una explicación de la visita ni preguntas sobre cambios y costos. | Se añadió una preparación breve y preguntas desplegables con el control nativo del navegador. |
| Disponibilidad | La agenda se consultaba después de iniciar la reserva. | La portada puede consultar el siguiente turno de evaluación con la misma fuente de disponibilidad. La consulta ocurre por acción explícita y elegir el horario sigue siendo parte de la reserva. |
| Reserva y gestión | La lista larga de horarios exigía buscar entre horas, y el enlace mostraba acciones que el servidor podía rechazar. | Revisión de fecha, grupos de horas y estados. Gomita se mantiene en las pantallas de reserva y acompaña los mensajes del sistema. |
| Ingreso y panel | Inicio de sesión con cuentas de prueba y navegación por rol. El panel exigía recorrer toda la navegación antes del contenido al usar teclado. | Enlace para saltar al contenido y objetivos táctiles de 44 px en la navegación del panel. Se conservaron agenda, pacientes, clínica, pagos y mensajes. |
| Privacidad y rutas | Faltaba ayuda pública sobre el uso de datos de prueba. Una ruta desconocida terminaba en el mensaje predeterminado. | Información de privacidad junto a las ayudas del pie y error 404 en español con regreso a la portada. |

El recorrido público conserva el isotipo del concepto A, el morado de Gómez Delgado y la tipografía de sistema para controles. Los titulares editoriales usan Georgia. El fondo cálido, la escena fija y el diseño a dos columnas hacen que el texto sea legible sin superponerlo a la imagen. En móvil el título y las acciones aparecen antes de la foto. El horario y la información de servicio se leen también como texto.

Aquello que necesita evidencia del consultorio queda fuera de la demostración: tratamientos adicionales, atención urgente o infantil, medios de pago, fotografías reales, reseñas, dirección exacta y canales de contacto. La consulta de horarios no promete atención inmediata. [Investigación de comportamiento](../research/PATIENT_BEHAVIOR_RESEARCH.md) · [Referentes de interfaz](../research/DENTAL_WEBSITE_BENCHMARK.md)

## Fotografía de portada

La escena es una ilustración fotográfica generada con la herramienta integrada ImageGen. Se indica su carácter ilustrativo en la portada. La versión de la web mide 1440 × 960 y ocupa 107.518 bytes en WebP. Next.js envía variantes según el ancho y la densidad de pantalla. [Recurso final](../../public/fotografia/consulta-ilustrativa.webp)

Este fue el prompt de generación.

> Use case: photorealistic-natural. Create one horizontal 3:2 editorial photograph for a calm modern family dental website in Lima. A smiling Peruvian adult woman with dark wavy hair, wearing a warm cream everyday knit top, is seated upright in a contemporary dental consultation room, relaxed after speaking with the dentist. A female dental professional in muted lilac scrubs appears naturally at the edge, softer focus, engaged in friendly conversation. The patient's face and upper torso are the visual focus, centered near 57% of frame and 44% of height, with generous margins around both heads for responsive cropping. Daylight through frosted glass and warm off-white walls, soothing touches of desaturated lavender and a quiet leafy blur, magazine editorial with natural skin texture, warmth and ordinary realistic smiles. No instruments in mouths, no needles, no logos, no written text, no watermarks, no fashion studio posing. Single photographic scene edge to edge, not a website mockup. Distinct people, framing and colors from the reference screenshots. The picture will occupy the right side of a two-column hero so text is outside the image.
