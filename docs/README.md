# Documentación — Campernova CRM

| Campo                            | Valor                                                              |
| -------------------------------- | ------------------------------------------------------------------ |
| **Título**                       | Índice de documentación de arquitectura y gobierno de Fase 0       |
| **Estado**                       | ACTIVE                                                             |
| **Owner**                        | Engineering / Architecture                                         |
| **Última revisión**              | 2026-07-13                                                         |
| **Fuente de verdad relacionada** | Este índice (mapa de la documentación).                            |
| **Alcance**                      | Documentación de arquitectura, gobierno y operaciones de Fase 0.   |
| **Fuera de alcance**             | Documentación de producto (PRD, Roadmap, specs, planes de bloque). |

Índice de la documentación del repositorio. Distingue **fuentes de verdad actuales** de
**documentos históricos**. Ante cualquier duda, prevalece la fuente de verdad actual.

---

## Arquitectura (estado actual)

- [`architecture/fase-0-final-state.md`](architecture/fase-0-final-state.md) — **fuente de verdad del
  estado de Fase 0**: qué se cerró, garantías, riesgos residuales, decisión técnica (`PASS`) y
  operativa (`PENDING`).
- [`architecture/architecture-decisions.md`](architecture/architecture-decisions.md) — decisiones
  estables: Fase 0 (AD-001…AD-008) + **Fase 0→1 (AD-009…AD-016)**.

## Fase 1 — diseño de dominio (dirección aprobada; **entidades no implementadas**, salvo Fase 1A-1)

La **Fase 1A-1 (fact de venta canónico)** está **IMPLEMENTED / DEPLOYED** (PR #111, squash `2f1e436`):
las ventas se leen del hecho canónico `Vehicle.status`/`soldAt` y `Activity` sigue como timeline
humano; **Fase 1A-2 y posteriores siguen pendientes**. El resto de esta sección es **diseño y
dirección**, no implementación. El foco actual sigue siendo el CRM interno de un único concesionario;
marketplace y multiempresa están **diferidos**.

- [`architecture/fase-1-readiness.md`](architecture/fase-1-readiness.md) — **resumen ejecutivo**
  (ACTIVE): estado (Fase 1A-1 implementada), principios, riesgos, gates.
- [`architecture/fase-1-domain-architecture.md`](architecture/fase-1-domain-architecture.md) —
  **fuente de verdad del diseño** (ACTIVE): principio _driver-gated_, bounded contexts, decisiones,
  matriz actual→objetivo, riesgos.
- [`architecture/fase-1-current-domain-map.md`](architecture/fase-1-current-domain-map.md) — **mapa
  del dominio actual** (ACTIVE): inventario as-is, flujos, hechos verificados.
- [`architecture/fase-1-evolution-roadmap.md`](architecture/fase-1-evolution-roadmap.md) — **roadmap**
  (ACTIVE/DRAFT por bloque): secuencia de PRs, drivers, gates, relación con el rollout documental.

> El roadmap es una recomendación, **no un compromiso inmutable**; cada PR se revalida y requiere su
> propia aprobación.

## Gobierno

- [`governance/database-migrations.md`](governance/database-migrations.md) — migraciones Prisma:
  baseline inmutable, proceso, catálogo, drift.
- [`governance/supabase-storage.md`](governance/supabase-storage.md) — buckets, políticas, modelo
  Opción B, service role, signed URLs, huérfanos.
- [`governance/security-and-secrets.md`](governance/security-and-secrets.md) — `service_role`,
  variables de guarda, rotación/revocación, checklist de go-live.
- [`governance/ci-quality-gates.md`](governance/ci-quality-gates.md) — los 4 jobs de CI, checks
  requeridos vs recomendados, política de acciones.
- [`governance/engineering-change-process.md`](governance/engineering-change-process.md) — **proceso
  universal de cambios** (ACTIVE): clasificación C0–C9, niveles de riesgo, análisis de impacto,
  invariantes, gobierno de migraciones/autorización/concurrencia/efectos externos/KPIs, gobierno de
  **Sentry** y **PostHog** (según la integración real), feature flags, matriz de observabilidad,
  hotfix y criterios de bloqueo. Cubre arquitectura, migraciones, seguridad, concurrencia, Storage,
  testing, analítica y validación post-despliegue. Complementa (no duplica)
  [`../CONTRIBUTING.md`](../CONTRIBUTING.md).
- [`governance/testing-strategy.md`](governance/testing-strategy.md) — **estrategia de testing y
  validación** (ACTIVE): pirámide real (721 unit · 59 integración · 19 Supabase), matriz
  cambio→tests, regresión, testing de migraciones/concurrencia/Storage/KPIs/Sentry/PostHog,
  anti-patrones, flakes y validación post-despliegue.
- [`governance/ai-handoff-protocol.md`](governance/ai-handoff-protocol.md) — **protocolo de
  comunicación y handoff** (ACTIVE): cómo un agente entrega resultados **verificables y
  autosuficientes** — evidencia antes que narrativa; separación hecho/inferencia/recomendación/desconocido;
  niveles de respuesta A–F proporcionales al riesgo; plantilla de handoff. Complementa (no duplica)
  [`governance/engineering-change-process.md`](governance/engineering-change-process.md).
- [`../.github/PULL_REQUEST_TEMPLATE.md`](../.github/PULL_REQUEST_TEMPLATE.md) — **plantilla de PR**
  (proporcionada, con escapes `N/A`): objetivo, clasificación, impacto, schema, seguridad,
  concurrencia, tests, observabilidad, documentación, rollback, despliegue y checklist final.

## Operaciones

- [`operations/fase-0-operational-closeout.md`](operations/fase-0-operational-closeout.md) —
  checklist ejecutivo para pasar el cierre operativo de `PENDING` a `PASS`.
- [`runbooks/document-storage-rollout.md`](runbooks/document-storage-rollout.md) — runbook operativo
  detallado del rollout documental (staging → producción).

## Referencia de infraestructura (existente)

- [`migration-history-baseline.md`](migration-history-baseline.md) — cómo se generó la baseline de
  migraciones.
- [`integration-tests.md`](integration-tests.md) — infraestructura de tests de integración
  (PostgreSQL real).
- [`adr/`](adr/) — decisiones de arquitectura previas (ADR 0001–0008).
- [`ACCOUNTS.md`](ACCOUNTS.md) · [`PRODUCTION-READINESS.md`](PRODUCTION-READINESS.md) ·
  [`LAUNCH.md`](LAUNCH.md) — cuentas, preparación de producción y lanzamiento.

## Documentos históricos (no son fuente de verdad actual)

- [`historical/architecture-audit-2026-07-10.md`](historical/architecture-audit-2026-07-10.md) —
  auditoría de arquitectura (previa a Fase 0).
- [`historical/fase-0-implementation-plan-2026-07-10.md`](historical/fase-0-implementation-plan-2026-07-10.md)
  — plan de implementación de Fase 0.
- [`historical/migration-history-repair-plan-2026-07-10.md`](historical/migration-history-repair-plan-2026-07-10.md)
  — plan de reparación del historial de migraciones.

> Los documentos de `historical/` se conservan por trazabilidad; cada uno lleva una cabecera de
> estado que indica por qué es histórico y qué documento actual lo sustituye.

## Producto y otros

El resto de `docs/` (PRD, Roadmap, specs, planes de bloque, taxonomía, etc.) documenta producto y
funcionalidades; queda fuera del alcance de este índice de arquitectura/gobierno de Fase 0.

---

## Política de revisión de la documentación

Revisar y actualizar la documentación de arquitectura/gobierno tras: cambios de esquema, cambios de
Storage, cambios de CI, el rollout documental, y antes de iniciar la implementación de Fase 1.
