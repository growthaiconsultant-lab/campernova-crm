# Ciclo de vida de la entrega (Delivery) — fuente de verdad funcional

> **Estado:** vigente en `main` (verificado contra código, `687eae1`).
> **Alcance:** contrato funcional de `Delivery` y su relación con `Offer`, `Vehicle`, `BuyerLead` y
> `SellerLead`. Marketplace, SaaS multiempresa y otras expansiones **no** forman parte del alcance
> activo (ver `docs/architecture/fase-1-evolution-roadmap.md`).
>
> **Documentos relacionados:** protocolo de concurrencia → [`adr/0009-root-lock-coordination.md`](../adr/0009-root-lock-coordination.md);
> operación de migraciones → [`governance/database-migrations.md`](../governance/database-migrations.md);
> garantías de test → [`quality/delivery-test-matrix.md`](../quality/delivery-test-matrix.md);
> estado del programa → [`roadmap/i3-status.md`](../roadmap/i3-status.md).
>
> **Terminología de fase:** _preparado / fusionado / migrado / desplegado / validado_ no son
> sinónimos. Una entidad puede estar desplegada sin que su flujo autenticado esté validado
> manualmente en producción (ver la matriz de tests).

## 1. Entidades y campos clave

- **`Delivery`**: `id`, `vehicleId`, `buyerLeadId`, **`offerId` (obligatorio, `NOT NULL`)**,
  `status` (`DeliveryStatus`), `scheduledAt`, `startedAt?`, `completedAt?`, `cancellationReason?`,
  firma (`signedByName?`/`signedByDni?`/`signatureUrl?`), `checklist[]`, `documents[]`, `warranty?`.
- **`Offer`**: enlaza `Vehicle` ↔ `BuyerLead`; una `Offer` `CONVERTIDA` es la que una `Delivery`
  cumple.
- **`Vehicle`**: su `status` (`RESERVADO`/`VENDIDO`/…) lo gobiernan la capa de ofertas y la de
  entregas, no la edición manual (ver ADR 0009 y el estado del programa I3).

## 2. Máquina de estados de `Delivery`

`DeliveryStatus = PROGRAMADA | EN_CURSO | COMPLETADA | CANCELADA`. La autoridad es el **servidor**;
la UI nunca decide la transición. Mapa real (`app/(backoffice)/entregas/actions.ts` ·
`lib/delivery-transitions.ts`):

| Estado actual | Destino          |   Permitido   | Frontera responsable                            | Precondiciones                                                                      | Efectos                                                            |
| ------------- | ---------------- | :-----------: | ----------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| —             | PROGRAMADA       | sí (creación) | `createDeliveryTx` (`lib/delivery-creation.ts`) | Offer `CONVERTIDA` coherente + Vehicle `RESERVADO` + sin Delivery activa/completada | crea Delivery + checklist inicial + Activity `ENTREGA_PROGRAMADA`  |
| PROGRAMADA    | EN_CURSO         |      sí       | `transitionDeliveryTx` (I3C2)                   | leads **no** archivados; CAS sobre `PROGRAMADA`                                     | `startedAt = now`; Activity `CAMBIO_ESTADO` (sin flecha)           |
| PROGRAMADA    | CANCELADA        |      sí       | `transitionDeliveryTx` (I3C2)                   | motivo obligatorio; CAS sobre `PROGRAMADA`                                          | `cancellationReason`; Activity `ENTREGA_CANCELADA`                 |
| EN_CURSO      | CANCELADA        |      sí       | `transitionDeliveryTx` (I3C2)                   | motivo obligatorio; CAS sobre `EN_CURSO`                                            | `cancellationReason`; Activity `ENTREGA_CANCELADA`                 |
| EN_CURSO      | COMPLETADA       |      sí       | `completeDeliveryTx` (I3C3, root locks)         | checklist completo + firma **validados bajo lock**; CAS sobre `EN_CURSO`            | Vehicle→VENDIDO, Warranty, follow-ups, cierre Match/Buyer (ver §6) |
| COMPLETADA    | cualquiera       |    **no**     | —                                               | terminal                                                                            | —                                                                  |
| CANCELADA     | cualquiera       |    **no**     | —                                               | terminal                                                                            | —                                                                  |
| cualquiera    | salto no listado |    **no**     | —                                               | —                                                                                   | `INVALID_DELIVERY_TRANSITION`                                      |
| mismo → mismo | —                |    **no**     | —                                               | el CAS por estado esperado no reescribe                                             | error de dominio estable (nunca 2ª Activity)                       |

**Idempotencia / cliente obsoleto:** cada transición recibe el `expectedCurrentStatus` observado por
la UI, pero el servidor **relee el estado real bajo lock** y solo transiciona con CAS
(`WHERE status = expectedCurrentStatus`). Un cliente obsoleto o un doble envío no reescribe: obtiene
`DELIVERY_STATUS_CHANGED` / `DELIVERY_ALREADY_CANCELLED` / `DELIVERY_ALREADY_COMPLETED`.

## 3. Relación con `Offer` y `Vehicle` (invariantes de creación)

- **Toda `Delivery` tiene `offerId`** (columna `NOT NULL` desde I3C1B; relación Prisma obligatoria).
- La `Offer` pertenece **al mismo `Vehicle`** y **al mismo `BuyerLead`** que la `Delivery`.
- `createDeliveryTx` exige **Offer `CONVERTIDA`** y **Vehicle `RESERVADO`**.
- **Como máximo una `Delivery` activa (`PROGRAMADA`/`EN_CURSO`) por `Vehicle`** — reforzado por el
  índice único parcial `deliveries_active_vehicle_key`.
- Tras `CANCELADA` **puede** crearse otra `Delivery`; tras `COMPLETADA` **no**.

## 4. Contrato de cancelación (I3C2)

Cancelar es un **cierre administrativo** ante una incidencia, no un avance comercial. La cancelación:

- **no** libera el `Vehicle` (no lo devuelve a `PUBLICADO`);
- **no** modifica la `Offer`;
- **no** modifica ni **reactiva** ningún lead;
- **admite leads archivados** (a diferencia de iniciar);
- **exige motivo** (no vacío, acotado); **el motivo y la `Activity` se escriben en la misma
  transacción** que el cambio de estado (atómicos);
- **conserva** `scheduledAt`, `startedAt`, checklist, firma y documentos.

## 5. Contrato de inicio (I3C2)

`PROGRAMADA → EN_CURSO`:

- **exige leads no archivados** (bloquea si `BuyerLead` o `SellerLead` están archivados →
  `LEAD_ARCHIVED`);
- usa **CAS** + **root locks**;
- fija `startedAt`;
- crea `Activity` atómica (`CAMBIO_ESTADO`, contenido **sin** flecha `→` para no contaminar el
  cálculo de tiempo-por-estado de leads).

> **Asimetría deliberada:** el archivado bloquea **iniciar** (avanzar el proceso) pero **no
> cancelar** (cerrarlo). Un lead archivado no debe dejar una entrega activa atrapada. La
> clasificación de estado terminal (`ALREADY_*`/`STATUS_CHANGED`/`ROOT_CHANGED`) tiene **precedencia**
> sobre `LEAD_ARCHIVED`.

## 6. Contrato de compleción (I3C3)

`EN_CURSO → COMPLETADA` la ejecuta `completeDeliveryTx` (`lib/delivery-completion.ts`) **bajo el
protocolo de root locks** (raíces `Vehicle → SellerLead → BuyerLead`, mismo orden global que el resto
de escritores). La server action toma una lectura preliminar mínima (vehicleId, buyerLeadId,
`vehicle.sellerLeadId`), construye las raíces y ejecuta el núcleo dentro de `withLockedRoots`. Dentro
de la transacción, **antes** de cualquier escritura:

1. **relee** la Delivery (estado, `vehicleId`, `buyerLeadId`, `offerId`, firma, checklist);
2. verifica **coherencia de raíces** (delivery↔vehicle↔buyer y `vehicle.sellerLeadId ===
resolvedSellerLeadId`) → `DELIVERY_ROOT_CHANGED` si cambió;
3. verifica existencia de vendedor/comprador (**admite archivados**, sin reactivarlos);
4. verifica **coherencia de la Offer** vía `delivery.offerId` → `OFFER_MISMATCH`;
5. clasifica el estado terminal (`ALREADY_COMPLETED`/`ALREADY_CANCELLED`/`STATUS_CHANGED`) **con
   precedencia** sobre las validaciones de negocio;
6. valida **checklist completo** (ningún ítem `PENDIENTE`) → `CHECKLIST_INCOMPLETE`, y **firma**
   presente (nombre+DNI+url) → `SIGNATURE_REQUIRED`, **ambos releídos bajo el lock**.

Solo entonces escribe, de forma **atómica** en la misma transacción: Delivery→`COMPLETADA` +
`completedAt` (CAS `WHERE status = EN_CURSO`); Vehicle→`VENDIDO` + `soldAt` (CAS `WHERE status IN
{PUBLICADO, RESERVADO}`); `Match` `OFERTA(vehicle,buyer)`→`CERRADO`; `BuyerLead`→`CERRADO` (**no** se
archiva); `Warranty` (único por `deliveryId`) + 2 `PostventaFollowup` (DIA_7/DIA_30, únicos por
`(warrantyId, type)`); 3 `Activity` (`CAMBIO_ESTADO` **sin flecha**, `ENTREGA_COMPLETADA`,
`GARANTIA_ACTIVADA`). El envío de los follow-ups lo hace el cron; aquí solo se **registran**.

- **`soldAt` = instante de compleción** (un único timestamp; coincide con `completedAt`). Las ventas se
  cuentan por `Vehicle.status = VENDIDO + soldAt` (no por el contenido de la Activity).
- **La `Offer` permanece `CONVERTIDA`** (la compleción no la modifica).
- **No es reversible:** no existe una transición COMPLETADA→\* ni una acción de deshacer.

> **Carrera cancelación↔compleción — segura.** El CAS de la cancelación (`WHERE status = EN_CURSO`) y
> el de la compleción se serializan por el row-lock de PostgreSQL. Gane quien gane, hay **un único
> estado terminal** y el perdedor revierte por completo. **Nunca** coexisten `CANCELADA` con Vehicle
> vendido / Warranty / follow-ups.

> **Writers de precondición serializados con la compleción (I3C3).** Los dos writers que producen las
> precondiciones de la compleción —edición de checklist (`updateChecklistItemTx`) y firma
> (`writeSignatureTx`)— entran en el **mismo protocolo de root locks** que la compleción
> (`Vehicle → SellerLead → BuyerLead`): resuelven raíces en una lectura preliminar mínima, ejecutan
> dentro de `withLockedRoots`, **relean la entrega bajo el lock**, clasifican el estado terminal contra
> lo releído y solo escriben si sigue editable, todo en la misma transacción (núcleo en
> `lib/delivery-precondition.ts`). Como comparten los mismos row locks que la compleción, se serializan
> con ella y **el TOCTOU queda cerrado end-to-end**:
>
> - _gana la compleción_ → el writer se **bloquea** esperando las raíces; al liberarse relee el estado
>   terminal y **rechaza** (`DELIVERY_ALREADY_COMPLETED`/`_CANCELLED`), sin escribir;
> - _gana el writer_ → escribe (p. ej. checklist a `PENDIENTE`) y **commitea**; la compleción se
>   bloquea, y al liberarse relee el checklist incompleto → `CHECKLIST_INCOMPLETE`, sin venta.
>
> Ya **no** queda ninguna ventana en la que una entrega `COMPLETADA` conviva con un checklist
> incompleto, ni en la que la firma se modifique tras un estado terminal. La firma ya era obligatoria
> pre-compleción; I3C3 la revalida bajo el lock y serializa además su **escritura**. Ambas carreras
> están demostradas con PostgreSQL real y contención observada (`waitUntilBlocked`).

## 7. Errores de dominio

Transición/cancelación en `lib/delivery-transitions.ts`; compleción en `lib/delivery-completion.ts`
(`DeliveryCompletionError`); edición de checklist y firma en `lib/delivery-precondition.ts`
(`DeliveryPreconditionError`). Mensajes sin ids/PII/SQL:

| Código                         | Cuándo                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| `DELIVERY_NOT_FOUND`           | la entrega no existe                                                                       |
| `DELIVERY_STATUS_CHANGED`      | el estado real ≠ el esperado por el cliente (obsoleto); en compleción, no es `EN_CURSO`    |
| `DELIVERY_ALREADY_CANCELLED`   | ya está `CANCELADA` (compleción; y edición/firma bajo lock)                                |
| `DELIVERY_ALREADY_COMPLETED`   | ya está `COMPLETADA` (compleción; y edición/firma bajo lock)                               |
| `INVALID_DELIVERY_TRANSITION`  | transición fuera del subconjunto de I3C2                                                   |
| `DELIVERY_ROOT_CHANGED`        | el vehículo/comprador/vendedor cambió entre la lectura preliminar y la relectura bajo lock |
| `OFFER_MISMATCH`               | **compleción**: la `Offer` enlazada no corresponde al par Vehicle+Buyer de la entrega      |
| `CHECKLIST_INCOMPLETE`         | **compleción**: algún ítem del checklist sigue `PENDIENTE` (validado bajo lock)            |
| `SIGNATURE_REQUIRED`           | **compleción**: falta firma (nombre/DNI/url)                                               |
| `CHECKLIST_ITEM_NOT_FOUND`     | **edición**: el ítem no existe (relectura bajo lock)                                       |
| `CHECKLIST_ITEM_MISMATCH`      | **edición**: el ítem no pertenece a esa entrega                                            |
| `SIGNATURE_FORBIDDEN`          | **firma**: quien firma no es el responsable ni un admin                                    |
| `LEAD_ARCHIVED`                | **solo al iniciar**: `BuyerLead`/`SellerLead` archivado (compleción **admite** archivados) |
| `CANCELLATION_REASON_REQUIRED` | cancelar sin motivo                                                                        |

La compleción conserva además `DeliveryConflictError` (`reason: 'delivery' | 'vehicle'`) como segunda
barrera cuando un CAS afecta 0 filas. Los errores de bloqueo del protocolo (`ROOT_NOT_FOUND`,
`LOCK_TIMEOUT`, `DEADLOCK`, …) se traducen a mensajes seguros (ver ADR 0009).

## 8. Invariantes (con enforcement verificable)

| Invariante                                                                                    | Enforcement DB                                                 | Enforcement aplicación                                                                  | Tests                                                                                                                   |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Toda `Delivery` tiene `offerId`                                                               | columna `NOT NULL` (I3C1B)                                     | todos los writers persisten `offerId`                                                   | `contract-migration*.test.ts`, `old-client-compat.test.ts`                                                              |
| ≤ 1 `Delivery` activa por `Vehicle`                                                           | índice único parcial `deliveries_active_vehicle_key`           | `createDeliveryTx` cuenta activas antes de crear                                        | `delivery-creation.test.ts`                                                                                             |
| `createDelivery` exige Offer `CONVERTIDA` + Vehicle `RESERVADO`                               | FK `deliveries_offer_id_fkey`                                  | validación en `createDeliveryTx` bajo lock                                              | `delivery-creation.test.ts`                                                                                             |
| Offer coherente (mismo Vehicle+Buyer)                                                         | —                                                              | relectura + comparación en los núcleos                                                  | `offer-*`, `delivery-*`                                                                                                 |
| Cancelar no libera Vehicle ni toca Offer                                                      | —                                                              | `transitionDeliveryTx` solo escribe Delivery+Activity                                   | `delivery-transition.test.ts`                                                                                           |
| Iniciar exige leads no archivados; cancelar los admite                                        | —                                                              | gate por `targetStatus` en `transitionDeliveryTx`                                       | `delivery-transition.test.ts` (+ unit)                                                                                  |
| Transición atómica (estado + motivo + Activity)                                               | transacción                                                    | un solo `tx` de `withLockedRoots`                                                       | `delivery-transition.test.ts`                                                                                           |
| Carrera cancelación↔compleción sin estado incoherente                                         | row-lock                                                       | CAS en ambos núcleos                                                                    | `delivery-transition.test.ts`, `delivery-completion-coordination.test.ts` (ambas intercalaciones, `waitUntilBlocked`)   |
| Compleción coordinada (relectura bajo lock; checklist/firma; efectos atómicos)                | row-lock + CAS delivery/vehicle; `@unique` Warranty/follow-ups | `completeDeliveryTx` dentro de `withLockedRoots`                                        | `delivery-completion.test.ts`, `delivery-completion-coordination.test.ts`                                               |
| Compleción admite leads archivados sin reactivar                                              | —                                                              | existencia sin gate de archivado en la compleción                                       | `delivery-completion-coordination.test.ts`                                                                              |
| Edición de checklist serializada con la compleción (no hay COMPLETADA + checklist incompleto) | row-lock compartido                                            | `updateChecklistItemTx` dentro de `withLockedRoots`; relee terminal bajo lock           | `delivery-precondition.test.ts`, `delivery-completion-coordination.test.ts` (ambas intercalaciones, `waitUntilBlocked`) |
| Firma serializada con la compleción (no se escribe firma tras terminal)                       | row-lock compartido                                            | `writeSignatureTx` dentro de `withLockedRoots`; relee terminal + autorización bajo lock | `delivery-precondition.test.ts`, `delivery-completion-coordination.test.ts`                                             |

## 9. Referencias de código (no se copia código aquí)

- `lib/delivery-transitions.ts` — núcleo I3C2 (transición/cancelación).
- `lib/delivery-creation.ts` — creación coordinada (I3C1A).
- `lib/delivery-completion.ts` — compleción coordinada (I3C3): `completeDeliveryTx`,
  `DeliveryCompletionError`, `DeliveryConflictError`.
- `lib/delivery-precondition.ts` — writers de precondición coordinados (I3C3):
  `updateChecklistItemTx`, `writeSignatureTx`, `DeliveryPreconditionError`.
- `app/(backoffice)/entregas/actions.ts` — server actions (creación, transición/cancelación,
  compleción, edición de checklist y firma; todas bajo `withLockedRoots`).
- `lib/locking/` — `withLockedRoots` y el protocolo de raíces.
