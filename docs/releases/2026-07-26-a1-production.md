# Release/handoff — A1 en producción + precisión de validación (2026-07-26, ciclo 2)

> Registra **exactamente** lo migrado, fusionado, desplegado y validado, y corrige el grado de
> validación declarado para HARD-1/PERM-1/M1. No exagera el nivel de validación.

## 1. A1 — Fundamentos de entrada oficial: MIGRADO + FUSIONADO + DESPLEGADO

|                                         |                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------ |
| **PR**                                  | #133 (squash)                                                                              |
| **Commit en `main`**                    | `7871fb0`                                                                                  |
| **Migración**                           | `20260726000000_add_vehicle_entry_foundations` (aditiva, sin DML/backfill)                 |
| **Staging** (`iatuhydsfwoeprpbklod`)    | aplicada; base_tables 31→32; RLS preservada; counts sin cambios; cliente nuevo sin `P2022` |
| **Producción** (`bbmglaatlyilxutzomxd`) | **aplicada** (orden BD-antes-que-cliente); deployment del cliente nuevo READY              |

### Evidencia de producción

- **Preflight**: A1 única migración pendiente; A1 ausente; `base_tables=31`; `tables_without_rls=0`;
  conteos **vehicles=47, seller_leads=47, buyer_leads=113**.
- **Migración**: aplicada **solo** A1 con el cliente antiguo activo. Cliente antiguo siguió sirviendo
  (200/307, 0 runtime errors) → tolera columnas nullable nuevas.
- **Postflight**: A1 `done`; **11 columnas**; enums `EntryAnnulmentReason` + `DocumentRequirementDisposition`;
  tabla `vehicle_document_requirement_dispositions` + índice único + **2 FKs** + **RLS true**;
  `tables_without_rls=0`; **base_tables=32**; conteos **sin cambios (47/47/113)** → **cero backfill**.
- **Merge + deploy**: `main`=`7871fb0`; deployment de Production READY del commit exacto.
- **Smoke**: rutas públicas 200, privadas 307, **0 runtime errors**. `/comprar/vehiculos` renderiza
  contenido de vehículos → el **cliente nuevo lee `Vehicle` (con columnas A1) sin `P2022`** (prueba
  definitiva de compatibilidad).
- **Validación autenticada del backoffice**: **NO ejercitada** (sin sesión headless) → **pendiente**.
  Riesgo residual bajo: el catálogo público ya demuestra la compatibilidad de lectura de `Vehicle`.

**Ningún comportamiento de entrada oficial procede de A1**: es esquema puro. La entrada oficial
funcional es **A2** (PR #140, Draft, no desplegado).

## 2. Conteos canónicos (tras A1)

- **Migraciones en `main`**: **7** (las 6 previas + `20260726000000_add_vehicle_entry_foundations`).
- **Catálogo de producción/staging tras A1**: tables **32** · `tables_without_rls` **0** ·
  `deliveries.offer_id` NOT NULL. (Los conteos completos de la aserción `migration-replay` viven en
  `.github/workflows/ci.yml`.)

## 3. Precisión de validación — HARD-1 / PERM-1 / M1 (corrección documental)

Estos tres bloques están **fusionados y desplegados en producción con CI verde y smoke técnico
inmediato**, pero su **validación funcional autenticada y la observación posterior siguen PENDIENTES**.
No deben describirse como "completamente validados".

| Bloque            | Estado real                                                                                                                                                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **HARD-1** (#137) | Fusionado + desplegado + CI verde + smoke técnico. **NO** comprobada en vivo, autenticada, la pestaña `?tab=compradores` donde ocurría la hidratación. Observación de Sentry `CAMPERNOVA-CRM-G` pendiente.                                    |
| **PERM-1** (#136) | Fusionado + desplegado + CI verde + smoke técnico (rutas 307 sin sesión). **NO** probadas sesiones reales por rol (ADMIN/AGENTE/TALLER/ENTREGAS/MARKETING). Cubierto por 30 tests de auth, no por sesiones en vivo.                           |
| **M1** (#139)     | Fusionado + desplegado + CI verde + smoke técnico. **NO** comprobado autenticadamente que un vehículo `NUEVO` deje de mostrar "compradores esperando" ni el cambio de KPIs. Los ~331 matches históricos permanecen (solo ocultos en lectura). |

No se reabren los PR; la precisión queda registrada aquí.

## 4. Estado tras este release

- **`main`** = `7871fb0` (HARD-1 + PERM-1 + M1 + docs + **A1**). 7 migraciones.
- **Staging** y **Producción**: A1 aplicado; A2 **no**.
- **A2** (PR #140): Draft; en corrección tras auditoría dirigida (presencia física persistida, UI
  operable, cierre de orden en anulación) y rebase sobre `main`; **no** migrado/desplegado.
- **Observación pendiente**: 24 h de Sentry/Vercel para HARD-1/PERM-1/M1/A1; validación autenticada de
  A1 y de los tres bloques por el dueño.

## 5. Project Brief

`CLAUDE.md` y el **Project Brief de Campers Nova** (documento de negocio, ~15 jul) son **distintos** y
ambos están desactualizados como fotografía técnica. Se consolidarán **tras A2**; no deben seguir
usándose como estado técnico actual.
