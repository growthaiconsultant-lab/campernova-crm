# Calendario operativo — Mapeo spec ideal → CRM actual

**Fuente**: `docs/specs/calendario-operativo-ideal.md` (spec de visión del dueño, 2026-07).
**Decisión de arquitectura (acordada con el dueño)**: **agregación + tabla focalizada**, NO la mega-tabla `calendar_events` del spec. El calendario reúne lo ya agendado y añade `CalendarEvent` solo para tipos sin hogar. Una sola fuente de verdad por entidad.

---

## 1. Tipos del spec → dónde viven

| Tipo de evento (spec §4) | Implementación                                           | Estado                   |
| ------------------------ | -------------------------------------------------------- | ------------------------ |
| **Entrega**              | Módulo Entregas (`Delivery`) — agregado en el calendario | Existente, integrado     |
| **Reparación**           | Módulo Taller (`WorkOrder`) — agregado                   | Existente, integrado     |
| **Mejora**               | Futuro: `WorkOrder.kind` (REPARACION\|MEJORA\|LIMPIEZA)  | Pendiente                |
| **Recepción/Entrada**    | Alta de `SellerLead` (canal PRO/CN) + trade-in (CAM-63)  | Existente                |
| **Tasación**             | `Valuation` + auto-tasación                              | Existente                |
| **Publicación**          | Estado `Vehicle.PUBLICADO`                               | Existente                |
| **Postventa**            | `PostventaFollowup.scheduledFor` — agregado              | Existente, integrado     |
| **Próximas acciones**    | `lead.nextActionDueAt` (CAM-60) — agregado               | Existente, integrado     |
| **Cita**                 | **`CalendarEvent` tipo CITA** (F2)                       | ✅ Hecho                 |
| **Limpieza**             | `CalendarEvent` tipo LIMPIEZA                            | Base lista, UI pendiente |
| **Seguimiento**          | `CalendarEvent` tipo SEGUIMIENTO                         | Base lista, UI pendiente |
| **Demanda**              | `BuyerLead` + matching (ya existe como entidad)          | Existente                |
| **Otros**                | `CalendarEvent` tipo OTRO                                | Base lista               |

## 2. Fases

- **F1 — Vista unificada** ✅ (PR #51, sin migración): `lib/calendar/` agrega Entregas + Taller + Postventa + Próximas acciones en `CalendarItem`; `/calendario` semana/día + filtros.
- **F2 — CalendarEvent + Citas** ✅ (PR #52, migración `20260707400000_add_calendar_events`): tabla nueva, máquina de estados, crear/detalle/estados, integración en ficha comprador. 5º origen en la agregación.
- **F3 — Limpieza / Seguimiento / Otros**: reutilizan `CalendarEvent` + checklists por tipo (tabla `event_checklist_items` del spec §18) cuando se necesiten.
- **F4 — Reparación/Mejora unificadas**: `WorkOrder.kind` + categoría; surface por vehículo en fichas.
- **F5 — Vista mensual + reporting** (§27): muchas métricas ya calculables desde los orígenes.
- **F6 — Automatizaciones/recordatorios**: parte ya existe (Entregas/Taller bloquean completado). Recordatorios 24h/2h como cron.
- **F7 — IA** (§22): crear evento desde texto natural, resumir cita, sugerir próxima acción. Al final.

## 3. Descartado del spec (con motivo)

- **Mega-tabla `calendar_events` con JSONB para los 8 tipos**: duplicaría Delivery + WorkOrder + postventa y crearía dos fuentes de verdad. Sustituido por agregación + `CalendarEvent` focalizada.
- **`event_related_entities` polimórfica** (§19): a esta escala, las FKs directas (buyer/seller/vehicle/match) en `CalendarEvent` bastan. Reconsiderar si un evento necesita N vehículos candidatos (demanda avanzada).
- **`delivery_events`/`repair_events`… tablas por tipo** (§5 opción B): innecesario; los que tienen lógica ya son módulos propios.

---

> Estado: **F1 (PR #51) + F2 (PR #52) desplegados a prod (2026-07-07)**. Núcleo operativo funcional. F3–F7 pendientes, base lista.
