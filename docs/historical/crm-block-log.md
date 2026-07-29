# Log histórico del CRM Campernova

Este archivo contiene el log detallado de bloques anteriores (Block 22 hacia atrás) que estaba en CLAUDE.md y se movió aquí el 2026-07-29 para reducir el tamaño del archivo principal (impacto en rendimiento del harness). El contenido está íntegro; solo cambió su ubicación. Para el estado actual y las decisiones técnicas vigentes, ver CLAUDE.md.

---

## Estado previo (Block 22 — Rebrand visual del CRM COMPLETO — MERGED A MAIN ✅)

Rebrand del **backoffice** a partir del handoff de Claude Design: nueva identidad **verde `#0e7d6b` + carbón `#12151c` + fondo `#f4f6f8`**, tipografía **IBM Plex Sans** (UI) + JetBrains Mono (datos). **Reskin, no rebuild** — rutas/entidades/flujos/KPIs intactos. Scopeado **solo al CRM**; la web pública mantiene su identidad (crema + Inter/Fraunces). Plan en el plan file de la sesión; diseño en **ADR `docs/adr/0008-crm-rebrand-scoped-theme.md`**.

- **Enfoque `.crm-theme`**: bloque en `app/globals.css` que sobreescribe los tokens semánticos de shadcn (verde/carbón, radio 10px) + fija la fuente; se aplica en el `<div>` raíz de `app/(backoffice)/layout.tsx`. Todo lo que usa tokens semánticos (shell, `components/ui/*`, los 7 dashboards de analytics, taller/entregas/postventa/calendario/vehículos/matches) se rebrandeó **de golpe**. La web pública comparte `app/layout.tsx` raíz **sin** la clase → intacta.
- **Fuente tras var genérica `--font-crm`** (en `app/layout.tsx`): cambiar de tipografía en el CRM = 1 línea. Se remapea `--font-inter`→`--font-crm` dentro del scope para que las utilidades `font-sans` también cambien. (Se probó Hanken Grotesk primero; se cambió a IBM Plex Sans por legibilidad — feedback del dueño.)
- **Reskin por módulo** (hex hardcodeado → nuevos neutros fríos + semáforo del handoff): F2 dashboard (PR #79), F3 compradores (#80), F4 vendedores (#81), F5-F6 captaciones+ofertas+usuarios+componentes compartidos (#82). El **teal de marca viejo `#294e4c` y el tan `#b59e7d` → verde `#0e7d6b`**; slate → tokens (`#e2e8f0`→`#e6e9ee`, `#64748b`→`#586173`, `#0a0a0a`/`#1e293b`→`#141922`); semáforo unificado (`#1a9d5f`/`#c9820a`/`#d64545`/`#3a6fd4`). **Las paletas categóricas de gráficos y el verde de WhatsApp `#25D366` se mantienen**. `cookie-banner.tsx` (público) se dejó intacto a propósito.
- **Semáforo unificado** en `lib/kpi/thresholds.ts` (`SEMAPHORE_HEX`) y `lib/captacion.ts` (`CAPTURE_STATUS_COLORS`) a los hex del handoff.
- **F7 homogeneización (PR #83) — clave para la coherencia real**: el reskin por hex no bastaba porque las **utilidades Tailwind `cn-*`** (`text-cn-teal-900`, `border-cn-line`, `bg-cn-cream-*`, `text-cn-ink-*`…) eran **hex literales en `tailwind.config.ts`** → medio backoffice (filtros, usuarios, botones) seguía con colores viejos. Fix: **`cn.*` → `var(--cn-*)`** en `tailwind.config`; las vars viven en `:root` (valores viejos = **web pública intacta**) y se sobreescriben en `.crm-theme` (valores nuevos = backoffice). Además: **acciones primarias → verde** (`bg/border/ring-cn-teal-900` → `primary`, 28 botones/estados; toggles on → verde; `RoleBadge` coherente), manteniendo `text-cn-teal-900` oscuro (títulos). PR #84: los CTA de listas/filtros que usaban hex arbitrario `bg-[#141922]` (no token) → `bg-primary`. **Regla aprendida: las utilidades Tailwind `cn-*` son ahora var-driven y scopeadas; no volver a hex literales.**
- **Cero hex de marca vieja** en el backoffice tras el cierre. Verificado en vivo (producción, sesión del dueño): usuarios/compradores/fichas homogéneos (botones y toggles verdes, badges coherentes) y **web pública sin cambios** (crema + Fraunces/tan). Sin migración de BD en ninguna fase. **531 tests verdes** en todas.

### Pendiente/diferido del rebrand (opcional)

Header desktop global del prototipo (buscador ⌘K + "Nuevo lead" + campana) — **diferido**: cada página del CRM ya tiene su cabecera `sticky top-0`, una barra global rompería esos offsets; se aborda al ajustar layouts por módulo. Pipeline **kanban** dedicado (vista nueva). Reconvertir `/dashboard` a panel "Mi día" (solapa con `/analytics/comercial`). Semáforo de `lib/state-machine.ts` (`*_STATUS_CLASSES`) se dejó en paleta Tailwind (ya alineada). Validación en vivo del backoffice: la hace el dueño (auth-gated, no verificable en headless).

## Estado previo (Block 21 — Sistema de KPIs y Dashboards F0→F6 COMPLETO — MERGED A MAIN ✅)

Arranque del sistema de KPIs/dashboards a partir de los specs del dueño (`CampersNova_KPIs_Completos...` + `..._Dashboards_KPIs_UX...` + handoff de Claude Design). **Plan maestro en `docs/Dashboards-KPIs-Plan.md`** (fases F0→F6, hilado con lo ya existente). Umbrales del dueño: 7 ventas/mes, margen mín 4%, 1ª respuesta <24/48h, tiempo de venta <15/30d, aging >30/45d, Trust ≥70%, datos ≥80%.

### F0 — Fundaciones (PR #67, `9bfe494`)

Migración **additiva** `20260711000000_add_kpi_events` (tabla `kpi_events` + índices + FK actor) aplicada a **staging y prod**.

- **`lib/kpi/`**: `events.ts` (catálogo de eventos, `eventName` String para no migrar), `emit.ts` (`emitKpiEvent` **no bloqueante**, acepta cliente `tx`), `stage-map.ts` (adaptador estados reales→etapas de funnel, sin migrar enums).
- **`lib/scoring/completeness.ts`** (puro + tests): `buyerCompleteness`/`sellerCompleteness`/`vehicleCompleteness` (pesos del spec) + `operationStructure` (gates del North Star: comprador+vehículo ≥70, valoración, match, workflow, próxima acción).
- **Hooks emitidos**: `createBuyerLead`, `createSellerLead`, `createOffer`, `updateOfferStatus` (reserva/venta), `grantTrustSeal`. **Pendientes** (F1b): form público `/vender`, chat, vehículo publicado/vendido/valorado, match, cita, entrega.

### F1a — Analytics + Dashboard Dirección (PR #68, `b148129`) — sin migración

- **`lib/kpi/thresholds.ts`**: objetivos + semáforos (`sem.*`) del dueño + tests.
- **`components/analytics/`**: `KpiCard` (valor+variación+semáforo+tooltip+drill-down), `FunnelChart` (conversión+caída+drill-down).
- **`lib/kpi/direccion.ts`** + **`/analytics/direccion`** (ADMIN/MARKETING, filtro de agente): North Star (operaciones estructuradas), ventas/margen (reutiliza `lib/dashboard`), stock, demanda activa, matches útiles, % Trust Passport, funnels comprador/vehículo. Se lee de tablas → funciona desde el día 1.
- **Sidebar**: nuevo grupo "Analytics" (Dirección + CRM).
- Suite: **521 tests verdes**.

### F1b — Dashboard CRM (PR #69, `c1752fd`) — sin migración

- **`lib/kpi/crm.ts`**: leads nuevos 30d (por tipo), leads sin dueño, sin próxima acción, tareas vencidas, motivos de pérdida (comprador/vendedor), filas accionables. El **AGENTE solo ve lo suyo**.
- **`components/analytics/actionable-table.tsx`** (drill-down + semáforo + empty state).
- **`/analytics/crm`** (ADMIN/AGENTE/MARKETING): salud CRM + funnels + motivos de pérdida + tablas accionables.
- **Hooks inbound**: `submitPublicLead` (`/vender`) → SELLER_CREATED, chat comprador → BUYER_CREATED.

### F2 — Dashboard Operaciones + Trust (PR #70, `2094aee`) — sin migración

- **`lib/kpi/operaciones.ts`**: stock por estado, **bloqueados por motivo** (evalúa el expediente legal por vehículo con `lib/vehicle-legal`), **aging de stock** (buckets 0-15/16-30/31-45/45+), **Trust Passport pendiente**, entregas próximas. Filas accionables.
- **`components/analytics/bar-list.tsx`** (barras horizontales reutilizables).
- **`/analytics/operaciones`** (ADMIN/AGENTE/ENTREGAS/TALLER/MARKETING). Sidebar: "Operaciones" (icono Boxes).

### F3 — Dashboard Matching (PR #71, `236ed0b`) — sin migración

- **`lib/kpi/matching.ts`**: matches generados/útiles (score≥70), score medio, rechazados, **embudo por estado** (Sugerido→Propuesto→Visita→Oferta→Cerrado), **distribución de score** (buckets), **match→oferta** (`offers.matchId`), top vehículos con más demanda compatible.
- **`/analytics/matching`** (ADMIN/AGENTE/MARKETING). Sidebar: "Matching" (icono Zap).

### F4 — Inteligencia de Mercado (PR #72, `a4c2e0b`) · F5 — Comercial (PR #73, `872d580`) — sin migración

- **F4 `lib/kpi/mercado.ts`** + **`/analytics/mercado`**: demanda por tipo y por rango de precio, **gap oferta/demanda por segmento** (palanca de captación), **rotación por modelo** (días de venta), precio medio de cierre (ofertas convertidas). Sidebar "Mercado" (TrendingUp).
- **F5 `lib/kpi/comercial.ts`** + **`/analytics/comercial`**: mi día (tareas hoy/vencidas, citas hoy, calientes, reservas activas), **lista priorizada** (reservas en riesgo → tareas vencidas → calientes), reservas en riesgo, compradores calientes. El AGENTE ve lo suyo. Sidebar "Comercial" (Target).

### F6 — Calidad de Datos + export (PR #74, `cba9010`) — sin migración

- **`lib/kpi/calidad.ts`**: completitud media comprador/vehículo (reutiliza `lib/scoring/completeness`), **% trazabilidad de eventos** (`kpi_events` con actor u origen), **incidencias críticas** (sin presupuesto/acción/valoración/margen), fichas de vehículo incompletas.
- **`/analytics/calidad`** (ADMIN/MARKETING) + botón **export CSV** → `/api/analytics/incompletos.csv` (route handler autenticado, BOM para Excel). Sidebar "Calidad de datos" (BadgeCheck).
- **7 dashboards vivos** en el grupo Analytics: Dirección · CRM · Comercial · Operaciones · Matching · Mercado · Calidad.

### Pendiente del sistema de KPIs (mejoras opcionales)

Hooks de eventos restantes (vehículo publicado/vendido/valorado, match generado, cita, entrega — hoy solo se emiten los de alta de lead/oferta/reserva/venta/sello; los dashboards ya funcionan porque leen de tablas). Validaciones de producto duras (bloquear cita sin outcome, venta sin margen). Export PDF + endpoints `/api/kpis/*` para consumo externo. Persistir scores/completitud si se quiere ordenar listados grandes. Fase Plataforma bloqueada por decisión del dueño (portal profesional). Detalle en `docs/Dashboards-KPIs-Plan.md`.

## Estado previo (Block 20 — Trust Passport unificado — MERGED A MAIN ✅)

Capa de **confianza** (Trust Layer) del roadmap infraestructura. Fusiona el **expediente legal** (Block 4) + el **checklist técnico del taller** en una única **vista de verificación con estados**, un score y el sello **"Verificado por CampersNova"** — palanca de demanda pull hacia el comprador. Plan en `docs/Trust-Passport-Plan.md`. PR #66 (`ff98f88`).

Migración **additiva** `20260710000000_add_trust_passport` (`Vehicle.trustVerifiedAt`/`trustVerifiedById` FK/`trustNotes` + `ActivityType += TRUST_SELLO_OTORGADO, TRUST_SELLO_REVOCADO`) aplicada a **staging y prod** antes del merge.

- **Modelado**: **agregación en lectura, no tabla de checks** (coherente con el calendario B15). Solo se persiste el **sello**.
- **`lib/trust-passport/`** (puro + tests): `buildTrustPassport(input, now)` → secciones (Documentación legal + Estado técnico) con estados por check (`ok`/`warn`/`fail`/`pending`), **score 0-100**, **level** (VERIFICADO/PARCIAL/INCOMPLETO), **`eligibleForSeal` + `blockers`**. Legal: ITV vigente (warn <60d, fail caducada), cargas DGT, titularidad, VIN, 7 docs obligatorios. Técnico: agrega el checklist del **último parte de taller** por categoría (Mecánica/Camper/Electricidad) — `NECESITA_REPARACION`→fail, `PENDIENTE`→pending, resto→ok; sin parte→pending. `aggregateTechnicalCategory`, `CHECK_STATE_LABELS/COLORS`. `prisma-deps` → `getTrustPassportInput(db, vehicleId)`.
- **Server actions** (`vendedores/[id]/trust-actions.ts`, guard `requireAgente`): `grantTrustSeal(vehicleId, notes?)` (solo si `eligibleForSeal`; idempotente) + `revokeTrustSeal`, con traza en el timeline.
- **UI**: `components/trust-passport-panel.tsx` en la pestaña **Preparación** del vendedor — badge nivel+score, estado del sello (emitir / emitido con fecha+autor / revocar), lista de bloqueos, secciones con checks coloreados.
- **Público** (dato seguro `PublicVehicle.verified = trustVerifiedAt != null`): badge **"Verificado por CampersNova"** en `/comprar/[id]` y en la card del catálogo (`components/catalog/vehicle-catalog-card.tsx`). Palanca comercial de cara al comprador.
- Suite: **506 tests verdes**.

### Pendiente (siguientes fases de confianza)

Sello externo/URL verificable (QR), verificación por terceros vía API (capa 9 del roadmap), checks técnicos dedicados de trust (humedades/gas/agua) como ítems propios si se quiere separar del checklist del taller.

## Estado previo (Block 19 — Scoring + alertas de demanda activa — MERGED A MAIN ✅)

Fase 2 del roadmap infraestructura: convierte los datos estructurados del **B17** (financiación, condiciones de operación) y del **B18** (ofertas) en **señales accionables**. **Sin migración** — todo se calcula en lectura. Plan en `docs/Scoring-Demanda-Plan.md`. PR #65 (`0dc6dbd`).

- **`lib/scoring/`** (puro + tests): `buyerScore` (0-100 + desglose: contacto, necesidad, presupuesto, **financiación B17**, plazo, temperatura, mejor match, **oferta activa B18**) — sustituye el `calcBuyerScore` inline de la ficha de comprador; `sellerAcquisitionScore` (realismo de precio pide-vs-tasación, **urgencia + riesgo B17**, **demanda activa**); `scoreLabel`, `priceRealismPoints`, `ACTIVE_DEMAND_MATCH_THRESHOLD = 60`.
- **`components/score-info.tsx`**: icono (i) con el desglose del score (eje · pts/máx) en tooltip.
- **Ficha comprador**: KPI "Calidad lead" ahora usa `buyerScore` + desglose.
- **Ficha vendedor**: KPI **"Score captación"** (con desglose) + card en el rail **"N compradores esperando"** (verde, enlaza a Compradores) cuando hay demanda activa compatible.
- **Dashboard** (ADMIN/AGENTE): sección **"Demanda activa esperando"** — vehículos en stock (PUBLICADO/TASADO) con compradores activos compatibles (match ≥60), ordenados por nº de compradores. Palanca comercial + señal para captar más stock parecido. Respeta el filtro de agente.
- Suite: **495 tests verdes**.

### Pendiente (siguientes fases del scoring)

Persistir scores si hace falta ordenar/filtrar listados por score (hoy en lectura). Alertas push/email cuando entra un vehículo que satisface una demanda activa concreta (hoy es pull desde dashboard/ficha). Vehicle completeness score ya cubierto por el expediente legal (Block 4). Siguiente capa mayor del roadmap: **B20 Trust Passport unificado** (fusionar expediente legal + checklist técnico del taller en una vista de verificación con estados + sello "Verificado por CampersNova").

## Estado previo (Block 18 — Ofertas y Reservas — MERGED A MAIN ✅)

Primera pieza de la **capa transaccional** (Transaction & Financing Layer) del roadmap infraestructura. Captura estructurada de ofertas y reservas comprador→vehículo — registra **importes negociados + señales** = "precios reales de cierre", el dato que el documento marca como el más difícil de replicar. Plan en `docs/Ofertas-Reservas-Plan.md`. PR #64 (`53776f9`).

Migración **additiva** `20260709000000_add_offers` (enum `OfferStatus` + `ALTER TYPE ActivityType ADD VALUE` ×2 + tabla `offers` + índices + FKs) aplicada a **staging y prod** antes del merge.

- **Modelado**: una sola entidad `Offer` cubre oferta→reserva→venta. Una oferta **ACEPTADA con señal** (`depositAmount`) **es una reserva** (no se duplica en otra tabla). La **venta final** (`Vehicle → VENDIDO`) sigue en el flujo de `Delivery`; aquí solo se marca `CONVERTIDA`. Una fuente de verdad por concepto.
- **Schema**: `Offer` (vehicleId, buyerLeadId, matchId?, amount, depositAmount?, reservedUntil?, notes, rejectionReason? `LostReason`, createdById, decidedAt?) + índices `(vehicleId,status)`/`(buyerLeadId,status)`/`status`. Back-relations en Vehicle/BuyerLead/Match/User. `ActivityType += OFERTA_REGISTRADA, OFERTA_ACTUALIZADA`.
- **`lib/offers.ts`** (puro): máquina de estados `PROPUESTA → CONTRAOFERTA → ACEPTADA → CONVERTIDA` (+ terminales RECHAZADA/EXPIRADA/RETIRADA/CANCELADA); `isReservation` (ACEPTADA+señal>0), `isActiveHold` (ocupa stock), labels/colores/opciones. Tests.
- **Server actions** (`ofertas/actions.ts`, guard `requireAgente`): `createOffer`/`updateOfferStatus`. **Efectos sobre el stock**: ACEPTADA → Vehicle `RESERVADO` (si estaba PUBLICADO); CANCELADA desde una reserva → libera a `PUBLICADO` (RECHAZADA/EXPIRADA/RETIRADA no son alcanzables desde ACEPTADA y no tocan el stock). Transiciones de vehículo validadas con `VEHICLE_TRANSITIONS`. Traza en el timeline de **ambos lados** (comprador + vendedor). **La señal no puede modificarse mediante una acción genérica de edición de oferta** (`updateOffer` retirada en I2A: no tenía consumidores y permitía fijar `depositAmount` en cualquier estado sin transacción, Activity ni sincronización del vehículo). Se registra solo al ACEPTAR, con `isValidDepositAmount` rechazando negativos. Una futura corrección o devolución requerirá una operación explícita, auditable y coordinada. **`createOffer` adopta el protocolo de locks (I2B)**: bloquea `Vehicle → SellerLead → BuyerLead` con `withLockedRoots`, relee todo dentro de la transacción, rechaza leads archivados (`LEAD_ARCHIVED`) y vehículos fuera de `OFFER_CREATION_ALLOWED_VEHICLE_STATUSES` (`TASADO`/`PUBLICADO`/`RESERVADO`; `NUEVO`/`VENDIDO`/`DESCARTADO` → `VEHICLE_NOT_AVAILABLE`), detecta que el vehículo cambió de vendedor (`OFFER_ROOT_CHANGED`) y escribe `Offer` + `Activity` de forma atómica; KPI y revalidación quedan **fuera** de la transacción. Núcleo en `lib/offers-creation.ts`. **`updateOfferStatus` adopta el protocolo (I2C)**: mismas raíces, relectura transaccional, `LEAD_ARCHIVED` sin excepciones, `OFFER_ROOT_CHANGED`, y el **CAS conservado como segunda barrera**. Aceptar exige `Vehicle = PUBLICADO`; cancelar libera solo si sigue `RESERVADO` (si ya está `PUBLICADO` no es fallo; en otros estados falla cerrado); **convertir exige `Vehicle = RESERVADO`** (`VEHICLE_NOT_READY_FOR_CONVERSION` en cualquier otro, sin emitir `SALE_CLOSED`) y no modifica el vehículo. **Propiedad de la reserva inferida sin columna nueva**: se hace cumplir «como máximo una `Offer` `ACEPTADA` por vehículo» (`RESERVATION_ALREADY_OWNED` al aceptar, `RESERVATION_OWNERSHIP_CONFLICT` al cancelar/convertir). Núcleo en `lib/offers-transition.ts`. ✅ **I3C1A (`feat/delivery-offer-link-and-coordinated-creation`) — enlace `Delivery → Offer` y creación coordinada.** `I3C1A ADDS AN OPTIONAL DELIVERY OFFER LINK FOR EXPAND–CONTRACT COMPATIBILITY`: migración additiva `20260721100000_add_delivery_offer_link_expand` añade `Delivery.offerId` **nullable** (`ON DELETE NO ACTION` — no Restrict, para no romper el cascade convergente de `Vehicle → Offer`/`Vehicle → Delivery`) + índice de FK + **índice único parcial** `deliveries_active_vehicle_key` (`AT MOST ONE PROGRAMADA OR EN_CURSO DELIVERY IS ALLOWED PER VEHICLE`). `SCHEMA I3C1A IS BACKWARD-COMPATIBLE WITH THE CURRENT PRODUCTION CODE` — demostrado ejecutando el **Prisma Client genuino generado desde `ca6015e`** contra el schema expandido (`old-client-compat.test.ts`, `pnpm exec prisma generate` con el binario local): create/read/update/delete de Delivery sin `offerId`, `offer_id` queda NULL, sin `P2022`. Asimetría del rollout: `old code + expand schema = compatible`, `new I3C1A code + old schema = incompatible` → `CODE I3C1A MUST NOT BE DEPLOYED BEFORE THE EXPAND MIGRATION IS APPLIED`. **Traductor del P2002 del índice parcial**: Prisma NO devuelve el nombre del índice (solo `modelName='Delivery'` + `target=['vehicle_id']`, verificado con un P2002 REAL), así que `P2002 DELIVERY ACTIVE CONFLICTS ARE CONFIRMED BY A POST-ROLLBACK READ BEFORE DOMAIN TRANSLATION`: la metadata marca el candidato y una lectura post-rollback confirma la activa real antes de traducir a `DELIVERY_ALREADY_ACTIVE` (no depende del nombre del índice ni de que `vehicle_id` sea de un único unique). (La columna es nullable solo para el rollout; `NEW DELIVERY WRITERS MUST ALWAYS PERSIST offerId`; `offerId MUST BECOME NOT NULL IN I3C1B AFTER ZERO-NULL VALIDATION`). `createDelivery` pasa a `requireCanEditEntregas` (era escalada de privilegios), adopta `withLockedRoots` (`Vehicle → SellerLead → BuyerLead`) y exige Offer `CONVERTIDA` coherente + Vehicle `RESERVADO` + sin Delivery activa/completada, atómico con la Activity; núcleo en `lib/delivery-creation.ts`. [HISTÓRICO, superado: `LEAD_ARCHIVED` ya es productivo en I2/I3, no depende de PR #117]. [HISTÓRICO, superado] I3C1B (`SET NOT NULL`), I3C2 (transiciones/cancelación) e **I3C3** (compleción coordinada) **ya están fusionados y desplegados**. I3C3 (squash `ae88e31`): `completeDeliveryTx` adopta `withLockedRoots`, valida checklist/firma bajo lock, efectos atómicos, admite leads archivados, no reversible; **edición de checklist y firma serializadas con la compleción** vía `lib/delivery-precondition.ts` → TOCTOU cerrado; **8 callers productivos**; sin migración; validado técnicamente (CI + postflight prod), validación autenticada end-to-end limitada por 0 Deliveries. Estado vigente: `docs/roadmap/i3-status.md`.

✅ **`I3 MUST REMOVE MANUAL PUBLICADO ↔ RESERVADO TRANSITIONS FROM updateVehicle` — completado por I3A**: `VEHICLE_TRANSITIONS` pasa a ser el subconjunto **manual**; no hay transición manual a `RESERVADO` ni a `VENDIDO` y `RESERVADO` no tiene salidas manuales (`OFFER OWNS PUBLICADO ↔ RESERVADO`, `DELIVERY OWNS THE TRANSITION TO VENDIDO`). `updateVehicle` escribe con **CAS** sobre el estado releído (`lib/vehicle-status.ts`, `VEHICLE_STATUS_CONFLICT`) y su guard de venta manual se retiró por inalcanzable. **`I3B COORDINATES MANUAL VEHICLE UPDATES AND PUBLICATION`**: `updateVehicle` adopta el protocolo de raíces (`MANUAL VEHICLE UPDATES USE THE ROOT LOCK PROTOCOL`) — bloquea `Vehicle → SellerLead` con `withLockedRoots`, relee dentro de la transacción, rechaza `VEHICLE_ROOT_CHANGED` (el vehículo cambió de vendedor) y `LEAD_ARCHIVED` (vendedor archivado), revalida la transición y **conserva el CAS**; el guard legal de `TASADO/PUBLICADO` se releé bajo el lock (los documentos son tabla aparte → límite documentado). **I3B retira todas las transiciones manuales a `DESCARTADO`** (`TEMPORARY MANUAL DISCARD REMOVAL IS A SAFETY MEASURE UNTIL I3D`): quedan solo `NUEVO→TASADO` y `TASADO→PUBLICADO`; descartar debe bloquear ofertas y entregas activas, pero `createDelivery` sigue sin coordinar (`DELIVERY CREATION AND COMPLETION REMAIN UNCOORDINATED UNTIL I3C`) y podría crear una entrega tras el descarte, así que coordinarlo ahora daría una garantía falsa (`FINAL DISCARD COORDINATION REMAINS PENDING UNTIL DELIVERY IS COORDINATED`). I3C (Delivery), I3D (descarte coordinado) e I3E (tasación) siguen pendientes. **`DELIVERY, VEHICLE AND VALUATION WRITERS REMAIN UNCOORDINATED UNTIL I3`**: el invariante del archivado sigue sin estar garantizado end-to-end.

- **UI**: `components/offers-section.tsx` reutilizable (alta inline eligiendo contraparte de los matches + transiciones con diálogos: señal+fecha al aceptar, motivo al rechazar). Pestaña **Ofertas** en ficha comprador (candidatos = vehículos matcheados); bloque bajo los matches en ficha vendedor (candidatos = compradores matcheados). **`/ofertas`**: tablero por estado (4 columnas) + cerradas colapsables + KPIs (ofertas vivas, reservas activas, valor en negociación, señales retenidas). Sidebar "Ofertas" (icono HandCoins) en Pipeline (ADMIN/AGENTE).
- Suite: **483 tests verdes**.

### Pendiente de la capa transaccional (fases siguientes)

Contratos/pagos, integración con financiera y gestoría, y **reporting de precios reales de cierre** (alimenta valoración v2 + Market Intelligence). "Reserva vence" como recordatorio de calendario (patrón de agregación ya disponible). Sigue pendiente **B19 (scoring + alertas de demanda activa)**.

## Estado previo (Block 17 — Modelo de datos estructurado: demanda + oferta — MERGED A MAIN ✅)

Primer bloque guiado por el documento estratégico fundacional (visión "de concesionario a infraestructura"): estructura la información comercial clave que vivía en notas libres, para habilitar el scoring (B19) y las ofertas/reservas (B18). Plan en `docs/Modelo-Datos-Estructurado-Plan.md`. PR #63 (`e3b268e`).

Migración **additiva** `20260708100000_add_structured_deal_fields` (3 enums + columnas nullable) aplicada a **staging y prod** antes del merge (orden seguro: migración → merge → deploy).

- **Comprador (`BuyerLead`)** — `financingNeeded` (Boolean?) + `maxMonthlyPayment` (Decimal?). Financiación como dato de cualificación (no filtro de matching): campos en alta + ficha, resumen en el rail.
- **Vendedor (`SellerLead`)** — `minPrice` (precio mínimo aceptado), `dealType` (`SellerDealType`: DEPOSITO_VENTA/COMPRA_DIRECTA/PARTE_PAGO/INDECISO), `urgency` (`SellerUrgency`: ALTA/MEDIA/BAJA), `riskLevel` (`SellerRisk`: BAJO/MEDIO/ALTO), `riskNotes`. Sección "Condiciones de la operación" en el form + card "Operación" en el rail (urgencia/riesgo coloreados). El **margen NO se duplica** (vive en `Vehicle`).
- **`lib/deal-terms.ts`** (puro): labels/opciones/colores/validadores de los 3 enums de vendedor + tests. Validadores (buyer/seller) y server actions (`createBuyerLead`/`updateBuyerLead`/`updateSellerLead`) actualizados.
- Suite: **476 tests verdes**. typecheck + lint OK.

### Contexto estratégico (memoria privada)

El dueño compartió (2026-07-08) el **documento estratégico fundacional** de CampersNova (privado, NO en el repo — guardado solo en memoria local). Tesis: el concesionario/marketplace es el motor; el activo es convertirse en la **infraestructura del caravaning** ("CampersNova OS", 10 capas + flywheel de datos). El roadmap del CRM se ordena ahora por ese marco: **B17 datos estructurados → B18 ofertas/reservas (precios reales de cierre) → B19 scoring + alertas de demanda activa → B20 Trust Passport unificado**. Filtro de priorización: una feature entra si aumenta operaciones, captura mejores datos, reduce riesgo o crea dependencia.

## Estado previo (Block 16 — Captación de vehículos de portales F1→F3 — MERGED A MAIN ✅)

Nuevo módulo pedido por el dueño (nota "GESTIÓN DE VENTA"): cómo los comerciales registran vehículos que encuentran en portales externos (Coches.net, Wallapop, Milanuncios) — **fase 0 del vendedor**, antes de que el vehículo entre en la nave. Plan en `docs/Captacion-Vendedor-Plan.md`. Entidad ligera `VehicleCapture` con tablero tipo pipeline; cuando el vehículo va a entrar, se convierte en `SellerLead` + `Vehicle` (una sola fuente de verdad, no se duplica).

### F1 — Entidad + tablero + dedup (PR #60, `65c2c00`)

Migración additiva `20260708000000_add_vehicle_captures` (2 enums + tabla + índices + FKs) aplicada a staging y prod antes del merge.

- **Schema**: `VehicleCapture` + enums `CapturePortal` (COCHES_NET, WALLAPOP, MILANUNCIOS, OTRO) y `CaptureStatus` (NO_CONTACTADO → CONTACTADO → EN_CURSO → ENTRADA_AGENDADA → CONVERTIDO / RECHAZADO). Campos: listingUrl, phone, portal, title, askingPrice, notes, rejectionReason (`LostReason`), entradaScheduledAt, assignedTo/createdBy (User), `sellerLeadId @unique` (FK ON DELETE SET NULL). Back-relations en User (`createdCaptures`/`assignedCaptures`) y SellerLead (`capture`).
- **`lib/captacion.ts`** (puro): labels/colores/opciones, `CAPTURE_BOARD_COLUMNS` (5 columnas, excluye RECHAZADO), validadores, `isTerminalCaptureStatus` (CONVERTIDO/RECHAZADO), `findDuplicateCaptureByPhone` (reutiliza `lib/phone`, ignora terminales). Tests.
- **`/captaciones`** (RSC): quick-add inline (url+tel+portal+título+precio) con **aviso de duplicado** por teléfono (contra captaciones vivas Y seller leads) + "Captar de todas formas"; tablero de 5 columnas por estado + "Rechazadas" colapsable. Card client: badge de portal, precio, link al anuncio, WhatsApp, responsable, notas, selector de estado, rechazo inline (con `LostReason`), edición inline.
- **`createCapture` / `updateCaptureStatus` / `updateCapture`** (`captaciones/actions.ts`, guard `requireAgente`).
- **Sidebar**: "Captaciones" (icono Radar) antes de "Vendedores" en Pipeline (ADMIN/AGENTE).

### F2 — Agendar Entrada + aparece en el calendario (PR #61, `31e8ea4`) — sin migración

La "cita confirmada" de la nota del dueño es en realidad una **Entrada** (recepción del vehículo en la nave), no una cita de comprador. Nombre del estado: **Entrada agendada**.

- **`scheduleEntrada(id, dateTimeIso)`**: pone `ENTRADA_AGENDADA` + `entradaScheduledAt`, revalida `/captaciones` y `/calendario`. Card: picker `datetime-local` inline + muestra la fecha formateada con `timeZone: 'Europe/Madrid'`.
- **Calendario** (6º origen `captacion`): `captureToItem` (kindLabel "Entrada", href `/captaciones`), `listCaptures` en `CalendarDeps`/`prisma-deps` (status ENTRADA_AGENDADA con `entradaScheduledAt` en rango), incluido en `getCalendarItems`/`applyFilters`. Leyenda/filtros del calendario ganan "Entradas" (color #0d9488) + "Eventos".

### F3 — Convertir a ficha de vendedor + vehículo (PR #62, `2a2d49b`) — sin migración

Un clic (visible cuando la Entrada está agendada) cierra la fase 0 → pipeline normal del vendedor.

- **`convertCaptureToSellerLead(id)`**: crea `SellerLead` (canal CN, `agentId` = responsable de la captación) + `Vehicle` prellenado — marca/modelo del título vía **`splitCaptureTitle`** (1ª palabra = marca, resto = modelo, placeholders editables), `desiredPrice` = precio pedido, tipo/año/km/plazas por defecto (AUTOCARAVANA / año actual / 0 / 4) que el comercial ajusta. Registra el origen en el timeline (portal, link, precio, observaciones), marca **CONVERTIDO**, vincula `sellerLeadId`. Tasación + recálculo de matches no bloqueantes. **Idempotente** (si ya está convertida, devuelve el lead existente). Patrón espejo de `createSellerLeadFromTradeIn`.
- **UI**: botón "Convertir a ficha de vendedor" en la card + enlace directo a la ficha cuando ya está convertida.
- ⚠️ **La captación NO trae email** (los portales no lo exponen) → el `SellerLead` se crea con `email: ''`; el comercial lo completa en la ficha.
- Suite: **473 tests verdes**.

### Pendiente del plan de captación (cuando se quiera)

F4 (opcional): reporting de captaciones por portal, tasa de conversión, por comercial. Fuera de alcance de este bloque (viven en el flujo del vendedor real): contrato de depósito-venta con el vendedor y cuestionario de recepción del vehículo en la nave.

## Estado previo (Block 15 — Calendario operativo F1→F6 — DESPLEGADO A PROD ✅)

### Fixes UX del calendario (PRs #58-#59, 2026-07-07) — sin migración

Detectados validando en producción en vivo con el dueño (navegador):

- **Header cohesivo + scroll propio (#58, `f845b83`)**: el `-mt-6` metía el header en el padding del `<main>` (overflow container) y lo recortaba; la fila "Semana del…" flotaba suelta. Rediseño a layout de app: contenedor `lg:h-[calc(100vh-3rem)] flex flex-col`, **header fijo** (`shrink-0`) de 2 filas (título+acciones / periodo+filtros), y **rejilla con scroll propio** (`flex-1 overflow-auto`). El header nunca se recorta y queda fijo al scrollear.
- **Ocultar cancelados (#59, `04e39ca`)**: `listEvents` filtra `status notIn [CANCELADO, NO_SHOW]` — los cancelados no se muestran en el calendario.

### Fix zona horaria — hora de España (PR #57, squash `dfc468e`, 2026-07-07) — sin migración

Bug detectado validando en producción con el dueño: las horas se mostraban en **UTC** (Vercel corre en UTC), p.ej. una cita a las 12:00 salía como 10:00. El instante se guarda bien; era solo render.

- **`instrumentation.ts`** fija `process.env.TZ = 'Europe/Madrid'` en runtime nodejs. **GOTCHA: Vercel RESERVA el nombre de env var `TZ`** — no se puede poner desde el panel (da "name is reserved"); por eso se hace en código. Node relee `process.env.TZ` → arregla display **y** lógica de creación (ej. "llamar mañana 10:00") en toda la app.
- **Garantía por formateador**: `timeZone: 'Europe/Madrid'` explícito en todos los `toLocaleString`/`toLocaleDateString` del calendario (vista, detalle, cron recordatorios, digest, card de citas en ficha comprador).
- Cosmético: `capitalize` (mayúscula por palabra) → `first-letter:uppercase` en los títulos del calendario.

### F6 — Recordatorios y notificaciones (PR #56, squash `93faabe`, 2026-07-07) — sin migración

Spec §26. Dos piezas:

- **Digest diario "tu agenda de mañana"** (`/api/cron/calendar-reminders`, cron 06:00 UTC en `vercel.json`): agrupa lo agendado para mañana (todos los orígenes) por responsable vía `groupItemsByAssignee` (`lib/calendar/reminders.ts`, puro, 2 tests) y envía email por responsable. Reutiliza `getCalendarItems`.
- **Aviso inmediato al asignar**: `createCalendarEvent` con responsable ≠ creador → email al momento (no bloqueante).
- `CalendarItem` gana `assigneeId` (5 mappers). Plantillas `calendar-digest.ts` + `sendCalendarDigest`/`sendCalendarEventAssigned`.
- **Operativa**: el cron necesita `CRON_SECRET` en Vercel (mismo del cron de postventa); Resend con dominio verificado (ya hecho). Suite: **462 tests verdes**.

### F5 — Vista mensual (PR #55, squash `7a3e3e2`, 2026-07-07) — sin migración

- Tercera vista del calendario (spec §23.1): `/calendario?view=month`. Rejilla de semanas (lun–dom), celda con día + hasta 3 eventos + "+N más"; días fuera del mes atenuados, hoy resaltado; clic en día → vista día; nav por meses (`?month=`). Toggle: Semana · Día · Mes.
- **Fix zona horaria**: helper `ymd()` (fecha local YYYY-MM-DD) en vez de `toISOString().slice(0,10)`, que en UTC+ devolvía el día anterior.
- Suite: **460 tests verdes**.

### F4 — Mejora ≠ Reparación en Taller (PR #54, squash `d04f793`, 2026-07-07)

Migración additiva `20260707600000_add_workorder_kind` (columna con default → filas existentes = REPARACION) aplicada a staging y prod.

- **Schema**: enum `WorkOrderKind` (REPARACION, MEJORA) + `WorkOrder.kind` default REPARACION. (Limpieza NO va aquí — ya es evento de calendario; no se duplica.)
- Formulario de orden: selector Reparación/Mejora; acepta `?kind=`. Selector del calendario: Reparación/Mejora → `/taller/nueva?kind=`. Agregación: tarjeta "Taller · Mejora/Reparación". Ficha de la orden: badge (Mejora violeta / Reparación gris).
- Con F4 el calendario cubre **los 8 tipos de la hoja del dueño completos y sin duplicar**. Suite: **460 tests verdes**.

### F3 — Crear los 8 tipos de la hoja desde el calendario (PR #53, squash `04887c3`, 2026-07-07)

Alinea el calendario con la **hoja manuscrita del dueño**: los 8 tipos (Entrega, Entrada/Recepción, Reparación, Mejora, Cita, **Llamada**, Otros, Limpieza) se crean "desde el calendario" sin duplicar datos. Migración additiva `20260707500000_add_llamada_event_type` (nuevo valor de enum) aplicada a staging y prod.

- **Selector de tipo** en `/calendario/nuevo`: 8 tarjetas. Nativos (Cita/Llamada/Limpieza/Otros) → formulario `CalendarEvent`; con módulo propio (Entrega→`/entregas/nueva`, Entrada→`/vendedores/nuevo`, Reparación/Mejora→`/taller/nueva?vehicleId=`) → redirigen a su form existente. **Una sola fuente de verdad.**
- **Nuevo tipo `LLAMADA`** (enum `CalendarEventType`) con campos teléfono + motivo; `NATIVE_EVENT_TYPES` separa los que se materializan como evento de los que redirigen.
- ⚠️ **Reparación y Mejora comparten `/taller/nueva`** (misma creación). Distinguir Mejora dentro de Taller (`WorkOrder.kind`) queda como F4.
- Nota: la hoja decía "Demanda" pero el dueño aclaró que es **"Llamada"**. Suite: **460 tests verdes**.

## Estado previo (Block 15 — Calendario operativo F1+F2 — DESPLEGADO A PROD ✅)

Módulo de **Calendario / Agenda operativa** (spec del dueño en `docs/`). Decisión de arquitectura acordada con el dueño: **agregación, NO mega-tabla** — el calendario reúne lo ya agendado (Entregas, Taller, Postventa, Próximas acciones) en una vista unificada + una tabla `CalendarEvent` **solo** para tipos sin hogar (Citas primero). Se evita duplicar Delivery/WorkOrder → una sola fuente de verdad por entidad. El plan/mapeo vive en `docs/Calendario-Mapeo.md`.

### F1 — Vista unificada (PR #51, squash `7cdc8e5`, 2026-07-07) — sin migración

- **`lib/calendar/`**: modelo de lectura `CalendarItem` + mappers puros por origen (`deliveryToItem`, `workOrderToItem`, `followupToItem`, `nextActionToItem`, y en F2 `eventToItem`) + `getCalendarItems(deps, range, filters)` (deps inyectables) + `prisma-deps.ts`. Cada ítem enlaza a su ficha real.
- **`/calendario`**: vista **semana** (7 columnas día) + **día** (lista), nav `?week=`, filtros por origen (chips) y responsable. CSS grid, sin librerías nuevas. Sidebar: entrada "Calendario" en Operaciones (ADMIN/AGENTE/TALLER/ENTREGAS).

### F2 — CalendarEvent + Citas (PR #52, squash `eb4587d`, 2026-07-07)

Migración additiva `20260707400000_add_calendar_events` aplicada a staging y prod antes del merge.

- **Schema**: `CalendarEvent` + enums `CalendarEventType` (CITA, LIMPIEZA, SEGUIMIENTO, OTRO), `CalendarEventStatus` (PROGRAMADO→CONFIRMADO→EN_CURSO→COMPLETADO / CANCELADO / NO_SHOW), `CalendarEventPriority`. FKs opcionales a User (creador/responsable), BuyerLead, SellerLead, Vehicle, Match + `specificData Json`. **Reparación/Mejora siguen en WorkOrder; Entrega en Delivery** — NO se duplican aquí.
- **`lib/calendar/event-meta.ts`**: labels/opciones + máquina de estados (`isValidEventTransition`, terminales).
- **Agregación**: 5º origen `event` en `getCalendarItems` (mapper → href `/calendario/:id`).
- **`createCalendarEvent` / `updateCalendarEventStatus`** (`calendario/actions.ts`): crear con `endAt` derivado de la duración; transiciones validadas; completar guarda `resultNotes`, cancelar/no-show guardan motivo. 6 tests.
- **UI**: `/calendario/nuevo` (form por tipo + campos de cita: canal/teléfono/objetivo + asociaciones), `/calendario/[id]` (detalle + barra de estados), botón "Nuevo evento". **Ficha comprador**: card "Citas y eventos" en el rail + "Agendar" con comprador preseleccionado.
- Suite: **460 tests verdes**.

### Pendiente del spec de calendario (fases siguientes, cuando se quiera)

Limpieza/Seguimiento/Otros sobre `CalendarEvent` (la tabla ya los soporta); `WorkOrder.kind` (REPARACION|MEJORA|LIMPIEZA) para diferenciar mejora; vista **mensual** + reporting (§27); recordatorios/notificaciones; **IA** de "crear evento desde texto natural" (§22). Base lista para todas.

## Estado previo (Block 14 — Ficha Comprador: CAM-60→66 COMPLETO — DESPLEGADO A PROD ✅)

### CAM-65 — Excluyentes vs preferencias visibles (PR #50, squash `83c7d35`, 2026-07-07)

**Sin migración** — la distinción ya vivía en `lib/matching/filters.ts`, ahora se hace visible.

- **`lib/buyer-criteria.ts`**: `classifyBuyerCriteria(buyer)` etiqueta cada criterio activo como **excluyente** (filtros duros: tipo, plazas mín., presupuesto, plazas dormir, baño obligatorio, carnet B, largo/alto máx.) o **preferencia** (scoring: distribución, cama, equipamiento, zona, invierno, garaje, niños). 5 tests.
- **Ficha comprador (rail)**: card "Criterios de búsqueda" con badge rojo (excluyente) / gris (preferencia) + tooltip; oculta si no hay criterios.
- Suite: **445 tests verdes**. **Bloque Ficha de Comprador cerrado: CAM-60→66 completo.**

### CAM-66 — Aviso de duplicados por teléfono (PR #49, squash `82cef40`, 2026-07-07)

### CAM-66 — Aviso de duplicados por teléfono (PR #49, squash `82cef40`, 2026-07-07)

**Sin migración**.

- **`lib/phone.ts`**: `normalizePhone` (móviles ES → prefijo 34) + `phonesMatch`; `formatPhoneForWhatsApp` reutiliza `normalizePhone`. 7 tests.
- **`lib/buyer-dedup.ts`**: `findDuplicateBuyerByPhone` (deps-injectable) + `prismaBuyerDedupDeps`. Escanea `buyerLead.findMany` y compara por teléfono normalizado (escala pequeña, sin columna normalizada). 3 tests.
- **`createBuyerLead(data, allowDuplicate=false)`**: si hay duplicado devuelve `{ duplicate: {id,name,status} }` en vez de crear; el form de alta muestra banner ámbar con enlace + "Crear de todas formas". 2 tests.
- **Chat** (`register_buyer_lead`): si el teléfono existe, **reutiliza** el lead (vincula sesión + Activity "nueva conversación de comprador existente") en vez de duplicar.
- Suite: **440 tests verdes**. Bloque Ficha de Comprador **completo** (CAM-60→66; CAM-65 quedó opcional, no implementado).

### CAM-64 — Explicación del match (PR #48, squash `d200cf1`, 2026-07-07)

### CAM-64 — Explicación del match (PR #48, squash `d200cf1`, 2026-07-07)

**Sin migración** — reutiliza los ejes de scoring del matching.

- **`lib/matching/explain.ts`**: `explainMatch(vehicle, buyer, breakdown)` + `buildMatchExplanation(vehicle, buyer)` generan determinista (sin LLM) motivos (✓) y riesgos (⚠) desde el `ScoreBreakdown` + datos del par: distribución, cama, equipamiento crítico que falta, precio vs presupuesto, antigüedad/km, zona. Exportado en `lib/matching/index.ts`. 7 tests.
- **`MatchesSection`**: bloque de motivos (verde) + riesgos (ámbar) en cada tarjeta (ambos lados). Tipo `MatchExplanationData` opcional en `VehicleMatchData`/`BuyerMatchData`.
- **Fichas comprador y vendedor**: computan la explicación por match en el server component vía `prismaMatchingDeps` (≤10 queries por ficha) y la pasan serializada al cliente.
- Suite: **427 tests verdes**.

### CAM-63 — Vehículo de parte de pago / trade-in (PR #47, squash `955fd4e`, 2026-07-07)

### CAM-63 — Vehículo de parte de pago / trade-in (PR #47, squash `955fd4e`, 2026-07-07)

Migración additiva `20260707300000_add_trade_in` aplicada a staging y prod antes del merge.

- **Schema**: enum `TradeInVehicleType` (COCHE, CAMPER, AUTOCARAVANA, FURGONETA, MOTO, OTRO) + campos `hasTradeIn`/`tradeInType`/`tradeInBrand`/`tradeInModel`/`tradeInYear`/`tradeInKm`/`tradeInFinancePending`/`tradeInNotes` + relación 1:1 opcional `tradeInSellerLead` (`tradeInSellerLeadId @unique`, FK ON DELETE SET NULL) en `BuyerLead`.
- **`lib/trade-in.ts`**: labels + `isStockEligibleTradeIn` (solo camper/autocaravana = stock) + `tradeInTypeToVehicleType`. 9 tests.
- **Ficha comprador** (pestaña Ficha, `trade-in-card.tsx`): sección "Vehículo de parte de pago" con toggle + form; `updateTradeIn` guarda/limpia.
- **`createSellerLeadFromTradeIn`** (`trade-in-actions.ts`): con camper/autocaravana + marca/modelo/año/km, crea `SellerLead` CN + `Vehicle` NUEVO (seats=4 por defecto), vincula, registra origen en ambos timelines, tasa + recalc matches. Idempotente (bloquea si ya hay `tradeInSellerLeadId`). 5 tests.
- Suite: **420 tests verdes**.

### CAM-62 — Temperatura del lead comprador (PR #46, squash `201457a`, 2026-07-07)

### CAM-62 — Temperatura del lead comprador (PR #46, squash `201457a`, 2026-07-07)

Migración additiva `20260707200000_add_lead_temperature` aplicada a staging y prod antes del merge.

- **Schema**: enum `LeadTemperature` (HOT/WARM/COLD) + `temperature` nullable en `BuyerLead`; `ActivityType` += `TEMPERATURA_ACTUALIZADA`.
- **`lib/lead-temperature.ts`**: labels/colores + `suggestTemperatureFromTimeline` (<1 mes → HOT · 1-3 meses → WARM · resto/null → COLD). 6 tests.
- **Ficha comprador**: selector segmented de un clic (`temperature-chip.tsx`) junto al StatusPill del hero; server action `setBuyerTemperature` (`temperature-actions.ts`) con Activity y no-op si no cambia.
- **Listado**: punto de color junto al nombre + chip filtro "Temperatura" (`?temp=`).
- **Sugerencia inicial** en `createBuyerLead` y tool del chat según `purchaseTimeline`.
- Suite: **407 tests verdes**.

### CAM-61 — Motivo de pérdida estructurado (PR #45, squash `e43960a`, 2026-07-07)

Migración additiva `20260707100000_add_lost_reason` aplicada a staging y prod antes del merge.

- **Schema**: enum `LostReason` (PRECIO, FINANCIACION, COMPRO_A_OTRO, NO_RESPONDE, APLAZA, SIN_STOCK, EXPECTATIVAS, OTRO) + `lostReason`/`lostReasonNotes` nullable en ambos leads.
- **`lib/lost-reason.ts`**: labels/opciones/validador (compartido comprador+vendedor).
- **`archiveBuyerLead`/`archiveSellerLead`**: motivo obligatorio (validado server-side), notas máx 500 → null si vacías, incluido en la Activity `CAMBIO_ESTADO`.
- **Diálogos de archivar** (ambas fichas): select obligatorio + detalle opcional + error inline.
- **Dashboard**: card "Por qué perdemos leads · últimos 90 días" (ADMIN+AGENTE, respeta filtro de agente, oculta si no hay datos) con desglose compradores/vendedores por motivo.
- Suite: **401 tests verdes**.

### CAM-60 — Próxima acción comercial (PR #44, squash `35a1dac`, 2026-07-07)

Primer ticket del bloque Ficha de Comprador (`docs/Ficha-Comprador-Mapeo.md`). Migración additiva `20260707000000_add_next_action` aplicada a **staging y prod ANTES del merge** con `prisma migrate deploy` (staging dio P1001 al inicio — era una incidencia de Supabase, el proyecto estaba "Unhealthy", NO pausado; reintento OK).

- **Schema**: enum `NextActionType` (LLAMAR, WHATSAPP, EMAIL, ENVIAR_VEHICULOS, PEDIR_DOCS, AGENDAR_VISITA, SEGUIMIENTO, CERRAR) + `nextActionType`/`nextActionDueAt` nullable + índice en `SellerLead` y `BuyerLead`; `ActivityType` += `PROXIMA_ACCION_ACTUALIZADA`.
- **`lib/next-action.ts`**: labels/opciones, `defaultNextActionData()` ("Llamar mañana 10:00"), `isNextActionOverdue`, `formatNextActionDue`. 18 tests.
- **`setNextAction`** (`app/(backoffice)/next-action-actions.ts`): server action polimórfica seller/buyer, guard `requireAgente`, transacción update+Activity, revalida ficha/listado/dashboard. 6 tests.
- **`components/next-action-editor.tsx`**: editor inline (select + datetime-local) dentro de la `ProximaAccionCard` de ambas fichas; badge "⚠ Vencida"; fallback al texto heurístico por estado si no hay acción.
- **Defaults al crear lead** en los 4 puntos de entrada: `createSellerLead`, `submitPublicLead` (/vender), `createBuyerLead`, tool del chat (/comprar).
- **Dashboard**: la agenda abre con acciones vencidas (link a ficha) + contador de leads activos sin próxima acción (respeta el filtro de agente).
- Suite: **398 tests verdes**.

## Estado previo (Block 13 — Backoffice 100% responsive — DESPLEGADO A PROD ✅)

Desplegado a producción el **2026-07-07** vía **PR #43** (squash-merge a `main`, commit `92fee20`). Sin migraciones — solo frontend. El backoffice era desktop-only; ahora es usable en móvil y tablet. La web pública no se tocó (ya era mobile-first).

### Navegación unificada (una sola barra)

- **Desktop (≥1024px)**: se eliminó la barra global casi vacía (h-16). El menú de usuario (avatar + nombre + rol + logout) vive en el **pie del sidebar** (`components/layout/sidebar.tsx`). Cada página tiene una única barra sticky propia (título + acción principal).
- **Móvil (<1024px)**: barra global fina h-14 (`components/layout/topbar.tsx`, ahora `lg:hidden`) con hamburguesa + avatar. El sidebar se oculta (`hidden lg:flex`) y se abre como **drawer** (`components/layout/mobile-sidebar.tsx`: overlay + panel w-64, cierra al navegar, bloquea scroll del body). Sin librerías nuevas.
- `SidebarContent` es el componente compartido entre el aside desktop y el drawer móvil (props `userRole`, `userName`, `roleLabel`, `onNavigate`).
- **Cabeceras de página** (listados y fichas): sticky **solo en desktop** (`lg:sticky lg:top-0 lg:h-[73px]`); en móvil scrollean con el contenido (altura auto con `min-h` + `py-2`). Esto corrige un glitch donde la cabecera sticky flotaba en mitad de la lista en móvil.

### Listados y tablas

- **`/vendedores` y `/compradores`**: pipeline strip y tabla envueltos en `overflow-x-auto` con `min-w-[820px]`/`min-w-[980px]` (scroll horizontal, no aplastar columnas). Tabs de vistas scrollables (`overflow-x-auto whitespace-nowrap`). Footer de paginación con `flex-wrap`. Paddings `px-4 md:px-10`. Botón "Exportar" oculto en `<sm`. "Guardar vista" oculto en `<md`. **Acciones de fila (WhatsApp/ver) siempre visibles en táctil**: `lg:opacity-0 lg:group-hover:opacity-100` (antes eran invisibles en móvil al depender del hover).
- **Taller/Entregas/Postventa/Usuarios**: todas las tablas pasaron de `overflow-hidden` a `overflow-x-auto` + `min-w-[480-760px]` en el `<table>`. Cabeceras de página con `flex-wrap gap-3`.
- Los buscadores de filtros bajaron de `min-w-[280px]` a `min-w-[200px]` (no desbordan en 320px).

### Fichas

- **Ficha comprador** adoptó el patrón de la de vendedor: `grid-cols-1 lg:grid-cols-[1fr_320px]` (antes `grid-cols-[1fr_320px]` fijo — rota en móvil). Rail derecho: `border-t lg:border-l lg:border-t-0`, sticky solo desktop (`lg:sticky lg:top-[130px]`).
- **Ficha vendedor**: paddings responsive (`px-4 md:px-8/10`, `p-4 md:p-8`), `QuickAdvanceButton` del topbar oculto en `<sm` (la próxima acción del rail es el CTA primario).
- Dashboard: cabecera con wrap; fila "Top vehículos por margen" oculta la barra de progreso en `<md` con grid responsive.

> Nota validación: el preview de Vercel del PR dio `500 MIDDLEWARE_INVOCATION_FAILED` — al scope **Preview** de Vercel le faltan las env vars de Supabase (paso pendiente del handoff de staging, ver Block 9). No afecta a Production. Validado en local.

## Estado previo (Block 12 — Analytics, Favicon, Logo y limpieza web — DESPLEGADO A PROD ✅)

Desplegado a producción el **2026-07-01** vía **PRs #39–#42** (squash-merge a `main`). Sin migraciones de base de datos — solo cambios de frontend y analytics.

### Google Tag Manager + GA4 (PR #39)

- **GTM**: contenedor `GTM-NK5ZBX8P` cargado en `components/google-tag-manager.tsx` con **consentimiento estricto** — idéntico al modelo de PostHog. El script solo se inyecta cuando el usuario hace clic en "Aceptar todas" en el banner de cookies. Escucha `CustomEvent('cn:consent')` (mismo tab) y `StorageEvent` (cross-tab).
- **GA4**: propiedad `CampersNova` · stream `campersnova.com - Web` · Measurement ID `G-WTR0WB8R6R`. Configurado **dentro del contenedor GTM** como etiqueta "Google tag" con trigger All Pages — no hay código GA4 en el repo.
- **Env var en Vercel**: `NEXT_PUBLIC_GTM_ID=GTM-NK5ZBX8P` (Production + Preview).
- Actualizado: banner de cookies (menciona GA), `/cookies` (filas `_ga` y `_ga_*`), `/privacidad` (sección analítica + Google Ireland Ltd. como encargado).

### Favicon con logo real (PR #40)

- `app/favicon.ico` — 32×32 generado desde el logo circular (PowerShell System.Drawing)
- `app/icon.png` — 512×512 (favicon moderno / PWA)
- `app/apple-icon.png` — 180×180 (iOS Add to Home Screen)
- Fuente: `public/favicon Campers Nova.png` (logo circular cream)

### Logo PNG en el header (PR #42)

- `components/public-nav.tsx` reemplaza `LogoCampersNova` (componente tipográfico) por `<Image>` con el logo PNG real.
- Fuente: `public/logo cn.png` (1536×1024, fondo transparente). El PNG original tenía el texto en solo el 33% del área → recortado automáticamente a `public/logo-cn-cropped.png` (756×334) usando PowerShell con detección de píxeles alfa > 0.
- Tamaño en header: `h-9` mobile · `h-11` desktop, ancho automático.
- El componente `LogoCampersNova` sigue existiendo (`components/logo-campers-nova.tsx`) — lo usa el sidebar del backoffice y el footer.

### Sección Nova Assistant ocultada (PR #41)

- `app/page.tsx`: `<NovaAssistant />` comentado e import eliminado. La funcionalidad no está lista. El componente sigue en `components/landing/nova-assistant.tsx` para reactivar cuando esté disponible.

## Estado previo (Block 11 — Taxonomía RV en el matching + etiquetado IA — DESPLEGADO A PROD ✅)

Desplegado a producción el **2026-06-18** vía **PR #34** (squash-merge a `main`). La migración additiva `20260618000000_add_rv_taxonomy` se aplicó a prod **antes** del merge (orden seguro: migración → merge → deploy), con `prisma migrate deploy` (conexión directa `.env` → prod). **No** se usó el MCP de Supabase: el token cargado apunta a la cuenta **TuteBot/joeylito**, no a Campernova (gotcha de cuentas, ver `docs/ACCOUNTS.md`). Migración solo `CREATE TYPE` + `ADD COLUMN` nullable → no toca datos.

### Taxonomía RV (Fase #3 del plan de la nota de voz) — antes bloqueada, ahora v1

- **Schema additivo** en `Vehicle` (category, bedLayout, sleepingPlaces, bathroomType, heatingType, winterized, hasGarage, maxMassKg, heightM, offGrid) y `BuyerLead` (preferencias espejo + excluyentes). `seats` = plazas homologadas; `sleepingPlaces` = para dormir.
- **Matching** (`lib/matching`): nuevos ejes de scoring **categoría (22)** y **cama (18)** + filtros duros nuevos (plazas dormir, baño obligatorio, carnet/MMA > 3.500 kg, largo/alto de parking). `WEIGHTS` = categoría 22 · cama 18 · precio 20 · equipo 15 · antig/km 15 · zona 10. **Fail-open**: el stock sin etiquetar NO se oculta (ejes sin dato → neutral 60). Diseño en `docs/adr/0006-rv-taxonomy-matching.md`.
- **Fuente única de opciones** `lib/rv-taxonomy.ts` (mismas etiquetas/valores en `/vender`, ficha de vehículo y de comprador). Baño = dimensión propia (`bathroomType`); `equipment.bathroom` se deriva de ahí.
- **Etiquetado asistido por IA** (`lib/rv-suggest/`): botón "Sugerir con IA" en la ficha del vehículo (pestaña Preparación) → Claude (visión) analiza fotos + marca/modelo y prerellena la ficha técnica RV; el agente revisa y guarda. Solo **añade** información; salida validada contra los enums (`normalizeRvSuggestion`). Reutiliza el pipeline de visión de anuncios (SDK oficial, URL + fallback base64).
- **Glosario** del dueño en `docs/taxonomia-rv-glosario.md` (base de la taxonomía y futuro conocimiento del chat en la Fase B).
- Tests: **378 verdes**. Validado end-to-end en staging (3 vehículos + 2 compradores opuestos → cada filtro y eje demostrado) y visión real probada (el modelo reconoció el vehículo desde la foto).

**Operativa para el equipo**: para que el matching cuadre fino, etiquetar el stock en la ficha del vehículo (pestaña **Preparación** → "Ficha técnica (RV)"). Atajo: el botón **"Sugerir con IA"** rellena casi todo desde las fotos; solo hay que revisar y Guardar.

### Fix del chat comprador en local (PR #33)

`@ai-sdk/anthropic` construye la URL como `${baseURL}/messages`, así que `ANTHROPIC_BASE_URL` debe incluir `/v1`. Si el entorno la exporta sin `/v1` (válido para el SDK oficial, no para el AI SDK) el chat de `/comprar` daba 404 y se quedaba "pensando" — **solo en local** (en Vercel la variable no existe). Provider normalizado en `lib/ai/anthropic.ts`.

### Fase B — Chat con taxonomía RV (DESPLEGADO A PROD ✅)

Desplegado el **2026-06-19** vía **PR #37** (squash-merge a `main`). **Sin migración** (reutiliza los campos RV del `BuyerLead` de la Fase A) → deploy directo de código.

- El asistente de `/comprar` traduce el lenguaje del cliente (coloquial o técnico) a la taxonomía: distribución, tipo de cama, plazas para dormir, baño obligatorio, carnet/peso, alto/largo de parking, uso invernal, garaje deporte, niños → se guarda en el `BuyerLead` para alimentar el matching.
- **Tool** ampliado (`lib/chat/tools.ts`) + **system prompt** (`lib/chat/system-prompt.ts`) con una chuleta _lenguaje cliente → taxonomía_ y reglas **excluyente vs preferencia** (solo fija carnet/medidas/baño si el cliente es firme → no auto-excluye stock). Mapeo args→`BuyerLead` en `app/api/chat/buyer/message/route.ts`.
- Estilo conversacional (1-2 preguntas máximo, no interrogatorio); avisa proactivamente del carnet/peso si el cliente pide algo grande.
- Validado: **380 tests** + eval de comprensión (NLU) con el modelo real sobre 12 frases (11/12; el restante es una clasificación alternativa válida) + prueba en vivo en staging (lead creado con sus preferencias RV). Baño = `bathroomRequired` (se quitó `bathroom` de los flags de equipamiento del chat, coherente con la Fase A).

> **Nota dev**: la ficha pesada de comprador puede tirar el worker de render del dev server en Windows (`Jest worker encountered child process exceptions`) — es un flake local de Next 14 dev, no afecta a producción. Mitiga: `rm -rf .next` + `NODE_OPTIONS=--max-old-space-size=4096 pnpm dev`.

### Pendiente del plan de la nota de voz

Plan original (taller, CRM vehículo-céntrico, chat+matching RV) **completado**. Próximo valor: que el equipo **etiquete el stock real** (botón "Sugerir con IA") para que el matching y el chat crucen contra inventario etiquetado.

## Estado previo (Block 10 — Staging, Calendario de Taller y Rediseño UX — DESPLEGADO A PROD ✅)

Desplegado a producción el **2026-06-18** vía **PR #31** (squash-merge a `main`, commit `43cc899`). La migración additiva se aplicó a prod **antes** del merge (orden seguro: migración → merge → deploy). Tres frentes del plan de la nota de voz del dueño (`docs`/plan aprobado):

### Entorno de STAGING (Fase 0 del plan)

- 2º proyecto Supabase **`campernova-crm-staging`** (ref `iatuhydsfwoeprpbklod`, Frankfurt) inicializado **desde el código** (no se copian datos de clientes de prod): `prisma db push` del schema completo + RLS deny-all + extensión `vector` + buckets + `pnpm seed`.
- Secretos de staging en **`.env.staging`** (gitignored). Para trabajar contra staging en local: `set -a; . ./.env.staging; set +a; pnpm dev`. **Verificar siempre** que el host es `iatuhydsfwoeprpbklod` (staging), no `bbmglaatlyilxutzomxd` (prod). `.env` (sin sufijo) apunta a **prod** y es el que usa Prisma CLI por defecto.
- Disciplina de migraciones: validar en staging → a prod solo migraciones **additivas** (nunca destructivas).
- ⚠️ **Corrección importante: Supabase de prod está en plan _Pro_ (compute _Micro_)** — verificado en el panel el 2026-06-18. **La nota previa de "plan free / se pausó por inactividad" quedó OBSOLETA.** Si el equipo nota lentitud bajo carga, la palanca no es el plan sino **subir el compute Micro → Small** en Project Settings → Compute and Disk (ojo con el spend cap). Vercel sigue en Hobby (cold starts). Local en modo dev no es representativo del rendimiento de prod.

### Módulo Taller — calendario de capacidad (#1)

- Schema **additivo**: `WorkOrder.scheduledStart`/`scheduledEnd` (nullable) + `@@index([assignedToId, scheduledStart])`. Migración `20260617000000_add_workorder_scheduling` (solo `ADD COLUMN` + `CREATE INDEX`, sin destructivos). **Aplicada a prod.**
- `lib/taller/scheduling.ts` (lógica pura, deps inyectables, 18 tests): `suggestSchedule` (modelo de cola: primer hueco libre + fecha de entrega estimada según el backlog del mecánico y horas/día), `computeHoursDeviation` (previstas vs reales), `addWorkingDays`/`workingDaysForHours`. `lib/taller/prisma-deps.ts`: `getMechanicBacklogHours`.
- Server actions (`taller/actions.ts`): `suggestScheduleForOrder`, `scheduleWorkOrder` (persiste responsable + ventana + horas; sin Activity para no chocar con el parser `CAMBIO_ESTADO` del dashboard), `createWorkOrder` ampliado con planificación.
- UI: **agenda semanal** `app/(backoffice)/taller/agenda/page.tsx` (CSS grid, filas = mecánicos, columnas = días, bloques por `scheduledStart/End`, "libre desde", nav `?week`); `ScheduleCard` en el detalle de orden (`taller/[id]/schedule-card.tsx`); botón **"Crear orden de taller"** en la ficha del vehículo (pestaña Preparación) con `?vehicleId=`; **previstas vs reales** en el tab Resumen de la orden.

### Rediseño UX de fichas (vehículo-céntrico) + navegación

- **Sistema de ficha unificado**: vendedor y comprador comparten plantilla — topbar sticky + hero centrado en el **vehículo/necesidad** + tira de métricas en tarjetas + **rail derecho persistente de 320px** (próxima acción + contacto + agente + resumen) visible en TODAS las pestañas (antes la próxima acción se perdía al cambiar de tab en vendedor).
- **`components/status-pill.tsx`** — `<StatusPill status entity="seller|vehicle|buyer" />`: **fuente única** de labels + colores de estado desde `lib/state-machine` (con variantes dark). Las fichas dejan de redefinir mapas de estado a mano (se eliminó el `VEHICLE_PHASE` inline del vendedor).
- **Ficha comprador tokenizada a la marca**: se reemplazaron TODOS los hex slate/azul hardcodeados (`#e2e8f0`, `#64748b`, `#0a0a0a`, `#294e4c`…) por tokens `--cn-*`/shadcn → vendedor y comprador ya parecen la misma app. Hero centrado en la necesidad ("Busca {tipo} · hasta {€} · {plazas}p", persona como subtítulo, avatar neutro) + **mejor-match como KPI ancla** + `InfoTooltip`.
- `LeadTabNav` **accesible**: `role=tablist/tab`, `aria-selected`, roving `tabIndex`, navegación con flechas/Home/End, foco visible. Componente compartido por ambas fichas.
- `MatchesSection` acepta `defaultOpen` → abierta por defecto en su pestaña dedicada (Compradores / Vehículos sugeridos).
- **Navegación**: `components/layout/sidebar.tsx` reagrupado — grupo **"Pipeline"** etiquetado con **Vehículos elevado** tras Dashboard; contraste del item inactivo subido (`/60`→`/75`) a nivel AA.
- En el topbar del vendedor, el avance de estado (`QuickAdvanceButton`) se degradó a `variant="outline"` (secundario) — la próxima acción real del rail es el CTA primario.

### CRM centrado en el vehículo — segmentación + cruce (#2)

- `/vendedores` (`buildViewConditions`): vistas **"Stock"** (vehículos en `TASADO`/`PUBLICADO`/`RESERVADO` = inventario real, `STOCK_STATUSES`) y **"Leads web"** (canal `PRO` sin cualificar = formulario público a triar) con contador en vivo.
- Cruce **vehículo↔comprador**: tarjeta "Comprador" en el rail de la ficha del vendedor cuando hay **match cerrado** (`closedMatch`) con enlace a la ficha del comprador; y enlace "Ver ficha del vehículo / vendedor" en la tarjeta de operación del comprador (se añadió `sellerLead` al select de `deliveries.vehicle`).

### Pendiente del plan (#3)

- **Chat + matching con taxonomía RV** (distribución capuchina/perfilada/integral/camper, tipos de cama, plazas homologadas, etc.) — **NO empezado, bloqueado** a la espera de que el dueño dé la **taxonomía exacta** y qué criterios son **excluyentes vs preferencia**.

> Tests: **354 verdes** (incluye 18 de `lib/taller/scheduling`). Verificado typecheck + lint + suite + CI `quality` en verde antes del deploy.

## Estado previo (Block 9 — Calidad, Flujo y Entornos profesionales — 6/8 COMPLETADO ✅)

### Block 9 — Calidad, Flujo y Entornos profesionales

Endurecimiento del proyecto a estándar senior. Documentación de entrada (`README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `docs/adr/`) que complementa este log. Flujo de release profesional. Ejecutado vía PRs con CI (#2–#6).

- ✅ **Higiene**: `.gitignore` cubre `.codex/` (tokens MCP), `.claude/worktrees/`, docs legales y artefactos e2e. Eliminado `seller-leads-table.tsx` (huérfano) y el gitlink erróneo del worktree. `AGENTS.md` commiteado.
- ✅ **Flujo Git trunk-based**: ramas cortas → PR → squash-merge a `main`. **`main` protegida** (branch protection): exige el check de CI `quality` + PR (approvals=0). Conventional Commits enforced (commitlint + hook `commit-msg`). Hook `pre-push` (typecheck + test). `CONTRIBUTING.md` + plantilla de PR.
- ✅ **CI/CD** (GitHub Actions): `ci.yml` → job `quality` (typecheck + lint + test) en push a main y PRs. `e2e.yml` → e2e autenticado contra staging (manual/nightly, no bloqueante; requiere secrets). **Sin staging configurado el E2E NO falla**: un paso guarda comprueba `E2E_BASE_URL` y, si está vacío, salta el resto y deja el run en verde (evita emails de fallo nocturnos hasta montar staging). `package.json` con `packageManager` pin (pnpm@10.33.2) + `engines node>=20`.
- ✅ **Documentación**: `README.md`, `ARCHITECTURE.md`, `CHANGELOG.md` (Keep a Changelog) y 5 ADRs en `docs/adr/`.
- ✅ **Cobertura de tests**: +41 tests de server actions (compradores, entregas, postventa, matches), **+27 del chat API** (handlers start/message/status/complete + tool-use + system prompt, mock de `ai`/`@ai-sdk/anthropic`) y +3 del catálogo → **336 verdes**. Patrón `vi.hoisted` mockDb. (Cierra el P1 #9; el chat ya no es el único módulo crítico sin tests.)
- ✅ **SEO sitio público**: metadata raíz orientada a cliente (`lib/seo.ts`), `app/robots.ts`, `app/sitemap.ts`, `app/manifest.ts`, `app/opengraph-image.tsx` (edge), JSON-LD AutoDealer (landing+contacto, corrige teléfono obsoleto) + Vehicle (`/comprar/[id]`), canonicals. Rutas SEO añadidas a `PUBLIC_PATHS` del middleware. Verificado en prod (`/robots.txt`, `/sitemap.xml` con 15 URLs).
- ✅ **Fix middleware cold-start**: las rutas públicas ya no llaman a Supabase Auth (evita `504 MIDDLEWARE_INVOCATION_TIMEOUT` en la web pública). Solo backoffice y `/login` comprueban sesión.
- ✅ **Migración SEO 301 (WordPress → web nueva)**: sitemap del WP antiguo descargado (183 URLs en `docs/migration/`). Redirecciones 308 en `lib/legacy-redirects.ts` (resueltas en el middleware, antes del guard de auth). Solo se redirige lo que tiene **valor SEO** (~6 reglas: páginas con slug cambiado + `/listings/*`→`/comprar`); taxonomías/productos demo/carrito se dejan en 404 a propósito. Se activan al hacer cutover del dominio. Ver `docs/migration/README.md`.
- 📌 **Cuentas e identidades**: el dueño tiene varios proyectos con cuentas distintas (Campernova=`growthaiconsultant` vs TuteBot=`joeylito`). Ver **`docs/ACCOUNTS.md`** — evita fallos de push, MCP en cuenta equivocada, etc.
- ✅ **SEO web pública — Fase A (fixes técnicos)**: helper `pageMetadata()` (`lib/seo.ts`) → canonical + Open Graph por página en todas las públicas. `/comprar` recibe meta vía `app/comprar/layout.tsx` (era client component sin meta). H1 en `/sobre`. JSON-LD AutoDealer en `/vender` y `/sobre`. Marca duplicada en títulos corregida (la plantilla `%s · CampersNova` ya añade la marca). PRs #14, #15.
- ✅ **SEO web pública — Fase B núcleo (inventario real)**: `lib/public-catalog.ts` lee los vehículos **PUBLICADO** del CRM y los expone con forma SEGURA. **Precio público = SOLO `salePrice`** (nunca `purchasePrice`/`margin`/valoraciones — 8 tests lo garantizan). Slug SEO `marca-modelo-año-id`. `/comprar/[id]` reescrita a datos reales (ISR on-demand, sin DB en build), fotos reales con alt, Vehicle JSON-LD. Sitemap dinámico resiliente. Eliminados los 7 vehículos demo (`lib/dummy/`) + `vcard.tsx` huérfano. **Validado en vivo** publicando temporalmente un coche real. PRs #16, #17.
  - **Operativa para el equipo**: para que un coche aparezca en la web pública, ponerlo en estado **PUBLICADO** en el CRM con `salePrice`, fotos y `publicNotes` (descripción). Aparece solo (ISR ~10 min).
  - Diagnóstico SEO completo y roadmap: ver el plan aprobado de esta sesión.
- ✅ **SEO web pública — Fase C (catálogo navegable)**: catálogo indexable que faltaba para no perder el SEO de producto en el cutover. Rutas: `/comprar/vehiculos` (hub), `/comprar/autocaravanas`, `/comprar/campers` (categorías con copy SEO), `/comprar/marcas` + `/comprar/marcas/[marca]`. Lee el inventario real (`PUBLICADO`) vía `lib/public-catalog` (helpers `getPublishedVehiclesSafe`, `getCatalogBrands`, `getPublishedVehiclesByBrandSlug`, `categoryForType`, `brandSlug`). **Navegación por enlaces/facetas, no filtros JS** (mejor indexación). Componentes `components/catalog/` (`CatalogView` + `VehicleCatalogCard`). Breadcrumbs + JSON-LD `BreadcrumbList`/`ItemList`; la ficha enlaza a su categoría. **Sitemap dinámico** que solo incluye listados con contenido; **`noindex`** automático en listados vacíos (`pageMetadata({ noindex })`). Interlinking desde el footer. Resiliente (DB caída/sin stock → estado vacío, no 500). Decisión: chat en `/comprar` se mantiene; el catálogo vive en `/comprar/vehiculos` y se enlaza desde el footer (promover a la nav cuando haya stock). PR #22. **Verificado en prod (200).**
- ✅ **Seguridad — RLS deny-all (2026-06-03)**: activado Row Level Security en **todas** las tablas de `public` (migración `20260603000000_enable_rls_deny_all_public`). Antes, la API REST de Supabase exponía todo el CRM (PII, márgenes, `session_token`) a quien tuviera la clave anónima (pública). La app accede vía Prisma (rol `postgres`, BYPASSRLS) → no afectada. Linter de Supabase: **0 errores de seguridad**. PR #21. Pendientes menores (WARN, no bloqueantes): extensión `vector` en `public`, listado del bucket `vehicle-photos`, "leaked password protection" (N/A: auth por enlace mágico).
- 🚀 **LANZAMIENTO a producción (2026-06-03)** — ver **`docs/LAUNCH.md`** (fuente de verdad del go-live + lo pendiente + rollback):
  - ✅ **Cutover DNS hecho**: `campersnova.com` ya sirve la web nueva (Next.js en Vercel), SSL emitido, rutas 200. En dinahosting se cambió el `A @` de `82.98.132.86` (WordPress) → `216.198.79.1` (Vercel). El dominio estaba enlazado a otra cuenta de Vercel → se verificó con `TXT _vercel`. Apex sin `www` como canónico (coincide con `SITE_URL`). WordPress se mantiene vivo como respaldo; **rollback** = volver el `A @` a `82.98.132.86` (propaga en minutos, TTL bajo). El **correo no se ve afectado** (MX raíz intacto).
  - ✅ **Emails reales**: dominio verificado en Resend (DKIM/SPF/MX en subdominio `send`) + `EMAIL_FROM = CampersNova <info@campersnova.com>` + redeploy.
  - ✅ **Secretos en Vercel**: `CRON_SECRET` y `SENTRY_AUTH_TOKEN` (Production) + redeploy.
  - 🔴 **Pendiente inmediato tras cutover** (no bloquea, web funciona): **`NEXT_PUBLIC_APP_URL` → `https://campersnova.com` + redeploy** (el sitemap aún lista URLs de `vercel.app`; los canonicals ya usan el dominio real); **Supabase Auth** (Site URL + `campersnova.com/auth/callback` para el login del equipo en el dominio); ~~**`www.campersnova.com`**~~ ✅ **hecho** — redirige 301 al apex vía la redirección de dominio de dinahosting (independiente del WordPress; verificado 2026-06-19). Pasos exactos en `docs/LAUNCH.md` (incl. cómo jubilar el WordPress).
  - 🟠 **Pendiente medio plazo**: publicar **stock real** (comerciales, ~2 semanas → catálogo y sitemap se llenan solos); decidir **Supabase Pro** (free se pausa por inactividad; menor riesgo con tráfico en vivo); rotar tokens `.codex`; staging (Fase 4) + E2E autenticado (Fase 7).
- ⚠️ **Riesgo operativo confirmado**: el Supabase de prod (plan free) se **pausó por inactividad** durante la sesión (CRM caído hasta reactivarlo a mano en el dashboard). Refuerza la necesidad de staging/upgrade (Fase 4 + checklist de production-readiness).
- ⬜ **Entornos dev/staging/prod** (PENDIENTE — requiere acciones del dueño): 2º proyecto Supabase gratuito como staging; Vercel Preview → staging, Production → prod.
- ⬜ **E2E autenticado** (PENDIENTE — depende de staging): bypass de auth vía `storageState` (admin API Supabase) contra staging — cierra CAM-42.

> **Handoff Fases 4+7** (retomar cuando se quiera montar staging):
>
> 1. Crear 2º proyecto Supabase "campersnova-crm-staging" (free, Frankfurt) — elegir organización.
> 2. Aplicar las 10 migraciones + `pnpm seed` contra staging; activar extensión `vector` + buckets `vehicle-photos`/`vehicle-documents`.
> 3. Vercel → env vars con scope: Production→Supabase prod, Preview→Supabase staging. Añadir redirect URLs de preview/staging en Supabase Auth.
> 4. GitHub secrets para `e2e.yml`: `E2E_BASE_URL`, `STAGING_NEXT_PUBLIC_SUPABASE_URL`, `STAGING_SUPABASE_SERVICE_ROLE_KEY`, `E2E_USER_EMAIL`.
> 5. Escribir `e2e/global-setup.ts` (generateLink→verifyOtp→storageState) + `e2e/backoffice/*.spec.ts` (incl. pestaña Conversación CAM-55) + usuario e2e en `prisma/seed.ts`.
>    Plan detallado: ver el plan aprobado de esta sesión.

> Decisiones estructurales en `docs/adr/`. Flujo de trabajo y comandos en `CONTRIBUTING.md`. Diseño del sistema en `ARCHITECTURE.md`.

### Estado previo (Block 8 v2 — Listado Vendedores Visual System Unificado COMPLETADO ✅)

### Sprint 1 — COMPLETADO ✅

- ✅ **CAM-6** — Repo, scaffold Next.js 14, Vercel, pre-commit hooks
- ✅ **CAM-7** — Supabase configurado: pgvector activo, buckets `vehicle-photos` y `lead-documents` con RLS, clientes Next.js en `lib/supabase/`
- ✅ **CAM-8** — Schema Prisma completo, migración aplicada en Supabase, `lib/db.ts`
- ✅ **CAM-9** — Auth magic link + middleware de protección de rutas
- ✅ **CAM-10** — Layout backoffice + theme Campernova (sidebar teal + topbar con usuario/logout)
- ✅ **CAM-11** — Seed: Joel (ADMIN) + Esteban (AGENTE) + Joui (AGENTE). Ejecutar con `pnpm seed`

### Sprint 2 — COMPLETADO ✅

- ✅ **CAM-12** — Form SellerLead + Vehicle en backoffice (canal CN)
- ✅ **CAM-13** — Subida de fotos con drag&drop (pendiente validación manual por el usuario)
- ✅ **CAM-14** — Listado de SellerLeads con filtros, búsqueda y paginación
- ✅ **CAM-15** — Ficha SellerLead editable (datos vendedor + vehículo + fotos)
- ✅ **CAM-16** — Form público `/vender` (canal Pro) — wizard 3 pasos, mobile-first
- ✅ **CAM-17** — Captcha hCaptcha en form público — validación server-side
- ✅ **CAM-18** — Email confirmación al vendedor (Resend) — funcional con sandbox; swap `EMAIL_FROM` al verificar dominio
- ✅ **CAM-19** — Notificación a todos los agentes activos cuando entra lead — funcional con sandbox
- ✅ **CAM-20** — Asignación/reasignación manual de agente: solo ADMIN puede cambiar `agentId`; cada cambio crea `Activity` (tipo `LEAD_ASIGNADO`)

### Sprint 3 — COMPLETADO ✅

- ✅ **CAM-21** — Tabla de referencia poblada: 80 entradas (30 CAMPER + 50 AUTOCARAVANA). Seed idempotente en `prisma/seeds/reference-prices.ts`. CSV en `prisma/data/reference-prices.csv`.
- ✅ **CAM-22** — Algoritmo de tasación `calculateValuation` en `lib/valuation/`. Vitest instalado, 25 tests verdes.
- ✅ **CAM-23** — Histórico de tasaciones: `persistValuation` + `runAndSaveAutoValuation`. Auto al crear/actualizar vehículo. Override MANUAL desde ficha. Timeline en la ficha del lead.
- ✅ **CAM-24** — Rango en página de éxito `/vender/success` y email al vendedor. Fallback "En revisión" si no hay datos.

### Sprint 4 — COMPLETADO ✅

- ✅ **CAM-25** — Form BuyerLead en backoffice (canal CN)
- ✅ **CAM-26** — Listado y ficha BuyerLead (filtros + ficha editable)
- ✅ **CAM-27** — Algoritmo matching v1 (`lib/matching/`, 39 tests verdes)
- ✅ **CAM-28** — Job recalcular matches (idempotente, in-process desde Server Actions)
- ✅ **CAM-29** — UI "Ver matches" en fichas (sección colapsable en ficha vendedor + comprador)

### Sprint 5 — COMPLETADO ✅

- ✅ **CAM-30** — Estados y transiciones: guards en server actions (SellerLead, Vehicle, BuyerLead), `CAMBIO_ESTADO` en activity log, selectores de estado filtrados por transiciones válidas + deshabilitados en estados terminales
- ✅ **CAM-31** — Activity log timeline: `ActivityTimeline` en fichas vendedor y comprador (icono por tipo, autor, timestamp)
- ✅ **CAM-32** — Notas libres: `NoteForm` + `deleteNote` con guard de autoría, integradas en fichas
- ✅ **CAM-33** — Click-to-WhatsApp: botón en headers de fichas, plantillas por tipo de lead, activity `WHATSAPP_INICIADO`
- ✅ **CAM-34** — Notificación email a agentes cuando match score ≥ 70, con throttle persistente de 30 min por agente (`User.lastMatchEmailAt`)
- ✅ **CAM-37** — Dashboard KPIs: 4 KPIs, distribución por estado, funnel Pro, tiempo medio por estado, filtro de agente con control de permisos
- ✅ **CAM-38** — Landing comercial `/`: hero, 3 ventajas, cómo funciona, mini-FAQ, CTA final, footer
- ✅ **CAM-39** — Página `/contacto`: info real (tel 645 63 91 85, WhatsApp wa.me/34645639185, email, instalaciones) + CTA a `/vender`
- ✅ **CAM-40** — Aviso legal, privacidad, cookies + banner de consentimiento de cookies
- ✅ **CAM-41** — Consentimientos en formularios: checkbox RGPD en `/vender` step 3, validación Zod + guard server-side, `gdprConsentAt` + `gdprConsentIp` guardados en `seller_leads`
- ✅ **CAM-43** — Sentry instalado: `@sentry/nextjs`, configs client/server/edge, `instrumentation.ts`, `global-error.tsx`, `withSentryConfig` con source maps
- ✅ **CAM-44** — Analytics PostHog: `PostHogProvider`, consentimiento conectado al banner, eventos `form_view`/`form_step_completed`/`form_submitted` en `/vender`
- ✅ **CAM-46** — Deploy Vercel completado (`campernova-crm.vercel.app`); env vars subidas; Supabase Auth URLs configuradas. Pendiente: conectar dominio real `campersnova.com`, verificar dominio en Resend, añadir `SENTRY_AUTH_TOKEN`

### Generación de anuncios — COMPLETADO ✅

Feature P0-E: generación de anuncios Wallapop / Coches.net desde la ficha del vendedor.

- ✅ **Schema** — `Vehicle.publicNotes`, modelo `VehicleAd`, enum `AdChannel`, `ActivityType` ampliado con `ANUNCIO_GENERADO` y `FOTOS_DESCARGADAS`. Migración `20260504000000_add_vehicle_ads` aplicada.
- ✅ **`lib/ads/`** — knowledge base portado del GPT de Joel; prompts, context builder, generador Anthropic con visión multimodal, descarga ZIP.
- ✅ **Server Actions** — `generateVehicleAd`, `updateVehicleAdContent`, `updateVehiclePublicNotes` en `ads-actions.ts`.
- ✅ **Route Handler** — `GET /api/vendedores/[id]/photos.zip` con auth y activity log.
- ✅ **UI** — sección "Anuncios y publicación" al final de la ficha: `PublicNotesEditor` (autosave 1 s), `GenerateAdButton` (Dialog con spinner + contador + copiar + regenerar), `DownloadPhotosButton`.
- ✅ **Tests** — 8 tests `build-context.test.ts` + 5 tests `download-photos.test.ts`. Total suite: 113 tests verdes.

### Portal comprador — EN CURSO 🔄

Tickets según `docs/PRD-Chat-Buyer-v1.md`:

- ✅ **CAM-50** — Schema Prisma: `BuyerChatSession` + enums + migración + `BuyerLead.source` enum
- ✅ **CAM-51** — `POST /api/chat/buyer/start`: captcha hCaptcha + rate limit 50 sesiones/IP/día + greeting inicial
- ✅ **CAM-52** — `POST /api/chat/buyer/message`: streaming Claude (Vercel AI SDK) + persistencia de mensajes
- ✅ **CAM-53** — Creación BuyerLead via Anthropic tool use en `message/route.ts`; `/complete` deprecado (410)
- ✅ **CAM-54** — Página `/comprar` con UI de chat streaming, mobile-first, hCaptcha invisible (nota: ruta es `/comprar`, no `/buscar` del PRD)
- ✅ **Páginas de apoyo**: `/comprar/[id]` ficha de vehículo, `/como-funciona`, `/sobre`, `VCard` + `lib/dummy/vehicles.ts`
- ✅ **E2E tests**: Playwright 22 tests para todas las páginas públicas, 22 passing
- ⬜ **CAM-55** — Vista en CRM: pestaña "Conversación" en ficha BuyerLead chat + filtro origen

### Block 2 — Entregas y Postventa — COMPLETADO ✅

Implementación completa del ciclo post-venta: gestión de entregas físicas y garantías/postventa.

- ✅ **Módulo Entregas** — UI completa: listado + `/nueva` + `/[id]` con 4 tabs (Resumen / Checklist / Documentos / Firma). Máquina de estados `PROGRAMADA → EN_CURSO → COMPLETADA / CANCELADA`. Checklist de 10 ítems pre-configurados por categoría. Firma simplificada (nombre + DNI) como requisito previo a completar.
- ✅ **Módulo Postventa** — Garantías vinculadas automáticamente a entregas completadas (12 meses, ampliables). Tickets de incidencia con prioridades (BAJA / MEDIA / ALTA / CRITICA). Follow-ups automáticos en días 7 y 30 post-entrega.
- ✅ **`lib/postventa/`** — Módulo de negocio puro: `createWarrantyForDelivery`, `imputeTicketCostToVehicle`, `extendWarranty`. 12 tests unitarios.
- ✅ **Cron job** — `vercel.json` + `GET /api/cron/postventa-followups` (09:00 UTC diario). Procesa follow-ups pendientes, actualiza estado `ENVIADO` / `FALLIDO`.
- ✅ **Email templates** — `delivery-confirmation.ts` + `ticket-opened.ts`. Funciones `sendDeliveryConfirmation` + `sendTicketOpenedNotification` en `lib/email/send.ts`.
- ✅ **Dashboard** — 3 nuevos KPIs postventa: garantías activas, tickets abiertos, follow-ups pendientes.
- ✅ **Sidebar** — Navegación Entregas (CalendarCheck) + Postventa (ShieldCheck).
- ✅ **ActivityTimeline** — 10 nuevos tipos de actividad cubiertos: `ENTREGA_*`, `GARANTIA_*`, `TICKET_POSTVENTA_*`, `FOLLOWUP_*`.

### Block 3 — Roles y Permisos — COMPLETADO ✅

Sistema RBAC completo con 5 roles diferenciados y guards en todos los niveles (schema, server actions, páginas, UI).

- ✅ **Schema** — `UserRole` ampliado a 5 valores: `ADMIN`, `AGENTE`, `TALLER`, `ENTREGAS`, `MARKETING`. Migración `20260511000000_add_roles_taller_entregas_marketing` aplicada en Supabase.
- ✅ **`lib/auth.ts`** — `requireRole(roles[])` genérico + 9 helpers semánticos + `userHasRole()` booleano para UI condicional. Ver tabla de permisos en la sección técnica.
- ✅ **Sidebar dinámico** — `components/layout/sidebar.tsx` recibe `userRole` y filtra los items de navegación según los roles permitidos por cada módulo.
- ✅ **Topbar** — Muestra el rol con label legible (Taller, Entregas, Marketing…) en lugar de solo Administrador/Agente.
- ✅ **Usuarios UI** — Select de 5 roles con descripciones, `RoleBadge` 5 colores (azul/teal/amber/índigo/rosa).
- ✅ **Server action guards** — Todos los módulos protegidos: taller (`requireCanViewTaller`/`requireCanEditTaller`), entregas (`requireCanViewEntregas`/`requireCanEditEntregas`), postventa (`requireCanViewPostventa`/`requireCanEditPostventa`), anuncios (`requireCanGenerateAds`), costes/economía (`requireAdmin`), comercial (`requireAgente`).
- ✅ **Forbidden toast** — `components/forbidden-toast.tsx` muestra "No tienes permiso" en el Dashboard cuando el redirect llega con `?error=forbidden`.
- ✅ **Notificaciones por rol** — Leads nuevos (PRO + chat) → solo ADMIN + AGENTE. Tickets ALTA/CRITICA → ADMIN + ENTREGAS. Matches ≥70 → solo agentes ADMIN + AGENTE asignados.
- ✅ **Tests** — `lib/auth.test.ts` (7 tests), suite completa actualizada: 183 tests verdes.

### Block 4 — Expediente Legal del Vehículo — COMPLETADO ✅

Gestión documental completa del vehículo: campos legales en Vehicle, subida de documentos por categoría, reglas de bloqueo inteligentes que impiden publicar sin expediente completo.

- ✅ **Schema** — Campos en `Vehicle`: `plate`, `vin`, `itvValidUntil`, `titleTransferredAt`, `chargeCheckedAt`/`chargeCheckedById`. Nuevo modelo `VehicleDocument` con enum `VehicleDocumentCategory` (11 categorías). 7 nuevos `ActivityType`: `DOCUMENTO_SUBIDO`, `DOCUMENTO_ELIMINADO`, `MATRICULA_AÑADIDA`, `ITV_ACTUALIZADA`, `CARGAS_VERIFICADAS`, `TITULARIDAD_TRANSFERIDA`, `PUBLICACION_BLOQUEADA`. Migración `20260511100000_add_vehicle_legal_docs` aplicada.
- ✅ **`lib/vehicle-legal/`** — Módulo puro: `listMissingRequirements`, `isReadyForStatus`, `calculateCompletionPercent`. Requisitos por estado: TASADO exige matrícula + precio deseado + 1 foto; PUBLICADO además exige 7 documentos obligatorios, VIN, ITV vigente, cargas verificadas, precio compra/venta, 5 fotos, sin órdenes taller activas. ITV < 60 días = `warning` (no bloquea). 17 tests verdes.
- ✅ **Guards en `updateVehicle`** — Antes de transicionar a TASADO o PUBLICADO, verifica `isReadyForStatus`. Si falla: loguea `PUBLICACION_BLOQUEADA` + devuelve error con lista de requisitos pendientes.
- ✅ **`legal-actions.ts`** — Server actions: `uploadVehicleDocument` (AGENTE), `deleteVehicleDocument` (ADMIN), `updateVehicleLegalFields` (ADMIN), `markChargesChecked` (ADMIN), `getVehicleDocumentSignedUrl` (AGENTE).
- ✅ **UI** — `VehicleLegalFieldsForm` (campos legales editables/solo lectura según rol), `VehicleDocumentsList` (11 categorías, upload inline, signed URL), `MissingForPublishCard` (alerta verde/amber con lista de pendientes), `CompletionBadge` (semáforo %).
- ✅ **Ficha vendedor** — Nueva sección "Expediente legal" tras las fotos: campos + documentos + badge de progreso.
- ✅ **Dashboard** — 3 alertas nuevas: expedientes incompletos (TASADO/PUBLICADO < 100%), ITV próxima a vencer (≤ 60 días), cargas DGT sin verificar.
- ✅ **Form `/vender`** — Campo matrícula opcional en step 1 (se guarda en `Vehicle.plate`).
- ✅ **Tests** — `validate.test.ts` (17), `legal-actions.test.ts` (13), `actions.test.ts` guards (7). Suite total: 225 tests verdes.

### Block 6 — Rediseño Ficha Vendedor — COMPLETADO ✅

Rediseño completo de `app/(backoffice)/vendedores/[id]/page.tsx` siguiendo el spec `CRM Vendedor Detalle.html`. Además, corrección de varios bugs menores detectados durante la auditoría.

**Bugs corregidos:**

- ✅ **`quick-advance-actions.ts`** — `advanceLeadStatus` solo invalidaba la ficha (`/vendedores/${id}`), no el listado. Añadido `revalidatePath('/vendedores')` para que el estado se refleje inmediatamente en la lista.
- ✅ **`quick-advance-button.tsx`** — Eliminada la prop `currentStatus` declarada en el tipo pero no usada en ningún sitio.
- ✅ **`actions.ts` → `overrideValuation`** — La transición NUEVO→TASADO se hacía con un `updateMany` suelto fuera de la transacción y sin crear Activity. Consolidado en el `$transaction` existente: `db.vehicle.update` con `...(wasNuevo ? { status: 'TASADO' } : {})` + `db.activity.create` con el mensaje correspondiente.
- ✅ **`vehicle-costs-table.tsx`** — El botón de borrar nunca aparecía para no-admins porque comparaba `cost.createdBy?.name === currentUserId` (string nombre ≠ cuid). Añadido `id` al select de Prisma y corregida la comparación a `cost.createdBy?.id === currentUserId`.

**Nuevo diseño (`page.tsx`):**

- ✅ **Topbar sticky 73px** — `header` con `sticky top-0 z-20 h-[73px]`. Breadcrumb font-mono uppercase con `ChevronLeft` + link "Vendedores". Derecha: botones icono Archive + MoreHorizontal + WhatsApp + QuickAdvance CTA.
- ✅ **Hero section** — Avatar 84px con status-ring coloreado según estado del lead (teal/verde/rojo/amber). Nombre `text-[28px]` + pill de estado inline. Sub-info: email/phone como links clickables. Botones circulares call/email con hover de color. Hero no sticky — se desplaza al hacer scroll.
- ✅ **KPI bar** — `grid-cols-[repeat(5,1fr)_auto]` (antes flex). Valores `text-[22px]`, labels `font-mono text-[10px] uppercase tracking-[0.12em]`. Columnas: Vehículo, Precio salida, Margen (admin/placeholder), Días pipeline, Lead score, + link Estado.
- ✅ **Body layout** — `grid grid-cols-[1fr_360px]` (antes `flex gap-0`). Main `p-8 pb-16`, sidebar siempre visible a 360px.
- ✅ **Sidebar 360px sticky** — `sticky top-[130px]` (73px topbar + ~57px tabs). Secciones:
  - **Próxima acción**: card con `linear-gradient(135deg, #0a0a0a 0%, #2a221c 100%)`, blob de luz teal con `filter: blur(40px)`, eyebrow tan `#b59e7d`, texto blanco, botones Llamar (tan filled) + WhatsApp (glass `rgba(255,255,255,0.08)`).
  - **Asignación**: avatar teal o placeholder dashed "+" si sin agente. Botones Reasignar + Asignar a otro (admin).
  - **Tasación**: `grid-cols-[1fr_auto_1fr]` (Cliente pide → Nuestra tasación) + footer 3-col (Mediana / Tasaciones / Confianza).
  - **Costes y margen** (admin): línea compra + gastos + total + badge neto verde/rojo.
  - **Resumen**: métricas de origen, días, etapa, actividad, probabilidad cierre.

### Block 8 — Listado Vendedores Visual System Unificado — COMPLETADO ✅

Dos iteraciones de rediseño de `/vendedores`. La v2 final unifica el visual system con `/compradores` (fondo blanco, bordes `#e2e8f0`, tipografía `#0a0a0a`/`#64748b`), añade columna TASACIÓN, badges de vehículo por tipo, vista "Sin tasar" y filtros chip via `<label>`+`<select>`.

**Archivos modificados (v2 final):**

- ✅ **`app/(backoffice)/vendedores/page.tsx`** — RSC con tabla inline (sin `seller-leads-table.tsx`). Visual system compradores (blanco, `#e2e8f0`). Pipeline strip con `CUALIFICADO` relabelado "Tasado". 11 queries paralelas incluida `sinTasarCount`. TASACIÓN col con rango verde / "Sin tasar" / aviso sobreprecio. Badges vehículo por tipo (CAMPER azul / AUTOCARAVANA morado). Canal: CN → "BACKOFFICE" slate, PRO → "FORMULARIO WEB" amber. `getAvatarGradient` por initial. Row flags `#dc2626`/>7d y `#d97706`/>2d.
- ✅ **`app/(backoffice)/vendedores/leads-filters.tsx`** — Reescrito con `<label>`+`<select className="absolute inset-0 opacity-0">` overlay (no DropdownMenu). Chips: Buscar (form submit), Estado (con dot coloreado), Marca (10 marcas), Precio máx., Agente, Limpiar, Ordenar. `chipBase`/`chipActive` idénticos a `compradores/buyer-list-filters.tsx`.

**Funcionalidades clave v2:**

- ✅ **Visual system unificado** — Fondo `#fff`, header `h-[73px] sticky`, bordes `border-[#e2e8f0]`, textos `#0a0a0a`/`#64748b`, tabla inline en RSC. Mismo look que compradores.
- ✅ **TASACIÓN column** — Verde: `valuationMin`–`valuationMax` range. Amber: si `desiredPrice > valuationMax × 1.15` + badge "⚠ sobreprecio". Dashed: "— Sin tasar" si `valuationRecommended === null`.
- ✅ **Vista "Sin tasar"** — Prisma: `{ OR: [{ vehicle: null }, { vehicle: { valuationRecommended: null } }] }`. Tab en área de vistas guardadas.
- ✅ **CUALIFICADO → "Tasado"** — Solo en display. DB status `CUALIFICADO` sin cambios. `PIPELINE_STAGES` tiene `{ key: 'CUALIFICADO', label: 'Tasado', color: '#0891b2' }`.
- ✅ **Vehicle type badges** — CAMPER: `bg #eff6ff`/`text #2563eb`. AUTOCARAVANA: `bg #f5f3ff`/`text #7c3aed`. Otro: slate.
- ✅ **Pipeline strip clicable** — Toggle: clic en etapa activa la quita, clic en inactiva filtra. `stageUrl()` preserva view y otros filtros.
- ✅ **Row flags** — Borde izquierdo 3px: `#dc2626` si >7d, `#d97706` si >2d sin actividad. Terminales excluidos. `relativeDays()` helper.
- ✅ **"Necesitan acción"** — Prisma `activities: { none: { createdAt: { gte: twoDaysAgo } } }`.
- ✅ **Tabla inline en RSC** — No usa `seller-leads-table.tsx` (sigue existiendo pero no se importa). WhatsApp/call como `<a href>` directos — sin server actions en el listado.

### Block 7 — Fichas CRM Completamente Funcionales — COMPLETADO ✅

Rediseño completo de la ficha de comprador + todos los botones e interacciones de ambas fichas (vendedor y comprador) completamente funcionales. Ningún elemento interactivo queda decorativo.

**Ficha Comprador rediseñada (`compradores/[id]/page.tsx`):**

- ✅ **Topbar sticky 73px** — Misma estructura que vendedor: breadcrumb font-mono + `ChevronLeft` + link "Compradores". Derecha: `BuyerTopbarActions` (Archive + MoreHorizontal). Hero section con avatar, nombre, pill de estado, email/phone como links, botones circulares call/email.
- ✅ **KPI strip** — 4 columnas: Canal, Presupuesto, Días pipeline, Vehículos sugeridos (conteo de matches).
- ✅ **5 tabs navegables** — `LeadTabNav` con `defaultTab="ficha"`: Ficha / Actividad / Vehículos sugeridos / Postventa / Documentos. URL-driven con `searchParams.tab`.
- ✅ **Grid 2 columnas** — `grid-cols-[1fr_360px]`. Sidebar 360px siempre visible independientemente del tab activo.
- ✅ **Sidebar comprador** — `ProximaAccionCard` (dark gradient con WhatsApp + Llamar), card de asignación, card de preferencias (tipo/plazas/presupuesto/zona/timeline), card de resumen (canal, días, actividad).
- ✅ **Tab Actividad** — NoteForm + ActivityTimeline + empty state si sin actividad.
- ✅ **Tab Vehículos sugeridos** — MatchesSection o empty state con icono Search.
- ✅ **Tab Postventa** — Si hay garantía: grid 4-col (estado/vigencia/meses restantes/cobertura) + progress bar + tabla de tickets abiertos + link a `/postventa/${warrantyId}`. Si no hay garantía: empty state con escudo.
- ✅ **Tab Documentos** — Empty state "Próximamente".

**Botones funcionales — ambas fichas:**

- ✅ **Archive (vendedor)** — `SellerTopbarActions`: Dialog de confirmación + `archiveSellerLead()` → DESCARTADO. Deshabilitado si ya es terminal (`!nextLeadStatuses.length`).
- ✅ **Archive (comprador)** — `BuyerTopbarActions`: Dialog de confirmación + `archiveBuyerLead()` → PERDIDO. Deshabilitado si ya es terminal (`!BUYER_LEAD_TRANSITIONS[status]`).
- ✅ **MoreHorizontal (ambas fichas)** — `DropdownMenu` shadcn con: "Copiar enlace" (clipboard API), "Abrir en nueva pestaña" (`window.open`), y opcionalmente "Marcar como perdido/Descartar" si no es terminal.
- ✅ **WhatsApp botón sidebar dark card (ambas fichas)** — `ProximaAccionCard` (client component). Antes era `<a href>` sin tracking. Ahora llama `logWhatsApp()` antes de abrir wa.me → genera activity `WHATSAPP_INICIADO`.
- ✅ **Tabs (compradores)** — Antes eran `<button>` con CSS hardcodeado sin ninguna acción. Ahora usan `LeadTabNav` con URL `?tab=xxx` y el RSC renderiza el contenido correcto.
- ✅ **`archiveSellerLead` server action** — añadido en `vendedores/[id]/actions.ts` con `$transaction` (update status + `CAMBIO_ESTADO` activity) y `revalidatePath` de ficha + listado.
- ✅ **`archiveBuyerLead` server action** — añadido en `compradores/[id]/actions.ts`, mismo patrón.

### Block 5 — Dashboard Financiero — COMPLETADO ✅

Visibilidad financiera real del negocio: capital en nave, márgenes, rotación, funnels y vehículos estancados.

- ✅ **`lib/dashboard/metrics.ts`** — 12 funciones de métricas financieras: `getStockValue` (valor/capital/margen potencial), `getAverageDaysInStock` (días medios + over-90), `getStagnantVehicles` (>90d en estado actual), `getMonthlyNetMargin` (margen neto + ticket medio mes), `getPublishedToSoldRate` (tasa pub→vendido), `getLeadAcceptanceRate` / `getFunnelComparison` (Pro vs CN), `getAveragePostventaCostPerVehicle`, `getVehiclesPerCommercial`, `getAverageWorkshopHoursPerVehicle`, `getStockHistorySnapshot` (cacheable con `unstable_cache`, raw SQL, 12 meses), `getAverageTicket`.
- ✅ **`components/dashboard/`** — 5 nuevos componentes: `KpiCard` (genérico con trend), `StockEvolutionChart` (recharts ComposedChart dual-axis: barras valor € + línea conteo), `FunnelComparison` (Pro teal / CN amber, div-based), `StagnantVehiclesTable` (tabla con badge rojo >180d), `VehiclesPerCommercial` (recharts BarChart por comercial).
- ✅ **`app/(backoffice)/dashboard/page.tsx`** — Reestructurado en 6 secciones role-based: Resumen operativo (todos), Resumen financiero (ADMIN+MARKETING), Stock y rotación (ADMIN+AGENTE+MARKETING+ENTREGAS), Operativas con alertas+distribución+funnel (todos), Análisis avanzado con gráficos (ADMIN), Vehículos estancados (condicional).
- ✅ **recharts** — `pnpm add recharts` (v3.8.1). `StockEvolutionChart` y `VehiclesPerCommercial` son `'use client'`.
- ✅ **Tooltips informativos** — `components/info-tooltip.tsx` + `components/ui/tooltip.tsx` (shadcn). Icono `(i)` en todos los KPIs y métricas del dashboard con texto explicativo en español. Ver sección técnica más abajo.
- ✅ **Tests** — `lib/dashboard/metrics.test.ts` con 26 tests verdes. Suite total: **251 tests verdes**.
