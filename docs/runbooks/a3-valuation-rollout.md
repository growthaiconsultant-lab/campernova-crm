# Runbook — Rollout de A3 (valoración preliminar vs tasación oficial)

> **Estado:** paquete preparado en la rama Draft `feat/vehicle-valuation-purpose-a3` (PR #144,
> **Draft**). La migración **no** está aplicada en ningún entorno remoto y el PR **no** está fusionado
> ni desplegado. Este runbook describe el procedimiento y la evidencia. **No ejecutar** ningún paso
> remoto sin autorización explícita por paso.

## 1. Qué se despliega

- **Migración** `20260727000000_add_valuation_purpose_and_attempts` — **aditiva, sin DML/backfill**:
  - `CREATE TYPE "ValuationPurpose"` (PRELIMINAR, OFICIAL);
  - `CREATE TYPE "ValuationOutcome"` (COMPLETADA, SIN_REFERENCIA, FALLO_TECNICO);
  - `ALTER TABLE "valuations" ADD COLUMN "purpose"` (nullable);
  - `CREATE TABLE "vehicle_valuation_attempts"` (17 columnas —incluye `idempotency_key` y
    `request_fingerprint`—, PK + 4 índices + 1 **UNIQUE GLOBAL** en `idempotency_key`, 3 FK) +
    `ENABLE ROW LEVEL SECURITY`.
- **Deltas de catálogo (validados por migration-replay):** tables +1 (33), columns +18 (480),
  enums +2 (55), enum_values +5 (293), foreign_keys +3 (77), indexes +6 (124), `tables_without_rls`
  = 0. Migraciones aplicadas: 8 → 9.

## 2. Conceptos

- **Valoración preliminar** (`runAndSavePreliminaryValuation`): orientativa, **antes** de la entrada
  oficial. NUNCA cambia `Vehicle.status`, NUNCA escribe los denormalizados oficiales
  (`Vehicle.valuation*`), NUNCA habilita matching/publicación. Registra **siempre** un
  `VehicleValuationAttempt` (purpose PRELIMINAR), incluidos SIN_REFERENCIA y FALLO_TECNICO. Si el
  intento es COMPLETADA, crea además una `Valuation` PRELIMINAR (historial). La invocan los 5 puntos
  de auto-valoración (createSellerLead, submitPublicLead, updateVehicle, captación, parte de pago).
- **Tasación oficial** (`officialValuationTx` bajo `withLockedRoots`): **gate estricto** — entrada
  oficial activa (`entryValidatedAt != null AND entryAnnulledAt == null`) + WorkOrder
  `INSPECCION_ENTRADA` en `COMPLETADA` + estado elegible (no VENDIDO/DESCARTADO). Es la **única** vía
  que escribe los denormalizados oficiales y transiciona `NUEVO → TASADO` (CAS); la edición manual de
  estado se rechaza con `OFFICIAL_VALUATION_REQUIRED`. Auto o manual. Manual exige confianza declarada
  - motivo (fin del hardcode `ALTA`). Un intento AUTO sin datos → `SIN_REFERENCIA` sin tocar el
    vehículo. Un fallo técnico aborta la transacción (vehículo intacto) y se registra como
    `FALLO_TECNICO`.
- **Idempotencia VINCULADA a la petición** (clave `crypto.randomUUID()` por intento + huella
  `request_fingerprint`, UI → action → dominio): un intento con la clave solo se reutiliza si pertenece
  a la MISMA petición (mismo `vehicleId` + misma huella del payload normalizado); si la clave coincide
  pero la petición difiere (otro vehículo, otro modo AUTO/MANUAL, otro rango/confianza/motivo) →
  `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST` (nunca devuelve un resultado ajeno). Autorización
  (`requireAgente`) ANTES de resolver cualquier intento previo. Barreras: pre-chequeo con binding en el
  action + paso 0 con binding bajo el lock + UNIQUE GLOBAL (P2002 re-resuelto con binding, no 500).
  `NULL` múltiple ⇒ los preliminares no colisionan. Ver spec §6.
- **Precio oficial = denormalizados `Vehicle.valuation*`.** La UI etiqueta la preliminar como
  «orientativa» y NUNCA la muestra como precio oficial.

## 3. Política de legacy (D4, sin backfill)

`Valuation.purpose = null` = **LEGACY/UNKNOWN** (filas anteriores a A3). No se hace backfill. Una
valoración legacy **nunca** se considera oficial por sí sola ni habilita publicación/matching; los
lectores la etiquetan «Legacy». La reconciliación (asignar purpose a filas históricas) es **DATA-1**,
diferida y sujeta a autorización de datos.

## 4. Regla de orden (VINCULANTE): BD nueva ANTES que cliente nuevo

- `old code + new schema`: **compatible** (columna nullable; la tabla nueva no la lee el código
  viejo).
- `new code + old schema`: **incompatible** — el código A3 lee `Valuation.purpose` y escribe
  `vehicle_valuation_attempts`. Desplegar el cliente nuevo contra una BD sin la migración rompería
  esas operaciones.

Por tanto: **aplicar la migración (staging → prod) ANTES de fusionar/desplegar el código A3.** Nunca
`merge → deploy → migrar`.

## 5. Validación post-despliegue (read-only)

- `vehicle_valuation_attempts` existe con RLS activada; `tables_without_rls = 0`.
- Postflight: ninguna `Valuation` nueva con `purpose IS NULL` (las nuevas siempre escriben purpose);
  los denormalizados `Vehicle.valuation*` solo cambian tras una tasación **oficial**.
- Un vehículo `NUEVO` recién creado ya **no** salta a `TASADO` por la auto-valoración.

## 5b. Estado en STAGING (aplicado — 2026-07-28)

- **Migración aplicada:** `20260727000000_add_valuation_purpose_and_attempts` en
  `campersnova-crm-staging` (`iatuhydsfwoeprpbklod`) vía `prisma migrate deploy` (mecanismo canónico;
  única migración pendiente antes; A1/A2 ya aplicadas). **Sin DML ni backfill.**
- **Preflight (read-only):** A3 ausente; catálogo en baseline A2 (tables 32, columns 462, enums 53,
  enum_values 288, FK 74, indexes 118, `tables_without_rls`=0). Negocio: vehicles 3, seller_leads 3,
  buyer_leads 3, valuations 0, work_orders 3, activities 5.
- **Postflight (read-only):** enums A3 = 2; `vehicle_valuation_attempts` con 17 columnas (incluye
  `idempotency_key` + `request_fingerprint`); `valuations.purpose` presente; UNIQUE GLOBAL en
  `idempotency_key`; RLS activa en la tabla nueva. Catálogo: tables 33, columns 480, enum_values 293,
  FK 77, indexes 124, `tables_without_rls`=0. **Zero backfill:** vehicles 3, valuations 0
  (`purpose IS NULL` = 0, vacío), attempts 0 — conteos sin cambios.
- **Compatibilidad cliente A2 (old code + A3 schema): VERIFICADA empíricamente.** Se levantó el código
  de `main` (A2, sin A3) contra la BD A3 de staging y, autenticado como AGENTE, se navegaron
  `/dashboard`, `/vendedores`, ficha de vendedor con valoración **OFICIAL**, ficha con valoración
  **legacy** (`purpose = null`), `/vehiculos` (lee `salePrice`/valoración) y `/compradores`: **todo 200,
  sin redirección a /login, sin 5xx, sin P2022** en el log del servidor. Confirma la compatibilidad
  aditiva (Prisma A2 selecciona columnas explícitas; no lee la tabla nueva).

- **Validación autenticada A3 (2026-07-28): COMPLETADA en staging** con navegador real (Playwright) y
  sesiones sintéticas (GoTrue admin + filas `users` sintéticas; sin PII, sin emails, sin producción):
  - **Gate oficial (UI):** vehículo sin entrada activa y vehículo con entrada pero sin inspección
    COMPLETADA → el panel muestra «Tasación oficial no disponible» con el motivo correcto.
  - **Tasación oficial manual (UI + action + BD):** expediente válido (entrada activa +
    `INSPECCION_ENTRADA` COMPLETADA) → `NUEVO → TASADO`; Attempt `OFICIAL/COMPLETADA/MANUAL`, Valuation
    `OFICIAL`, denormalizados oficiales escritos, **confianza declarada MEDIA (no ALTA)**, Activity con
    actor AGENTE; **`salePrice` intacto (40000)**.
  - **Idempotencia vinculada, a través de la ACTION real:** replay idéntico (misma clave+payload) →
    idempotente (sin 2.º Attempt/Valuation/Activity/transición); misma clave con **otro payload** y con
    **otro vehículo** → `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST` (nunca resultado ajeno, cero
    escritura en el 2.º vehículo); usuario **TALLER** reutilizando la clave → 303 (forbidden), **no
    recupera** el resultado previo (autorización antes que idempotencia). Resultado en BD: **exactamente
    1 Attempt / 1 Valuation / 1 transición** pese a los 4 POST adicionales.
  - **Readers (UI):** el precio **oficial** se muestra como tal; la valoración **legacy** (`purpose
null`) se etiqueta «Legacy» y **no** como precio oficial («Sin tasación oficial todavía»);
    `salePrice` no se presenta como tasación oficial.
  - **§6.1 preliminar / §6.2 formulario genérico:** cubiertos en la ronda UI-final (ver §5c).
  - **Limpieza:** todos los datos sintéticos eliminados por IDs exactos; conteos de vuelta al baseline
    (vehicles 3, seller_leads 3, buyer_leads 3, valuations 0, attempts 0, work_orders 3, users 7); cero
    residuo; **cero afectación a datos preexistentes**. Acceso temporal cerrado
    (`.env.staging.admin.local` a 0 bytes). **Pendiente manual del dueño:** revocar la Secret key de
    staging `a3_e2e_temporary` (el MCP no gestiona API keys).

## 5c. Validación UI final del recorrido `updateVehicle` (2026-07-28)

Ronda dirigida a cerrar el hueco de que A3 conectó la valoración **preliminar** dentro de
`updateVehicle`: se validó el recorrido operativo real `formulario → Server Action → dominio → BD →
reader tras recarga`, sin cambios de código (HEAD `6c2c8c5`, CI 4/4). Migración A3 congelada
(checksum `95c989f2…3c413`, sin tocar). Sesiones sintéticas (GoTrue admin + `users`), sin PII/emails/prod.

- **`updateVehicle` real (AGENTE):** en la ficha, se editaron campos ordinarios (km 1000→1234,
  ubicación Barcelona→«Girona A3UI») y se **guardó por la UI**; tras **recargar**, los cambios
  **persisten**. Efecto lateral esperado: la **valoración preliminar se ejecutó** por la vía prevista →
  Attempt **`PRELIMINAR/SIN_REFERENCIA`** (outcome correcto: sin `ReferencePrice` para ese modelo; sin
  `Valuation` con cifras, coherente). Invariantes: **Vehicle sigue NUEVO**, **sin denormalizados
  oficiales**, **`salePrice` intacto**, **sin Activity de transición a TASADO**. Sin 5xx ni errores
  materiales de consola/servidor.
- **Selector genérico de estado (UI):** en un Vehicle NUEVO el desplegable «Estado vehículo» ofrece
  **solo «Nuevo»** (no TASADO).
- **Rechazo en servidor (garantía de seguridad):** replay de la Server Action `updateVehicle`
  manipulada con `status=TASADO` → **`OFFICIAL_VALUATION_REQUIRED`**, **cero escritura** (Vehicle sigue
  NUEVO, sin denormalizados oficiales, sin Attempt extra, sin Activity de transición).
- **Tasación oficial por ADMIN (UI):** expediente válido (entrada activa + `INSPECCION_ENTRADA`
  COMPLETADA) → ADMIN ve la acción y completa una tasación manual con **confianza declarada BAJA (no
  ALTA)** y motivo → `NUEVO → TASADO`; Attempt `OFICIAL/COMPLETADA/MANUAL`, Valuation `OFICIAL`, Activity
  con **actor ADMIN**; **`salePrice` intacto (35000)**.
- **Limpieza:** datos sintéticos eliminados por IDs exactos; baseline restaurado (3/3/3/0/0/3/7); cero
  residuo; cero afectación a datos preexistentes. Acceso temporal cerrado (`.env.staging.admin.local`
  a 0 bytes). **Pendiente manual del dueño:** revocar la Secret key `a3_ui_final_temporary` (el MCP no
  gestiona API keys).

## 6. Riesgos y deuda

- **Cerrado (§3):** la edición manual genérica ya **no** puede alcanzar `TASADO`
  (`VEHICLE_TRANSITIONS.NUEVO = []` + rechazo `OFFICIAL_VALUATION_REQUIRED`). `TASADO` tiene fuente
  única: la tasación oficial.
- **Cerrado (§4):** la tasación oficial es **idempotente** (clave explícita + UNIQUE index + paso 0
  bajo lock). Un reintento con la misma clave ya no duplica el historial.
- **Pendiente (DATA-1, autorización de datos):** reconciliación de `Valuation.purpose = null` (legacy)
  y limpieza de matches históricos inelegibles.
- **Producción: pendiente de autorización.** Con la migración A3 verificada en staging, la compatibilidad
  A2 confirmada y la validación autenticada A3 completada, el siguiente gate es el rollout productivo
  (orden BD-antes-que-cliente) — **no autorizado todavía**. Observación de 24 h: pendiente tras el
  despliegue productivo.
