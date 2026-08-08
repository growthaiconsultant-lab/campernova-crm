# Permisividad — Oleada 1 (saltos de estado libres + archivar con menos fricción)

| Campo                | Valor                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| **Estado**           | EN PRODUCCIÓN ✅ (PR #161, fusionado a `main` y desplegado el 2026-07-31)                                |
| **Migración**        | Ninguna (sin cambios de schema)                                                                          |
| **Owner**            | Engineering                                                                                              |
| **Decisión**         | Del dueño (Joel), 2026-07-31                                                                             |
| **Alcance**          | Gates de **flujo** de bajo riesgo (orden del funnel) en leads, matches, calendario y archivado de leads. |
| **Fuera de alcance** | Tasación, ofertas/entregas/venta, vehículo→RESERVADO/VENDIDO, matching eligibility, autorización/roles.  |

## 1. Contexto (programa de permisividad)

El equipo empezó a usar el CRM en real y muchos flujos definidos no coinciden con cómo trabajan de verdad: hay pasos que el sistema exige pero que en la práctica no siempre se dan en ese orden. La decisión del dueño es **abrir las acciones para poder hacerlas en cualquier momento**, e ir **volviendo a poner restricciones** más adelante, cuando los flujos reales estén claros por el uso.

El trabajo se ordena por **oleadas** sobre un inventario de 91 restricciones clasificadas en:

- **Muro de flujo** — bloquea por un paso previo de proceso → candidato a abrir.
- **Barandilla de seguridad** — integridad, concurrencia, dinero → se conserva siempre.
- **Autorización** — quién puede hacer la acción → se decide aparte.

Esta **Oleada 1** abre solo los muros de flujo de **bajo riesgo** (sin efecto sobre dinero/stock/venta). Las barandillas de seguridad quedan intactas.

## 2. Qué se abrió

### A. Saltos de estado libres en leads (vendedor y comprador)

`lib/state-machine.ts`: las transiciones de `SellerLead` y `BuyerLead` dejan de ser secuenciales; **cualquier estado puede sustituir al actual** (adelante, atrás o directo). El estado del lead se trata como una clasificación operativa corregible, no como un gate del funnel. Cada cambio conserva su traza `CAMBIO_ESTADO` (Activity).

- **Vendedor:** libre entre `NUEVO/CONTACTADO/CUALIFICADO/EN_NEGOCIACION/CERRADO/DESCARTADO`.
- **Comprador:** libre entre `NUEVO/CONTACTADO/CUALIFICADO/EN_NEGOCIACION/PERDIDO`.

### B. Saltos de estado libres en matches

`app/(backoffice)/matches/actions.ts`: saltos libres entre `SUGERIDO/PROPUESTO_CLIENTE/VISITA/OFERTA/RECHAZADO`, con traza. La UI (`components/matches-section.tsx`) ofrece todos los destinos.

### C. Saltos de estado libres en calendario

`lib/calendar/event-meta.ts` + `app/(backoffice)/calendario/actions.ts`: correcciones libres entre estados del evento, **conservando** resultado, motivo de cancelación/no-show y timestamps. Se añade traza `CAMBIO_ESTADO` al cambio.

### D. Archivar leads con menos fricción

`lib/lead-archiving/domain.ts`: archivar **deja de bloquear** por "próxima acción pendiente" y por "eventos futuros en el calendario". Se puede archivar; la `Activity` de archivado menciona lo que había (tareas/eventos) a título informativo.

## 3. Qué se conserva (carve-outs e invariantes de seguridad)

**Carve-outs de venta (protegen los KPIs):**

- **Comprador → `CERRADO`** sigue exigiendo una `Delivery` COMPLETADA (`app/(backoffice)/compradores/[id]/actions.ts`). Se puede saltar libremente **salvo** a CERRADO.
- **Match → `CERRADO`** exige una `Delivery` COMPLETADA de la pareja exacta vehículo–comprador
  (`app/(backoffice)/matches/actions.ts`).

**Bloqueos de archivado que se mantienen (Oleada 2):** archivar sigue bloqueado si hay **ofertas/reservas vivas**, **entregas `PROGRAMADA/EN_CURSO`** o **stock `TASADO/PUBLICADO/RESERVADO`** (`lib/lead-archiving/domain.ts`).

**Barandillas de seguridad (intactas, no negociables):** locks de raíces + CAS + relecturas transaccionales del archivado y de las transiciones; importes; unicidad; FKs; atomicidad. **No** se tocó la máquina de estados del **vehículo** (`lib/vehicle-status.ts`), ni ofertas, ni entregas.

## 4. Qué queda fuera (Oleada 2)

Requiere override diseñado porque toca dinero/stock/venta: **tasación** (alimenta pricing), **ofertas/entregas/venta**, vehículo a **RESERVADO/VENDIDO** a mano, **matching eligibility** (incluir stock sin entrada), y **archivar con stock/ofertas/entregas vivas**. La **autorización** (a qué roles se abre cada acción) se decide por separado.

## 5. Efecto para el equipo

En las fichas de **vendedor** y **comprador**, y en **matches** y **calendario**, se puede mover el estado a cualquier valor sin respetar el orden. Y se puede **archivar** un lead aunque tenga tareas o eventos pendientes. Todo queda registrado en el timeline.

## 6. Archivos clave

- `lib/state-machine.ts` — `SELLER_LEAD_TRANSITIONS` / `BUYER_LEAD_TRANSITIONS` permisivas.
- `app/(backoffice)/matches/actions.ts` + `components/matches-section.tsx` — saltos de match (carve-out CERRADO).
- `lib/calendar/event-meta.ts` + `app/(backoffice)/calendario/actions.ts` — saltos de evento con traza.
- `lib/lead-archiving/domain.ts` — archivado sin bloqueo por próxima acción/eventos futuros.
- `app/(backoffice)/vendedores/[id]/actions.ts`, `app/(backoffice)/compradores/[id]/actions.ts` — actions de estado (carve-out comprador→CERRADO).

## 7. Deuda / validación pendiente

- **Validación autenticada en producción:** que el equipo confirme en vivo los saltos de estado y el archivado (no verificable en headless por el gate de auth del backoffice).
- **Re-endurecer más adelante:** cuando los flujos reales estén claros, decidir qué gates se vuelven a poner. Ojo: re-apretar sobre datos ya acumulados que incumplen el gate es más costoso que aflojar.
- **Efectos aguas abajo:** los saltos de estado pueden alterar funnels y tiempos por etapa en los KPIs; revisar los dashboards cuando haya uso real.
