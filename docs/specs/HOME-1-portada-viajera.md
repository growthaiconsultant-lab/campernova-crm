# HOME-1 — Portada viajera y catálogo público

| Campo      | Valor       |
| ---------- | ----------- |
| **Estado** | IMPLEMENTED |

## Problema

La portada anterior repetía los itinerarios de compra y venta y dejaba el taller fuera de la navegación principal.

## Resultado esperado

El titular aprobó el diseño y su publicación en campersnova.com el 12 de noviembre de 2026. Ruta estándar de presentación web.

La página de inicio reunirá compra, venta, búsqueda a medida, taller, garantías, futura tienda y visita a la nave. La cabecera, las fotos y las tarjetas siguen la última maqueta aprobada. Se conserva el consentimiento, la analítica de landing y el marcado SEO.

Las unidades disponibles proceden del catálogo público del CRM. Las referencias de archivo enlazan a búsqueda a medida y llevan una etiqueta visible. Se muestra únicamente el precio de venta público. La cuota se consulta por WhatsApp porque el catálogo no incluye ofertas financieras por unidad. Los importes ficticios de la maqueta no se publican.

## Criterios de aceptación y verificación

- Portada navegable en escritorio y móvil, sin desbordamiento ni sección de podcast.
- Ficha, filtros, financiación, WhatsApp y búsqueda a medida accesibles. En ausencia de stock se ofrece la búsqueda.
- Invalidar la portada al cambiar el catálogo. No se modifica el esquema ni el flujo de compraventa.
- Verificar tipos, lint, pruebas de catálogo, CI, preview y dominio público. Comprobar que la portada muestra las mismas unidades disponibles que el catálogo.

## Rollout y rollback

Publicación desde main tras CI y comprobación de la vista previa. Revertir el PR si fallan navegación, disponibilidad o exposición de precios. El cambio no necesita revertir datos.
