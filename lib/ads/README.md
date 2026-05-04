# `lib/ads/` — Generación de anuncios Wallapop / Coches.net

Esta carpeta porta la metodología probada del GPT custom de CampersNova para generar anuncios profesionales de campers y autocaravanas a partir de los datos de la ficha del vendedor.

## Estructura

```
lib/ads/
  knowledge/
    01-equipment.md           — catálogo de equipamiento detectable
    02-capacities.md           — rangos típicos + conversiones L/H
    03-models.md               — marcas y modelos de referencia
    04-pricing.md              — factores que influyen en el precio
    05-structure.md            — orden obligatorio de las 10 secciones
    06-marketplace-rules.md    — límites de caracteres y tono por canal
  templates/
    sales-conditions.md        — bloque fijo de condiciones de venta
    cta.md                     — llamada a la acción fija
  prompts/
    wallapop.ts                — system prompt para Wallapop (≤620 chars)
    cochesnet.ts               — system prompt para Coches.net (≤4500 chars)
  build-context.ts             — Vehicle → user message estructurado
  generate.ts                  — wrapper Anthropic con visión multimodal
  download-photos.ts           — genera ZIP con todas las fotos del vehículo
  index.ts                     — exports públicos
```

## Filosofía

- **Knowledge files** (`knowledge/`): material de referencia que se inyecta en cada llamada como contexto. Iterar la calidad = editar un .md.
- **Templates** (`templates/`): bloques fijos que aparecen siempre literales (condiciones de venta, llamada a acción).
- **Prompts** (`prompts/`): system prompts específicos por canal, cortos, que delegan al knowledge.
- **Anti-alucinación**: el modelo nunca inventa datos técnicos. Si no están en la ficha o las fotos, omite la línea.
