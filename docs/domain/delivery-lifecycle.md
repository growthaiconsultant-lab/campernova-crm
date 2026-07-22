# Ciclo de vida de la entrega (Delivery) — fuente de verdad funcional

> **Estado:** vigente en `main` (verificado contra código, `687eae1`).
> **Alcance:** contrato funcional de `Delivery` y su relación con `Offer`, `Vehicle`, `BuyerLead` y
> `SellerLead`. Marketplace, SaaS multiempresa y otras expansiones **no** forman parte del alcance
> activo (ver `docs/architecture/fase-1-evolution-roadmap.md`).
>
> **Documentos relacionados:** protocolo de concurrencia → [`docs/adr/0009-root-lock-coordination.md`](adr/0009-root-lock-coordination.md);
> operación de migraciones → [`docs/governance/database-migrations.md`](governance/database-migrations.md);
> garantías de test → [`docs/quality/delivery-test-matrix.md`](quality/delivery-test-matrix.md);
> estado del programa → [`docs/roadmap/i3-status.md`](roadmap/i3-status.md).
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
| EN_CURSO      | COMPLETADA       |      sí       | `completeDeliveryTx` (**pendiente de I3C3**)    | checklist completo + firma; CAS sobre `EN_CURSO`                                    | Vehicle→VENDIDO, Warranty, follow-ups, cierre Match/Buyer (ver §6) |
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

## 6. Compleción — **pendiente de I3C3** (no implementada como coordinada)

`EN_CURSO → COMPLETADA` la ejecuta hoy `completeDeliveryTx` (`lib/delivery-completion.ts`) con CAS,
pero **todavía NO adopta el protocolo de root locks** (eso es I3C3). Al completar se disparan
Vehicle→`VENDIDO`, `soldAt`, cierre de `Match`/`Buyer`, `Warranty` y follow-ups. El diseño y la
coordinación completa (locks, carreras, y la decisión sobre las **guardas de checklist/firma en
estados terminales**) pertenecen a **I3C3** y a su auditoría previa.

> Entretanto, la carrera cancelación↔compleción es **segura** aunque la compleción no use locks: el
> CAS de la cancelación (`WHERE status = EN_CURSO`) y el de la compleción se serializan por el
> row-lock de PostgreSQL. Gane quien gane, hay **un único estado terminal** y el perdedor revierte por
> completo (ver la matriz de tests). **Nunca** coexisten `CANCELADA` con Vehicle vendido / Warranty /
> follow-ups.

`CHECKLIST AND SIGNATURE TERMINAL-STATE GUARDS REMAIN PENDING` — hoy `updateDeliveryChecklistItem` /
`signDelivery` no bloquean en estados terminales; se decidirá en I3C3.

## 7. Errores de dominio (transición/cancelación)

Definidos en `lib/delivery-transitions.ts` (mensajes sin ids/PII/SQL):

| Código                         | Cuándo                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| `DELIVERY_NOT_FOUND`           | la entrega no existe                                                                       |
| `DELIVERY_STATUS_CHANGED`      | el estado real ≠ el esperado por el cliente (obsoleto)                                     |
| `DELIVERY_ALREADY_CANCELLED`   | ya está `CANCELADA`                                                                        |
| `DELIVERY_ALREADY_COMPLETED`   | ya está `COMPLETADA`                                                                       |
| `INVALID_DELIVERY_TRANSITION`  | transición fuera del subconjunto de I3C2                                                   |
| `DELIVERY_ROOT_CHANGED`        | el vehículo/comprador/vendedor cambió entre la lectura preliminar y la relectura bajo lock |
| `LEAD_ARCHIVED`                | **solo al iniciar**: `BuyerLead`/`SellerLead` archivado                                    |
| `CANCELLATION_REASON_REQUIRED` | cancelar sin motivo                                                                        |

Además, los errores de bloqueo del protocolo de locks (`ROOT_NOT_FOUND`, `LOCK_TIMEOUT`, `DEADLOCK`,
…) se traducen a mensajes seguros (ver ADR 0009).

## 8. Invariantes (con enforcement verificable)

| Invariante                                                      | Enforcement DB                                       | Enforcement aplicación                                | Tests                                                                     |
| --------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| Toda `Delivery` tiene `offerId`                                 | columna `NOT NULL` (I3C1B)                           | todos los writers persisten `offerId`                 | `contract-migration*.test.ts`, `old-client-compat.test.ts`                |
| ≤ 1 `Delivery` activa por `Vehicle`                             | índice único parcial `deliveries_active_vehicle_key` | `createDeliveryTx` cuenta activas antes de crear      | `delivery-creation.test.ts`                                               |
| `createDelivery` exige Offer `CONVERTIDA` + Vehicle `RESERVADO` | FK `deliveries_offer_id_fkey`                        | validación en `createDeliveryTx` bajo lock            | `delivery-creation.test.ts`                                               |
| Offer coherente (mismo Vehicle+Buyer)                           | —                                                    | relectura + comparación en los núcleos                | `offer-*`, `delivery-*`                                                   |
| Cancelar no libera Vehicle ni toca Offer                        | —                                                    | `transitionDeliveryTx` solo escribe Delivery+Activity | `delivery-transition.test.ts`                                             |
| Iniciar exige leads no archivados; cancelar los admite          | —                                                    | gate por `targetStatus` en `transitionDeliveryTx`     | `delivery-transition.test.ts` (+ unit)                                    |
| Transición atómica (estado + motivo + Activity)                 | transacción                                          | un solo `tx` de `withLockedRoots`                     | `delivery-transition.test.ts`                                             |
| Carrera cancelación↔compleción sin estado incoherente           | row-lock                                             | CAS en ambos núcleos                                  | `delivery-transition.test.ts` (ambas intercalaciones, `waitUntilBlocked`) |

## 9. Referencias de código (no se copia código aquí)

- `lib/delivery-transitions.ts` — núcleo I3C2 (transición/cancelación).
- `lib/delivery-creation.ts` — creación coordinada (I3C1A).
- `lib/delivery-completion.ts` — compleción (pendiente de coordinar, I3C3).
- `app/(backoffice)/entregas/actions.ts` — server actions + `VALID_TRANSITIONS`.
- `lib/locking/` — `withLockedRoots` y el protocolo de raíces.
