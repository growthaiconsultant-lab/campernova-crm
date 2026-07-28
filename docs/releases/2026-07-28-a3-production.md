# Release/handoff — A3 (valoración preliminar vs tasación oficial) en producción (2026-07-28)

> Registra **exactamente** lo migrado, fusionado, desplegado y validado. No exagera el grado de
> validación. El smoke autenticado de producción y la observación prolongada (24 h) **no** se
> declaran completados.

## 1. A3 — Valoración preliminar vs tasación oficial

|                                         |                                                                                                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PR**                                  | #144 (squash)                                                                                                                                                                   |
| **Commit en `main`**                    | `6a8c61d`                                                                                                                                                                       |
| **Migración**                           | `20260727000000_add_valuation_purpose_and_attempts` (aditiva; 2 enums, `Valuation.purpose` nullable, tabla `vehicle_valuation_attempts` + UNIQUE global; **sin DML/backfill**)  |
| **Checksum (idéntico staging = prod)**  | `95c989f25b187d9da1043f79a81e81a324d8119ef8f0aa5f7fa36b4c9093c413`                                                                                                              |
| **Staging** (`iatuhydsfwoeprpbklod`)    | migración aplicada; validación de dominio (CI PG17) + validación **UI autenticada e2e** (gates, oficial AGENTE/ADMIN, idempotencia vía Server Action, readers, `updateVehicle`) |
| **Producción** (`bbmglaatlyilxutzomxd`) | migración **aplicada** (orden BD-antes-que-cliente); cliente A3 **desplegado** (deployment `6a8c61d`, target production, READY)                                                 |

### Alcance funcional de A3

Separa **valoración preliminar** (orientativa, pre-entrada; nunca cambia estado ni escribe los
denormalizados oficiales ni habilita matching/publicación; registra **siempre** un intento con
outcome `COMPLETADA | SIN_REFERENCIA | FALLO_TECNICO`) de **tasación oficial** (gate estricto: entrada
activa + inspección de entrada COMPLETADA + estado elegible; escribe el precio oficial y es la **única**
vía de la primera transición `NUEVO → TASADO`; confianza **declarada**, fin del hardcode `ALTA`).
Cierre del **bypass hacia TASADO**: `VEHICLE_TRANSITIONS.NUEVO = []` + rechazo
`OFFICIAL_VALUATION_REQUIRED` en la edición manual genérica. **Idempotencia vinculada a la petición**:
clave `crypto.randomUUID()` + huella `request_fingerprint`; reutilizar la clave con otro
vehículo/modo/payload → `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST` (nunca resultado ajeno);
autorización (`requireAgente`) antes de resolver cualquier intento previo. `desiredPrice`, tasación
oficial y `salePrice` permanecen separados; A3 no toca `salePrice`.

## 2. Migración y postflight (producción)

- **Preflight (read-only):** A3 ausente; A1+A2 aplicadas; A3 única migración pendiente; catálogo en
  baseline A2 (tables 32, columns 462, enums 53, enum_values 288, FK 74, indexes 118,
  `tables_without_rls`=0). Conteos de negocio (baseline): vehicles 51, seller_leads 51, buyer_leads
  117, valuations 0, work_orders 4, activities 250, users 8.
- **Migración:** `prisma migrate deploy` aplicó **solo** `20260727000000` (mecanismo canónico, cliente
  A2 aún activo). Checksum registrado = local = staging.
- **Postflight (read-only):** 2 enums (`ValuationPurpose`/`ValuationOutcome`);
  `vehicle_valuation_attempts` (17 columnas, incluye `idempotency_key` + `request_fingerprint`); UNIQUE
  GLOBAL sobre `idempotency_key`; `Valuation.purpose` nullable; RLS activa en la tabla nueva. Catálogo:
  tables 33, columns 480, enum_values 293, FK 77, indexes 124, `tables_without_rls`=0. **Cero backfill,
  cero DML:** conteos de negocio **idénticos** al preflight; `Valuation.purpose IS NULL` = 0 (vacuo, 0
  valuations). Las valoraciones legacy permanecen `purpose = null` (no reclasificadas — DATA-1 diferido).

## 3. Compatibilidad del cliente A2 (old code + A3 schema)

Con el cliente A2 aún desplegado contra la BD A3, se comprobó el sitio productivo en vivo
(`campersnova.com`): rutas públicas y de catálogo (lecturas de `vehicles`) → **200, sin P2022, sin
5xx**. `A2 CLIENT TECHNICALLY COMPATIBLE`; el smoke **autenticado** read-only de producción queda
**pendiente** (no se dispuso de sesión productiva legítima reutilizable; no se crearon usuarios ni
enlaces en producción).

## 4. Validación

- **Staging (autenticada, completa):** gates oficiales (sin entrada / sin inspección), tasación oficial
  manual por **AGENTE y ADMIN** (`NUEVO → TASADO`, confianza declarada, `salePrice` intacto), **idempotencia
  vinculada a través de la Server Action real** (replay idempotente; reutilización por otro
  payload/vehículo → rechazo; TALLER no recupera resultado), readers (preliminar/oficial/Legacy), y el
  **recorrido real `updateVehicle`** (edición ordinaria persiste + preliminar ejecutada + sigue NUEVO +
  sin denormalizados oficiales + `salePrice` intacto). Datos sintéticos limpiados por IDs exactos;
  baseline restaurado; cero residuo.
- **Producción (inmediata, técnica):** migración + postflight + compatibilidad A2 técnica + deployment
  READY del commit fusionado. **Pendiente:** smoke **autenticado** read-only de producción; **observación
  24 h**.

## 5. Estado exacto por entorno

- **`main`:** `6a8c61d` (A3 fusionado por squash).
- **Producción** (`bbmglaatlyilxutzomxd`): A3 **migrado** (checksum `95c989f2…3c413`) + cliente A3
  **desplegado** (READY). Sin backfill; conteos sin cambios por la migración.
- **Staging** (`iatuhydsfwoeprpbklod`): A3 migrado + validado (dominio + UI autenticada). Sin datos
  sintéticos residuales.

## 6. Pendientes / fuera de alcance

- **Pendiente:** smoke autenticado read-only de producción; observación 24 h; revisión Sentry
  prolongada.
- **Diferido (no iniciado):** reconciliación de valoraciones legacy `purpose = null` (**DATA-1**);
  **PUB-1**; **B1A**; historial comercial de `salePrice` (se abordará en PUB-1). Sin marketplace/SaaS/
  multiempresa.
- **Acceso administrativo temporal:** las Secret keys temporales de staging (`a2_e2e_temporary`,
  `a3_e2e_temporary`, `a3_ui_final_temporary`) fueron **revocadas**; no queda acceso administrativo
  temporal a staging. `.env.staging.admin.local` vacío.
