# Fase 1 — Readiness (resumen ejecutivo)

| Campo                            | Valor                                                                                                                                                                                                                                                                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Título**                       | Fase 1 — resumen ejecutivo de diseño y preparación                                                                                                                                                                                                                                                                     |
| **Estado**                       | ACTIVE (diseño aprobado como dirección; **implementación no iniciada**)                                                                                                                                                                                                                                                |
| **Owner**                        | Architecture / Product                                                                                                                                                                                                                                                                                                 |
| **Última revisión**              | 2026-07-13                                                                                                                                                                                                                                                                                                             |
| **Fuente de verdad relacionada** | Diseño: [`fase-1-domain-architecture.md`](fase-1-domain-architecture.md). Dominio actual: [`fase-1-current-domain-map.md`](fase-1-current-domain-map.md). Roadmap: [`fase-1-evolution-roadmap.md`](fase-1-evolution-roadmap.md). Decisiones: [`architecture-decisions.md`](architecture-decisions.md) (AD-009…AD-016). |
| **Alcance**                      | Resumen ejecutivo que enlaza a las fuentes de detalle de Fase 1.                                                                                                                                                                                                                                                       |
| **Fuera de alcance**             | Implementación, schema definitivo, migraciones. **Nada de Fase 1 está implementado.**                                                                                                                                                                                                                                  |

> **Análisis de Fase 1 completado. Diseño estratégico aprobado como dirección. Implementación NO
> iniciada.** El foco actual sigue siendo el **CRM interno de un único concesionario**.

---

## Enlaces a las fuentes de detalle

- **Arquitectura de dominio (diseño principal):** [`fase-1-domain-architecture.md`](fase-1-domain-architecture.md)
- **Mapa del dominio actual (as-is verificable):** [`fase-1-current-domain-map.md`](fase-1-current-domain-map.md)
- **Roadmap evolutivo (secuencia, drivers, gates):** [`fase-1-evolution-roadmap.md`](fase-1-evolution-roadmap.md)
- **Decisiones (AD-009…AD-016):** [`architecture-decisions.md`](architecture-decisions.md)
- **Estado de Fase 0:** [`fase-0-final-state.md`](fase-0-final-state.md) ·
  **Cierre operativo:** [`../operations/fase-0-operational-closeout.md`](../operations/fase-0-operational-closeout.md)

## Declaración de estado

- **Foco actual:** CRM interno de un único concesionario.
- **Marketplace:** diseñado conceptualmente, **DIFERIDO**.
- **Multiempresa (tenancy):** diseñada conceptualmente, **DIFERIDA**.
- **Party / Listing / Deal / Organization / Membership / BuyerIntent / DomainEvent / Outbox:**
  **DIFERIDOS** (cada uno espera un driver — ver el roadmap).
- **`ServiceOrder` y `Vehicle.commercializationMode`:** **recomendados, no implementados**.
- **Primer PR técnico recomendado:** **fact de venta canónico + retirada del _parsing_ de `Activity`**
  para contar ventas (additivo, reversible, sin tabla nueva, no gated por documentos).

## Principios

- **Evolución guiada por drivers** (AD-009): ninguna entidad estructural nueva sin consumidor real.
- **"Ship the field, gate the entity"**: un campo aditivo resuelve el problema actual; una entidad
  exige un driver; las ADR fijan la dirección antes de las tablas.

## Riesgos principales

- **Dominante: abstracción prematura (F1-R1).** Otros: merge de Party, dual-write Vehicle/Listing,
  tenant leakage, reporting inconsistente durante la transición del fact de venta, dependencia del
  rollout documental. Matriz completa en [`fase-1-domain-architecture.md`](fase-1-domain-architecture.md#riesgos-de-fase-1).

## Gates

- **Puede empezar ya (tras aprobación por PR):** Fase 1A (fact de venta, dedup vendedores,
  `commercializationMode`, `ServiceOrder`), en paralelo al rollout documental. La **retirada de
  `Document`** es de Fase 1A pero **condicionada** (tabla `documents` vacía verificada + no mezclarse
  con las tablas de documentos vivas del rollout; ver PR 5 en
  [`fase-1-evolution-roadmap.md`](fase-1-evolution-roadmap.md)).
- **Debe esperar un driver:** Party, Deal, Listing, Organization/Membership, BuyerIntent, DomainEvent,
  Outbox, StatusTransition.
- **Debe esperar el rollout documental de Fase 0:** cualquier cambio en las tablas de documentos
  (`VehicleDocument`/`DeliveryDocument`/`DocumentVersion`).

## Siguiente gate documental

Antes del primer PR técnico se creará un **PR separado de gobierno de ingeniería** (protocolo de
cambios, estrategia de testing, plantilla de PR, ampliación mínima de `CLAUDE.md`). Detalle en
[`fase-1-evolution-roadmap.md`](fase-1-evolution-roadmap.md#próximo-gate-documental--pr-de-gobierno-de-ingeniería).
Esos archivos **no** se crean en este PR.
