# CAP-1 — Alta y edición progresiva de candidatos y vehículos

> **Estado:** **EN PRODUCCIÓN** (fast-track por urgencia operativa, 2026-07-29). PR #150 fusionado
> a `main` (`145359f`); migración `20260728130000` aplicada a producción DB-first (11 columnas,
> checksum `cb2d2dd3…12b9`, sin DML/backfill, conteos idénticos al preflight); deployment READY en
> `campersnova.com`; smoke autenticado con un único expediente sintético + limpieza exacta. La
> validación autenticada en staging se **omitió** por urgencia (excepción autorizada). **Observación
> de 24 h: pendiente.** Detalle en `docs/releases/2026-07-29-cap1-production.md`.

## 1. Política (vinculante)

**Ningún campo de _negocio_ introducido a mano es obligatorio para crear o guardar** un candidato
**vendedor** (SellerLead), un vehículo (Vehicle) o una captación de portal (VehicleCapture) en el
**CRM interno**, incluida la conversión del vehículo de **parte de pago** (trade-in). El comercial
captura lo que sabe cuando lo sabe; la ficha se completa de forma progresiva. La ausencia de un dato
es un estado válido y **se persiste como `null`**, nunca como placeholder inventado.

Esto **NO** relaja:

- **BuyerLead (comprador): FUERA de alcance.** El contacto del comprador (nombre/email/teléfono)
  **sigue siendo obligatorio** al crear/editar. No hay dependencia técnica que obligue a relajarlo
  (los schemas de comprador y vendedor son independientes), así que se conserva su comportamiento
  previo (ver §2 y §7).
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
| VehicleCapture | `/captaciones` (quick-add + edición) · `createCapture`/`updateCapture`                  |
| Trade-in       | conversión de parte de pago a vendedor+vehículo · `createSellerLeadFromTradeIn`         |

**Fuera de alcance** (no se toca funcionalmente): **BuyerLead** (el contacto del comprador sigue
obligatorio; solo se relaja el vehículo de parte de pago que se convierte en stock), marketplace/
SaaS/multiempresa, telefonía/WhatsApp, PUB-1, B1A, DATA-1, histórico de `salePrice`, el formulario
público `/vender` (§7).

## 3. Campos de negocio afectados (11 columnas → nullable)

| #   | Tabla              | Columna       | Tipo previo | Clasificación            | Fuente del valor      |
| --- | ------------------ | ------------- | ----------- | ------------------------ | --------------------- |
| 1   | `seller_leads`     | `name`        | text        | dato de negocio (manual) | comercial / form      |
| 2   | `seller_leads`     | `email`       | text        | dato de negocio (manual) | comercial / form      |
| 3   | `seller_leads`     | `phone`       | text        | dato de negocio (manual) | comercial / form      |
| 4   | `vehicles`         | `brand`       | text        | dato de negocio (manual) | comercial / form / IA |
| 5   | `vehicles`         | `model`       | text        | dato de negocio (manual) | comercial / form / IA |
| 6   | `vehicles`         | `year`        | int         | dato de negocio (manual) | comercial / form      |
| 7   | `vehicles`         | `km`          | int         | dato de negocio (manual) | comercial / form      |
| 8   | `vehicles`         | `seats`       | int         | dato de negocio (manual) | comercial / form      |
| 9   | `vehicles`         | `type`        | enum        | dato de negocio (manual) | comercial / form      |
| 10  | `vehicle_captures` | `listing_url` | text        | dato de negocio (manual) | comercial / form      |
| 11  | `vehicle_captures` | `phone`       | text        | dato de negocio (manual) | comercial / form      |

Las 11 son **datos de negocio introducidos a mano**. **Ninguna** es PK, FK indispensable,
discriminador de tenant/propiedad, identidad de auth, actor obligatorio de una operación cerrada,
estado técnico/workflow, clave de idempotencia, integridad económica ni requisito estructural de
A1/A2/A3. **`buyer_leads.name/email/phone` NO se incluyen** (BuyerLead fuera de alcance, §2).

**Constraints/índices:** ninguna de las 11 participa en índices `UNIQUE`, índices parciales,
constraints `CHECK`, FKs, defaults ni triggers; `DROP NOT NULL` no altera índices ni recuento de
columnas. No hay UNIQUE nullable involucrada, por lo que la semántica "varios NULL permitidos" no
aplica a ninguna. `ReferencePrice` (`brand`/`model`/`type`) **no** se toca: es tabla de referencia
interna, no captación de candidatos.

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

### Valoración preliminar (A3) no bloquea ni revierte el guardado ordinario

**Call graph verificado** (`vendedores/[id]/actions.ts` → `updateVehicle`):

1. El guardado del vehículo (write + gate legal) vive dentro de `db.$transaction(...)` con
   `withLockedRoots`; **la transacción hace commit** al salir del `try`.
2. **Después** del `try/catch` (transacción ya cerrada) se llama a `runAndSavePreliminaryValuation`,
   en **transacciones propias y separadas**. No comparten transacción con el guardado.
3. `updateVehicle` devuelve `{ ok: true }` **descartando** el valor de retorno de la valoración.

Respuestas (evidencia `lib/valuation/save.ts`):

| Escenario                               | Efecto sobre el guardado                                                            |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| `SIN_REFERENCIA`                        | registra `VehicleValuationAttempt` (append-only), no revierte, no persiste tasación |
| `FALLO_TECNICO` (throw en cálculo)      | `catch` → registra intento fallido best-effort, `return null`, no propaga           |
| Excepción no clasificada                | mismo `catch` genérico → no propaga                                                 |
| Falla el insert del Attempt             | `try/catch` interno best-effort → no propaga                                        |
| Timeout                                 | se manifiesta como throw → capturado → no propaga                                   |
| ¿Excepción posterior deshace el update? | **No**: el update ya hizo commit antes; la valoración no reabre esa tx              |
| Respuesta a la UI                       | `{ ok: true }` en todos los casos anteriores                                        |

Con datos incompletos el motor devuelve `method: 'NONE'` (guard temprano en
`lib/valuation/calculate.ts` cuando falta `brand`/`model`/`type`/`year`/`km`) → outcome
`SIN_REFERENCIA`, **sin** tasación persistida, **sin** cambio de estado, **sin** denormalizados
oficiales ni `salePrice`, **sin** habilitar matching.

**Invariante garantizada:** una edición válida del candidato/vehículo persiste aunque la valoración
preliminar no pueda ejecutarse o falle.

## 7. El formulario público `/vender` conserva sus reglas

El `createSellerLeadSchema` compartido se **desacopló**: la versión interna es permisiva; la pública
es `createSellerLeadPublicSchema` (`= createSellerLeadSchema.extend({...})`) que **reimpone**
name/email/phone/type/brand/model/year/km/seats como obligatorios. `app/vender/empezar/actions.ts`
usa la versión estricta. Sin regresión en el flujo público.

## 8. Migración (relajación nullable retrocompatible, **no aplicada** en este encargo)

`prisma/migrations/20260728130000_cap1_business_fields_nullable/`. Redacción canónica:
**_Backward-compatible nullable-relaxation migration; DROP NOT NULL only; no DML, no backfill and no
destructive data operation._** Sólo `ALTER TABLE ... ALTER COLUMN ... DROP NOT NULL` sobre las **11**
columnas. `DROP NOT NULL` amplía el dominio (permite null) sin tocar filas existentes. Sin drops, sin
cambio de recuento de columnas → los deltas de catálogo de CI no cambian.

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
