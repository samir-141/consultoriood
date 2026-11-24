# Rendimiento después del rediseño

Comparación del 24 de noviembre de 2026 entre `b212eaa` y ADE-012. Se usaron Next.js 16.4.6 en modo producción local, Lighthouse 13.6.0 y Chrome 158. Cada ruta se midió una vez por perfil, en secuencia, con los ajustes de la [línea base](BASELINE_REPORT.md). Los resultados son mediciones de laboratorio.

| Ruta | Perfil | Rendimiento anterior → final | LCP anterior → final (ms) | TBT final (ms) | CLS final | Transferencia final (bytes) | JS final (bytes) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | Móvil | 99 → 98 | 2154 → 2288 | 21 | 0 | 210740 | 157519 |
| `/` | Escritorio | 100 → 100 | 521 → 506 | 0 | 0 | 205415 | 157519 |
| `/reservar` | Móvil | 99 → 98 | 2121 → 2336 | 42 | 0 | 196550 | 173352 |
| `/reservar` | Escritorio | 100 → 100 | 501 → 539 | 0 | 0 | 196550 | 173352 |
| `/mi-cita` | Móvil | 100 → 100 | 909 → 932 | 75 | 0 | 181203 | 157519 |
| `/mi-cita` | Escritorio | 100 → 100 | 248 → 259 | 0 | 0 | 181201 | 157519 |

La portada y la reserva aumentaron el LCP móvil en esta medición. Las seis pruebas quedaron por debajo de 2,5 segundos y dentro de los presupuestos de 1 MB de transferencia y 200 KB de JavaScript. Lighthouse dio 100 en accesibilidad y buenas prácticas para las seis mediciones. El SEO quedó en 66 con la indexación bloqueada para la demo. Estos resultados no representan INP de campo, usuarios reales ni una verificación completa de WCAG. [Lighthouse](https://developer.chrome.com/docs/lighthouse/overview/) · [Web Vitals](https://web.dev/articles/vitals)

La foto original de la escena se entrega como WebP de 107.518 bytes y variantes adaptativas. El tamaño del marco queda reservado, la foto inicial tiene prioridad alta y la consulta de agenda de portada se inicia al pulsar el botón. Los servicios se prerenderizan, las preguntas frecuentes usan HTML nativo y no se añadió ninguna biblioteca al paquete del navegador.

Para repetir, compilar y arrancar `npm.cmd run start -- --port 4372`. Ejecutar la prueba para `/`, `/reservar` y `/mi-cita` con un archivo distinto, y agregar `--preset=desktop` para escritorio.

```powershell
npx.cmd -y lighthouse@13.6.0 http://127.0.0.1:4372/ --quiet --only-categories=performance,accessibility,best-practices,seo --output=json --output-path=portada-mobile.json '--chrome-flags=--headless=new'
```
