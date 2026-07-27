# A3 — Valoración preliminar vs tasación oficial · Especificación congelada

> **Estado:** especificación de dominio **congelada** para revisión. **No implementado.** Requiere
> decisiones materiales del dueño (ver §4) antes de escribir schema/migración/código.
> Veredicto: `A3 REQUIRES TARGETED DOMAIN DECISION`.

## 1. Modelo actual (as-is)

- `model Valuation` (append-only): `min`/`recommended`/`max` **Decimal NOT NULL**, `method`
  (`ValuationMethod` AUTO/MANUAL), `confidence` (`ValuationConfidence` ALTA/MEDIA/BAJA), `parameters`
  Json, `createdById`, `createdAt`. Nunca se actualiza (historial por inserción).
- `Vehicle.valuationMin/valuationRecommended/valuationMax` (denormalizados, para mostrar/ordenar).
- `runAndSaveAutoValuation` (`lib/valuation/save.ts`): tasa al crear/actualizar vehículo; si el método
  es `NONE` (sin datos) **NO persiste nada** (los intentos «sin referencia»/«fallo» se **pierden**);
  si hay resultado y el vehículo está en `NUEVO`, lo **transiciona a `TASADO`** — hoy para **cualquier**
  vehículo, sin exigir entrada oficial ni inspección.
- `overrideValuation` (`vendedores/[id]/actions.ts:414`): tasación MANUAL que **hardcodea
  `confidence: 'ALTA'`** (bug que A3 corrige).

## 2. Objetivo A3

Separar dos finalidades con un solo motor:

- **Valoración preliminar** (antes de la entrada oficial): orientativa; **no** cambia estado; **no**
  escribe campos oficiales denormalizados; **no** habilita matching ni publicación; **persiste el
  resultado del intento** con outcome `COMPLETADA | SIN_REFERENCIA | FALLO_TECNICO`.
- **Tasación oficial** (entrada oficial activa + inspección completada): automática o manual; historial;
  escribe campos oficiales; habilita `NUEVO → TASADO`; actor/fecha/Activity; lock + CAS; respeta
  archivado; no ejecutable en `VENDIDO`/`DESCARTADO`.
- **Manual** (AGENTE + ADMIN): motivo, método, **confianza declarada** (no hardcodear `ALTA`), rango
  válido, referencia usada cuando exista, observaciones, actor, fecha, historial, Activity, lock, CAS.

## 3. Diseño propuesto (sujeto a §4)

- Nuevo enum `ValuationPurpose` (`PRELIMINAR` | `OFICIAL`).
- Nuevo enum `ValuationOutcome` (`COMPLETADA` | `SIN_REFERENCIA` | `FALLO_TECNICO`).
- Registro **append-only de intentos** que admite intentos sin cifras (outcome ≠ COMPLETADA).
- Gating de la tasación **OFICIAL**: entrada activa (`entryValidatedAt != null AND entryAnnulledAt ==
null`) + inspección de entrada **completada** (WorkOrder `INSPECCION_ENTRADA` en estado terminal
  `COMPLETADA`).
- La valoración **preliminar** sustituye a la auto-valoración-al-crear actual en su rol orientativo:
  **no** transiciona `NUEVO → TASADO` (ese salto pasa a ser consecuencia de la tasación **oficial**).
- `overrideValuation` toma la confianza del input (fin del hardcode `ALTA`).
- Todo bajo `withLockedRoots` (Vehicle→SellerLead) + CAS, como el resto de A2.

## 4. Decisiones materiales pendientes (no derivables — requieren al dueño)

- **D1 · Forma del registro de intentos.** `Valuation.min/recommended/max` son **NOT NULL**; un intento
  `SIN_REFERENCIA`/`FALLO_TECNICO` no tiene cifras. Opciones:
  (a) **Nuevo modelo `VehicleValuationAttempt`** (append-only: purpose, outcome, method, confidence?,
  min/max nullable, referenceUsed, reason, actor, fecha) y mantener `Valuation` para resultados
  oficiales; (b) hacer **nullable** `Valuation.min/recommended/max` + añadir `purpose`/`outcome` (afecta
  al modelo existente y a sus lectores). **Recomendación:** (a) — aísla el cambio y no toca el
  historial oficial existente.
- **D2 · Señal de «inspección completada».** ¿Es WorkOrder `INSPECCION_ENTRADA` en `COMPLETADA`, o un
  criterio de checklist (todos los ítems OK)? **Recomendación:** estado `COMPLETADA` de la orden (simple,
  ya modelado).
- **D3 · Reconciliación con la auto-valoración/transición actual.** Hoy `runAndSaveAutoValuation`
  transiciona **cualquier** vehículo `NUEVO → TASADO`. A3 lo convierte en **preliminar** (sin
  transición) y mueve el salto a la tasación **oficial** (gated por entrada+inspección). Esto **cambia
  el comportamiento en vivo** de `createSellerLead`, `submitPublicLead`, `updateVehicle`, captación y
  parte-de-pago. ¿Se aplica el nuevo gating a **todos** los vehículos desde ya (los 50 candidatos
  actuales `NUEVO` dejan de auto-tasar-y-transicionar)? **Decisión de negocio.**
- **D4 · `purpose` de las `Valuation` existentes.** Si `purpose` fuera obligatorio, las filas actuales
  necesitan valor. Opciones: columna **nullable**; o default; o backfill (requiere autorización de
  datos). **Recomendación:** nullable (sin backfill), tratando `null` como legacy.
- **D5 · ¿La tasación oficial exige inspección COMPLETADA de forma dura, o solo advierte?** Si es dura,
  un vehículo sin inspección terminada **no** puede pasar a `TASADO` — cambia el flujo operativo actual.

## 5. Fuera de alcance de A3

Publicación (PUB-1), señales económicas (B1A), limpieza de datos (DATA-1). No hardcodear confianza
`ALTA`. Sin migración/merge remotos hasta resolver §4.
