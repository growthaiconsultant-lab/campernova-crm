# Fase 0 — Estado final (fuente de verdad)

| Campo                            | Valor                                                                                                                                                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Título**                       | Fase 0 — Estado final del endurecimiento de seguridad, integridad y capa documental                                                                                                                                                |
| **Estado**                       | ACTIVE                                                                                                                                                                                                                             |
| **Owner**                        | Architecture / Engineering                                                                                                                                                                                                         |
| **Última revisión**              | 2026-07-13                                                                                                                                                                                                                         |
| **Fuente de verdad relacionada** | Este documento (estado de Fase 0). Gobierno específico en [`../governance/`](../governance/).                                                                                                                                      |
| **Alcance**                      | Estado técnico y operativo de Fase 0 (PRs de seguridad, atomicidad y capa de documentos versionados).                                                                                                                              |
| **Fuera de alcance**             | Diseño e implementación de Fase 1 (ver [`fase-1-readiness.md`](fase-1-readiness.md)); rollout real contra staging/producción (ver [`../operations/fase-0-operational-closeout.md`](../operations/fase-0-operational-closeout.md)). |

> Este documento describe el **estado actual del repositorio**, no las intenciones de los planes
> originales. Los tres documentos de planificación/auditoría que originaron Fase 0 se conservan,
> como referencia histórica y con su estado marcado, en [`../historical/`](../historical/).

---

## 5.1. Resumen ejecutivo

**Fase 0** fue el endurecimiento de la base del CRM antes de añadir capacidades nuevas. Partió de
una auditoría de arquitectura (2026-07-10) que identificó un fallo de seguridad crítico, tres
costuras transaccionales de dinero/stock, un problema de gobierno de Storage y un historial de
migraciones no reproducible desde cero. Fase 0 resolvió esos puntos y, además, construyó una
**capa de documentos versionados** con Storage privado seguro y un utillaje de migración legacy
controlado.

**Qué problemas resolvía:**

- Cuatro tablas de `public` expuestas a la API PostgREST con la clave anónima (RLS ausente).
- Tres flujos no atómicos (aceptación de oferta, garantía de entrega, conversión de captación).
- Historial de migraciones Prisma no reconstruible desde una base vacía (colisión de timestamps).
- Subida de documentos privados desde el cliente con la clave anónima, sin validación server-side;
  políticas de Storage no versionadas y divergentes entre entornos.
- Ausencia de un modelo documental con versiones (reemplazo/lectura/borrado seguros).

**Qué se ha cerrado (a nivel de código y CI):**

- Seguridad RLS, atomicidad transaccional, baseline de migraciones reproducible, Storage privado
  server-side, modelo de documentos versionados, buckets/políticas de Storage versionados, y el
  utillaje (read-only + dry-run) de auditoría/backfill/rollback legacy.

**Qué NO se ha ejecutado todavía (deliberadamente diferido):**

- El **backfill real** de referencias legacy contra staging y producción.
- La **reconciliación** de buckets/políticas remotos a la configuración versionada.
- La **retirada** del bucket legacy `lead-documents` y de la columna `url` legacy.
- El aprovisionamiento de `SUPABASE_SERVICE_ROLE_KEY` en el entorno remoto (prerequisito de runtime).

**Decisión de cierre:**

- **Cierre técnico de Fase 0: `PASS`** (sin defectos críticos ni altos vivos; capa correcta,
  atómica, testeada y reproducible en CI).
- **Cierre operativo de Fase 0: `PENDING`** (pendientes los pasos de rollout supervisado; ver
  [`../operations/fase-0-operational-closeout.md`](../operations/fase-0-operational-closeout.md)).

---

## 5.2. Estado validado

| Aspecto                           | Valor verificado                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **`main` SHA**                    | `1b0f6fb4bad700cb766b7637cc6c2414b22b26c4`                                                                               |
| **Migraciones Prisma (`public`)** | Exactamente **2**: `000000000000_squashed_migrations` (baseline) + `20260712000000_add_versioned_document_model` (PR5B1) |
| **Migración Supabase Storage**    | `supabase/migrations/20260713000000_storage_buckets_and_policies.sql` (PR5B2)                                            |
| **Jobs de CI**                    | `quality`, `integration`, `migration-replay`, `supabase-storage` — todos verdes en `main`                                |
| **Tests unitarios**               | **721**                                                                                                                  |
| **Tests de integración**          | **59** (PostgreSQL 17 real y efímero, 10 ficheros)                                                                       |
| **Tests Supabase**                | **19** (Supabase local efímero, 2 ficheros)                                                                              |
| **Catálogo (`public`)**           | **31** tablas · **439** columnas · **50** enums · **266** valores de enum · **67** FKs · **113** índices                 |
| **Paridad de esquema**            | `prisma migrate diff --exit-code` sin drift (RLS no lo modela Prisma)                                                    |
| **RLS**                           | **0** tablas de `public` sin RLS · **0** con `FORCE RLS` · **0** políticas en `public` (deny-all)                        |
| **Supabase local**                | `supabase start` + `supabase db reset` reproducen buckets/políticas; guard anti-remoto activo                            |
| **Vercel**                        | build/deploy verde                                                                                                       |

> Los conteos de catálogo son los **posteriores a PR5B1** (baseline + migración aditiva). El
> conteo de la baseline **sola** (30/412/48/255/60/101) es un dato histórico documentado en
> [`../migration-history-baseline.md`](../migration-history-baseline.md) y en
> [`../governance/database-migrations.md`](../governance/database-migrations.md).

---

## 5.3. Historial de PRs

Fase 0 se implementó como una secuencia de PRs pequeños e independientes. La tabla recoge cada uno
con su commit de squash en `main`.

> **Contexto previo a PR2.** Antes de los tres fixes de atomicidad, Fase 0 cerró el fallo de
> seguridad crítico y saneó la base de migraciones:
>
> | Commit    | Título                                                               | Qué resolvió                                                                                                                                                                                  |
> | --------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
> | `5ce93d6` | `fix(security): enable RLS on new public tables`                     | Activó RLS en `offers`, `calendar_events`, `vehicle_captures`, `kpi_events` (fallo crítico SEG-01 de la auditoría). Efecto consolidado hoy en la baseline.                                    |
> | `00be57b` | `fix(migrations): replace broken history with reproducible baseline` | Sustituyó las 26 migraciones no reproducibles por una baseline única (`000000000000_squashed_migrations`). Detalle en [`../migration-history-baseline.md`](../migration-history-baseline.md). |
> | `078f43d` | `test(integration): add PostgreSQL integration test infrastructure`  | Infraestructura de test de integración con PostgreSQL real (habilita los tests de atomicidad/concurrencia/RLS). Detalle en [`../integration-tests.md`](../integration-tests.md).              |

### PR2 — Reserva de oferta atómica

- **Commit:** `18d3376` — `fix(offers): make vehicle reservations atomic`
- **Problema:** condición de carrera (TOCTOU) al aceptar una oferta: el estado del vehículo se leía
  fuera de la transacción → doble reserva posible.
- **Solución:** cambio de estado del vehículo dentro del `$transaction` con **compare-and-swap**
  (`updateMany where status esperado` → `count===0` = conflicto controlado); transición de la
  oferta también condicional; liberación de reserva condicional.
- **Garantías:** una sola reserva viva por vehículo bajo concurrencia; sin efectos externos dentro
  de la transacción.
- **Pruebas:** tests de integración de concurrencia (dos aceptaciones simultáneas → una OK, otra
  conflicto).
- **Limitaciones:** el índice único parcial de refuerzo quedó como opción no obligatoria.

### PR3 — Entrega, garantía y follow-ups atómicos

- **Commit:** `531b2df` — `fix(deliveries): make completion warranty and followups atomic`
- **Problema:** la garantía y los follow-ups se creaban **fuera** de la transacción de completar la
  entrega, sin idempotencia → vehículo VENDIDO sin garantía si fallaba a mitad.
- **Solución:** `createWarrantyForDelivery` recibe `tx` y corre **dentro** del `$transaction`;
  idempotencia por `deliveryId`; docstring corregido.
- **Garantías:** completar una entrega crea garantía + 2 follow-ups atómicamente; reintento
  idempotente.
- **Pruebas:** integración (atomicidad, rollback ante fallo inyectado, idempotencia).

### PR4 — Conversión de captación y trade-in atómica

- **Commit:** `fadf828` — `fix(captures): make capture and trade-in conversion atomic`
- **Problema:** el `SellerLead` (con vehículo y actividad) se creaba fuera de la transacción de
  vinculación → lead/vehículo huérfano ante fallo; idempotencia rota.
- **Solución:** `create` + vínculo + nota en un único `$transaction`; efectos derivados
  (tasación/matching) fuera y reintentables, con registro de fallo.
- **Garantías:** conversión atómica; sin huérfanos ante fallo; idempotente ante reintento; mismo
  patrón en trade-in.
- **Pruebas:** integración (atomicidad, ausencia de huérfanos, idempotencia).

### PR5A — Documentos privados server-side

- **Commit:** `4f52f8d` — `fix(storage): secure private document handling`
- **Problema:** subida a bucket privado desde el cliente con clave anónima, sin validación
  server-side (SEG-02).
- **Solución:** subida server-side previa autorización; validación de MIME/tamaño en servidor;
  nombres/paths seguros (UUID); descarga con URLs firmadas efímeras.
- **Garantías:** ninguna escritura al bucket privado sin autorización previa del CRM.
- **Pruebas:** unitarias de validación + integración.

### PR5B1 — Modelo documental versionado

- **Commit:** `0ec0857` — `feat(documents): add versioned document model`
- **Problema:** los documentos no tenían versiones (reemplazo/lectura/borrado no trazables ni
  seguros).
- **Solución:** tabla `document_versions`; puntero `currentVersionId` (sin flag `isCurrent`
  divergente); **FKs compuestas** que garantizan que la versión actual pertenece a su raíz;
  reemplazo por CAS sobre `versionSequence`. Migración aditiva `20260712000000_add_versioned_document_model`
  (`CREATE TYPE`/`ALTER ADD`/`CREATE TABLE` + 4 `CHECK` + RLS deny-all; sin `DROP`/`DELETE`).
- **Garantías:** una única fuente de verdad de la versión actual; integridad referencial a nivel de
  motor; escritura de `url` sólo junto a `currentVersionId` no nulo.
- **Pruebas:** unitarias + integración (CAS, idempotencia). Catálogo actualizado a 31/439/50/266/67/113.
- **Limitaciones:** el flujo de _reemplazo_ es code-complete y testeado pero **no está cableado** a
  UI/Server Action todavía.

### PR5B2 — Buckets y políticas de Storage versionados

- **Commit:** `e607f2a` — `feat(storage): version Supabase buckets and policies`
- **Problema:** buckets/políticas gestionados por panel, no versionados, divergentes entre entornos.
- **Solución:** `supabase/config.toml` + migración `20260713000000_storage_buckets_and_policies.sql`
  (`vehicle-documents` privado deny-all, `vehicle-photos` público acotado por `bucket_id`); cliente
  `service_role` **server-only** ([`lib/supabase/admin.ts`](../../lib/supabase/admin.ts)); guard
  anti-remoto; `scripts/check-storage-policies.sql`; tests reales contra Supabase local; nuevo job
  CI `supabase-storage`.
- **Garantías:** fuente de verdad reproducible de Storage; documentos privados deny-all para
  `anon`/`authenticated`.
- **Pruebas:** 19 tests reales sobre Supabase local; invariantes de catálogo de Storage.
- **Limitaciones:** `lead-documents` legacy no se crea en la config versionada (se reconcilia/retira
  en el rollout).

### PR5B3 — Utillaje de migración legacy seguro

- **Commit:** `1b0f6fb` — `feat(documents): add safe legacy migration tooling`
- **Problema:** las referencias documentales legacy debían migrarse al modelo versionado sin riesgo.
- **Solución:** auditores read-only (DB + Storage), planes deterministas con hash, backfill
  **dry-run por defecto** con CAS por raíz, batching/checkpoints/resume, verificación, rollback
  **exacto-o-bloqueado**, reconciliación no destructiva, utilidad de redacción y runbook
  ([`../runbooks/document-storage-rollout.md`](../runbooks/document-storage-rollout.md)).
- **Garantías:** ninguna operación real contra staging/producción; escribir exige `--apply` +
  plan + hash + entorno + allow-var + token de confirmación (+ `--ack` en producción).
- **Pruebas:** unitarias + integración PostgreSQL + Supabase local (auditoría/paginación).
- **Limitaciones:** el backfill/rollback/reconciliación **reales** quedan diferidos al rollout.

---

## 5.4. Garantías actuales

| Garantía                   | Cómo se consigue                                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Atomicidad**             | Operaciones de dinero/stock envueltas en `$transaction`; efectos externos sólo tras el commit.                                                                                              |
| **CAS (compare-and-swap)** | `updateMany({ where: { id, <campo>: esperado } })` + `count===0` → conflicto controlado (row-locking de PostgreSQL en READ COMMITTED). Usado en reserva de oferta y backfill de documentos. |
| **Idempotencia**           | Completar entrega, conversión de captación y backfill son reintetables sin duplicar.                                                                                                        |
| **Compensación**           | Ante fallo de DB tras subir a Storage, se intenta eliminar el objeto (best-effort); `upsert:false` evita sobrescrituras.                                                                    |
| **Documentos privados**    | Bucket `vehicle-documents` deny-all; acceso sólo server-side con `service_role` tras autorización Prisma.                                                                                   |
| **Versionado**             | `document_versions` + `currentVersionId` + FKs compuestas; sin flag `isCurrent`; reemplazo por CAS.                                                                                         |
| **Storage versionado**     | `supabase/config.toml` + migración de buckets/políticas como fuente de verdad reproducible.                                                                                                 |
| **Service role**           | Cliente server-only, validación perezosa, nunca en bundle de cliente.                                                                                                                       |
| **Signed URLs**            | URLs firmadas efímeras (300 s) para lectura de documentos privados; nunca `getPublicUrl` en privados.                                                                                       |
| **Tooling legacy**         | Auditoría/verificación read-only; backfill/rollback dry-run por defecto con múltiples confirmaciones.                                                                                       |
| **CI**                     | 4 jobs (`quality`, `integration`, `migration-replay`, `supabase-storage`) reproducibles, sin secretos remotos.                                                                              |

Detalle por área: [`../governance/database-migrations.md`](../governance/database-migrations.md),
[`../governance/supabase-storage.md`](../governance/supabase-storage.md),
[`../governance/security-and-secrets.md`](../governance/security-and-secrets.md),
[`../governance/ci-quality-gates.md`](../governance/ci-quality-gates.md).

---

## 5.5. Riesgos residuales

Riesgos del **stack documental/Storage de Fase 0**. Los riesgos estructurales de mayor alcance
(multi-tenancy, `Party`, `Listing`, `Deal`…) son materia de Fase 1 y viven en
[`fase-1-readiness.md`](fase-1-readiness.md).

Leyenda — **Bloqueo técnico**: ¿impide declarar el cierre técnico? · **Bloqueo operativo**: ¿debe
resolverse antes del rollout a producción?

| #   | Riesgo                                                                                                   | Severidad                   | Estado                             | Mitigación                                                                     | Bloqueo técnico | Bloqueo operativo | Fase recomendada             |
| --- | -------------------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------- | ------------------------------------------------------------------------------ | --------------- | ----------------- | ---------------------------- |
| R1  | Validación por MIME declarado + extensión, no por _magic bytes_                                          | Baja                        | Abierto (aceptado)                 | Allowlist MIME (sin svg/html/js) + se sirve con Content-Type benigno           | No              | No                | Hardening posterior          |
| R2  | `SUPABASE_SERVICE_ROLE_KEY` es prerequisito de runtime para documentos privados                          | Media (operativa)           | Abierto                            | Runbook + checklist de go-live; falla en cerrado si falta                      | No              | **Sí**            | Rollout (gate de producción) |
| R3  | Supabase CLI en CI con `version: latest` (flotante)                                                      | Baja                        | Abierto                            | Pin deliberado a una release conocida                                          | No              | No                | Hardening CI                 |
| R4  | Clave `[inbucket]` en `config.toml` puede emitir aviso de deprecación en CLIs nuevas                     | Info                        | Abierto                            | `enabled = false`; sin efecto funcional                                        | No              | No                | Housekeeping                 |
| R5  | Acciones de GitHub fijadas a tags mayores mutables, no a SHA                                             | Baja                        | Abierto                            | SHA-pin de acciones de terceros                                                | No              | No                | Hardening CI                 |
| R6  | `integration`/`migration-replay`/`supabase-storage` no son checks _required_ (sólo `quality`)            | Baja                        | Abierto                            | Promover a checks obligatorios de `main`                                       | No              | No                | Gobierno CI                  |
| R7  | El CAS del backfill no compara `url` (se apoya en una invariante app-wide)                               | Baja                        | Abierto (invariante verdadera hoy) | Test-guardián de la invariante antes del backfill real; defensa en profundidad | No              | No                | Pre-backfill                 |
| R8  | Rollback de filas `VALID_LEGACY_SIGNED_URL` bloqueado (token no preservado)                              | Info (por diseño)           | Cerrado como diseño                | Reversión manual documentada; `VALID_PATH` sí es reversible exacto             | No              | No                | —                            |
| R9  | Compensación best-effort puede dejar un objeto huérfano sin traza                                        | Baja                        | Abierto                            | Reconciliación periódica; recomendable loggear el huérfano                     | No              | No                | Post-rollout                 |
| R10 | El borrado elimina el objeto de Storage antes del commit de DB (referencia colgante en fallo raro)       | Info (por diseño)           | Cerrado como diseño                | Dirección segura (sin objeto huérfano); sweep de reconciliación                | No              | No                | —                            |
| R11 | Cobertura multi-bucket limitada (sólo `vehicle-documents`/`vehicle-photos`; `lead-documents` legacy)     | Baja                        | Abierto                            | Reconciliar/retirar `lead-documents` en el rollout                             | No              | No                | Rollout / post-observación   |
| R12 | Sin UI/Server Action para historial/reemplazo de documentos                                              | Baja (limitación funcional) | Abierto                            | Cablear `replaceCurrentVersion` cuando se necesite; el core no cambia          | No              | No                | Seguimiento                  |
| R13 | Reconciliación de buckets/políticas remotos aún no aplicada a staging/prod                               | Baja (operativa)            | Abierto                            | `documents:plan-storage-reconciliation` → revisión → aplicación manual         | No              | **Sí**            | Rollout                      |
| R14 | Backfill legacy real no ejecutado (distribución de BLOQUEADOS desconocida)                               | Info (operativa)            | Abierto                            | Auditar staging → plan → dry-run → apply → verify                              | No              | **Sí**            | Rollout                      |
| R15 | Periodo de observación aún no realizado                                                                  | Info (operativa)            | Abierto                            | Observar 2–4 semanas tras el backfill antes de limpiar                         | No              | No                | Post-migración               |
| R16 | Columna `url` legacy + lectura de fallback aún presentes                                                 | Info (operativa)            | Abierto                            | Retirar en PR separado tras el periodo de observación                          | No              | No                | Post-observación             |
| R17 | Los workflows de CI no declaran un bloque `permissions:` explícito (el `GITHUB_TOKEN` hereda el default) | Baja                        | Abierto                            | Añadir `permissions: contents: read` a nivel de workflow (mínimo privilegio)   | No              | No                | Hardening CI                 |

**Total: 17 riesgos residuales documentados. Bloqueos técnicos: 0. Bloqueos operativos: 3 (R2, R13, R14).**

---

## 5.6. Decisiones

- **Cierre técnico de Fase 0: `PASS`** (sin condiciones a nivel de código y CI).
- **Cierre operativo de Fase 0: `PENDING`** (condicionado a los gates de rollout de
  [`../operations/fase-0-operational-closeout.md`](../operations/fase-0-operational-closeout.md)).
- **Fase 1 (análisis): autorizado a comenzar.** Ver [`fase-1-readiness.md`](fase-1-readiness.md).
- **Fase 1 (implementación que toque tablas documentales): bloqueada** hasta completar el rollout
  documental (backfill staged + verificado). El resto del diseño de Fase 1 no tiene esa dependencia.

> Este documento **no** afirma que el backfill esté ejecutado, ni que staging esté validado, ni que
> producción esté migrada. Esos son pasos operativos pendientes (ver el cierre operativo).
