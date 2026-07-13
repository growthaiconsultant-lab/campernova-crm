# Fase 1 — Roadmap evolutivo

| Campo                            | Valor                                                                                                                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Título**                       | Roadmap evolutivo, drivers y secuencia de PRs de Fase 1                                                                                                                                                                         |
| **Estado**                       | ACTIVE (dirección) · los bloques por driver son DRAFT                                                                                                                                                                           |
| **Owner**                        | Architecture / Engineering / Product                                                                                                                                                                                            |
| **Última revisión**              | 2026-07-13                                                                                                                                                                                                                      |
| **Fuente de verdad relacionada** | Diseño: [`fase-1-domain-architecture.md`](fase-1-domain-architecture.md). Dominio actual: [`fase-1-current-domain-map.md`](fase-1-current-domain-map.md). Decisiones: [`architecture-decisions.md`](architecture-decisions.md). |
| **Alcance**                      | Orden de evolución, drivers, gates y secuencia recomendada de PRs.                                                                                                                                                              |
| **Fuera de alcance**             | Implementación. **Ningún PR de este roadmap está iniciado.** El roadmap es una recomendación, **no un compromiso inmutable**.                                                                                                   |

> **El orden y el alcance de cada PR se revalidan tras cada entrega.** Autorizar este diseño **no**
> autoriza automáticamente ningún PR técnico; cada uno requiere su propia aprobación explícita.

---

## Fase 1A — Mejoras fundacionales del CRM (additivas, valor NOW, no gated por documentos)

Orden **recomendado** (cada PR es pequeño, aditivo y reversible):

### PR 1 — Fact de venta canónico _(primer PR técnico recomendado)_

- Retirar el _parsing_ de `Activity` para contar ventas; leer desde columnas transaccionales
  (`Vehicle.status = VENDIDO`, `Vehicle.soldAt`; `Offer` para métricas de reserva).
- Reconciliar conteos (dual-read + verificación); tests unitarios e integración.
- **Sin tablas nuevas. Sin eliminar `Activity`.**

### PR 2 — Deduplicación de vendedores

- Reutilizar el patrón de normalización/dedup existente (`lib/phone`, `lib/buyer-dedup`) y
  **extenderlo a vendedores** (hoy inexistente; capturas crean `email:''`).
- Comportamiento **conservador**; **no** auto-merge. Tests con teléfonos/emails incompletos.

### PR 3 — `Vehicle.commercializationMode`

- Migración **aditiva** (campo nullable). Seed _best-effort_ desde `SellerLead.dealType`.
- Mantener compatibilidad. **No** crear `Listing`.

### PR 4 — `ServiceOrder`

- Modelo **acotado** (financiación/seguro/cambio de nombre/transporte/peritaje/contrato externo).
- Autorización + transacciones + métricas. **Sin `ServiceProvider`** (usar `providerName`).

### PR 5 — Retirada de `Document` legacy

- **Solo cuando:** tabla vacía verificada; rollout documental completado si hay dependencia;
  periodo de observación cumplido. **PR separado**, migración **expand/contract**.

### PR documental de ADRs _(este PR)_

- Cubre las decisiones de dirección (AD-009…AD-016). No implementa nada.

> **PR 2–5 no constituyen una autorización automática**: se revalidan tras cada entrega.

## Fase 1B — Adopción por driver (cada uno exige un driver explícito)

- **Party/Contact** — FK nullable, backfill lazy, merge cross-rol revisado.
- **Deal lean** — `dealId` nullable en Offer/Delivery; resolver antes la colisión de `dealType`.
- **StatusTransition** — historial tipado de estados, solo si hay KPI real de tiempo-en-estado.
- **Racionalización de `KpiEvent`** — decidir leerlo o dejar de escribirlo.

## Fase 1C — Marketplace (solo con decisión comercial + flujo público)

- **Listing** (+ canales, precios por canal, historial de publicación), sellers/dealers externos,
  moderación, leads externos, **BuyerIntent**, matching ampliado.

## Fase 1D — Multiempresa

- **Organization**, **Membership**, tenancy (`organizationId` solo en agregados tenant-owned),
  **RLS por organización** (defensa en profundidad), roles por org, suscripciones, reporting
  cross-tenant.

---

## Primer PR técnico recomendado (detalle) — RECOMENDACIÓN, no implementación

**Fact de venta canónico y retirada del _parsing_ de `Activity`.**

- **Problema:** las ventas se calculan en varios puntos buscando el texto `→ Vendido`.
- **Riesgo:** _rewording_, traducción, cambios de formato, eventos ausentes → métricas divergentes
  (hoy hay representaciones divergentes de "venta ocurrió").
- **Fuente canónica:** `Vehicle.status = VENDIDO` + `Vehicle.soldAt`, escritos en la transición de
  `lib/delivery-completion.ts`; `Offer` para métricas de reserva.
- **Alcance esperado:** identificar todas las lecturas (`lib/kpi/flow.ts:56`,
  `lib/dashboard/metrics.ts:194`, `lib/dashboard/queries.ts:57`); sustituir el _parsing_; reconciliar
  resultados; tests de integración; **sin tabla nueva**; **sin eliminar `Activity`**.
- **Fuera de alcance:** Deal, Party, Listing, Organization, StatusTransition, DomainEvent, Outbox,
  documentos.

> **El prompt ejecutable de este PR NO se escribe todavía.** Es una recomendación pendiente de
> aprobación del diseño.

---

## Drivers obligatorios (no exhaustiva; no es un schema definitivo)

| Entidad            | No implementar hasta que exista                                  |
| ------------------ | ---------------------------------------------------------------- |
| Party              | visión 360 cross-rol, empresas/CIF, payer ≠ buyer, o marketplace |
| Listing            | publicación programática, sellers externos o varios canales      |
| Deal               | operación con identidad propia, múltiples intentos o contratos   |
| Organization       | segundo operador real del CRM                                    |
| Membership         | usuarios con pertenencia a más de una organización               |
| BuyerIntent        | búsquedas activas múltiples, alertas o marketplace               |
| StatusTransition   | KPI real de tiempo-en-estado                                     |
| AuditEntry         | obligación de auditoría estructurada                             |
| DomainEvent        | múltiples consumidores del mismo hecho                           |
| Outbox             | efecto externo que requiera entrega garantizada                  |
| ServiceProvider    | catálogo real de proveedores                                     |
| VehicleOwnership   | cambios de propietario que deban conservarse históricamente      |
| ListingPublication | publicación programática multicanal                              |

## Relación con el rollout documental de Fase 0

**Puede avanzar en paralelo** (pista de código, no toca documentos): fact de venta, dedup,
`commercializationMode`, diseño de `ServiceOrder`, ADRs, mejoras no documentales.

**Debe esperar** (pista operativa de Fase 0): cualquier cambio en `VehicleDocument`,
`DeliveryDocument`, `DocumentVersion`; la retirada del _fallback_ legacy; la retirada de `url`; la
retirada de buckets legacy; cualquier migración mezclada con el backfill.

Reglas: el **rollout documental es una pista operativa independiente**; **no** mezclar migraciones de
Fase 1 con el rollout; las **tablas documentales permanecen congeladas** hasta backfill, verificación
y periodo de observación. Ver
[`../operations/fase-0-operational-closeout.md`](../operations/fase-0-operational-closeout.md).

---

## Próximo gate documental — PR de gobierno de ingeniería

**Después** de fusionar este diseño y **antes** del primer PR técnico se creará un **PR separado** de
gobierno de ingeniería con:

- `docs/governance/engineering-change-process.md`
- `docs/governance/testing-strategy.md`
- `.github/pull_request_template.md`
- actualización mínima de `CLAUDE.md`

Deberá formalizar: análisis de impacto · clasificación del cambio · migraciones · seguridad ·
autorización · concurrencia · tests · documentación · CI · rollback · validación post-merge.

> **Esos archivos NO se crean en este PR.** Aquí solo se documenta que es el siguiente gate.

## Secuencia global

1. Rollout documental de Fase 0 _(pista operativa)_ ‖ 2. Fase 1A _(pista de código, additiva,
   no-gated; empieza por el PR 1)_ → 3. Fase 1B _(por driver)_ → 4. Fase 1C _(marketplace)_ →
2. Fase 1D _(multiempresa)_. Las tablas de documentos solo se tocan tras el rollout + observación.
