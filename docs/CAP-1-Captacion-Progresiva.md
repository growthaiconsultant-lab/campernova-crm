# CAP-1 — Alta y edición progresiva de candidatos y vehículos

> **Estado:** Draft PR (`feat/progressive-candidate-intake-cap1`). Sin fusionar, sin migración
> remota, sin despliegue. Este documento describe el cambio tal como está implementado localmente
> con CI local en verde.

## 1. Política (vinculante)

**Ningún campo de _negocio_ introducido a mano es obligatorio para crear o guardar** un candidato
(BuyerLead), un vendedor (SellerLead), un vehículo (Vehicle) o una captación (VehicleCapture) en el
**CRM interno**. El comercial captura lo que sabe cuando lo sabe; la ficha se completa de forma
progresiva. La ausencia de un dato es un estado válido y **se persiste como `null`**, nunca como
placeholder inventado.

Esto **NO** relaja:

- Los **identificadores técnicos** (id, claves primarias, timestamps, claves foráneas): siguen
  siendo obligatorios.
- El **formulario público `/vender`**: conserva sus reglas estrictas propias (ver §7).
- Los **gates operativos** del proceso (entrada oficial A2, tasación oficial A3, publicación,
  reserva, venta, entrega): siguen exigiendo sus requisitos **en el hito**, no en la captación (§6).

## 2. Alcance

Formularios y acciones de servidor **internas** de creación/edición de:

| Entidad        | Formulario(s) / acción(es)                                                              |
| -------------- | --------------------------------------------------------------------------------------- |
| SellerLead     | `vendedores/nuevo`, `vendedores/[id]` (edición) · `createSellerLead`/`updateSellerLead` |
| Vehicle        | ficha del vendedor (`vehicle-edit-form`) · `updateVehicle`                              |
| BuyerLead      | `compradores/nuevo`, `compradores/[id]` · `createBuyerLead`/`updateBuyerLead`           |
| VehicleCapture | `/captaciones` (quick-add + edición) · `createCapture`/`updateCapture`                  |

**Fuera de alcance** (no se toca): marketplace/SaaS/multiempresa, telefonía/WhatsApp, PUB-1, B1A,
DATA-1, histórico de `salePrice`. El formulario público `/vender` (§7).

## 3. Campos de negocio afectados (14 columnas → nullable)

| Tabla              | Columnas                                        |
| ------------------ | ----------------------------------------------- |
| `seller_leads`     | `name`, `email`, `phone`                        |
| `vehicles`         | `brand`, `model`, `year`, `km`, `seats`, `type` |
| `buyer_leads`      | `name`, `email`, `phone`                        |
| `vehicle_captures` | `listing_url`, `phone`                          |

`ReferencePrice` (`brand`/`model`/`type`) **no** se toca: es tabla de referencia interna, no
captación de candidatos.

## 4. Normalización de ausencia → `null` (nunca placeholders)

Helpers en `lib/validators/optional.ts` (con tests en `lib/validators/cap1-intake.test.ts`):

- **Texto** (`optionalText`): se **recorta**; cadena vacía o solo-espacios → `null`. Tope de
  longitud como protección de payload.
- **Email** (`optionalEmail`): vacío → `null`.
- **Números** (`optionalInt` / `optionalPositive`): vacío / `undefined` / `NaN` → `null` (**nunca
  `0`**). Los inputs nativos que emiten string numérica también se normalizan.
- **Selects / enums**: sin elección → `null` (o `undefined`, que Prisma persiste como `null` en
  columna nullable sin default).

Nunca se escribe `"Pendiente"`, `"Desconocido"`, `"-"`, matrícula/VIN inventados, `km: 0` ni
`price: 0` como sustituto de un dato ausente. En la **conversión de captación** a vendedor+vehículo
(`convertCaptureToSellerLead`) los campos desconocidos (tipo/año/km/plazas, email) se dejan en `null`
en lugar de los placeholders previos (`km:0`, `year: añoActual`, `seats:4`, email `''`).

### Detalle Zod 4 (por qué no `z.preprocess`)

En Zod 4, `z.preprocess(...)` **no** hace opcional la clave del objeto (falla con _"expected
nonoptional"_ si el campo falta). Por eso los helpers usan `.optional()` sobre una unión y la
normalización va en el `.transform`, manteniendo el `z.input` amigable con react-hook-form.

## 5. Validación **cuando sí hay valor** (formato/dominio)

Si el usuario aporta un valor, se valida (pero vacío nunca bloquea):

- Email con formato válido.
- `km` ≥ 0, `year` en rango razonable, `seats` ≥ 0, precios ≥ 0 / > 0 según el campo.
- Topes de longitud de texto; enums restringidos a sus valores; teléfono con laxitud.

## 6. Gates operativos preservados

CAP-1 sólo relaja la **captura**. Los módulos de decisión no se tocan y siguen exigiendo sus
requisitos en el hito correspondiente:

- **A2 — entrada oficial:** intacto (`lib/valuation/official.ts`, precondiciones de entrada).
- **A3 — tasación oficial:** intacto (`lib/valuation/save.ts`, `official.ts`): entrada activa +
  inspección completada + rol + idempotencia + locks/CAS.
- **Publicación / reserva / venta / entrega:** `lib/vehicle-status.ts` y los gates de
  `lib/vehicle-legal/*` siguen exigiendo campos/documentos/fotos en `TASADO`/`PUBLICADO` (el guard
  legal se relee bajo lock en `updateVehicle`).

### Valoración preliminar (A3) no bloquea el guardado ordinario

`updateVehicle` y la conversión de captación disparan `runAndSavePreliminaryValuation`, que es **no
bloqueante y recomputable**. Con datos incompletos, el motor de valoración devuelve `method: 'NONE'`
(guard temprano en `lib/valuation/calculate.ts` cuando falta `brand`/`model`/`type`/`year`/`km`) y
**no** se persiste tasación. Un resultado `SIN_REFERENCIA`/`FALLO_TECNICO` **no** revierte la
edición, **no** cambia el estado, **no** escribe campos oficiales ni `salePrice`, y **no** habilita
matching. El guardado del vehículo se completa igual.

## 7. El formulario público `/vender` conserva sus reglas

El `createSellerLeadSchema` compartido se **desacopló**: la versión interna es permisiva; la pública
es `createSellerLeadPublicSchema` (`= createSellerLeadSchema.extend({...})`) que **reimpone**
name/email/phone/type/brand/model/year/km/seats como obligatorios. `app/vender/empezar/actions.ts`
usa la versión estricta. Sin regresión en el flujo público.

## 8. Migración (aditiva, **no aplicada** en este encargo)

`prisma/migrations/20260728130000_cap1_business_fields_nullable/` — sólo
`ALTER TABLE ... ALTER COLUMN ... DROP NOT NULL` sobre las 14 columnas. **No destructiva**: `DROP NOT
NULL` amplía el dominio (permite null) sin tocar filas existentes. Sin DML, sin backfill, sin drops,
sin cambio de recuento de columnas → los deltas de catálogo de CI no cambian.

## 9. Orden de rollout (cuando se autorice)

**BD antes que cliente.** Compatibilidad:

- `código viejo + schema nuevo` = **compatible** (el código viejo siempre aporta valores; nunca
  inserta null).
- `código CAP-1 + schema viejo` = **incompatible** (inserta null en columnas aún `NOT NULL`).

Por tanto: aplicar la migración en la BD → verificar → **después** desplegar el cliente CAP-1.

## 10. Riesgos y mitigaciones

- **Datos más incompletos en fichas** → mitigado por fallbacks de **presentación** computados en
  render (`lib/display.ts`: `vehicleLabel`, `personLabel`, `initialOf`, `shortIdSuffix`), que
  producen etiquetas legibles ("Vehículo sin identificar", "Vendedor sin identificar" + sufijo de id)
  **sin persistir nada**.
- **Lectores que asumían no-null** → recorridos y endurecidos (matching, KPIs, catálogo público,
  calendario, ofertas, dedup, anuncios); el typecheck con columnas nullable actuó de driver.
- **Orden de rollout invertido** → documentado como crítico (§9).
- **Regresión del formulario público** → evitada por el desacople del schema (§7).

## 11. Plan futuro: obligatoriedad gradual (no en CAP-1)

Cuando el proceso lo requiera, la obligatoriedad se reintroduce **por hito**, no en la captura:
requisitos mínimos para `TASADO`/`PUBLICADO` ya viven en `lib/vehicle-legal`; se pueden añadir
"requisitos para pasar a X etapa" declarativos y avisos de completitud (semáforo) sin volver a hacer
obligatoria la creación. La reintroducción de `NOT NULL` a nivel de BD **no** se contempla mientras
la política de captación progresiva siga vigente.
