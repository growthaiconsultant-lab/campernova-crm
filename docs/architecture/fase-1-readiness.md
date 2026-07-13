# Fase 1 — Preparación (análisis, no implementación)

| Campo                            | Valor                                                                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Título**                       | Preparación de Fase 1 — análisis de evolución de dominio                                                                |
| **Estado**                       | DRAFT                                                                                                                   |
| **Owner**                        | Architecture / Product                                                                                                  |
| **Última revisión**              | 2026-07-13                                                                                                              |
| **Fuente de verdad relacionada** | Este documento (análisis de Fase 1). El estado de Fase 0 está en [`fase-0-final-state.md`](fase-0-final-state.md).      |
| **Alcance**                      | Análisis de los problemas estructurales y de las decisiones a investigar antes de implementar Fase 1.                   |
| **Fuera de alcance**             | Diseño del esquema definitivo, implementación de código o migraciones. **Este documento no diseña ni implementa nada.** |

> **Fase 1 NO está iniciada.** Este documento es análisis para preparar su diseño. La base de este
> análisis es la auditoría de arquitectura de 2026-07-10, conservada en
> [`../historical/architecture-audit-2026-07-10.md`](../historical/architecture-audit-2026-07-10.md).

---

## Punto de partida

- **CRM single-dealer** en producción, técnicamente sólido: lógica de negocio pura y testeada,
  máquina de estados central para entidades núcleo, autorización server-side consistente.
- **Seguridad y atomicidad reforzadas** en Fase 0 (RLS, transacciones CAS, Storage privado).
- **CI reproducible** (4 jobs, base efímera, sin secretos remotos).
- **Deuda legacy aislada** (columna `url` + fallback, con retirada planificada).
- **Rollout documental pendiente**: la implementación de Fase 1 sobre tablas de documentos debe
  esperar a que el backfill esté ejecutado y verificado (ver
  [`fase-0-final-state.md`](fase-0-final-state.md) y
  [`../operations/fase-0-operational-closeout.md`](../operations/fase-0-operational-closeout.md)).

---

## Problemas estructurales futuros (identificados, no resueltos)

Adecuados para el negocio single-dealer actual; se vuelven limitaciones al evolucionar hacia
plataforma/marketplace/SaaS.

- **Sin `Organization`** ni tabla de organizaciones.
- **Sin `Membership`** (usuario ↔ organización ↔ rol).
- **Usuarios ligados a un único contexto** (rol global, no por organización).
- **`Vehicle` y `Listing`/publicación conflados**: la publicación es un `VehicleStatus`, no una
  entidad de anuncio con ciclo de vida propio.
- **`Party` fragmentado**: comprador y vendedor son entidades separadas que duplican a la misma
  persona; no hay identidad canónica.
- **`Deal`/operación fragmentado**: el ciclo Match→Offer→Delivery no se agrega en una entidad de
  operación.
- **Modelo `Document` muerto**: el modelo Prisma `Document` (y el enum `DocumentType`) están
  **sin uso**, ambiguos frente a `VehicleDocument`/`DeliveryDocument` (los reales, ya versionados).
- **JSON de dominio**: varios campos `Json` llevan datos de negocio fuera del sistema de tipos.
- **`Activity` usada como fuente analítica**: ventas/tiempos se cuentan por _string-parsing_ de
  `Activity.content`, no sobre datos estructurados.
- **Sin soft-delete** ni política de retención/RGPD (borrado/exportación).
- **Sin outbox** para efectos diferidos fiables (hoy fire-and-forget).
- **Sin aislamiento por tenant** (cualquier agente ve/edita todo).

---

## Decisiones que deben investigarse (en el análisis de Fase 1)

`Organization` · `Membership` · `Party` · `Vehicle` · `Listing` · `Deal` · `Transaction` ·
`Ownership` · `Consignment` · intención de compra (`Buyer intent`) · intención de venta
(`Seller intent`) · anuncio de marketplace (`Marketplace listing`) · onboarding de concesionarios ·
aislamiento por tenant · plataforma de datos · modelo de eventos · `Outbox` · `Audit trail`.

> Cada una es una **pregunta de diseño**, no una decisión tomada. Ninguna debe implementarse antes
> de un análisis de dominio y un mapa de _bounded contexts_.

---

## Secuenciación recomendada

1. **Análisis de dominio** (identidad, inventario, ventas, operaciones, analítica).
2. **Mapa de _bounded contexts_** y de propiedad de datos.
3. **Modelo objetivo** (ER objetivo, additivo, con compatibilidad temporal).
4. **Estrategia de migración** por cada cambio (expandir → backfill → observar → contraer).
5. **No** añadir `organizationId` de forma improvisada: sólo tras decidir el modelo de tenancy.
6. **No** construir el marketplace sobre `VehicleStatus`: requiere `Listing` como entidad propia.
7. **No** modificar las tablas de documentos hasta que el rollout documental esté ejecutado y
   verificado (dependencia dura, ver más abajo).
8. **Empezar** por cambios compatibles con el CRM actual (aditivos, sin romper flujos vivos).

---

## Gates — qué puede empezar ya y qué debe esperar

| Actividad                                                      | ¿Puede empezar ya?                   | Condición                                                                  |
| -------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------- |
| Análisis de dominio y _bounded contexts_                       | **Sí**                               | —                                                                          |
| Diseño del ER objetivo (borrador, additivo)                    | **Sí**                               | Sin implementar                                                            |
| Estrategia de migración (documento)                            | **Sí**                               | Sin ejecutar                                                               |
| Decisión de modelo de tenancy                                  | **Sí** (decisión), no implementación | —                                                                          |
| Implementación de `Organization`/`Membership`/`organizationId` | **No**                               | Tras decidir el modelo de tenancy en el análisis                           |
| Implementación de `Party`/`Listing`/`Deal`                     | **No**                               | Tras el diseño y la estrategia de migración                                |
| **Cualquier migración estructural sobre tablas de documentos** | **No**                               | Tras el backfill documental **ejecutado y verificado** (rollout de Fase 0) |
| Marketplace / usuarios externos                                | **No**                               | Tras `Listing` + multi-tenant                                              |

> **No se diseña aquí el esquema definitivo ni se implementa código.** Este documento sólo delimita
> el análisis y sus dependencias.
