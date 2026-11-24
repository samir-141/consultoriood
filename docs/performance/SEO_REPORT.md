# SEO y visibilidad de la demostración

- La portada y las tres páginas de servicio tienen títulos y descripciones en español. La información de Lima procede del catálogo de demostración. Los enlaces del sitio llevan al detalle y conservan el servicio en la reserva.
- `DENTAL_PUBLIC_URL` permite preparar enlaces canónicos, metadatos Open Graph y un sitemap de las páginas públicas a partir de un origen HTTPS. Sin ese valor el sitemap queda vacío y la demo prescinde de emitir URL canónicas especulativas.
- El sitio conserva `noindex, nofollow` y `robots.txt` bloquea el rastreo. Los recursos privados también necesitan autorización. Los resultados Lighthouse de SEO reflejan esa configuración de demostración. [Directivas de búsqueda de Google](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)
- Quedan pendientes el dominio definitivo, nombre legal y ubicación exacta, horario y contacto autorizados, imágenes reales y validación de `Dentist` en Google. Search Console y Google Business Profile requieren una propiedad autorizada. [Datos estructurados para empresas locales](https://developers.google.com/search/docs/appearance/structured-data/local-business)
