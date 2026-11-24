# Línea base de rendimiento y experiencia

## Alcance y condiciones

La medición corresponde al commit `b212eaa` de `main`, servido en `http://127.0.0.1:4320` por la compilación de producción local el 24 de noviembre de 2026. El proyecto usaba Next.js 16.4.6, Node.js 26.12.1 y datos de demostración. Ejecuté `npm.cmd run verify` desde la misma rama y pasaron las comprobaciones de portada y catálogo, sesiones y permisos, reservas y contención de turnos, cola de demostración, clínica, pagos, caducidad y persistencia tras reiniciar.

## Lighthouse

Lighthouse 13.6.0 con Chrome 158 sin interfaz, iniciado a las 10:12, hora de Lima. Una corrida secuencial por ruta y perfil. La emulación móvil simuló 412 × 823 px, DPR 1,75, RTT de 150 ms, 1638,4 Kbps y CPU ×4. El perfil de escritorio simuló 1350 × 940 px, DPR 1, RTT de 40 ms, 10.240 Kbps y CPU ×1.

| Ruta | Perfil | Rendimiento | Accesibilidad | Buenas prácticas | SEO | FCP (ms) | LCP (ms) | TBT (ms) | CLS | TTFB (ms) | Transferencia (bytes) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | Móvil | 99 | 100 | 100 | 63 | 911 | 2154 | 59 | 0 | 6 | 193903 |
| `/` | Escritorio | 100 | 100 | 100 | 63 | 251 | 521 | 0 | 0 | 5 | 195535 |
| `/reservar` | Móvil | 99 | 100 | 100 | 63 | 909 | 2121 | 41 | 0 | 3 | 179475 |
| `/reservar` | Escritorio | 100 | 100 | 100 | 63 | 252 | 501 | 0 | 0 | 3 | 179475 |
| `/mi-cita` | Móvil | 100 | 100 | 100 | 63 | 909 | 909 | 47 | 0 | 3 | 182285 |
| `/mi-cita` | Escritorio | 100 | 100 | 100 | 63 | 248 | 248 | 0 | 0 | 4 | 182285 |

El SEO de 63 refleja la instrucción `noindex` de la demostración, detectada por `is-crawlable`. La auditoría cubre los estados iniciales públicos. El puntaje de accesibilidad complementa las pruebas de interacción. INP y los percentiles de usuarios requieren datos de campo. [Lighthouse](https://developer.chrome.com/docs/lighthouse/overview/) · [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

Para reproducir, usar la misma compilación en 4320. Ejecutar el comando para `/`, `/reservar` y `/mi-cita`, con un archivo de salida distinto. Agregar `--preset=desktop` para escritorio.

```powershell
npx.cmd -y lighthouse@13.6.0 http://127.0.0.1:4320/reservar --quiet --only-categories=performance,accessibility,best-practices,seo --output=json --output-path=reserva-mobile.json '--chrome-flags=--headless=new'
```

## Playwright

Chrome 158 con un contexto de caché fría por navegación, sin simulación de red ni CPU. TTFB, DOMContentLoaded y fin de carga provienen de `PerformanceNavigationTiming`. LCP proviene de `PerformanceObserver`. Los bytes incluyen transferencia observada por el navegador. Lighthouse aplica otro perfil de red y CPU.

| Ruta | Ancho (px) | TTFB (ms) | DOMContentLoaded (ms) | Carga (ms) | LCP (ms) | JavaScript (bytes) | Transferencia (bytes) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/reservar` | 390 | 9 | 86 | 149 | 112 | 150959 | 162361 |
| `/reservar` | 1440 | 6 | 36 | 140 | 100 | 150959 | 162361 |
| `/mi-cita` | 390 | 31 | 95 | 176 | 116 | 146108 | 157356 |
| `/mi-cita` | 1440 | 6 | 67 | 136 | 76 | 146108 | 157356 |

Las dos páginas quedaron dentro del ancho de pantalla a 320, 360, 375, 390, 414, 768, 1024, 1280, 1440 y 1920 px, con alto de 844 px, y en orientación horizontal a 844 × 390 px. En el flujo de reserva, Enter avanzó al horario y el foco pasó a su encabezado. Los campos de contacto aparecían después de los horarios y la preferencia de movimiento reducido dejaba la ilustración estática. Estas pruebas usaron un navegador automatizado.

## Hallazgos de reserva y gestión

| Hallazgo observado | Cambio previsto |
| --- | --- |
| El calendario tenía fecha mínima y carecía de fecha máxima. El backend solo ofrecía horarios dentro de 90 días. | Representar el intervalo como límites nativos del calendario y excluir consultas fuera del rango. |
| El 17 de diciembre había 30 opciones en la lista de horas para Evaluación dental, todas al mismo nivel. | Agrupar horas efectivamente devueltas por la API en mañana y tarde, con el profesional al lado de cada hora. |
| Al agotarse una fecha, el paciente recibía una indicación para cambiar el día a mano. | Añadir búsqueda explícita de alternativas durante los siete días siguientes. |
| La confirmación mostraba fecha, servicio, profesional y precio. | Mostrar duración, ubicación del catálogo de demostración, referencia y descarga de calendario para citas confirmadas. |
| En la pantalla de gestión, la explicación del enlace era general. | Explicar la caducidad y alinear los controles con el inicio de la cita. |
| El CSS local usaba el borde decorativo `#e5d8eb` junto a `#fffcff`, con contraste de 1,34:1. | Usar el token de controles `#987e9f`, con contraste de 3,54:1 frente a la misma superficie. |

Las decisiones favorecen reconocer horarios por franjas, dar retroalimentación al buscar y ofrecer una recuperación desde el estado vacío. Las pruebas de conversión con pacientes y la verificación con lectores de pantalla quedan como trabajo de investigación. [Heurísticas de Nielsen](https://www.nngroup.com/articles/ten-usability-heuristics/) · [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

## Seguimiento de la experiencia

Playwright verificó las mejoras del flujo a 390 px con respuestas controladas de la API. Una fecha fuera del rango de 90 días quedó sin consulta. Desde un día sin turnos, la búsqueda pasó al primer día con horarios de la respuesta y devolvió el foco a la fecha. El control de horas expuso grupos de mañana y tarde. También se probó la recuperación tras una desconexión, la misma clave de idempotencia para el mismo intento y la creación de una nueva al editar los datos o liberar el turno.

La confirmación ofreció un calendario con fecha, hora y título genérico, que mantiene privados el nombre y el enlace de gestión. A 320 px se comprobó la vista de solo consulta para una cita iniciada y la ausencia de datos de cita cuando el enlace devolvió HTTP 410. La comparación de rendimiento del candidato se mide por separado con la compilación integrada.
