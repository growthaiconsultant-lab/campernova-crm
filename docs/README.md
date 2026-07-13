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
  estables de Fase 0 (AD-001…AD-008).
- [`architecture/fase-1-readiness.md`](architecture/fase-1-readiness.md) — análisis de preparación de
  Fase 1 (**no** implementación).

## Gobierno

- [`governance/database-migrations.md`](governance/database-migrations.md) — migraciones Prisma:
  baseline inmutable, proceso, catálogo, drift.
- [`governance/supabase-storage.md`](governance/supabase-storage.md) — buckets, políticas, modelo
  Opción B, service role, signed URLs, huérfanos.
- [`governance/security-and-secrets.md`](governance/security-and-secrets.md) — `service_role`,
  variables de guarda, rotación/revocación, checklist de go-live.
- [`governance/ci-quality-gates.md`](governance/ci-quality-gates.md) — los 4 jobs de CI, checks
  requeridos vs recomendados, política de acciones.

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
