# A3 — Valoración preliminar vs tasación oficial · Especificación

> **Estado:** decisiones materiales **resueltas** (D1–D5, §4) e **implementadas en la rama Draft**
> `feat/vehicle-valuation-purpose-a3` (PR #144, **Draft**). **NO fusionado, NO migrado en ningún
> entorno remoto, NO desplegado.** La migración `20260727000000_add_valuation_purpose_and_attempts`
> es **aditiva y sin DML/backfill**. Runbook de rollout: `docs/runbooks/a3-valuation-rollout.md`.
> Reconciliación de valoraciones legacy: **DATA-1** (diferido; requiere autorización de datos).

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

## 3. Diseño (implementado en el Draft)

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

## 4. Decisiones materiales (resueltas e implementadas)

- **D1 · Forma del registro de intentos → APLICADA (opción a).** Nuevo modelo **append-only**
  `VehicleValuationAttempt` (`purpose`, `outcome`, `method`, `confidence?`, `min/recommended/max`
  nullable, `referenceUsed`, `reason`, `errorCode`, `createdById`, `valuationId?`, `createdAt`).
  `Valuation` se conserva para el historial con cifras; gana `purpose` nullable. Activity NO es la
  fuente de verdad de la trazabilidad de valoración.
- **D2 · Señal de «inspección completada» → APLICADA.** WorkOrder `kind = INSPECCION_ENTRADA` con
  `status = COMPLETADA` (señal estructurada ya modelada; sin booleano paralelo ni parseo de Activity).
- **D3 · Reconciliación con la auto-valoración/transición → APLICADA.** Los 5 puntos de
  auto-valoración (`createSellerLead`, `submitPublicLead`, `updateVehicle`, captación→conversión,
  parte de pago) pasan a **PRELIMINAR**: no transicionan `NUEVO → TASADO` ni escriben los
  denormalizados oficiales. La transición ocurre **solo** vía tasación oficial (gated).
  - **Límite de alcance (residual documentado):** la transición manual genérica de estado del
    vehículo (`updateVehicle` → `VEHICLE_TRANSITIONS.NUEVO = ['TASADO']`, con su guard legal, dominio
    I3B) **no** es una tasación y queda **fuera de A3**. Reconciliar ese camino con el gate
    entrada+inspección es trabajo futuro (riesgo en §6). A3 solo garantiza que **ninguna valoración**
    (auto o manual) transiciona sin el gate.
- **D4 · `purpose` de las `Valuation` existentes → APLICADA.** Columna **nullable**, **sin backfill**.
  `purpose = null` = **LEGACY/UNKNOWN**: nunca es oficial por sí sola, nunca habilita
  publicación/matching, y los lectores la etiquetan «Legacy». Reconciliación futura = **DATA-1**.
- **D5 · Gate estricto → APLICADO.** La tasación oficial exige inspección `COMPLETADA` de forma
  **dura**: sin ella no hay tasación oficial y no hay `NUEVO → TASADO`. **Sin bypass manual en v1, ni
  ADMIN.** AGENTE/ADMIN pueden crear tasación manual, pero deben cumplir entrada activa + inspección
  completada + estado elegible. La preliminar no requiere inspección.
- **Tasación manual (fin del hardcode) → APLICADA.** `overrideValuation` (hardcodeaba `ALTA`, sin
  gate) se retira. `officialManualValuation` exige purpose OFICIAL, motivo estructurado, `method`,
  **confianza seleccionada explícitamente**, rango válido (`min ≤ recomendado ≤ máximo`, dinero no
  negativo), actor y fecha; escribe Attempt + Valuation + Activity bajo lock + CAS.

## 5. Matriz de comportamiento (implementada)

| Escenario                                   | Estado  | Denormalizado oficial | Attempt                   | Valuation              |
| ------------------------------------------- | ------- | --------------------- | ------------------------- | ---------------------- |
| Preliminar COMPLETADA (pre-entrada)         | intacto | no                    | PRELIMINAR/COMPLETADA     | PRELIMINAR (historial) |
| Preliminar SIN_REFERENCIA                   | intacto | no                    | PRELIMINAR/SIN_REFERENCIA | —                      |
| Preliminar FALLO_TECNICO                    | intacto | no                    | PRELIMINAR/FALLO_TECNICO  | —                      |
| Oficial sin entrada/inspección/archivado    | intacto | no                    | — (rechazo)               | —                      |
| Oficial COMPLETADA (NUEVO)                  | →TASADO | sí (CAS)              | OFICIAL/COMPLETADA        | OFICIAL                |
| Oficial COMPLETADA (ya TASADO, re-tasación) | intacto | sí                    | OFICIAL/COMPLETADA        | OFICIAL                |
| Oficial AUTO sin datos                      | intacto | no                    | OFICIAL/SIN_REFERENCIA    | —                      |

## 6. Invariante de fuente única de `TASADO` + auditoría de escritores

La corrección final de A3 cierra dos garantías que el bloque debía introducir:

**(§3) `TASADO` tiene una sola fuente.** `VEHICLE_TRANSITIONS.NUEVO` es `[]` (sin salidas manuales) y
`updateVehicleTx` (`lib/vehicle-status.ts`) rechaza cualquier intento genérico de alcanzar `TASADO`
por edición manual con el error de dominio `OFFICIAL_VALUATION_REQUIRED` **antes** que el genérico de
transición inválida. La **única** vía que produce la primera transición `NUEVO → TASADO` es
`officialValuationTx` (CAS `where status = NUEVO`), gated por entrada activa + inspección de entrada
COMPLETADA.

Auditoría de escritores de `status = 'TASADO'` y de los campos oficiales
(`valuationMin/Recommended/Max`, `Valuation.purpose = OFICIAL`):

| Escritor                                            | ¿Escribe `TASADO`?                             | ¿Escribe precio oficial?                               | Control                                             |
| --------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| `officialValuationTx` (`lib/valuation/official.ts`) | **Sí** (CAS único)                             | Sí                                                     | Gate + lock + CAS + idempotencia. **Fuente única.** |
| `updateVehicleTx` (`lib/vehicle-status.ts`)         | No — rechaza con `OFFICIAL_VALUATION_REQUIRED` | No                                                     | `VEHICLE_TRANSITIONS.NUEVO=[]` + guardia explícita  |
| `overrideValuation` (preliminar)                    | No                                             | No (denormalizados preliminares, `purpose` no OFICIAL) | No toca estado                                      |
| `runAndSaveAutoValuation` (preliminar)              | No                                             | No                                                     | No toca estado                                      |
| Ofertas/entregas                                    | `RESERVADO/VENDIDO`, nunca `TASADO`            | No                                                     | Sus propias máquinas de estado                      |

**(§4) Idempotencia de la tasación oficial.** Clave explícita generada por el cliente
(`crypto.randomUUID()`), una por intención de tasar, que viaja **UI → server action → dominio**:

- **Persistencia:** `VehicleValuationAttempt.idempotencyKey` (nullable) con **UNIQUE index**. Nullable
  ⇒ Postgres admite múltiples `NULL` → los intentos **preliminares** (sin clave) no colisionan; solo
  se deduplican los **oficiales**.
- **Tres barreras:** (1) pre-chequeo en el server action (`priorOfficialResult`) antes de abrir la tx;
  (2) **paso 0 dentro de la tx**, bajo el lock del vehículo, que si encuentra un intento con esa clave
  lo devuelve sin re-ejecutar (ni 2.ª Valuation, ni denormalizado, ni CAS, ni Activity, ni 2.º
  Attempt); (3) el **UNIQUE index** como barrera final — un P2002 sobre `idempotency_key` se traduce a
  idempotencia (re-lectura + devolver el existente), no a 500.
- **Semántica:** misma clave → mismo resultado (`transitioned:false` en el reintento). Nueva tasación
  intencionada → clave nueva → intento nuevo. Un **rechazo de gate no consume la clave** (no se
  escribe intento). Un **`FALLO_TECNICO` sí consume la clave**: se registra fuera de la tx con la clave
  y un reintento con la misma clave devuelve `VALUATION_ATTEMPT_FAILED` (hay que usar una clave nueva).

**Grafo de llamada transaccional (efectos externos SIEMPRE fuera de la tx):**

```
officialManual/AutoValuation (server action)
  ├─ requireAgente()                         (fuera de tx)
  ├─ priorOfficialResult(key)                (fuera de tx — barrera 1)
  ├─ withLockedRoots(Vehicle→SellerLead)
  │    └─ officialValuationTx(tx, {…, idempotencyKey})
  │         (0) findUnique(idempotencyKey)   (barrera 2, bajo lock)
  │         (1–5) relectura + GATE estricto  (sin I/O externo)
  │         (6) calculateValuation(deps=tx)  (solo lecturas locales/BD — sin fetch/HTTP/IA)
  │         (7/8–12) Attempt (+Valuation +denorm +CAS +Activity)  (unique = barrera 3)
  ├─ (AUTO/catch) registrar FALLO_TECNICO    (fuera de tx, con la clave)
  ├─ recalculateMatchesForVehicle(...)       (fuera de tx)
  └─ revalidatePath(...)                      (fuera de tx)
```

**(§5) Alcance transaccional:** el cálculo AUTO corre bajo el lock, pero `calculateValuation` +
`prismaValuationDeps` sólo hacen **lecturas locales/de BD** (comparables + `reference_prices`); **no
hay `fetch`/HTTP/IA** en `lib/valuation` → no se mantiene una llamada de red abierta bajo el lock.

## 7. Fuera de alcance / riesgos

- **Fuera de alcance:** publicación (PUB-1), señales económicas (B1A), limpieza/reconciliación de
  datos (DATA-1). A3 **no** cambia la elegibilidad de matching/publicación (M1/A2): solo la tasación
  oficial alcanza `TASADO`.
- **Riesgos abiertos:** la reclasificación de valoraciones legacy (`Valuation.purpose = null`) y de
  matches históricos inelegibles queda pendiente (DATA-1, requiere autorización de datos).
