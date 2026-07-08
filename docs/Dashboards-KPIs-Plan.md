# Plan de implementación — Sistema de KPIs y Dashboards

Plan por fases para construir el sistema de KPIs + dashboards de CampersNova (specs `CampersNova_KPIs_Completos_CRM_Marketplace_Claude_Code.md` y `CampersNova_Dashboards_KPIs_UX_Claude_Code.md`, + maqueta `CampersNova Dashboards.dc.html` del handoff de Claude Design), **hilado con lo que ya existe** en el CRM. No se parte de cero: gran parte de la base (dashboard, scoring, trust, próxima acción, motivos de pérdida, demanda activa) ya está en producción.

> Principio rector (del spec): cada KPI debe terminar en una decisión/acción. KPI card = resumen · gráfico = patrón · **tabla accionable = acción**, con drill-down hasta la entidad. Cálculo **server-side**, auditable, filtrable.

---

## 1. Qué ya existe (reutilizar, no rehacer)

| Pieza del spec                           | Ya construido                                                                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Dashboard base                           | `app/(backoffice)/dashboard/page.tsx` (financiero, stock/rotación, alertas, tiempo por estado, **demanda activa esperando**) |
| North Star ("operaciones estructuradas") | Parcial: hay conteos; falta el KPI formal con su definición de completitud                                                   |
| Buyer/Seller score                       | `lib/scoring/` (buyerScore, sellerAcquisitionScore) — **B19**                                                                |
| Vehicle completeness                     | `lib/vehicle-legal/calculateCompletionPercent` (expediente) + `lib/lead-score`                                               |
| Trust Passport + % completado            | `lib/trust-passport/` — **B20**                                                                                              |
| Próxima acción / leads sin acción        | `lib/next-action` + alertas en dashboard                                                                                     |
| Motivos de pérdida (comprador/vendedor)  | `lib/lost-reason` + card en dashboard                                                                                        |
| Vehículos con demanda activa             | `lib/scoring` `ACTIVE_DEMAND_MATCH_THRESHOLD` + card                                                                         |
| Ofertas/reservas                         | `lib/offers` + `Offer` (importe/señal/estado) — **B18**                                                                      |
| Tiempo medio por estado                  | `lib/dashboard/time-in-state.ts` (parseo de `CAMBIO_ESTADO`)                                                                 |
| Funnel Pro / MoM ventas                  | `lib/dashboard/queries.ts`                                                                                                   |
| Métricas financieras                     | `lib/dashboard/metrics.ts` (stock value, margen, rotación, ticket…)                                                          |
| RBAC por rol                             | `lib/auth` (5 roles)                                                                                                         |
| Filtros URL-driven                       | patrón ya usado en listados y dashboard (`?agent=`)                                                                          |

**Conclusión**: el trabajo nuevo es sobre todo (a) una **capa de eventos + completitud formal**, (b) **6 dashboards separados** con componentes reutilizables y drill-down, y (c) los KPIs de **funnel / matching / inteligencia de mercado** que aún no existen como tales.

---

## 2. Decisiones de arquitectura

### 2.1. `kpi_events` — SÍ, tabla nueva (additiva)

El spec la pide desde el inicio y es la base auditable. Diseño:

- Tabla `KpiEvent` (event_name, entity_type, entity_id, related_entity_type/id, actor_user_id, source, metadata JSONB, occurred_at). Migración additiva.
- **Helper `emitKpiEvent(...)`** llamado **dentro de las server actions existentes** en los puntos de transición (crear lead, contactar, cualificar, match, cita, oferta, reserva, venta, entrega, trust otorgado…). Muchos de esos puntos ya crean `Activity`; se añade el evento en la misma transacción.
- **No backfill histórico completo**; los KPIs de "stock actual" se calculan por lectura de las tablas de negocio (como ahora). Los KPIs de "flujo por periodo" (leads nuevos, ventas, conversión) usan `kpi_events` a partir de su activación. Donde haga falta histórico y sea barato, derivar de `Activity` (ya se hace para tiempos por estado).

### 2.2. Completeness scores — formalizar en `lib/scoring`, cálculo en lectura

- `buyerCompleteness`, `sellerCompleteness`, `vehicleCompleteness`, `operationCompleteness` con los **pesos del spec** (§7 KPI B1, §9 KPI V2, etc.). Puro + tests.
- Se calculan **en lectura** (coherente con el resto). **Persistir solo si** hace falta ordenar/filtrar listados grandes por score → decisión diferida (ver §5).
- El "operation completeness" (≥70 en comprador+vehículo+valoración+match+workflow+próxima acción) es la base del **North Star** ("operaciones estructuradas").

### 2.3. Estados normalizados — adaptador, sin migrar enums

El spec usa nombres en inglés (`qualified`, `captured`, `published`…). Los enums actuales están en español y funcionan. En vez de migrar, un **mapa de adaptación** (`lib/kpi/stage-map.ts`) traduce estado real → etapa de funnel del spec. Cero riesgo, cero migración de datos.

### 2.4. Navegación — nueva sección "Analytics"

- Nuevo grupo de sidebar **"Analytics"** con 6 entradas: Dirección · CRM · Comercial · Operaciones · Inteligencia de Mercado · Calidad de Datos (permisos por rol).
- El **dashboard actual** se **reparte**: su contenido financiero/operativo migra a Dirección + Operaciones + Calidad; la ruta `/dashboard` puede quedar como "Dirección" o redirigir.

### 2.5. Componentes reutilizables (base de todo)

`components/analytics/`:

- `GlobalFilters` (rango de fechas + comparativa periodo anterior + comercial + tipo/fuente/estado…), URL-driven.
- `KpiCard` (valor + variación vs periodo + semáforo + mini-tendencia + tooltip + drill-down).
- `FunnelChart` (volumen + conversión + caída por etapa + drill-down por etapa).
- `ActionableTable` (columnas mínimas + CTAs: ver ficha/crear tarea/llamar/WhatsApp/asignar/enviar match/actualizar estado).
- `SectionEyebrow`, semáforos, empty states útiles, export CSV. (Recharts ya está para line/bar.)

### 2.6. Server-side + permisos + export

- Todo el cómputo en RSC/server (ya es el patrón). Recharts solo en islas `'use client'`.
- Permisos por rol reutilizando `lib/auth`. Export CSV por dashboard (P1: PDF).

---

## 3. Fases de implementación

Orden alineado con la "prioridad inmediata" del spec (§27) pero **saltando lo ya hecho**.

### F0 — Fundaciones (habilita todo lo demás)

- `KpiEvent` (migración additiva) + `emitKpiEvent` enganchado en las server actions de transición ya existentes.
- Adaptador de etapas `lib/kpi/stage-map.ts`.
- Completeness scores en `lib/scoring` (buyer/seller/vehicle/operation) + tests.
- Componentes `analytics/` base (GlobalFilters, KpiCard, FunnelChart, ActionableTable).
- **Validaciones de producto que falten** (guards): cita completada sin outcome, venta cerrada sin margen. (Lead sin próxima acción / sin dueño y pérdida sin motivo **ya** están.)

### F1 — Dashboard Dirección + CRM (P0)

- **Dirección**: North Star (operaciones estructuradas), ventas, margen, compradores activos, vehículos publicados/captados, vehículos con demanda activa, matches útiles, lead→cita, match→cita, reserva→venta, tiempo medio de venta, % Trust Passport, % datos completos. Funnel ejecutivo + evolución semanal + margen por tipo.
- **CRM**: leads nuevos (por tipo/fuente), tiempo 1ª respuesta, % contactados/cualificados, leads sin dueño, leads sin próxima acción, tareas vencidas, **funnel comprador** y **funnel vendedor** con drill-down, motivos de pérdida, actividad por comercial. Tablas accionables.

### F2 — Operaciones + Trust

- Vehículos por estado operativo (stacked), **bloqueados por motivo** (horizontal bar), **aging de stock** (buckets 0-15/16-30/…/90+), tiempos por etapa (captación→publicación→reserva→venta→entrega), docs pendientes, **Trust Passport pendiente**, entregas próximas. Tablas accionables con CTA.

### F3 — Matching

- Matches generados/útiles (score≥70 sin hard blocker), match→interés/cita/reserva, score medio, **motivos de descarte** (requiere registrar el outcome/descarte del match — pequeño añadido de datos), vehículos con demanda activa (ya existe, se integra).

### F4 — Inteligencia de mercado

- Demanda por tipo/rango de precio, **gap oferta/demanda por segmento** (compradores activos − vehículos compatibles), **precio anunciado vs cerrado** (necesita capturar precio de cierre — ya lo da `Offer.amount`/venta), días de venta por modelo, margen por modelo, extras que mejoran conversión, objeciones frecuentes. Tabla "segmentos prioritarios de captación".

### F5 — Comercial (día a día)

- **Lista priorizada de acciones** (reservas en riesgo → calientes sin contacto → leads sin 1ª respuesta → citas de hoy → matches pendientes → tareas vencidas), compradores calientes, vehículos con demanda activa, reservas en riesgo. Es sobre todo composición de datos ya existentes en una vista orientada al comercial.

### F6 — Calidad de datos + Export/API

- Dashboard Calidad: completeness por entidad, entidades incompletas críticas, citas sin outcome, ventas sin margen, matches sin outcome, % eventos con trazabilidad. Export CSV en todos. (Opcional) endpoints `/api/kpis/*` si se quiere consumo externo.

### Fase Plataforma (bloqueada por decisión del dueño)

- KPIs de profesionales/partners, MRR, leads a profesionales, uso de herramientas, API usage. **Requiere** definir el portal profesional (no modelado hoy). Ver §5.

---

## 4. Gaps de datos a crear (por fase)

- **F0**: `KpiEvent`. Outcome de cita → usar `CalendarEvent.status/resultNotes` (ya existe); formalizar "sin outcome" = COMPLETADO sin resultNotes o pasado sin cerrar.
- **F3**: `Match` → registrar **outcome/motivo de descarte** (hoy hay estados de match pero no un motivo estructurado de rechazo del match como tal).
- **F4**: precio de cierre → ya derivable de `Offer` (ACEPTADA/CONVERTIDA `amount`) + venta; objeciones del comprador → hoy en notas, valorar campo estructurado.
- **Transacción (futuro)**: estado de pago/financiación de la reserva, entidad de financiación — parte de la capa 8 pendiente, no imprescindible para el MVP de KPIs.

---

## 5. Decisiones que dependen del dueño

1. **Alcance del MVP**: ¿los 6 dashboards, o empezar por **Dirección + CRM** (F0-F1) y crecer? (recomendado: F0-F1 primero, es el 80% del valor).
2. **Persistir scores/completitud** vs calcular en lectura (hoy en lectura). Solo hace falta persistir si se quieren listados grandes ordenados/filtrados por score.
3. **Portal profesional / plataforma**: los KPIs de la fase plataforma dependen de modelar cuentas de profesional (decisión estratégica ya listada en `docs/Roadmap-Infraestructura-Estado.md`).
4. **Objetivos/umbrales**: definir objetivos mensuales (ventas, margen) y umbrales de semáforo (p.ej. 1ª respuesta <15min verde) para que las cards muestren cumplimiento.
5. **API de KPIs** (`/api/kpis/*`): ¿se necesita consumo externo ahora, o basta el render interno? (recomendado: diferir a F6/opcional).

---

## 6. Definition of Done (por dashboard, del spec §20/§25)

Filtros globales · KPI cards con variación · tooltips · gráficos adecuados · tablas accionables · drill-down · empty states útiles · semáforo · export · permisos · fecha de última actualización · cálculo server-side · cada KPI auditable hasta su entidad origen.

---

## 7. Recomendación de arranque

Empezar por **F0 + F1** (fundaciones + Dirección + CRM): es donde está el grueso del valor accionable, reutiliza casi todo lo ya construido, y deja la base (`kpi_events`, completitud, componentes) sobre la que las fases siguientes son incrementales. Cada fase se entrega como su propio bloque (diseño → schema/lib → staging → build → PR → CI → merge → validación), igual que B17-B20.
