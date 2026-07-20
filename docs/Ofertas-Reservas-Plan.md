# Block 18 — Ofertas y Reservas (Transaction & Financing Layer)

Captura estructurada de **ofertas** y **reservas** comprador→vehículo. El valor de negocio: registrar los **precios reales de cierre** y las **señales**, el dato más difícil de replicar por un competidor. Es la primera pieza de la capa transaccional; el cierre completo (contratos, pagos, financiación, gestoría) llega en fases posteriores.

## Decisión de modelado

Una sola entidad **`Offer`** cubre el ciclo oferta→reserva→venta. Una oferta **ACEPTADA con señal** (`depositAmount`) **es una reserva** — no se duplica en otra tabla. La **venta final** (`Vehicle` → `VENDIDO`) sigue viviendo en el flujo de `Delivery`; aquí solo se marca `CONVERTIDA`. Una sola fuente de verdad por concepto.

## Schema (migración additiva `20260709000000_add_offers`)

- Enum **`OfferStatus`**: `PROPUESTA → CONTRAOFERTA → ACEPTADA → CONVERTIDA` (+ terminales `RECHAZADA` / `EXPIRADA` / `RETIRADA` / `CANCELADA`).
- Modelo **`Offer`**: `vehicleId`, `buyerLeadId`, `matchId?`, `amount` (importe ofertado/acordado), `depositAmount?` (señal), `reservedUntil?`, `notes`, `rejectionReason?` (`LostReason`), `createdById`, `decidedAt?`. Índices por `(vehicleId,status)`, `(buyerLeadId,status)`, `status`.
- Back-relations en `Vehicle`, `BuyerLead`, `Match`, `User`. `ActivityType += OFERTA_REGISTRADA, OFERTA_ACTUALIZADA`.

## Máquina de estados (`lib/offers.ts`, puro)

```
PROPUESTA    → CONTRAOFERTA | ACEPTADA | RECHAZADA | EXPIRADA | RETIRADA
CONTRAOFERTA → ACEPTADA | RECHAZADA | EXPIRADA | RETIRADA
ACEPTADA     → CONVERTIDA | CANCELADA
terminales: CONVERTIDA, RECHAZADA, EXPIRADA, RETIRADA, CANCELADA
```

Helpers: `isValidOfferTransition`, `isTerminalOfferStatus`, `isReservation` (ACEPTADA + señal>0), `isActiveHold` (ocupa stock). Labels/colores/opciones. Tests.

## Efectos sobre el stock (server actions)

- **ACEPTADA**: el vehículo pasa a `RESERVADO` si estaba `PUBLICADO` (transición validada con `VEHICLE_TRANSITIONS`).
- **CANCELADA / RETIRADA / EXPIRADA** desde una reserva: libera el vehículo (`RESERVADO → PUBLICADO`).
- **CONVERTIDA**: marca la venta; el `VENDIDO` real lo gestiona `Delivery` (no se toca aquí).
- Cada cambio deja traza en el timeline de **ambos lados** (comprador + vendedor).

`createOffer`, `updateOfferStatus(id, status, extra)` — guard `requireAgente`.

> **I2A:** se retiró `updateOffer` (edición genérica de importe/notas/señal). No tenía consumidores y
> permitía fijar `depositAmount` en cualquier estado sin transacción, sin Activity y sin sincronizar
> el vehículo. La señal se registra únicamente al ACEPTAR. Una futura corrección o devolución
> requerirá una operación explícita, auditable y coordinada.

> **I2B — `I2B COORDINATES OFFER CREATION ONLY`.** `createOffer` adopta el protocolo de
> `lib/locking`: resuelve las raíces con una lectura preliminar (que **solo** sirve para eso),
> bloquea `Vehicle → SellerLead → BuyerLead` —el vendedor solo si `Vehicle.sellerLeadId` existe,
> nunca con id vacío— y dentro de la transacción relee y valida:
>
> - comprador y vendedor **no archivados** → `LEAD_ARCHIVED`;
> - el vehículo sigue colgando del mismo vendedor → `OFFER_ROOT_CHANGED`;
> - estado del vehículo en `OFFER_CREATION_ALLOWED_VEHICLE_STATUSES` = `TASADO`, `PUBLICADO`,
>   `RESERVADO` → en otro caso `VEHICLE_NOT_AVAILABLE`.
>
> `Offer` y `Activity` se escriben en la misma transacción; `emitKpiEvent` y `revalidatePath` van
> **después** del commit. Crear una oferta **no** toca `Vehicle.status`: nace en `PROPUESTA`, así
> que sobre un vehículo `RESERVADO` es una oferta de respaldo que no genera una segunda reserva ni
> desplaza a la aceptada. Núcleo en `lib/offers-creation.ts`.
>
> ⚠️ **`OFFER STATUS TRANSITIONS REMAIN UNCOORDINATED UNTIL I2C`.** La aceptación sigue gobernada
> por el CAS vigente, que exige `PUBLICADO`: una oferta creada sobre `TASADO` o sobre un vehículo
> `RESERVADO` **no podrá aceptarse** mientras el vehículo no esté publicado y libre. I2C revisará la
> política y los mensajes de las transiciones a `ACEPTADA`; I2B no las toca.
>
> **Deuda pendiente separada (UI, no abordada aquí):** los candidatos de oferta salen de
> `lead.matches` sin filtrar por el estado actual del vehículo, de modo que un match antiguo puede
> seguir ofreciendo un vehículo `VENDIDO` o `DESCARTADO`. El servidor ya lo rechaza; limpiar la
> lista es una mejora de UI aparte.

## UI

- **`components/offers-section.tsx`** (cliente, reutilizable en ambas fichas): lista de ofertas con badge de estado, importe, señal, "Reserva", enlace al otro lado; alta inline (elige contraparte de los **matches** + importe + notas); transiciones por botón con diálogos para aceptar (señal + fecha) y rechazar (motivo `LostReason`).
- **Ficha comprador**: nueva pestaña **Ofertas** (candidatos = vehículos matcheados).
- **Ficha vendedor**: en la pestaña **Compradores**, bajo los matches (candidatos = compradores matcheados).
- **`/ofertas`**: tablero por estado (4 columnas) + cerradas colapsables + KPIs (ofertas vivas, reservas activas, valor en negociación, señales retenidas). Sidebar: "Ofertas" (icono HandCoins) en Pipeline (ADMIN/AGENTE).

## Pendiente (fases siguientes de la capa transaccional)

Contratos/pagos, integración financiera (financiera), gestoría, y **reporting de precios reales de cierre** (alimenta valoración B-siguiente y Market Intelligence). "Reserva vence" como recordatorio de calendario (patrón de agregación ya disponible).
