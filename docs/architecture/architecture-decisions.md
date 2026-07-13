# Decisiones de arquitectura — Fase 0 y dirección de Fase 1

| Campo                            | Valor                                                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Título**                       | Registro de decisiones de arquitectura (Fase 0 AD-001…008 y dirección de Fase 1 AD-009…016)                                        |
| **Estado**                       | ACTIVE                                                                                                                             |
| **Owner**                        | Architecture                                                                                                                       |
| **Última revisión**              | 2026-07-13                                                                                                                         |
| **Fuente de verdad relacionada** | Este documento (decisiones estables: Fase 0 ejecutadas AD-001…008 + dirección de Fase 1 aprobada AD-009…016, **no implementada**). |
| **Alcance**                      | Decisiones estructurales de Fase 0 (ejecutadas) y decisiones de **dirección** de Fase 1 (aprobadas, no implementadas).             |
| **Fuera de alcance**             | Implementación de Fase 1, schema Prisma definitivo, migraciones y decisiones de producto.                                          |

> **Relación con `docs/adr/`.** El repositorio ya tiene ADRs numerados
> ([`../adr/`](../adr/), 0001–0008) para decisiones previas al endurecimiento. Este documento usa
> el prefijo **`AD-`** (distinto de `000X`) para las decisiones de **Fase 0** (AD-001…008) y las de
> **dirección de Fase 1** (AD-009…016), y las agrupa en un solo registro para facilitar su lectura
> conjunta. No sustituye a los ADRs existentes; los complementa.

---

## AD-001 — Baseline de migraciones reproducible

- **Contexto:** el historial de 26 migraciones no era reproducible desde una base vacía: dos
  carpetas compartían prefijo de timestamp y `prisma migrate deploy` (orden lexicográfico)
  intentaba `ALTER seller_leads` antes de crear la tabla → `P3018`/`42P01`. Staging y producción
  nunca vivieron ese orden (se poblaron por otras vías), por lo que el defecto sólo afectaba a
  reconstrucciones desde cero (CI/entornos nuevos).
- **Decisión:** squash a una única baseline `000000000000_squashed_migrations` (flujo oficial de
  _baselining_ de Prisma), con el SQL personalizado de RLS reincorporado manualmente, y marcada
  como aplicada en entornos existentes mediante `prisma migrate resolve --applied` (sólo inserta
  metadatos; no ejecuta DDL ni toca datos). Las migraciones futuras son aditivas encima.
- **Alternativas rechazadas:** renombrar las carpetas colisionantes (desincroniza `_prisma_migrations`,
  no soportado oficialmente); mantener dos historiales vivos; bootstrap sólo-CI (CI ≠ prod).
- **Consecuencias:** una sola historia canónica, reconstruible desde vacío; el job CI
  `migration-replay` garantiza la invariante (exactamente baseline + PR5B1, catálogo, RLS, paridad,
  idempotencia). Coste: cada migración aditiva futura debe actualizar los conteos de catálogo.
- **Estado:** ejecutado (`00be57b`). Gobierno en [`../governance/database-migrations.md`](../governance/database-migrations.md);
  detalle histórico en [`../migration-history-baseline.md`](../migration-history-baseline.md).
- **Fecha:** 2026-07 (Fase 0).

## AD-002 — Operaciones críticas transaccionales con CAS

- **Contexto:** tres flujos de dinero/stock leían estado fuera de la transacción y decidían con esa
  lectura obsoleta (TOCTOU), o creaban efectos secundarios fuera de la frontera transaccional.
- **Decisión:** las operaciones que cambian dinero/stock se envuelven en `$transaction`
  (interactive transactions de Prisma) y usan **compare-and-swap** —
  `tx.model.updateMany({ where: { id, <campo>: esperado }, data })` + `count===0` → conflicto
  controlado (row-locking de PostgreSQL en READ COMMITTED). Los **efectos externos** (emails,
  revalidaciones) sólo ocurren **después** del commit. Los conflictos se traducen a **errores de
  dominio** claros.
- **Alternativas rechazadas:** nivel de aislamiento `Serializable` con reintentos (más caro);
  confiar en el pre-read como garantía (es el patrón defectuoso original).
- **Consecuencias:** integridad bajo concurrencia sin bloqueos pesimistas; testeable con integración
  real. Requiere disciplina: nunca usar una lectura previa como garantía.
- **Estado:** ejecutado en reserva de oferta (`18d3376`), entrega/garantía (`531b2df`),
  conversión de captación (`fadf828`) y backfill de documentos (`1b0f6fb`).
- **Fecha:** 2026-07 (Fase 0).

## AD-003 — Modelo documental versionado

- **Contexto:** los documentos legales no tenían versiones; reemplazar/leer/borrar no era trazable
  ni seguro.
- **Decisión:** `VehicleDocument` y `DeliveryDocument` son las **raíces**; `DocumentVersion` es el
  **archivo físico** (una fila por versión). La versión vigente es un puntero **`currentVersionId`**
  (fuente única), **sin** flag booleano `isCurrent` (que podría divergir). **FKs compuestas**
  `(id, currentVersionId) → (rootId, id)` garantizan a nivel de motor que la versión actual
  pertenece a su raíz. El reemplazo usa CAS sobre **`versionSequence`**.
- **Alternativas rechazadas:** flag `isCurrent` por versión (divergencia posible); sobrescribir el
  objeto en Storage (pierde historial).
- **Consecuencias:** integridad referencial fuerte; historial completo; `url` se escribe sólo junto
  a `currentVersionId` no nulo. El flujo de _reemplazo_ es code-complete pero aún sin UI.
- **Estado:** ejecutado (`0ec0857`). Migración `20260712000000_add_versioned_document_model`.
- **Fecha:** 2026-07 (Fase 0).

## AD-004 — Storage privado deny-all + autorización en Prisma (Opción B)

- **Contexto:** los documentos privados se subían desde el cliente con la clave anónima; las
  políticas de Storage no estaban versionadas y divergían entre entornos.
- **Decisión:** el bucket `vehicle-documents` es **privado** (`public=false`) y **deny-all** para
  `anon`/`authenticated` (sin políticas). La autorización real del CRM vive en **Prisma** (roles),
  no en `auth.uid()`. Las operaciones privadas de Storage (subida, firma, borrado) las hace el
  **servidor** con `service_role` (que ignora RLS), **siempre después** de autorizar con Prisma en
  la Server Action. Es el modelo "Opción B" (identidad vía Supabase Auth; autorización en Prisma).
- **Alternativas rechazadas:** políticas RLS de Storage basadas en `auth.uid()`/path (duplicaría la
  autorización que ya vive en Prisma); subida cliente con anon (evita validación server-side).
- **Consecuencias:** una sola capa de autorización (Prisma); documentos privados inaccesibles sin
  pasar por el servidor. Coste: `service_role` es un secreto privilegiado de runtime (ver
  [`../governance/security-and-secrets.md`](../governance/security-and-secrets.md)).
- **Estado:** ejecutado (`4f52f8d` + `e607f2a`). Gobierno en
  [`../governance/supabase-storage.md`](../governance/supabase-storage.md).
- **Fecha:** 2026-07 (Fase 0).

## AD-005 — Compatibilidad legacy y retirada diferida

- **Contexto:** existen referencias documentales legacy (columna `url`) que deben migrar al modelo
  versionado sin romper lecturas.
- **Decisión:** se **conserva** la columna `url` y una **lectura de fallback** legacy durante la
  transición; el **backfill** es diferido y controlado; la **retirada** de `url` y del fallback es
  un PR posterior, tras un periodo de observación.
- **Alternativas rechazadas:** _big-bang_ (migrar y borrar a la vez); eliminar `url` antes de
  verificar el backfill.
- **Consecuencias:** reversibilidad y seguridad; a cambio se mantiene superficie legacy temporal.
- **Estado:** decidido y preparado (`1b0f6fb`); backfill/retirada **pendientes** (rollout).
- **Fecha:** 2026-07 (Fase 0).

## AD-006 — Rollout controlado (tooling en código, ejecución fuera de CI)

- **Contexto:** la migración legacy real es una operación peligrosa que no debe correr en el gate de
  merge ni por accidente.
- **Decisión:** el utillaje vive **en el código** (auditores read-only, backfill/rollback dry-run
  por defecto, planes con hash, checkpoints), pero su **ejecución real está fuera de CI**. Escribir
  exige `--apply` + `--plan` + `--plan-hash` + `--env` + allow-var de entorno + token de
  confirmación (+ `--ack I_UNDERSTAND_THIS_IS_PRODUCTION` en producción). Staging **antes** que
  producción. El rollback es **exacto o bloqueado** (nunca normaliza a un valor distinto).
- **Alternativas rechazadas:** ejecutar el backfill desde CI; backfill con escritura por defecto.
- **Consecuencias:** ninguna operación real puede dispararse accidentalmente; el rollout es una
  actividad supervisada y autorizada aparte. Runbook:
  [`../runbooks/document-storage-rollout.md`](../runbooks/document-storage-rollout.md).
- **Estado:** preparado (`1b0f6fb`); ejecución **pendiente**.
- **Fecha:** 2026-07 (Fase 0).

## AD-007 — Separación de fuentes de verdad

- **Contexto:** conviven dos sistemas de migración (Prisma para el esquema de aplicación; Supabase
  para Storage) y un `setup.sql` histórico.
- **Decisión:** **Prisma migrations** es la fuente de verdad del esquema `public` de aplicación;
  **Supabase migrations** (`supabase/config.toml` + `supabase/migrations/*.sql`) lo es de los
  buckets/políticas de Storage; **`supabase/setup.sql` queda DEPRECADO/histórico** (referencia del
  setup manual que se ejecutó una vez). La **documentación actual** (este árbol `docs/architecture`,
  `docs/governance`, `docs/operations`) es la fuente de verdad frente a los **documentos históricos**
  ([`../historical/`](../historical/)).
- **Alternativas rechazadas:** mantener `setup.sql` como fuente activa; duplicar el esquema de
  Storage en Prisma.
- **Consecuencias:** cada dominio tiene una sola fuente; se evita el drift entre panel y repo.
- **Estado:** ejecutado (`e607f2a`); `setup.sql` marcado como deprecado.
- **Fecha:** 2026-07 (Fase 0).

## AD-008 — Inicio de Fase 1

- **Contexto:** cerrada técnicamente Fase 0, procede planificar la evolución (multi-tenancy,
  identidad `Party`, `Listing`, `Deal`…).
- **Decisión:** el **análisis y diseño** de Fase 1 pueden **comenzar ya**. La **implementación** que
  toque las tablas documentales debe **esperar** al rollout documental (backfill staged +
  verificado). **No** introducir multi-tenancy ni ninguna estructura de plataforma de forma
  improvisada; deben salir del análisis de dominio.
- **Alternativas rechazadas:** empezar a implementar Fase 1 antes del rollout; añadir
  `organizationId` ad hoc.
- **Consecuencias:** se desbloquea el diseño sin comprometer la estabilidad de la capa documental.
- **Estado:** decisión de gobierno; Fase 1 **no** iniciada. Detalle en
  [`fase-1-readiness.md`](fase-1-readiness.md).
- **Fecha:** 2026-07-13.

---

## Decisiones de Fase 1 (dirección)

> Estas decisiones fijan la **dirección** del dominio de Fase 1. **Ninguna está implementada.**
> Detalle en [`fase-1-domain-architecture.md`](fase-1-domain-architecture.md); secuencia y drivers
> en [`fase-1-evolution-roadmap.md`](fase-1-evolution-roadmap.md).

## AD-009 — Evolución guiada por drivers ("ship the field, gate the entity")

- **Contexto:** el análisis estratégico de Fase 1 identificó una arquitectura objetivo clara, pero la
  revisión adversarial marcó la mayoría de las grandes entidades como abstracción prematura para un
  concesionario único sin consumidor de marketplace.
- **Decisión:** ninguna entidad estructural nueva sin **consumidor o problema verificable**; **ADR
  antes que tabla** cuando se trate de una dirección futura; cambios **pequeños y aditivos**; evitar
  _big-bang_.
- **Alternativas rechazadas:** construir el modelo objetivo por adelantado; una migración estructural
  grande.
- **Consecuencias:** el CRM evoluciona sin deuda estructural prematura; el riesgo dominante
  (abstracción prematura) queda gobernado por gates de driver.
- **Driver:** N/A (principio rector).
- **Estado:** ACTIVE. **Fecha:** 2026-07-13. **Evidencia:** análisis Fase 1 + panel adversarial.

## AD-010 — Party diferido

- **Contexto:** `BuyerLead`/`SellerLead` guardan identidad embebida; dedup solo en compradores; los
  vendedores creados desde captura tienen `email:''` y nunca se deduplican.
- **Decisión:** **no crear `Party` ahora.** Mantener los leads; corregir primero la **deduplicación
  de vendedores**. Introducir `Contact`/`Party` (FK nullable, roles derivados) solo ante: visión 360
  cross-rol, empresas/CIF, payer ≠ buyer, dealers externos, o marketplace. **No** modelar los roles
  como enum fijo universal.
- **Alternativas rechazadas:** Party canónico _big-bang_ (B); auto-merge de identidades.
- **Consecuencias:** identidad saneada por corrección, no por tabla; el spine de identidad llega con
  su consumidor.
- **Driver:** 360 cross-rol / empresa-CIF / payer≠buyer / dealers / marketplace.
- **Estado:** ACTIVE (dirección; Party = DRAFT). **Fecha:** 2026-07-13. **Evidencia:** `lib/buyer-dedup.ts`, `lib/phone.ts`, `schema.prisma` leads.

## AD-011 — Vehicle y Listing (campo ahora, entidad diferida)

- **Contexto:** `Vehicle` conflado (activo + inventario + publicación + economía + trust); publicar =
  `Vehicle.status=PUBLICADO`; `VehicleAd` es solo texto; modalidad comercial implícita en
  `SellerLead.dealType`.
- **Decisión:** `Vehicle` sigue siendo el activo del CRM; **añadir `commercializationMode`** (campo,
  seed _best-effort_ desde `SellerLead.dealType`) **antes** de crear `Listing`. **Diferir** `Listing`,
  `Ownership`, `InventoryPosition`. **No** dual-write `Vehicle.status ↔ Listing.status`.
- **Alternativas rechazadas:** introducir `Listing` con dual-write ahora.
- **Consecuencias:** el _porqué_ comercial se captura barato; la separación se hace cuando exista
  consumidor programático.
- **Driver (Listing):** publicación programática, varios canales, sellers externos, moderación,
  precios por canal, republicación, histórico, marketplace.
- **Estado:** ACTIVE (dirección; `commercializationMode` = recomendado, `Listing` = DRAFT). **Fecha:** 2026-07-13. **Evidencia:** `lib/public-catalog.ts`, `lib/state-machine.ts`, `SellerDealType`.

## AD-012 — Deal diferido

- **Contexto:** la operación está dispersa (`Match→Offer→Delivery→Warranty`), unida por
  `vehicleId`/`buyerLeadId`; la venta canónica ocurre en `lib/delivery-completion.ts`.
- **Decisión:** **no crear `Deal` en el primer bloque.** Corregir primero el **fact de venta**.
  `Deal` lean solo ante: múltiples intentos por vehículo, reservas como producto, operación con
  identidad propia, frontera organizativa, necesidad contractual. **Resolver antes la colisión de
  `dealType`** (ya existe en `SellerLead`).
- **Alternativas rechazadas:** `Deal` como primer PR; `Deal` agregado completo con line-items.
- **Consecuencias:** el único dolor NOW (KPI de venta) se arregla sin agregado.
- **Driver:** operación con identidad propia / intentos secuenciales / contrato.
- **Estado:** ACTIVE (dirección; Deal = DRAFT). **Fecha:** 2026-07-13. **Evidencia:** `lib/offers.ts`, `lib/delivery-completion.ts`, `ofertas`/`entregas` actions.
- **Implementado (2026-07-13, PR #111):** corregido el dolor NOW (KPI de venta) **sin** crear `Deal` — el fact de venta canónico se leyó desde `Vehicle.status`/`soldAt`. `Deal` sigue **DIFERIDO** (sin driver).

## AD-013 — Tenancy futura (dirección, cero tablas)

- **Contexto:** sin multi-tenancy (0 `organizationId`); rol global.
- **Decisión:** **dirección = shared-schema con propiedad explícita**; distinguir **tenant-owned** vs
  **platform-owned**; **no** crear `Organization`/`Membership`/`organizationId` ahora; **no** añadir
  `organizationId` indiscriminadamente. Tenancy cuando exista un **segundo operador real del CRM**
  (los dealers del marketplace son contrapartes, no tenants).
- **Alternativas rechazadas:** schema-por-org / db-por-org (prematuros); `Organization`/`Membership`
  ahora; reinterpretar el `UserRole` global como rol-por-org ahora.
- **Consecuencias:** se evitan errores costosos de columnas; se difiere indirección sin usuarios.
- **Driver:** segundo operador real del CRM.
- **Estado:** ACTIVE (dirección; tenancy = DRAFT). **Fecha:** 2026-07-13. **Evidencia:** ausencia de `organizationId` en schema/código.

## AD-014 — Activity, eventos y analítica

- **Contexto:** `Activity` (timeline humano) se usa como fuente analítica por _string-parsing_;
  `KpiEvent` write-mostly.
- **Decisión:** `Activity` **continúa como timeline humano**; **no** usar su texto como fuente de
  verdad analítica; los hechos críticos viven en **columnas transaccionales** (venta desde
  `Vehicle.status`/`soldAt`, reserva desde `Offer`). **Diferir** `DomainEvent`, `AuditEntry` y
  `Outbox` hasta un efecto asíncrono que requiera garantía de entrega. `StatusTransition` solo si hay
  demanda real de tiempo-en-estado fiable.
- **Alternativas rechazadas:** Event Bus / Outbox / DomainEvent genérico + idempotencia ahora (el CAS
  de Fase 0 ya evita doble-commit).
- **Consecuencias:** KPIs fiables sin infraestructura de eventos prematura.
- **Driver (DomainEvent/Outbox):** múltiples consumidores / efecto externo con entrega garantizada.
- **Estado:** ACTIVE. **Fecha:** 2026-07-13. **Evidencia:** `lib/kpi/flow.ts:56`, `lib/dashboard/metrics.ts:194`, `lib/dashboard/queries.ts:57`, `lib/kpi/calidad.ts`.
- **Implementado (2026-07-13, PR #111, squash `2f1e436`):** retirado el _string-parsing_ de `Activity` para contar ventas; las tres lecturas (`lib/kpi/flow.ts`, `lib/dashboard/metrics.ts`, `lib/dashboard/queries.ts`) leen desde el hecho canónico `Vehicle.status = VENDIDO` + `Vehicle.soldAt`. `Activity` permanece como timeline humano; las reservas siguen derivándose de `Offer`. Sin schema, migración ni backfill.

## AD-015 — Servicios transaccionales (`ServiceOrder` recomendado)

- **Contexto:** los servicios de comisión (financiación/seguro/gestoría/transporte/peritaje/contrato
  externo) no tienen modelo.
- **Decisión:** `ServiceOrder` como modelo para los servicios **sin hogar**; catálogo inicial
  **acotado**; **no** incluir reserva/entrega/taller/garantía (ya tienen modelo); **no** crear
  `ServiceProvider` inicialmente (usar `providerName`). `commissionAmount` **distinto** del margen del
  vehículo (`Vehicle.marginPercent`).
- **Alternativas rechazadas:** tablas por servicio; `ServiceProvider` como tabla en el primer PR;
  `serviceType` catch-all.
- **Consecuencias:** nueva superficie de ingresos con riesgo de regresión cero (aditivo).
- **Driver (ServiceProvider):** catálogo real de proveedores.
- **Estado:** ACTIVE (dirección; `ServiceOrder` = recomendado, no implementado). **Fecha:** 2026-07-13. **Evidencia:** ausencia de modelo de servicios; `Vehicle.marginPercent`.

## AD-016 — Marketplace diferido

- **Contexto:** el marketplace es la etapa INTERMEDIATE de la trayectoria.
- **Decisión:** el marketplace **no se implementa** durante la etapa CRM interna; su diseño **no**
  obliga a crear `Listing`/`BuyerIntent`/`Organization`/tenancy ahora. Se implementará cuando exista
  un producto público y un flujo de onboarding real.
- **Alternativas rechazadas:** construir `Listing`/`BuyerIntent` como piezas tempranas.
- **Consecuencias:** el desarrollo del CRM no queda condicionado por el marketplace.
- **Driver:** decisión comercial + flujo público + onboarding + moderación + monetización + ownership
  de listings + estrategia legal/privacidad + operaciones + métricas + equipo.
- **Estado:** ACTIVE (dirección; marketplace = DRAFT). **Fecha:** 2026-07-13. **Evidencia:** `lib/matching/*`, `lib/public-catalog.ts`, `VehicleAd`.

---

## Política de revisión

Revisar y, si procede, actualizar estas decisiones: tras cualquier cambio de esquema, tras cambios
de Storage, tras cambios de CI, tras el rollout documental, y antes de iniciar la implementación de
Fase 1.
