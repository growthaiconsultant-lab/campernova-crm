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

## 6. Riesgos y deuda

- **Cerrado (§3):** la edición manual genérica ya **no** puede alcanzar `TASADO`
  (`VEHICLE_TRANSITIONS.NUEVO = []` + rechazo `OFFICIAL_VALUATION_REQUIRED`). `TASADO` tiene fuente
  única: la tasación oficial.
- **Cerrado (§4):** la tasación oficial es **idempotente** (clave explícita + UNIQUE index + paso 0
  bajo lock). Un reintento con la misma clave ya no duplica el historial.
- **Pendiente (DATA-1, autorización de datos):** reconciliación de `Valuation.purpose = null` (legacy)
  y limpieza de matches históricos inelegibles.
- Validación autenticada end-to-end de la UI: la hace el dueño (auth-gated, no verificable headless).
