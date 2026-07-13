# Fase 1 — Arquitectura de dominio (diseño estratégico)

| Campo                            | Valor                                                                                                                                                                                                                                                                             |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Título**                       | Arquitectura de dominio y dirección evolutiva de Fase 1                                                                                                                                                                                                                           |
| **Estado**                       | ACTIVE (dirección aprobada)                                                                                                                                                                                                                                                       |
| **Owner**                        | Architecture                                                                                                                                                                                                                                                                      |
| **Última revisión**              | 2026-07-13                                                                                                                                                                                                                                                                        |
| **Fuente de verdad relacionada** | Este documento (diseño de Fase 1). Dominio actual: [`fase-1-current-domain-map.md`](fase-1-current-domain-map.md). Secuencia: [`fase-1-evolution-roadmap.md`](fase-1-evolution-roadmap.md). Decisiones: [`architecture-decisions.md`](architecture-decisions.md) (AD-009…AD-016). |
| **Alcance**                      | Diseño conceptual del dominio, decisiones de dirección, y qué NO construir todavía.                                                                                                                                                                                               |
| **Fuera de alcance**             | Implementación (salvo Fase 1A-1), schema Prisma definitivo, migraciones, marketplace, multi-tenancy. **Solo Fase 1A-1 (fact de venta canónico) está implementada; el resto de Fase 1 no.**                                                                                        |

> **Cómo leer este documento.** Distingue siempre cuatro grados: **diseñado** (modelo conceptual),
> **aprobado como dirección** (ADR), **recomendado** (candidato a PR), **pendiente/diferido** (espera
> un driver). Salvo el **fact de venta canónico (Fase 1A-1, PR #111)**, ninguna otra parte está
> **implementada**. "Diseñar el marketplace" ≠ "implementar el marketplace"; "diseñar multi-tenancy" ≠
> "crear `Organization` ahora".

---

## 6.1. Contexto

- Campers Nova es hoy un **CRM interno de un único concesionario** (equipo pequeño de confianza).
- Modelo de negocio: **compraventa e intermediación** de autocaravanas/campers (consignación,
  compra directa, parte de pago), con operaciones propias (taller, entregas, postventa).
- Trayectoria prevista (dirección, no compromiso): **marketplace** público → **SaaS multiempresa**
  → **plataforma de datos sectorial**.
- **Cierre técnico de Fase 0: PASS.** **Cierre operativo de Fase 0: PENDING** (rollout documental
  aún no ejecutado). Ver [`fase-0-final-state.md`](fase-0-final-state.md) y
  [`../operations/fase-0-operational-closeout.md`](../operations/fase-0-operational-closeout.md).

## 6.2. Principio central

**Preparar la trayectoria futura sin construir hoy abstracciones que no tienen consumidor.**

Regla operativa — **"Ship the field, gate the entity"** ("entrega el campo, aplaza la entidad"):

- Cuando un **campo** aditivo resuelve el problema actual, **no** se crea un agregado completo.
- Una **entidad nueva** exige un **driver** concreto y verificable (un consumidor real, no una
  hipótesis de fase futura).
- Las **ADR** pueden **fijar la dirección** antes de implementar tablas; la dirección es barata y
  reversible, la tabla sin consumidor es deuda.
- El **producto actual (CRM interno) es prioritario**: los cambios inmediatos deben aportarle valor.

**Riesgo arquitectónico dominante: la abstracción prematura.** La revisión adversarial del análisis
marcó como sobredimensionadas o mal secuenciadas la mayoría de las "grandes entidades"
(Party/Listing/Deal/Organization/bus de eventos) para la etapa actual.

## 6.3. Estado actual del dominio (resumen)

**30 modelos** verificados en `prisma/schema.prisma`. Inventario y flujos detallados en
[`fase-1-current-domain-map.md`](fase-1-current-domain-map.md). Clasificación:

- **Activos (core):** User, SellerLead, Vehicle, BuyerLead, Match, Offer, Delivery, Warranty,
  WorkOrder (+ checklist/time/parts), VehicleCost, Activity, CalendarEvent, VehicleCapture,
  VehicleDocument, DeliveryDocument, DocumentVersion, Valuation, VehiclePhoto, ReferencePrice,
  BuyerChatSession, PostventaTicket, PostventaFollowup.
- **Parcialmente usados / soporte:** VehicleAd (solo **texto** de anuncio para portales externos;
  sin precio ni estado), KpiEvent (**write-mostly**: 7 emisores, 1 lector), PostventaTicketPhoto,
  DeliveryChecklistItem.
- **Legacy:** enum `DocumentType`.
- **Muerto (confirmado por código, 0 CRUD):** modelo `Document`. Los documentos reales viven en
  `VehicleDocument`, `DeliveryDocument` y `DocumentVersion` (versionados en Fase 0). La **retirada
  de `Document`** solo procede tras confirmar la tabla vacía, en un PR separado additivo
  (expand/contract), y **respetando el rollout documental** (no mezclar con las tablas de documentos
  vivas).

## 6.4. Dolor actual vs limitaciones futuras

Distinción deliberada — una limitación futura **no** obliga a crear una tabla hoy.

### Dolor actual verificado (justifica trabajo NOW)

| Dolor                                                                                                         | Evidencia                                                                                                                                                           | Naturaleza                        |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Deduplicación de **vendedores** inexistente                                                                   | capturas crean `SellerLead` con `email:''`; dedup solo en compradores                                                                                               | corrección de datos               |
| Ventas calculadas por **parsing de `Activity`** — **RESUELTO (PR #111)**                                      | antes `content: { contains: '→ Vendido' }` en `lib/kpi/flow.ts`, `lib/dashboard/metrics.ts`, `lib/dashboard/queries.ts`; ahora leen desde `Vehicle.status`/`soldAt` | integridad de KPI (resuelto)      |
| **Servicios de comisión sin modelo** (financiación, seguro, gestoría, transporte, peritaje, contrato externo) | no existe entidad; hoy es nota libre                                                                                                                                | superficie de ingresos ausente    |
| **Modalidad comercial** del vehículo implícita                                                                | vive en `SellerLead.dealType` (`SellerDealType`), no en el vehículo                                                                                                 | _porqué_ comercial no consultable |

### Limitaciones futuras (dirección, no defecto del CRM actual)

Ausencia de `Organization`/`Membership`; `Vehicle` conflado (activo + inventario + publicación +
economía + trust); ausencia de `Listing`; ausencia de `Party`; ausencia de `Deal`; permisos por rol
global; ausencia de tenancy; ausencia de outbox/audit estructurado; datos `Json` sin contrato;
ausencia de ownership/consignment explícitos.

## 6.5. Bounded contexts (monolito modular, NO microservicios)

| Contexto                | Responsabilidad                 | Entidades actuales                                         | Entidades futuras                                                | Estado                            | Driver de implementación                    |
| ----------------------- | ------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------- | ------------------------------------------- |
| Identity & Access       | AuthN + roles                   | User                                                       | Organization, Membership, PlatformRole                           | actual → futuro                   | 2º operador real del CRM                    |
| Parties & Relationships | Identidad de personas/empresas  | (embebida en leads)                                        | Party/Contact                                                    | futuro                            | 360 cross-rol / empresa-CIF / dealers       |
| Vehicle Registry        | Identidad y ficha del vehículo  | Vehicle, VehiclePhoto, VehicleDocument                     | (split de Vehicle)                                               | consolidar                        | —                                           |
| Inventory & Ownership   | Propiedad/custodia/modalidad    | `SellerLead.dealType` (implícito)                          | commercializationMode (campo), luego Ownership/InventoryPosition | actual (campo) → futuro (entidad) | cambios de propietario históricos           |
| Listings & Marketplace  | Publicación por canal           | `Vehicle.status=PUBLICADO`, VehicleAd (texto)              | Listing, ListingPublication                                      | futuro                            | publicación programática / sellers externos |
| Demand & Matching       | Intención y cruce               | BuyerLead, Match                                           | BuyerIntent                                                      | consolidar                        | alertas / marketplace                       |
| CRM & Engagement        | Leads, tareas, actividades      | leads, Activity, CalendarEvent                             | (StatusTransition)                                               | consolidar                        | KPI de tiempo-en-estado                     |
| Deals & Transactions    | Operación end-to-end            | Offer, Delivery (implícito)                                | Deal lean                                                        | futuro                            | operación con identidad propia              |
| Fulfilment              | Documentación/servicios/entrega | Delivery, VehicleDocument                                  | ServiceOrder                                                     | actual (parcial) → recomendado    | —                                           |
| Warranty & After-sales  | Garantía/taller/coste           | Warranty, PostventaTicket/Followup, WorkOrder, VehicleCost | —                                                                | consolidar                        | —                                           |
| Documents               | Raíces + versiones              | VehicleDocument, DeliveryDocument, DocumentVersion         | —                                                                | **construido (Fase 0)**           | —                                           |
| Data & Analytics        | Eventos, métricas               | KpiEvent, `lib/kpi/*`                                      | DomainEvent (futuro)                                             | consolidar                        | múltiples consumidores del mismo hecho      |

Dependencias: Identity → todos; Parties → CRM/Deals/Listings; Vehicle Registry → Inventory →
Listings → Marketplace; Demand → Matching → Deals; Deals → Fulfilment → Warranty; todos →
Data & Analytics. **Todo dentro de un monolito modular Next.js + Prisma + Postgres.**

---

## Decisiones de diseño (detalle; las decisiones aprobadas se registran como ADR)

> Cada bloque resume opciones y la **dirección aprobada**. La decisión formal (contexto/alternativas/
> consecuencias/driver/estado/evidencia) vive en [`architecture-decisions.md`](architecture-decisions.md).

### Party — DIFERIDO (AD-010)

- **Opciones:** A (Buyer/Seller separados) · B (Party canónico + roles explícitos) · C (Party/Contact
  fino con perfiles/referencias especializados).
- **Dirección aprobada:** **no implementar Party ahora.** Mantener `BuyerLead`/`SellerLead` como
  fuente de la interacción; **mejorar primero la identidad** con deduplicación de vendedores
  (corrección real). `Party`/`Contact` se introduciría **additivamente** (FK nullable, backfill
  lazy, merge cross-rol como acción **revisada**, nunca auto-merge) cuando exista driver.
- **Riesgos a gestionar:** auto-merge erróneo de identidades; `normalizePhone` demasiado débil para
  ser clave de identidad (fijos/extranjeros/empresa); roles como enum universal (no; derivar de las
  filas que referencian).

### Vehicle / Ownership / Inventory / Listing — CAMPO AHORA, ENTIDAD DIFERIDA (AD-011)

- **Conceptos:** Vehicle = activo físico; Ownership = propietario y periodo; Custody = custodio
  físico; InventoryPosition = _por qué_ la organización lo comercializa; Listing = representación
  comercial publicada; ListingPublication = publicación por canal.
- **Dirección aprobada:** `Vehicle` sigue siendo el activo del CRM. **Capturar la modalidad comercial
  con un campo `commercializationMode`** (candidatas: OWN / CONSIGNMENT / INTERMEDIATION / TRADE*IN),
  seed \_best-effort* desde `SellerLead.dealType` (`DEPOSITO_VENTA`→CONSIGNMENT, `COMPRA_DIRECTA`→OWN,
  `PARTE_PAGO`→TRADE_IN, `INDECISO`→sin dato; INTERMEDIATION no es directamente derivable). **Diferir
  `Listing`, `Ownership` e `InventoryPosition`.** **No** dual-write `Vehicle.status ↔ Listing.status`
  en esta etapa (coste real: ~30 readers + acoplamiento con la reserva `RESERVADO`).
- **El enum definitivo de `commercializationMode` se valida en su PR técnico.**

### Deal / Operación — DIFERIDO (AD-012)

- **Modelo actual:** operación dispersa `Match → Offer → (reserva derivada) → Delivery → Warranty`,
  unida solo por `vehicleId`/`buyerLeadId`. La venta canónica se completa en
  `lib/delivery-completion.ts` (CAS `PUBLICADO|RESERVADO → VENDIDO` + `soldAt`).
- **Opciones:** A (flujo distribuido) · B (Deal lean) · C (Deal comercial + Transaction contractual).
- **Dirección aprobada:** **no crear `Deal` en el primer bloque.** Corregir primero el fact de venta
  (no requiere Deal). `Deal` lean (referencia `vehicleId`+`buyerLeadId`+`dealType`+`status`+
  `closedAt/outcome`, con `dealId` nullable en Offer/Delivery) solo ante un driver. **Resolver antes
  la colisión de `dealType`** (ya existe en `SellerLead`).
- **Lifecycle conceptual futuro (no aprobado como enum):** OPEN → RESERVED → WON / LOST.

### Organization / Membership / Multi-tenancy — DIRECCIÓN, CERO TABLAS (AD-013)

- **Opciones:** shared-schema + `organizationId` · schema-por-org · db-por-org · híbrido.
- **Dirección aprobada:** **shared-schema con propiedad explícita** como destino; **no crear
  `Organization`/`Membership`/`organizationId` ahora.** Definir la **clasificación de propiedad**
  (abajo) como dirección. Tenancy cuando exista un **segundo operador real del CRM** (los dealers del
  futuro marketplace son _contrapartes_, no tenants que operen el CRM).
- **Tenant-owned (futuro):** leads, Vehicle, Offer, Deal, Delivery, Warranty, WorkOrder, VehicleCost,
  Activity, CalendarEvent, VehicleCapture, Match, ServiceOrder, documentos.
- **Platform-owned (futuro):** ReferencePrice, taxonomías RV, catálogos, User (identidad global vía
  Membership), datos agregados anonimizados.
- Esta clasificación es **dirección**, no schema definitivo; **no** añadir `organizationId`
  indiscriminadamente.

### Marketplace — DIFERIDO (AD-016)

- **Modelo conceptual futuro:** Vehicle · Listing · ListingPublication · seller particular · dealer ·
  moderación · verificación · lead de marketplace · buyer intent · match · reserva · servicio
  contratado · operación.
- **Dirección aprobada:** **no se implementa durante la etapa CRM interna.** Su diseño **no** obliga
  a crear Listing/BuyerIntent/Organization/tenancy ahora; **no** debe condicionar cada mejora interna.
- **Drivers mínimos para empezarlo:** decisión comercial aprobada; flujo público definido; onboarding
  de sellers; política de moderación; modelo de monetización; ownership de listings; estrategia legal
  y de privacidad; operaciones capaces del volumen; métricas de éxito; equipo responsable.

### Buyer Intent y Matching — MATCHING SE MANTIENE, BUYERINTENT DIFERIDO (AD-014 relacionado)

- **Actual:** `BuyerLead` (perfil + preferencias RV), `Match` (score 0-100, `lib/matching`
  determinista + scoring). Colapsa perfil / intención / búsqueda / oportunidad en `BuyerLead`.
- **Dirección aprobada:** **mantener el matching determinista actual.** **No** crear `BuyerIntent`;
  **no** introducir IA avanzada. `BuyerIntent` aparecería con búsquedas simultáneas, alertas,
  marketplace o comportamiento suficiente.
- **Evolución del matching:** reglas → scoring (hoy) → señales de comportamiento → IA asistida — solo
  sobre un stream de eventos real. La IA **no** sustituye un modelo de datos correcto.

### Activity, analítica y eventos — CORREGIR LECTURAS, DIFERIR BUS (AD-014)

- **Separación conceptual:** `Activity` (timeline humano) · fact transaccional (columna/relación) ·
  `StatusTransition` (historial tipado de estados, solo si se necesita) · `AuditEntry` (quién cambió
  qué) · `DomainEvent` (hecho para consumidores internos) · `OutboxMessage` (entrega fiable).
- **Dirección aprobada:** **no crear Event Bus / Outbox / DomainEvent genérico ahora.** Corregir
  primero las **lecturas analíticas**: ventas desde `Vehicle.status`/`Vehicle.soldAt` (transición
  canónica en `lib/delivery-completion.ts`), reservas desde estado + importe de `Offer`. `Activity`
  deja de ser fuente de verdad para KPIs. `StatusTransition` solo si hay demanda real de
  tiempo-en-estado fiable (hoy `lib/dashboard/time-in-state.ts` lo reconstruye por texto).
- **Lectores de venta a corregir (verificados):** `lib/kpi/flow.ts:56`, `lib/dashboard/metrics.ts:194`,
  `lib/dashboard/queries.ts:57`.

### Servicios transaccionales — SERVICEORDER RECOMENDADO (AD-015)

- **Dirección aprobada:** `ServiceOrder` como modelo para servicios **hoy sin hogar**. Catálogo
  inicial acotado: FINANCIACION, SEGURO, CAMBIO_NOMBRE, TRANSPORTE, PERITAJE, CONTRATO_EXTERNO.
  **Excluir** reserva, entrega, taller y garantía (ya tienen modelo). **No** crear `ServiceProvider`
  inicialmente (usar `providerName` String). Contraparte polimórfica `buyerLeadId XOR sellerLeadId`
  (espejo de `Activity`), `vehicleId` nullable, `status`+guard, `amount`, `commissionAmount`.
- `commissionAmount` **debe distinguirse** del margen del vehículo (`Vehicle.marginPercent`).
- **`ServiceOrder` está recomendado, NO implementado.**

---

## Matriz actual → objetivo

| Actual           | Problema                       | Destino                                | Estrategia               | Driver                | Fase    | Riesgo    | Acción inmediata            |
| ---------------- | ------------------------------ | -------------------------------------- | ------------------------ | --------------------- | ------- | --------- | --------------------------- |
| User             | rol global                     | User + Membership                      | conservar → extender     | 2º operador           | 1D      | bajo      | ninguna                     |
| BuyerLead        | identidad duplicada            | + `partyId` (nullable)                 | conservar → extender     | 360/dealer            | 1B      | medio     | dedup                       |
| SellerLead       | sin dedup; identidad duplicada | + `partyId`                            | conservar → extender     | 360/dealer            | 1A→1B   | medio     | **dedup (PR 2)**            |
| Vehicle          | conflado                       | + `commercializationMode`; luego split | extender → dividir       | Listing driver        | 1A / 1C | bajo→alto | **campo (PR 3)**            |
| VehicleAd        | solo texto                     | absorber en Listing                    | complementar → fusionar  | marketplace           | 1C      | medio     | ninguna                     |
| Offer            | sin operación                  | + `dealId` nullable                    | conservar → extender     | Deal driver           | 1B      | bajo      | ninguna                     |
| Delivery         | sin operación                  | + `dealId` nullable                    | conservar → extender     | Deal driver           | 1B      | bajo      | ninguna                     |
| Warranty         | —                              | —                                      | conservar                | —                     | —       | bajo      | ninguna                     |
| Match            | perfil/intención colapsados    | + BuyerIntent                          | conservar → complementar | alertas/marketplace   | 1C      | bajo      | ninguna                     |
| Activity         | fuente analítica por texto     | timeline humano + StatusTransition     | conservar → complementar | tiempo-en-estado      | 1A/1B   | bajo      | **dejar de parsear (PR 1)** |
| KpiEvent         | doble verdad                   | DomainEvent o retirar escritura        | decidir                  | consumidores          | 1B      | bajo      | ninguna                     |
| VehicleCost      | —                              | —                                      | conservar                | —                     | —       | bajo      | ninguna                     |
| WorkOrder        | —                              | —                                      | conservar                | —                     | —       | bajo      | ninguna                     |
| VehicleDocument  | —                              | —                                      | conservar (gated)        | —                     | —       | —         | ninguna (rollout)           |
| DeliveryDocument | —                              | —                                      | conservar (gated)        | —                     | —       | —         | ninguna (rollout)           |
| DocumentVersion  | —                              | —                                      | conservar (gated)        | —                     | —       | —         | ninguna (rollout)           |
| Document         | muerto                         | retirar                                | retirar                  | tabla vacía + rollout | 1A\*    | bajo      | **retirar (PR 5)**          |
| — (servicios)    | sin modelo                     | ServiceOrder                           | crear                    | ingresos reales       | 1A      | bajo      | **crear (PR 4)**            |

> **`1A*`** = elegible en Fase 1A **pero condicionado**: solo tras verificar la tabla `documents`
> vacía y **sin mezclarse** con el rollout documental de Fase 0 (ver PR 5 en
> [`fase-1-evolution-roadmap.md`](fase-1-evolution-roadmap.md) y el riesgo **F1-R12**).

## Riesgos de Fase 1

| ID     | Riesgo                                               | Sev      | Prob       | Impacto                             | Mitigación                                  | Driver/Gate     | Fase  |
| ------ | ---------------------------------------------------- | -------- | ---------- | ----------------------------------- | ------------------------------------------- | --------------- | ----- |
| F1-R1  | **Abstracción prematura** (entidades sin consumidor) | **Alta** | Alta       | deuda estructural, velocidad        | ADR antes que tabla; driver obligatorio     | driver nombrado | todas |
| F1-R2  | Merge incorrecto de Party                            | Alta     | Media      | corrupción de identidad             | merge revisado, nunca auto                  | pre-Party       | 1B    |
| F1-R3  | Dual-write Vehicle/Listing                           | Alta     | Media      | dos fuentes de verdad en sitio vivo | diferir Listing; sin dual-write             | pre-Listing     | 1C    |
| F1-R4  | Tenant leakage                                       | Alta     | Baja (hoy) | fuga cross-org                      | split de propiedad + RLS por org            | 1D              | 1D    |
| F1-R5  | Colisión de `dealType` (Deal vs SellerLead)          | Media    | Media      | ambigüedad                          | resolver ubicación antes de Deal            | pre-Deal        | 1B    |
| F1-R6  | Migración incompleta                                 | Media    | Media      | estados incompatibles               | additivo + expand/contract                  | cada migración  | todas |
| F1-R7  | Reporting inconsistente durante transición de venta  | Media    | Media      | KPIs divergentes                    | dual-read + reconciliación                  | PR 1            | 1A    |
| F1-R8  | Eventos sin idempotencia (si se adelanta el bus)     | Media    | Baja       | duplicados                          | diferir outbox; CAS evita doble-commit      | pre-outbox      | 1B+   |
| F1-R9  | `commissionAmount` vs margen del vehículo            | Baja     | Media      | doble cómputo                       | documentar distinción                       | PR 4            | 1A    |
| F1-R10 | Sobrecarga operativa / pérdida de velocidad          | Media    | Media      | ritmo del equipo                    | bloques pequeños additivos                  | roadmap         | todas |
| F1-R11 | `ServiceOrder` demasiado genérico                    | Media    | Media      | catch-all                           | `serviceType` acotado a servicios sin hogar | PR 4            | 1A    |
| F1-R12 | Dependencia del rollout documental                   | Media    | —          | mezcla peligrosa                    | 1A no toca documentos; separación estricta  | siempre         | todas |

**Riesgo dominante: F1-R1 (abstracción prematura).**

---

## Estado de las piezas (referencia rápida)

| Pieza                              | Estado                                         |
| ---------------------------------- | ---------------------------------------------- |
| Marketplace                        | **diseñado conceptualmente, DIFERIDO**         |
| Multi-tenancy                      | **diseñado conceptualmente, DIFERIDO**         |
| Party                              | **DIFERIDO** (primero dedup)                   |
| Listing                            | **DIFERIDO** (primero `commercializationMode`) |
| Deal                               | **DIFERIDO** (primero fact de venta)           |
| Organization / Membership          | **DIFERIDOS**                                  |
| BuyerIntent                        | **DIFERIDO**                                   |
| DomainEvent / Outbox               | **DIFERIDOS**                                  |
| ServiceOrder                       | **RECOMENDADO, no implementado**               |
| commercializationMode              | **RECOMENDADO, no implementado**               |
| Fact de venta canónico (primer PR) | **IMPLEMENTADO / DESPLEGADO** (PR #111)        |

El orden de implementación, los drivers y el primer PR se detallan en
[`fase-1-evolution-roadmap.md`](fase-1-evolution-roadmap.md).
