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

`createOffer`, `updateOfferStatus(id, status, extra)`, `updateOffer` — guard `requireAgente`.

## UI

- **`components/offers-section.tsx`** (cliente, reutilizable en ambas fichas): lista de ofertas con badge de estado, importe, señal, "Reserva", enlace al otro lado; alta inline (elige contraparte de los **matches** + importe + notas); transiciones por botón con diálogos para aceptar (señal + fecha) y rechazar (motivo `LostReason`).
- **Ficha comprador**: nueva pestaña **Ofertas** (candidatos = vehículos matcheados).
- **Ficha vendedor**: en la pestaña **Compradores**, bajo los matches (candidatos = compradores matcheados).
- **`/ofertas`**: tablero por estado (4 columnas) + cerradas colapsables + KPIs (ofertas vivas, reservas activas, valor en negociación, señales retenidas). Sidebar: "Ofertas" (icono HandCoins) en Pipeline (ADMIN/AGENTE).

## Pendiente (fases siguientes de la capa transaccional)

Contratos/pagos, integración financiera (financiera), gestoría, y **reporting de precios reales de cierre** (alimenta valoración B-siguiente y Market Intelligence). "Reserva vence" como recordatorio de calendario (patrón de agregación ya disponible).
