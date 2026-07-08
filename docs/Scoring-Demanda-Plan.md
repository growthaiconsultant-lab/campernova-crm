# Block 19 — Scoring + alertas de demanda activa

Fase 2 del roadmap infraestructura: convertir los datos estructurados del B17 (financiación, condiciones de operación) y del B18 (ofertas) en **señales accionables**. **Sin migración** — todo se calcula en lectura sobre datos ya existentes.

## Scoring (`lib/scoring/`, puro + tests)

- **`buyerScore(input)`** → 0-100 + desglose explicable. Ejes: contacto, necesidad definida, presupuesto, **financiación clara (B17)**, plazo de compra, temperatura, mejor match, **oferta activa (B18)**. Reemplaza el `calcBuyerScore` inline de la ficha de comprador (ahora con financiación + oferta).
- **`sellerAcquisitionScore(input)`** → 0-100 + desglose. Mide lo atractivo que es **captar** el vehículo: realismo de precio (pide vs tasación), **urgencia** y **riesgo** (B17), y **demanda activa** (compradores esperando). Prioriza captación por margen/demanda, como pide el documento.
- `scoreLabel` (Alto/Medio/Bajo) + `priceRealismPoints` (testeable aparte).
- `ACTIVE_DEMAND_MATCH_THRESHOLD = 60`: un comprador vivo con match ≥60 cuenta como demanda esperando.

## Componente

- **`components/score-info.tsx`**: icono (i) que despliega el **desglose** del score (eje · pts/máx) en un tooltip, para que el comercial entienda de dónde sale la puntuación.

## Alertas de demanda activa ("tenemos compradores para un vehículo así")

- **Ficha vendedor**: KPI **"Score captación"** (con desglose) + card en el rail **"N compradores esperando"** (verde, enlaza a la pestaña Compradores) cuando hay demanda activa compatible.
- **Dashboard** (ADMIN/AGENTE): sección **"Demanda activa esperando"** — vehículos en stock (PUBLICADO/TASADO) con compradores activos compatibles (match ≥60), ordenados por nº de compradores. Palanca comercial + señal para captar más stock parecido. Respeta el filtro de agente.

## Ficha comprador

- KPI "Calidad lead" ahora usa `buyerScore` (módulo) con tooltip de desglose en vez del cálculo inline.

## Pendiente (siguientes fases)

Persistir scores si hiciera falta ordenar/filtrar listados por score (hoy se calcula en lectura). Alertas push/email cuando entra un vehículo que satisface una demanda activa concreta (hoy es pull desde el dashboard/ficha). Vehicle completeness score ya cubierto por el expediente legal (Block 4).
