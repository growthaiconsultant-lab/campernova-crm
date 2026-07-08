# Block 17 — Modelo de datos estructurado (Buyer Demand Graph + Seller Supply Graph)

Objetivo: dejar de guardar en notas libres la información comercial clave de la
**demanda** (comprador) y la **oferta** (vendedor), y pasarla a campos
estructurados. Esto habilita, sin migraciones adicionales, los bloques
siguientes: ofertas/reservas (B18) y scoring de comprador/vendedor (B19).

Es una migración **additiva** (solo `CREATE TYPE` + `ADD COLUMN` nullable): no
toca datos existentes y es segura de aplicar en producción.

## Campos nuevos

### Comprador — `BuyerLead` (demanda)

| Campo               | Tipo             | Para qué                              |
| ------------------- | ---------------- | ------------------------------------- |
| `financingNeeded`   | `Boolean?`       | ¿El comprador necesita financiación?  |
| `maxMonthlyPayment` | `Decimal(10,2)?` | Cuota máxima mensual que puede asumir |

La financiación es un dato de cualificación (no un filtro de matching): permite
priorizar leads financiables y preparar mejor la solicitud a la financiera.

### Vendedor — `SellerLead` (oferta / condiciones de la operación)

| Campo       | Tipo              | Para qué                                                                 |
| ----------- | ----------------- | ------------------------------------------------------------------------ |
| `minPrice`  | `Decimal(10,2)?`  | Precio mínimo que aceptaría el vendedor                                  |
| `dealType`  | `SellerDealType?` | Modalidad: depósito-venta / compra directa / parte de pago / sin decidir |
| `urgency`   | `SellerUrgency?`  | Urgencia real por cerrar (Alta / Media / Baja)                           |
| `riskLevel` | `SellerRisk?`     | Riesgo mecánico/documental (Bajo / Medio / Alto)                         |
| `riskNotes` | `String?`         | Detalle del riesgo (máx. 500)                                            |

El **margen esperado** NO se añade aquí: ya vive en `Vehicle`
(`purchasePrice` / `salePrice` / `marginPercent`), no se duplica.

## Enums nuevos

- `SellerDealType { DEPOSITO_VENTA, COMPRA_DIRECTA, PARTE_PAGO, INDECISO }`
- `SellerUrgency { ALTA, MEDIA, BAJA }`
- `SellerRisk { BAJO, MEDIO, ALTO }`

## Piezas

- **Migración** `20260708100000_add_structured_deal_fields` (additiva).
- **`lib/deal-terms.ts`** (puro): labels, opciones, colores y validadores de los
  tres enums del vendedor. Con tests.
- **Validadores** (`lib/validators/buyer-lead.ts`, `lib/validators/seller-lead.ts`):
  los campos entran en los schemas de creación/edición.
- **Server actions**: `createBuyerLead` / `updateBuyerLead` persisten financiación;
  `updateSellerLead` persiste las condiciones de la operación.
- **UI**:
  - Comprador: nuevos campos en el alta y en la ficha (financiación + cuota).
    La financiación se resume en el rail (card «Resumen»).
  - Vendedor: sección «Condiciones de la operación» en el formulario de la ficha
    - card «Operación» en el rail (con urgencia y riesgo coloreados).

## Fuera de alcance (siguientes bloques)

- **B18 — Ofertas y Reservas**: entidad con importe/señal/estado para capturar
  precios reales de cierre.
- **B19 — Scoring y alertas**: buyer score, seller acquisition score y alerta
  «vehículo compatible con demanda activa», que consumirán estos campos.
- Capturar financiación desde el chat de `/comprar` (hoy solo se captura en el
  backoffice; el chat puede añadirlo más adelante).
