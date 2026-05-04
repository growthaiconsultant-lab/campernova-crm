# Reglas por marketplace

## Wallapop

- **Descripción máxima: 620 caracteres** (límite real para asegurar que se publica sin recortar).
- Título recomendado: máximo 50 caracteres.
- Tono: cercano, conversacional. Sin emoji excesivo.
- La estructura completa de 10 secciones NO cabe en 620 caracteres → versión condensada:
  - 1 frase de descripción/highlight
  - 4-6 bullets de equipamiento más vendedor
  - Llamada a acción corta
  - Bloque mínimo de garantía + ubicación (no las condiciones completas, solo lo esencial)
- El bloque completo de "Condiciones de venta" se omite o se condensa porque no cabe.

## Coches.net

- **Descripción máxima recomendada: 4500 caracteres** (límite oficial 5000, dejamos margen).
- Tono: profesional, formal. Foco en estado mecánico y revisiones.
- Sin emoji.
- La estructura completa de 10 secciones DEBE caber.
- Listas con guiones (sin tablas — Coches.net no las renderiza bien).

## Salida final

El sistema debe devolver dos versiones:

1. **Anuncio listo para publicar en Wallapop** (≤ 620 caracteres)
2. **Anuncio listo para publicar en Coches.net** (≤ 4500 caracteres)

Ambos textos deben respetar el límite y estar formateados para copiar-pegar directamente.
