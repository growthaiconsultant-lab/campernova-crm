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
- **CANCELADA** desde una reserva: libera el vehículo (`RESERVADO → PUBLICADO`). `RECHAZADA`, `EXPIRADA` y `RETIRADA` no son alcanzables desde `ACEPTADA` y no tocan el stock.
- **CONVERTIDA**: exige el vehículo `RESERVADO` y marca la venta; el `VENDIDO` real lo gestiona `Delivery` (no se toca aquí).
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
> **Conversión**: solo se permite cuando el vehículo está `RESERVADO` y **no modifica ese estado**
> (`VEHICLE_NOT_READY_FOR_CONVERSION` en cualquier otro). Convertir cierra una venta y emite
> `SALE_CLOSED`, así que exige que la reserva siga viva; Delivery/I3 será responsable de llevar el
> vehículo posteriormente a `VENDIDO`.
> **Terminales desde `PROPUESTA`/`CONTRAOFERTA`**: `RECHAZADA`, `EXPIRADA` y `RETIRADA` solo parten
> de esos dos estados y **no tocan el stock**. No existe «retirar o expirar una reserva»: desde
> `ACEPTADA` la máquina de estados únicamente admite `CANCELADA` (que puede liberar) y `CONVERTIDA`
> (que no libera).
>
> **Decisión vigente: no se añade `reservedByOfferId`.** La propiedad se deriva de la unicidad, el
> lock de `Vehicle` la protege en los escritores de oferta, e I3 eliminará el escritor manual que
> puede romperla. Una propiedad explícita solo se reconsideraría si aparecieran reservas sin oferta,
> varios tipos de reserva, reservas temporales simultáneas, integraciones externas que escriban
> stock, o necesidad de enforcement por FK o índice.
>
> ✅ **`I3 MUST REMOVE MANUAL PUBLICADO ↔ RESERVADO TRANSITIONS FROM updateVehicle` — completado
> por I3A.** `VEHICLE_TRANSITIONS` ya no ofrece ninguna transición manual a `RESERVADO` ni a
> `VENDIDO`, y `RESERVADO` no tiene salidas manuales; además `updateVehicle` escribe con
> compare-and-swap sobre el estado releído.
>
> ```
> I3A REMOVES MANUAL RESERVATION, RELEASE AND SALE TRANSITIONS FROM updateVehicle
> OFFER OWNS PUBLICADO ↔ RESERVADO
> DELIVERY OWNS THE TRANSITION TO VENDIDO
> ```
>
> ✅ **I3B — `I3B COORDINATES MANUAL VEHICLE UPDATES AND PUBLICATION`.** `updateVehicle` adopta el
> protocolo de raíces (`MANUAL VEHICLE UPDATES USE THE ROOT LOCK PROTOCOL`): bloquea
> `Vehicle → SellerLead`, relee dentro de la transacción, rechaza `VEHICLE_ROOT_CHANGED` y
> `LEAD_ARCHIVED`, revalida la transición y conserva el CAS. La publicación `TASADO → PUBLICADO`
> queda coordinada con la creación/transición de ofertas y con el archivado futuro del vendedor; el
> guard legal se releé bajo el lock (los documentos del expediente son tabla aparte, límite
> documentado). **I3B retira todas las transiciones manuales a `DESCARTADO`**: quedan solo
> `NUEVO → TASADO` y `TASADO → PUBLICADO`.
>
> ```
> I3B COORDINATES MANUAL VEHICLE UPDATES AND PUBLICATION
> MANUAL VEHICLE UPDATES USE THE ROOT LOCK PROTOCOL
> TEMPORARY MANUAL DISCARD REMOVAL IS A SAFETY MEASURE UNTIL I3D
> DELIVERY CREATION AND COMPLETION REMAIN UNCOORDINATED UNTIL I3C
> FINAL DISCARD COORDINATION REMAINS PENDING UNTIL DELIVERY IS COORDINATED
> ```
>
> Coordinar el descarte ahora daría una garantía falsa: `createDelivery` sigue sin coordinar y podría
> crear una entrega **después** del descarte. Núcleo en `lib/vehicle-status.ts`.
>
> ✅ **I3C1A — enlace `Delivery → Offer` y creación coordinada** (`lib/delivery-creation.ts`).
> Migración additiva expand: `Delivery.offerId` **nullable** (`ON DELETE NO ACTION`) + índice de FK +
> índice único parcial `deliveries_active_vehicle_key`. `createDelivery` con `requireCanEditEntregas`
> bajo `withLockedRoots`, exige Offer `CONVERTIDA` coherente + Vehicle `RESERVADO` + sin Delivery
> activa/completada, atómico con la Activity.
>
> ```
> I3C1A ADDS AN OPTIONAL DELIVERY OFFER LINK FOR EXPAND–CONTRACT COMPATIBILITY
> NEW DELIVERY WRITERS MUST ALWAYS PERSIST offerId
> SCHEMA I3C1A IS BACKWARD-COMPATIBLE WITH THE CURRENT PRODUCTION CODE
> THE PRISMA CLIENT GENERATED FROM ca6015e WAS EXECUTED SUCCESSFULLY AGAINST THE I3C1A EXPAND SCHEMA
> CODE I3C1A MUST NOT BE DEPLOYED BEFORE THE EXPAND MIGRATION IS APPLIED
> P2002 DELIVERY ACTIVE CONFLICTS ARE CONFIRMED BY A POST-ROLLBACK READ BEFORE DOMAIN TRANSLATION
> AT MOST ONE PROGRAMADA OR EN_CURSO DELIVERY IS ALLOWED PER VEHICLE
> DELIVERY COMPLETION REMAINS UNCOORDINATED UNTIL I3C3
> offerId MUST BECOME NOT NULL IN I3C1B AFTER ZERO-NULL VALIDATION
> LEAD_ARCHIVED REMAINS PREPARATORY UNTIL PR #117 IS MERGED
> ```
>
> **Asimetría del rollout expand–contract** (demostrada con tests PostgreSQL 17 reales):
> `old code + expand schema = compatible` (el Prisma Client de `ca6015e` se ejecuta contra el schema
> expandido: create/read/update/delete de Delivery sin `offerId`, `offer_id` queda `NULL`, sin
> `P2022`) · `new I3C1A code + old schema = incompatible` (el código nuevo escribe `offerId` y daría
> `P2022` contra una base sin la migración). Por eso el orden seguro es **migración expand primero,
> luego deploy** del código nuevo. El traductor del P2002 del índice parcial se verifica con un error
> **real** de PostgreSQL (no metadata fabricada).
>
> La columna es nullable **solo** durante expand–contract para que el código actualmente desplegado
> (que no envía `offer_id`) siga funcionando durante el rollout; el escritor nuevo nunca crea sin
> Offer. `NoAction` (no `Restrict`) evita romper el cascade convergente `Vehicle → Offer` /
> `Vehicle → Delivery`.
>
> I3 **no** está completo: I3C1B (`SET NOT NULL`), I3C2 (transiciones/cancelación), I3C3
> (compleción/venta), I3D (descarte coordinado) e I3E (tasación) siguen pendientes, y el resto de
> escritores de `VehicleStatus` sigue sin coordinar.
>
> ⚠️ **`DELIVERY, VEHICLE AND VALUATION WRITERS REMAIN UNCOORDINATED UNTIL I3`** — el invariante
> global del archivado **todavía no está garantizado**.
>
> **Deuda pendiente separada (UI, no abordada aquí):** los candidatos de oferta salen de
> `lead.matches` sin filtrar por el estado actual del vehículo, de modo que un match antiguo puede
> seguir ofreciendo un vehículo `VENDIDO` o `DESCARTADO`. El servidor ya lo rechaza; limpiar la
> lista es una mejora de UI aparte.

> 🔶 **I3C1B — contract `Delivery.offerId` NOT NULL** (rama `feat/require-delivery-offer-link`, PR
> abierto; **migración remota y merge pendientes**). Cierra el patrón expand–contract iniciado en
> I3C1A. Sexta migración `20260721200000_make_delivery_offer_link_required` con una única sentencia
> `ALTER TABLE "deliveries" ALTER COLUMN "offer_id" SET NOT NULL;` (sin backfill, default, UPDATE,
> DELETE, FK, índices ni cambios de enum). Schema Prisma: `offerId String` + `offer Offer` (relación
> obligatoria; se conservan `NoAction`/`Cascade`, `@@index([offerId])` y el índice único parcial
> `deliveries_active_vehicle_key`).
>
> `I3C1B MAKES Delivery.offerId PHYSICALLY REQUIRED`
> `ALL PRODUCTIVE DELIVERY WRITERS PERSIST offerId`
> `THE PRISMA CLIENT GENERATED FROM aa739cc WORKS AGAINST THE I3C1B CONTRACT SCHEMA`
> `I3C1B DOES NOT COORDINATE DELIVERY CANCELLATION OR COMPLETION`
> `I3C1B REQUIRES ZERO NULL offer_id ROWS BEFORE REMOTE APPLICATION`
>
> **Pruebas PostgreSQL 17 reales (solo CI):** el cliente genuino de `aa739cc` (código desplegado)
> crea/lee/actualiza/borra una Delivery **con** `offerId` contra el schema contract, sin `P2022`
> (`old-client-compat.test.ts`); el contract con **cero nulls** aplica `SET NOT NULL` y conserva la
> fila válida y el índice parcial; el contract con **un `offer_id = NULL` deliberado** es rechazado
> por PostgreSQL, la fila permanece intacta, la columna sigue nullable y no hay aplicación parcial
> (`contract-migration.test.ts`); un `INSERT` que omite `offer_id` es rechazado tras el contract
> (`delivery-creation.test.ts`). El cliente **pre-I3C1A** ya no puede crear Deliveries tras el
> contract: incompatibilidad histórica **esperada**, no un fallo de I3C1B.
>
> **Preflight read-only obligatorio antes de cada aplicación remota:** `scripts/check-delivery-offer-nulls`
> (0 nulls, 0 huérfanas, coherencia Offer↔Delivery, 0 activas duplicadas, 0 migraciones fallidas).
> No escribe ni repara nada; no está cableado a ningún build.
>
> **Rollback documentado (procedimiento NO ejecutado, requiere autorización):**
> `ALTER TABLE "deliveries" ALTER COLUMN "offer_id" DROP NOT NULL;` — no elimina datos, FK ni
> índices; no debe ejecutarse automáticamente. El código I3C1A e I3C1B siguen funcionando tras
> volver a nullable; el código **pre-I3C1A no es un rollback operativo seguro** del writer. No se
> añade una migración de rollback al repositorio.
>
> I3C1B **no** coordina la cancelación ni la compleción de la entrega (I3C2/I3C3 siguen pendientes),
> no toca `createDelivery`, permisos, roots, estados, Warranty ni follow-ups, y el flujo real no se
> ha ejercitado en producción. **Orden de rollout seguro:** preflight → migración expand ya aplicada
> → **preflight + migración contract en staging** → **preflight + migración contract en producción**
> → merge → deployment. La migración remota (staging/producción) y el merge **no** están hechos.

## UI

- **`components/offers-section.tsx`** (cliente, reutilizable en ambas fichas): lista de ofertas con badge de estado, importe, señal, "Reserva", enlace al otro lado; alta inline (elige contraparte de los **matches** + importe + notas); transiciones por botón con diálogos para aceptar (señal + fecha) y rechazar (motivo `LostReason`).
- **Ficha comprador**: nueva pestaña **Ofertas** (candidatos = vehículos matcheados).
- **Ficha vendedor**: en la pestaña **Compradores**, bajo los matches (candidatos = compradores matcheados).
- **`/ofertas`**: tablero por estado (4 columnas) + cerradas colapsables + KPIs (ofertas vivas, reservas activas, valor en negociación, señales retenidas). Sidebar: "Ofertas" (icono HandCoins) en Pipeline (ADMIN/AGENTE).

## Pendiente (fases siguientes de la capa transaccional)

Contratos/pagos, integración financiera (financiera), gestoría, y **reporting de precios reales de cierre** (alimenta valoración B-siguiente y Market Intelligence). "Reserva vence" como recordatorio de calendario (patrón de agregación ya disponible).
