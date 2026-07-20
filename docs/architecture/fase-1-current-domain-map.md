# Fase 1 — Mapa del dominio actual

| Campo                            | Valor                                                                                                                                                                                  |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Título**                       | Mapa verificable del dominio actual (as-is)                                                                                                                                            |
| **Estado**                       | ACTIVE                                                                                                                                                                                 |
| **Owner**                        | Architecture / Engineering                                                                                                                                                             |
| **Última revisión**              | 2026-07-13                                                                                                                                                                             |
| **Fuente de verdad relacionada** | El repositorio (`prisma/schema.prisma`, `app/(backoffice)/**`, `lib/**`). Este documento lo resume. Diseño objetivo: [`fase-1-domain-architecture.md`](fase-1-domain-architecture.md). |
| **Alcance**                      | Inventario, flujos y hechos del dominio **actual**.                                                                                                                                    |
| **Fuera de alcance**             | Arquitectura objetivo (ver el documento de diseño). Este documento describe lo que **existe**, no lo que se propone.                                                                   |

> Este documento describe el repositorio **real** en `main` (`f089a7e`), no la arquitectura futura.

---

## 7.1. Inventario por modelo (30 modelos)

Clasificación: **A** activo · **P** parcial/soporte · **L** legacy · **M** muerto.

| Modelo                             | Cl.   | Propósito real                                                  | Relaciones clave                               | Destino recomendado                                 |
| ---------------------------------- | ----- | --------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------- |
| User                               | A     | Usuario interno + rol global                                    | hub de ~26 relaciones                          | conservar (→ Membership futuro)                     |
| SellerLead                         | A     | Lead de vendedor + condiciones de operación                     | 1:1 Vehicle; Activity; Capture                 | conservar; **dedup**                                |
| Vehicle                            | A     | Activo + inventario + publicación + economía + trust (conflado) | 1:1 SellerLead; Match/Offer/Delivery/WorkOrder | conservar; + `commercializationMode`                |
| VehiclePhoto                       | A     | Fotos (bucket público)                                          | Vehicle                                        | conservar                                           |
| Valuation                          | A     | Histórico de tasación                                           | Vehicle                                        | conservar                                           |
| BuyerLead                          | A     | Lead de comprador + preferencias RV + trade-in                  | Match/Offer/Delivery; chat                     | conservar; **dedup**; + `partyId` futuro            |
| BuyerChatSession                   | A     | Sesión de chat de captación                                     | 1:1 BuyerLead                                  | conservar                                           |
| Match                              | A     | Cruce vehículo↔comprador (score)                                | Vehicle, BuyerLead                             | conservar                                           |
| Offer                              | A     | Oferta/reserva (importe + señal)                                | Vehicle, BuyerLead, Match                      | conservar; + `dealId` futuro                        |
| Activity                           | A     | Timeline humano (polimórfico leads)                             | SellerLead XOR BuyerLead                       | conservar como timeline; dejar de parsear para KPIs |
| Document                           | **M** | (adjunto legal genérico) — **0 CRUD**                           | —                                              | **retirar**                                         |
| VehicleAd                          | P     | **Texto** de anuncio IA para portales externos                  | Vehicle                                        | conservar; absorber en Listing (futuro)             |
| VehicleCost                        | A     | Coste imputado al vehículo                                      | Vehicle, WorkOrder                             | conservar                                           |
| WorkOrder (+ checklist/time/parts) | A     | Orden de taller                                                 | Vehicle                                        | conservar                                           |
| Delivery (+ checklist/documents)   | A     | Entrega física + firma                                          | Vehicle, BuyerLead                             | conservar; + `dealId` futuro                        |
| DeliveryDocument                   | A     | Documento de entrega (versionado)                               | Delivery, DocumentVersion                      | conservar (**gated** por rollout)                   |
| DocumentVersion                    | A     | Versión física de documento (Fase 0)                            | VehicleDocument XOR DeliveryDocument           | conservar (**gated**)                               |
| Warranty                           | A     | Garantía (1:1 vehicle/delivery/buyer)                           | tickets, followups                             | conservar                                           |
| PostventaTicket (+ photos)         | A     | Incidencia de garantía                                          | Warranty                                       | conservar                                           |
| PostventaFollowup                  | A     | Seguimiento día 7/30 (cron)                                     | Warranty                                       | conservar                                           |
| CalendarEvent                      | A     | Evento de agenda operativa                                      | leads/vehicle/match                            | conservar                                           |
| VehicleCapture                     | A     | Captación de portal (fase 0 del vendedor)                       | → SellerLead                                   | conservar                                           |
| VehicleDocument                    | A     | Documento legal del vehículo (versionado)                       | Vehicle, DocumentVersion                       | conservar (**gated**)                               |
| ReferencePrice                     | A     | Tabla de tasación (global)                                      | —                                              | conservar (platform-owned futuro)                   |
| KpiEvent                           | P     | Log de eventos (**write-mostly**: 7 emisores, 1 lector)         | actor User?                                    | decidir (leer o dejar de escribir)                  |

**Resumen:** activos ~24 · parciales/soporte ~4 · legacy 1 enum (`DocumentType`) · **muerto 1**
(`Document`).

## 7.2. Flujos actuales (reconstruidos del código)

- **Captación:** `VehicleCapture` (portal externo) → estados NO_CONTACTADO…ENTRADA_AGENDADA.
- **Conversión captura→vendedor:** `convertCaptureToSellerLead` crea `SellerLead` (con `email:''`) +
  `Vehicle` dentro de `$transaction` con CAS (Fase 0 PR4).
- **Tasación:** `Valuation` (auto/manual) — efecto reintentable, fuera de la tx principal.
- **Publicación:** `Vehicle.status = PUBLICADO` (no hay entidad `Listing`).
- **Comprador:** chat `/comprar` (`BuyerChatSession`, tool-use crea `BuyerLead` en tx) o alta
  backoffice → preferencias RV.
- **Matching:** `Match` (score 0-100, `lib/matching`, determinista).
- **Oferta:** `Offer` (importe + señal opcional).
- **Reserva:** **derivada**, no es una tabla — `Offer.status = ACEPTADA` + `depositAmount`
  (`isReservation`, `lib/offers.ts:57`); aceptar pone `Vehicle = RESERVADO` (CAS, PR2).
- **Entrega (venta canónica):** `lib/delivery-completion.ts` completa la entrega y hace CAS
  `PUBLICADO|RESERVADO → VENDIDO` + `soldAt` (`:90-91`), y crea `Warranty` + 2 `PostventaFollowup` en
  la misma tx (PR3).
- **Garantía / postventa:** `Warranty` → `PostventaTicket` (cierre con `costReal` → `VehicleCost`
  POSTVENTA) + `PostventaFollowup` (cron día 7/30).
- **Trade-in:** `BuyerLead.tradeInSellerLeadId` (1:1) → `createSellerLeadFromTradeIn` crea
  `SellerLead` + `Vehicle` en tx.
- **Taller / costes:** `WorkOrder` → horas/piezas → `VehicleCost`.
- **Documentos:** `VehicleDocument` / `DeliveryDocument` versionados vía `DocumentVersion`
  (Fase 0; backfill legacy **pendiente**).

## 7.3. Hechos importantes (verificados)

- **No existe tabla `Reservation`**; la reserva se **deriva** de `Offer` aceptada + señal.
- **No existe `Listing`**; publicar equivale a `Vehicle.status = PUBLICADO`.
- **No existe `Deal`**; `Offer` y `Delivery` se relacionan por `Vehicle` y `BuyerLead`.
- La **venta canónica** se completa en `lib/delivery-completion.ts` (`Vehicle.status=VENDIDO` +
  `soldAt`, en `$transaction`).
- `Activity` es un **timeline humano**; ya **no** se usa para KPIs de venta. Desde **PR #111** (fact de
  venta canónico) las lecturas (`lib/kpi/flow.ts`, `lib/dashboard/metrics.ts`,
  `lib/dashboard/queries.ts`) cuentan desde el **hecho canónico** (`Vehicle.status = VENDIDO` +
  `Vehicle.soldAt` en el periodo), no desde `content: { contains: '→ Vendido' }`.
- `KpiEvent` es **write-mostly** (7 sitios de emisión; único lector `lib/kpi/calidad.ts`, 2 `count()`).
- `VehicleAd` es **texto** que un humano pega en portales externos (Wallapop/Coches.net); no tiene
  precio ni estado.
- La **modalidad comercial** vive implícita en `SellerLead.dealType` (`SellerDealType`:
  DEPOSITO_VENTA / COMPRA_DIRECTA / PARTE_PAGO / INDECISO), no en el vehículo.
- **Autorización** por **rol global** (`UserRole`) en las server actions (`requireAgente/Admin`); no
  hay checks de ownership por entidad.
- **No existe archivado.** Lo que hay son decisiones **comerciales** terminales: `discardSellerLead`
  (→ `DESCARTADO`) y `markBuyerLeadLost` (→ `PERDIDO`), con motivo obligatorio y `Activity`. No
  ocultan el registro de las bandejas, no eliminan datos y no son reversibles. No hay soft-delete
  genérico. El prefijo `archive*` queda **reservado** para el archivado real (no implementado).
- **`CalendarEvent.commitment`** (`EventCommitment`: EXTERNO / INTERNO / INDETERMINADO) — el tipo de
  evento **no** basta para saber si romperlo afecta a un cliente: una `LLAMADA` puede ser una
  llamada concertada o un recordatorio para llamar. La clasificación es explícita y la impone el
  servidor (`lib/calendar/commitment.ts`): `CITA → EXTERNO`, `LIMPIEZA → INTERNO`; `LLAMADA` y
  `OTRO` **exigen elección** del usuario. `SEGUIMIENTO` no es creable desde la UI (fuera de
  `NATIVE_EVENT_TYPES`) y queda `INDETERMINADO`.
  - **Histórico:** el backfill solo clasificó lo inequívoco (`CITA`, `LIMPIEZA`); `LLAMADA`, `OTRO`
    y `SEGUIMIENTO` quedaron `INDETERMINADO` **a propósito** — suponerlos internos podría ocultar un
    compromiso real con un cliente. Se clasifican a mano desde la ficha del evento
    (`setEventCommitment`), sin posibilidad de volver a `INDETERMINADO`.
  - **Uso previsto — todavía NO implementado:** el archivado de leads bloqueará ante un evento
    futuro no terminal `EXTERNO` **o** `INDETERMINADO` (no puede demostrarse que sea interno), y
    solo advertirá ante `INTERNO`. Esa regla llega en I4/B2 final; **hoy este campo no gobierna
    ningún comportamiento**: solo se guarda y se muestra.
  - **Sin índice propio:** la consulta futura de archivado filtra primero por `seller_lead_id` /
    `buyer_lead_id` / `vehicle_id` (ya indexados), lo que deja pocas filas por lead; `commitment`
    tiene 3 valores y no aportaría selectividad.
  - Las órdenes de taller que el calendario **agrega** no son `CalendarEvent`, no tienen
    `commitment` y siguen gobernadas por el estado del vehículo y de la orden.

## 7.4. Riesgos del dominio actual

- Duplicados de **vendedores** (dedup inexistente; capturas con `email:''`).
- **Venta contada por texto** de `Activity` (frágil ante reword/i18n/formato).
- Datos `Json` sin contrato (`equipment`, `criticalEquipment`, `metadata`, `specificData`,
  `messages`).
- Autorización global (cualquier ADMIN/AGENTE ve/edita todo) — **decisión** para el equipo de
  confianza actual, no un descuido.
- Efectos diferidos _fire-and-forget_ (emails, `emitKpiEvent`, matching, tasación).
- Sin auditoría estructurada.
- Ambigüedad de `Document` legacy (muerto) frente a los documentos versionados reales.

> **Las limitaciones futuras (sin `Organization`/`Party`/`Listing`/`Deal`) NO son defectos críticos
> del CRM actual.** Son cimientos ausentes cuya introducción se difiere hasta que exista un driver
> (ver [`fase-1-evolution-roadmap.md`](fase-1-evolution-roadmap.md)).
