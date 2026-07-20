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
> La aceptación sigue gobernada por el CAS vigente, que exige `PUBLICADO`: una oferta creada sobre
> `TASADO` o sobre un vehículo `RESERVADO` **no podrá aceptarse** mientras el vehículo no esté
> publicado y libre. La política y los mensajes de esas transiciones los fija I2C.

> **I2C — `I2C COORDINATES OFFER STATUS TRANSITIONS`.** `updateOfferStatus` adopta el mismo
> protocolo: raíces `Vehicle → SellerLead → BuyerLead`, relectura dentro de la transacción,
> `OFFER_ROOT_CHANGED` si la oferta cambió de vehículo o comprador o el vehículo de vendedor,
> `LEAD_ARCHIVED` **sin excepciones** (tampoco para transiciones terminales) y revalidación de la
> máquina de estados sobre el estado releído. Núcleo en `lib/offers-transition.ts`.
>
> ```
> OFFER CREATION AND STATUS TRANSITIONS USE THE ROOT LOCK PROTOCOL
> ```
>
> **El CAS se conserva como segunda barrera**, no se sustituye: los locks coordinan dominios; el CAS
> detecta que la expectativa del llamante quedó obsoleta.
>
> **Propiedad de la reserva — inferida, sin columna nueva.** El modelo no dice qué oferta reserva un
> vehículo. I2C hace cumplir el invariante
>
> ```
> PARA CADA VEHÍCULO: COMO MÁXIMO UNA OFFER CON status = ACEPTADA
> ```
>
> y mientras se cumpla, la única `ACEPTADA` es la dueña. Se comprueba **dentro** de la transacción y
> **después** de bloquear el vehículo: al aceptar (`RESERVATION_ALREADY_OWNED`) y al cancelar o
> convertir (`RESERVATION_OWNERSHIP_CONFLICT`). Ante un estado anómalo **falla cerrado**; no repara
> datos automáticamente.
>
> **Aceptación**: solo desde `PUBLICADO` (`VEHICLE_NOT_AVAILABLE` en cualquier otro estado). No
> desplaza reservas, no cancela otras ofertas, no libera stock para aceptar otra.
> **Cancelación**: libera solo si el vehículo sigue `RESERVADO`; si ya está `PUBLICADO` la liberación
> se considera hecha y no es un fallo; en `NUEVO`, `TASADO`, `VENDIDO` o `DESCARTADO` falla cerrado
> con `VEHICLE_RESERVATION_STATE_CONFLICT` — nunca se fuerza el vehículo a `PUBLICADO`.
> **Conversión**: no libera; el vehículo sigue `RESERVADO` hasta que la entrega lo lleve a `VENDIDO`.
> **Terminales desde `PROPUESTA`/`CONTRAOFERTA`**: no tocan el stock.
>
> **Decisión vigente: no se añade `reservedByOfferId`.** La propiedad se deriva de la unicidad, el
> lock de `Vehicle` la protege en los escritores de oferta, e I3 eliminará el escritor manual que
> puede romperla. Una propiedad explícita solo se reconsideraría si aparecieran reservas sin oferta,
> varios tipos de reserva, reservas temporales simultáneas, integraciones externas que escriban
> stock, o necesidad de enforcement por FK o índice.
>
> ⚠️ **`I3 MUST REMOVE MANUAL PUBLICADO ↔ RESERVADO TRANSITIONS FROM updateVehicle`.** Hoy
> `updateVehicle` todavía permite mover el estado del vehículo a mano, de modo que podría fabricarse
> el estado anómalo de dos ofertas `ACEPTADA` por fuera de este dominio. Hasta que I3 lo cierre, I2C
> se **defiende** fallando cerrado. I3 deberá además auditar el resto de escritores de
> `VehicleStatus`.
>
> ⚠️ **`DELIVERY, VEHICLE AND VALUATION WRITERS REMAIN UNCOORDINATED UNTIL I3`** — el invariante
> global del archivado **todavía no está garantizado**.
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
