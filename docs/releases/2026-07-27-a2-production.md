# Release/handoff — A2 (entrada oficial) en producción (2026-07-27)

> Registra **exactamente** lo migrado, fusionado, desplegado y validado. No exagera el grado de
> validación. La observación prolongada (24 h) **no** se declara completada.

## 1. A2 — Entrada oficial del vehículo + endurecimiento del matching

|                                         |                                                                                                                                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PR**                                  | #140 (squash)                                                                                                                                                                                                       |
| **Commit en `main`**                    | `2f33e58`                                                                                                                                                                                                           |
| **Migración**                           | `20260726120000_add_official_entry_activity_and_inspection_index` (aditiva; 6 `ActivityType`, 2 columnas `physical_arrival_*` + FK, índice único parcial `work_orders_active_inspection_key`; **sin DML/backfill**) |
| **Staging** (`iatuhydsfwoeprpbklod`)    | migración aplicada; validación de dominio (CI PG17) + validación **UI autenticada e2e** (ver §2)                                                                                                                    |
| **Producción** (`bbmglaatlyilxutzomxd`) | migración **aplicada** (orden BD-antes-que-cliente); cliente A2 **desplegado** (deployment `success`)                                                                                                               |

### Alcance funcional de A2

Entrada oficial del vehículo: **llegada física persistida** (`physicalArrivalAt`/`ById`) como hito
previo; **validación de entrada** (parking + custodia de llaves) bajo `withLockedRoots` + CAS →
crea **exactamente una** orden `INSPECCION_ENTRADA` visible en Taller (índice único parcial como 2.ª
barrera); **anulación** por Dirección (terminal, cierra la orden activa → `RECHAZADA`); **checklist
documental** clasificado (contrato de gestión exige documento vigente real, no disposición);
**expediente mínimo de entrada propio** (`isReadyForOfficialEntry` = **matrícula O VIN**; NO exige
`desiredPrice`, fotos, tasación, publicación ni entrega — corrección respecto a reutilizar TASADO);
**matching** extendido a «entrada activa» (`entryValidatedAt != null AND entryAnnulledAt == null`);
fix de escalada de privilegios en `createWorkOrder` (`requireCanEditTaller`).

## 2. Validación

### Redacción exacta del alcance validado

**A2 panel and official-entry workflow authenticated end-to-end validation complete; pre-existing
document upload and bulk checklist prerequisites were prepared through controlled staging setup.**

- **Dominio (CI, PostgreSQL 17):** flujo completo — llegada gatea validación, persistencia, una orden,
  idempotencia, rollback, concurrencia, anulación-cierra-orden, VIN-solo, sin-precio/sin-fotos.
- **UI autenticada e2e (staging, navegador real, sesiones por rol):** panel de entrada; la llegada
  gatea la validación; registrar llegada persiste (actor/fecha tras recarga); control de disposición
  operable por UI; **validar** → **una** orden `INSPECCION_ENTRADA` + enlace a Taller + sin
  re-validación (idempotente en UI); **TALLER** no accede a la ficha (no valida/anula) pero ve la
  orden; **ADMIN** anula (terminal) → orden activa cerrada (0 activas) → matching inelegible.
- **Prerrequisitos preparados como datos controlados** (no invalida A2): el documento
  `CONTRATO_GESTION` y la clasificación en bloque de 6 categorías se sembraron; la **subida de
  documentos pertenece al sistema documental preexistente** (no al panel de A2), se verificó que el
  contrato vigente real es **obligatorio**, y el control de disposición se comprobó por UI. **No** se
  revalidó integralmente todo el sistema documental.
- **Producción:** deployment `success` del commit exacto; smoke — públicas 200, privadas 307,
  `/comprar/vehiculos` renderiza (cliente A2 lee `Vehicle` con columnas nuevas **sin `P2022`**); **0**
  issues de error nuevas en Sentry en la hora posterior.
- **Pendiente:** **smoke autenticado read-only en producción** (no ejercitado; sin sesión headless
  segura) y **observación de 24 h** (Sentry/Vercel).

## 3. Evidencia de rollout (producción)

- **Preflight:** A2 única migración pendiente; objetos A2 ausentes; `base_tables=32`;
  `tables_without_rls=0`; **checksum idéntico al de staging** (`0a6bd109…`). Conteos base de este
  rollout: **vehicles=50, seller_leads=50, buyer_leads=115** (crecidos desde 47/47/113 por uso normal
  de producción; no por esta operación).
- **Migración:** aplicada **solo** A2 con el cliente A1 activo (que siguió sirviendo 200/307).
- **Postflight:** A2 `done`; **2 columnas** `physical_arrival_*` + **FK**; **6** `ActivityType`;
  **índice parcial** presente; ActivityType 41→**47**; `base_tables=32` (sin tablas nuevas);
  `tables_without_rls=0`; conteos **sin cambios (50/50/115)** → **cero backfill**;
  `vehicles_with_arrival=0` (sin DML).
- **Merge + deploy:** `main`=`2f33e58`; deployment de Production `success`.

## 4. Datos sintéticos de staging (validación e2e)

Se crearon 3 identidades (`A2-E2E-AGENT/ADMIN/WORKSHOP-<ts>`) + expediente sintético en **staging**.
**Limpiados** por IDs exactos tras recopilar evidencia: verificado que los conteos volvieron al
baseline (3 vehículos / 3 vendedores / 7 usuarios) → **ningún dato preexistente modificado**; **0**
identidades Auth temporales restantes; sin objetos de Storage sintéticos.

## 5. Credencial administrativa temporal de staging

La Secret key temporal se usó solo server-side, nunca se imprimió, y su archivo local
(`.env.staging.admin.local`, gitignored) quedó **vaciado**. **Revocada por el dueño el 2026-07-27**
(la revocación no era posible por los canales CLI/MCP disponibles) → **no queda ningún acceso
administrativo temporal a staging**.

## 6. Estado tras A2

- **`main`** = `2f33e58` · **8 migraciones**.
- **Producción**: A1 **y** A2 migrados + desplegados. **Staging**: A1 y A2 migrados; datos sintéticos
  limpiados.
- **Bloques del CRM en producción**: HARD-1, PERM-1, M1, A1, **A2**.
- **Observación pendiente**: 24 h de Sentry/Vercel para A2; smoke autenticado de producción.
- **Project Brief / `CLAUDE.md`**: documentos **distintos**; la consolidación técnica completa de la
  «Estado actual» sigue pendiente (se hará como tarea de documentación dedicada). Este release y
  `docs/plans/crm-completion-master-plan.md` son la fuente de estado más reciente.

## 7. Próximos bloques

**A3** (valoración preliminar vs tasación oficial) — iniciado como Draft PR (ver su propio estado).
Después: **PUB-1** (publicación/despublicación), **B1A** (señales económicas), **DATA-1**
(clasificación/limpieza de datos). Ninguno iniciado en producción.
