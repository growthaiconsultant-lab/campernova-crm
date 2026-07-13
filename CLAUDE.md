# Campernova CRM

CRM interno para gestionar la compraventa de autocaravanas y campers semi-nuevas en CampersNova.

## Identidad confirmada

- Marca comercial: **CampersNova**
- Razón social: **Campers Nova S.L**
- CIF: **B-22466874**
- Domicilio fiscal/nave: **Carrer Torre de Cellers, 08150 Barcelona**
- Dominio: `campersnova.com`
- Email contacto: `info@campersnova.com`
- Teléfono: `645 63 91 85` · WhatsApp: `wa.me/34645639185`
- Modelo de negocio: depósito-venta con custodia física en la nave de Parets del Vallès. El vendedor trae el vehículo, Campers Nova filtra (antigüedad / km / estado / precio que pide el vendedor) y, si encaja, lo asume en consignación: lo custodia, lo prepara, lo publica en portales y web propia, y busca comprador. Margen aproximado del 4% sobre el precio acordado con el vendedor, variable por vehículo. El margen NUNCA se muestra al cliente final (es interno). Servicios añadidos generan margen extra: taller propio (Manolo), garantía 12 m (ampliable a 36), financiación 4,99% hasta 15 años, parte de pago, gestión documental y cambio de nombre incluido.
- Equipo: 2 super-admins (Joel + Esteban CEO) + 1 agente comercial (Desirée). Por incorporar al sistema: taller (Manolo), entregas (Javi) y marketing (Ari) — se darán de alta vía UI cuando Joel lo decida, con notifyOnNewLead=false para que no reciban notificaciones de leads.
- Plazo MVP: 5 semanas a tiempo completo

## Stack

- Next.js 14 (App Router) + TypeScript
- Supabase (Postgres + Auth + Storage + pgvector)
- Prisma ORM
- Tailwind + shadcn/ui
- Vercel (deploy)
- Resend (email)
- Sentry (monitoring)
- PostHog (analytics)
- hCaptcha (anti-spam form público)

## Documentos clave (LEER PRIMERO)

- `docs/PRD.md` — qué construimos y por qué (visión, alcance, modelo de datos, métricas)
- `docs/Roadmap.md` — plan por sprints semanales (5 sprints en total)
- `docs/Backlog.md` — 41 tickets ordenados con IDs CAM-001 a CAM-1006
- `docs/Setup.md` — referencias de stack, MCPs y servicios
- `docs/Quickstart.md` — receta paso a paso de arranque
- `docs/Vision-CRM-360.md` — spec de referencia del CRM operativo end-to-end para los sprints post-launch (6-10). Modelo de negocio real, 8 fases, objetos, roles, reglas de bloqueo, KPIs.
- `docs/Roadmap-Infraestructura-Estado.md` — **vista única** del estado de las 10 capas de "CampersNova OS", pendiente técnico por capa, y **decisiones que dependen del dueño**. Consolidado tras B20; consultar antes de proponer el siguiente bloque. (La visión estratégica completa con cifras es privada — solo en memoria.)
- `docs/README.md` — **índice de arquitectura y gobierno**. Fuente de verdad de **Fase 0** (seguridad, atomicidad, capa documental versionada): estado final, decisiones (AD-001…016), gobierno de migraciones/Storage/secretos/CI, cierre operativo. Incluye el **diseño de dominio de Fase 1** (dirección aprobada; **entidades de dominio no implementadas**, pero el **primer PR técnico —fact de venta canónico (Fase 1A-1)— está implementado y desplegado** en PR #111, squash `2f1e436`): `docs/architecture/fase-1-domain-architecture.md` (diseño), `fase-1-current-domain-map.md` (as-is), `fase-1-evolution-roadmap.md` (secuencia/drivers/estado de Fase 1A). Marketplace y multiempresa **diferidos**. Los planes/auditoría originales están en `docs/historical/` (marcados como históricos).

## Convenciones

- Server Components por defecto, Client Components solo cuando necesario
- Server Actions para mutaciones, no API routes salvo webhooks
- Validación con Zod en client + server
- Estados como enums en Prisma + types compartidos
- Tests: Vitest para lógica, Playwright para flujos
- No introducir librerías sin discutirlo
- Commits pequeños y atómicos, mensaje en imperativo

## Reglas de trabajo

- Cada sesión: pregúntame en qué ticket trabajamos antes de empezar
- Antes de tocar código: lista los pasos que vas a seguir y pregúntame lo que no esté claro
- Si modificas el schema de Prisma, genera migración y actualiza el seed si aplica
- Si propones añadir una librería, justifica por qué no se puede hacer con lo que ya hay
- Tests obligatorios para: tasación, matching, transiciones de estado
- **Proceso de cambio (gobierno de ingeniería):** antes de tocar código, sigue `docs/governance/engineering-change-process.md` — clasifica el cambio (C0–C9) y su riesgo, lee `docs/governance/testing-strategy.md`, identifica invariantes y tests **antes** de implementar, decide la observabilidad/analítica necesaria (revisa Sentry/PostHog cuando aplique) sin enviar PII ni secretos, define la validación post-despliegue para cambios relevantes, respeta las ADR (no entidades diferidas sin driver), usa la plantilla `.github/PULL_REQUEST_TEMPLATE.md`, no declares implementado nada aún no fusionado, y no ejecutes staging/producción sin autorización explícita. **Comunica los resultados** según `docs/governance/ai-handoff-protocol.md` (evidencia antes que narrativa; distingue hecho/inferencia/recomendación/desconocido; respuesta proporcional al riesgo; no declares implementado/desplegado/validado/observado nada que no lo esté).

## Servicios externos ya configurados

- **GitHub repo**: `growthaiconsultant-lab/campernova-crm`
- **Vercel**: desplegado en `https://campernova-crm.vercel.app` ✅ (preview URL; dominio real pendiente CAM-46)
- **Supabase**: proyecto `campersnova-crm` en Frankfurt (eu-central-1), pgvector activo ✅
- **Resend**: API key creada, dominio pendiente de verificar
- **Sentry**: proyecto `campernova-crm` en org `ai-marketing-solutions`
- **PostHog**: proyecto en EU instance
- **hCaptcha**: sitekey y secret generados
- **Linear**: workspace `campersnova` listo, pendiente crear project "CRM v1"

Las credenciales completas están en `.env.local` (no commiteado, en `.gitignore`).

## MCPs configurados a nivel de proyecto

| MCP        | Paquete                         | Para qué lo usamos                                   | Token necesario                                |
| ---------- | ------------------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| `supabase` | `@supabase/mcp-server-supabase` | Inspeccionar schema, ejecutar SQL, gestionar Storage | PAT en supabase.com/dashboard/account/tokens   |
| `linear`   | `mcp-linear`                    | Crear/actualizar tickets, consultar backlog          | API key en linear.app/campersnova/settings/api |

### Cómo activarlos (Windows + Claude Code Desktop)

**Importante**: en Claude Code Desktop, los `mcpServers` definidos en `.claude/settings.local.json` no se cargan de forma fiable. Hay que registrarlos con la CLI `claude mcp add-json`. Cada dev hace esto una vez en su máquina.

1. Instala la CLI si no la tienes: `npm install -g @anthropic-ai/claude-code`
2. Desde la raíz del proyecto, registra cada MCP con su token (sustituye el valor):

```powershell
claude mcp add-json supabase '{\"command\":\"npx\",\"args\":[\"-y\",\"@supabase/mcp-server-supabase@latest\",\"--project-ref\",\"bbmglaatlyilxutzomxd\"],\"env\":{\"SUPABASE_ACCESS_TOKEN\":\"TU_PAT_DE_SUPABASE\"}}'

claude mcp add-json linear '{\"command\":\"npx\",\"args\":[\"-y\",\"mcp-linear@latest\"],\"env\":{\"LINEAR_API_KEY\":\"TU_API_KEY_DE_LINEAR\"}}'
```

3. Verifica con `claude mcp list` — deberías ver ambos como `✓ Connected`.
4. Reinicia Claude Code Desktop por completo (cierra ventana e icono de la bandeja del sistema) y abre sesión nueva.

`.claude/settings.json` y `.claude/settings.local.json` se mantienen como referencia de la estructura, pero la fuente de verdad funcional es el registro de la CLI.

## Estado actual (Block 23 — Rediseño fiel del CRM (handoff mockups) — EN PRODUCCIÓN ✅)

**Reproducción fiel de los mockups** `design_handoff_campersnova` (no reskin): se conserva la capa de datos (rutas, modelos, enums, cálculos server-side) y se rehace la capa visual/UX para calcar los `.dc.html`. Alcance: **solo el CRM** (web pública intacta). PRs #85–#94, cada uno con typecheck + lint + **531 tests** verdes y validación en vivo en producción. Sin migraciones.

- **F1 Fundamentos**: tokens EXACTOS del mockup como CSS vars crudas en `.crm-theme` (`--bg/--card/--line/--ink*/--panel*/--brand*` + semáforo `--green/amber/red/blue` con tints) + puente a los tokens shadcn. Utilidades Tailwind planas 1:1 (`bg-canvas`, `text-ink2`, `border-line`, `bg-brand`, `hover:bg-brand2`, `bg-panel2`, `text-good`, `bg-bad-tint`…). **Hanken Grotesk** (UI, tras `--font-crm`) + JetBrains Mono (datos); Inter/Fraunces solo para la web pública. Iconos Lucide según ESPEC §3 (trazo 1.9). **Shell fiel**: sidebar 246px `--panel` con logo "CN" verde + eyebrows mono + ítem activo con barra 3px; header 60px (buscador ⌘K visual + "Nuevo lead" + campana).
- **F2 Kit** (`components/redesign/`): Pill/HexPill, Card/CardHeader/Eyebrow, KpiCard (barra de estado + delta), ActionableTable (cabecera mono, drill-down stretched-link, col CTA), Button/ButtonLink, DetailLayout, BoardKanban, Timeline, EmptyState/Skeleton/ErrorState, y chrome móvil (MobileTabBar/MobileActionBar/MobileDetailHeader/PhoneFrame).
- **F3 Pantallas** (todas con título en contenido —fuera la doble cabecera—, EmptyState útil, `loading.tsx` skeleton y `error.tsx` con reintentar):
  - **Ofertas (OF1)**: 4 KPI cards + 2 tablas accionables (sustituye el kanban de B18; la lógica `lib/offers` intacta). "Reservas paradas" = `RESERVATION_STALE_DAYS` o reserva vencida.
  - **Captaciones (CAP1)**: tablero de sourcing + `CaptureCard` recalcada (badge portal mono, WhatsApp, avatar responsable) conservando toda la lógica.
  - **Compradores (C1)**: bandeja con Temp./Etapa/Próxima acción (vencida en rojo)/Presup./Match/Resp. + vistas + toggle **Lista|Pipeline**.
  - **Pipeline (P1)**: `/compradores/pipeline` — kanban del viaje del comprador con columnas **derivadas** (Lead→Cualificado→Cita→Oferta→Reserva; cada comprador en su columna más avanzada según status + citas CITA futuras + ofertas/reservas vivas). Lectura con drill-in: el avance se registra en la ficha (una fuente de verdad por entidad).
  - **Vendedores (VEN1)**: bandeja con Estado/Tasación (+sobreprecio)/Acuerdo/Próxima acción.
  - **Vehículos (V1)**: grid de cards (foto + badge de estado + matrícula mono + precio + chip de demanda con nº matches).
  - **Taller (TAL1/TAL2)**: columna y bloque grande **Horas P→R** con desviación (`computeHoursDeviation` + suma `timeEntries`), aprob. CEO; ficha con breadcrumb + COSTE EST.
  - **Entregas (ENT1/ENT2)**: **agenda por día** (HOY/MAÑANA) con barra de progreso del checklist; ficha con fecha/hora + barra + panel "al completar" (garantía+follow-ups).
  - **Postventa (POST1/POST2)**: tarjetas de garantía con días restantes coloreados, tickets con "Vencido · escalar" (dueAt), follow-ups 7/30; ficha con barra de progreso de vigencia.
  - **Dashboard «Mi día» (D1)**: `/dashboard` reconvertido a panel operativo — saludo+fecha, KPIs (vencidas/calientes/citas/reservas), "Tu día, priorizado" y "Agenda de hoy". Reutiliza `getComercialKpis` (B21) + `getCalendarItems` (B15); **el contenido financiero vive en `/analytics/*`**. `ForbiddenToast` y filtro de agente (ADMIN) conservados.
  - **Analytics**: layout compartido con **conmutador de tabs** (7 dashboards, filtrado por rol) + fade ~0.3s.
  - **Móvil**: tab bar inferior (Inicio·Compradores·Vehículos·Agenda, por rol; TALLER/ENTREGAS ven sus módulos) + **MobileFichaActions** (Llamar/WhatsApp fijos, con `logWhatsApp`) en fichas C2/VEN2 (z-50 sobre la tab bar).
  - Fichas C2/VEN2: cabecera breadcrumb a 60px + offsets sticky 118px (mantienen su arquitectura hero+tabs+rail, ya token-coherente). Calendario: colores de origen al semáforo.

### Pulido posterior del rediseño (PRs #95–#97, validado en vivo ✅)

- **Buscador global ⌘K cableado** (PR #97): `search-actions.ts` (`globalSearch`, RBAC del sidebar: leads/captaciones ADMIN+AGENTE, vehículos también TALLER/MARKETING; busca nombre/email/teléfono/marca/modelo/**matrícula**) + `components/layout/global-search.tsx` (overlay con grupos por entidad, debounce 250ms, Cmd/Ctrl+K, Escape). Validado en prod con datos reales (drill-down a ficha).
- **Tablas → tarjetas en móvil** (PR #96, ESPEC §6): `ActionableTable` acepta `mobileCard` (lista de tarjetas en `<lg`, tabla en `≥lg`). Aplicado a Compradores/Vendedores/Taller/Ofertas+Reservas.
- **Drag & drop en Captaciones** (PR #95): `capture-board.tsx` — soltar cambia el `CaptureStatus`; drop en "Entrada agendada" abre diálogo de fecha (`scheduleEntrada`); "Convertido" no acepta drop (aviso). Calendario: CTA/toggles/badge de hoy al verde de marca. `/usuarios` al patrón del kit. **Modal "Nuevo lead"** centrado (scrim ESPEC §5) con Comprador/Vendedor/Captación (`new-lead-button.tsx`).

### Filtros globales de Analytics — rango + comparativa (PR #98, validado en vivo ✅)

Última pieza funcional del handoff (spec §3): **`lib/kpi/range.ts`** (puro, 10 tests — rangos 7d/30d/90d/mes/mes-anterior/trimestre/año; comparativa = periodo de **igual duración** inmediatamente anterior) + **`lib/kpi/flow.ts`** (`getFlowKpis` — KPIs de **flujo** por periodo: leads nuevos, vehículos captados, ofertas creadas, reservas con señal decidedAt en rango, ventas vía activity "→ Vendido"; respeta filtro de agente; `computeDelta` testeado). UI: **chips de rango** en el layout de Analytics (`?range=`, **preservado entre tabs** vía useSearchParams+Suspense); **Dirección** gana sección "Flujo del periodo" (6 cards con delta y "antes: N"); **CRM** pasa "Leads nuevos" al rango global. Los KPIs de **estado** (stock, activos, trust) siguen siendo snapshot y sus secciones lo indican. Validado en prod: cambio de rango recalcula (30d: compradores 62 ↗288% → 7d: 17 ↗113%) y el rango persiste al cambiar de dashboard. Suite: **543 tests**.

### Pendiente del rediseño (fuera del handoff funcional)

La **campana** del header sigue visual (cablearla = sistema de notificaciones in-app, feature nueva). **Export PDF** de dashboards (CSV ya existe en Calidad). Validación visual de TAL2/ENT2/POST2 **con datos** cuando el equipo cree órdenes/entregas/garantías.

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
- **Server actions** (`ofertas/actions.ts`, guard `requireAgente`): `createOffer`/`updateOfferStatus`/`updateOffer`. **Efectos sobre el stock**: ACEPTADA → Vehicle `RESERVADO` (si estaba PUBLICADO); cancelar/retirar/expirar una reserva → libera a `PUBLICADO`. Transiciones de vehículo validadas con `VEHICLE_TRANSITIONS`. Traza en el timeline de **ambos lados** (comprador + vendedor).
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

## Decisiones técnicas

### Prisma 6, no 7

Usamos `prisma@^6` y `@prisma/client@^6`. La v7 eliminó `url` y `directUrl` del bloque `datasource` en `schema.prisma` y requiere un nuevo patrón de adapters (`prisma.config.ts` + `@prisma/adapter-pg`) que no está validado con Next.js 14 + Vercel. Migrar cuando esté estabilizado.

### pnpm build scripts de Prisma

pnpm v10 bloquea build scripts por defecto. Añadido en `package.json`:

```json
"pnpm": { "onlyBuiltDependencies": ["@prisma/client", "@prisma/engines", "prisma"] }
```

### Workflow de migraciones Prisma + Supabase

1. Editar `prisma/schema.prisma`
2. Generar SQL: `pnpm prisma migrate diff --from-schema-datasource --to-schema-datamodel prisma/schema.prisma --script`
3. Aplicar vía MCP Supabase (`apply_migration`, project_id `bbmglaatlyilxutzomxd`)
4. Crear carpeta `prisma/migrations/<timestamp>_<nombre>/migration.sql` con el SQL
5. Marcar como aplicada: `pnpm prisma migrate resolve --applied <nombre>`
6. Regenerar cliente: `pnpm prisma generate`

> Alternativa si hay conexión directa estable: `pnpm prisma migrate dev --name <nombre>` hace los pasos 2-6 automáticamente.

### Archivo .env para Prisma CLI

Prisma CLI lee `.env` (no `.env.local`). El `.env` contiene solo `DATABASE_URL` y `DIRECT_URL`, copiados de `.env.local`. Está en `.gitignore`. Cada dev lo crea ejecutando:

```bash
grep -E "^(DATABASE_URL|DIRECT_URL)" .env.local > .env
```

### Estructura de clientes Supabase

- `lib/supabase/client.ts` — browser (`createBrowserClient`), para `'use client'`
- `lib/supabase/server.ts` — server (`createServerClient` + cookies de Next.js), para RSC y Server Actions
- `lib/supabase/middleware.ts` — helper `updateSession()` usado por `middleware.ts` de raíz
- `lib/db.ts` — singleton `PrismaClient` exportado como `db`

### Supabase project ref

`bbmglaatlyilxutzomxd` (Frankfurt, eu-central-1). Usar como `project_id` en todas las llamadas al MCP de Supabase.

### Auth y estructura de rutas (CAM-9 + CAM-10)

- Rutas públicas: `/login`, `/auth/callback`. Todo lo demás protegido por middleware.
- `lib/auth.ts` — helpers `requireAuth()` y `requireAdmin()` para RSC y Server Actions.
- Callback route (`/auth/callback`) intercambia el code y sincroniza `authId` en tabla `users` al primer login.
- Grupo `app/(auth)/` para rutas de autenticación, grupo `app/(backoffice)/` para el backoffice.
- `app/(backoffice)/actions.ts` — Server Action `logout()`.
- Login verifica email en tabla `users` (Prisma) antes de enviar el OTP — sin auto-registro.

### Paleta de colores Campernova (extraída de campersnova.com)

- Primary (sidebar bg): `#294e4c` → `hsl(177, 31%, 23%)`
- Accent (item activo, CTA): `#cc6119` → `hsl(24, 78%, 45%)`
- Deep teal (sidebar border): `#153e4d` → `hsl(196, 57%, 19%)`
- Variables CSS en `app/globals.css`, tokens en `tailwind.config.ts`

### Seed de usuarios

- `prisma/seed.ts` — upsert idempotente por email. Añadir nuevos usuarios aquí.
- Comando: `pnpm seed`
- Usuarios actuales: Joel (ADMIN, growth.ai.consultant@gmail.com), Esteban (AGENTE, info@campersnova.com), Joui (AGENTE, joelmarfas@gmail.com)

### Zod 4 + @hookform/resolvers v5 — separación de tipos input/output

`zodResolver` v5 expone `Resolver<z.input<T>>` (tipo INPUT del schema), no el OUTPUT. Cuando el schema usa `.default()` u `.optional()`, el INPUT difiere del OUTPUT. En los formularios hay que:

1. Exportar `SellerLeadFormValues = z.input<typeof schema>` desde `lib/validators/`
2. Usar `useForm<SellerLeadFormValues>` (tipo INPUT), no `useForm<OutputType>`
3. El server action recibe `unknown` y valida con `schema.safeParse(data)` → obtiene el OUTPUT tipado

### shadcn/ui

- Inicializado con base `zinc`, CSS variables, RSC habilitado.
- Componentes instalados hasta sprint 2: `button`, `avatar`, `dropdown-menu`, `separator`, `form`, `input`, `label`, `select`, `checkbox`, `card`, `textarea`.
- Añadir nuevos con: `npx shadcn@latest add <componente>`

### Bucket vehicle-photos — público, URLs directas

El bucket `vehicle-photos` está configurado como `public: true` en Supabase. Se usan **URLs públicas**, no firmadas. La visibilidad se controla a nivel de app: cuando `vehicle.status ≠ PUBLICADO`, el portal no muestra las fotos. Si en algún momento se necesita privacidad real, habría que hacer el bucket privado y usar `createSignedUrl(path, 3600)`.

Helpers en `lib/supabase/storage.ts`:

- `vehiclePhotoPath(vehicleId, fileName)` → `{vehicleId}/{fileName}`
- `vehiclePhotoPublicUrl(path)` → URL completa pública
- `extractVehiclePhotoPath(url)` → extrae path de una URL pública

### Compresión de imágenes — canvas nativo, sin librería

`lib/image/compress.ts` usa `createImageBitmap` + `<canvas>` nativo para comprimir a JPEG ≤1.5 MB. Algoritmo: escala max edge a 2000px, prueba quality 0.85 bajando 0.1 hasta ≤1.5 MB o quality mínimo 0.4. Sin dependencia de `browser-image-compression` ni similar.

### Reordenado de fotos — HTML5 drag nativo, sin @dnd-kit

`<VehiclePhotoUploader>` en `components/vehicle-photo-uploader.tsx` usa `draggable` + `onDragStart/onDragOver/onDrop` nativo. Sin `@dnd-kit` ni similares.

### Archivos clave CAM-13/14/15/16/17/18

```
lib/supabase/storage.ts              — helpers bucket vehicle-photos
lib/image/compress.ts                — compresión canvas a JPEG ≤1.5 MB
lib/email/
  client.ts                          — singleton Resend
  send.ts                            — sendSellerLeadConfirmation + sendAgentLeadNotification
  templates/
    seller-lead-confirmation.ts      — email al vendedor (confirmación + resumen vehículo)
    agent-lead-notification.ts       — email interno al equipo (ficha completa + CTA backoffice)
components/vehicle-photo-uploader.tsx — uploader reutilizable (vehicleId + initialPhotos)
app/(backoffice)/vendedores/
  photo-actions.ts                   — uploadVehiclePhoto, deleteVehiclePhoto, reorderVehiclePhotos
  page.tsx                           — listado con filtros (RSC + searchParams)
  leads-filters.tsx                  — client component filtros en URL
  [id]/
    page.tsx                         — ficha editable (dos columnas + galería)
    seller-lead-edit-form.tsx        — form datos vendedor + estado + agente
    vehicle-edit-form.tsx            — form datos vehículo + estado
    actions.ts                       — updateSellerLead, updateVehicle
lib/validators/seller-lead.ts        — añadidos updateSellerLeadSchema, updateVehicleSchema
app/vender/
  page.tsx                           — wizard 3 pasos público (Vehículo → Fotos → Contacto + hCaptcha)
  actions.ts                         — submitPublicLead: captcha → lead PRO → fotos → email vendedor → notif agentes → redirect
  success/page.tsx                   — página de éxito con tasación placeholder
middleware.ts                        — /vender añadido a PUBLIC_PATHS
```

### Filtros del listado CAM-14 — URL como fuente de verdad

Los filtros de `/vendedores` viven en los `searchParams` de la URL (bookmarkeable, compartible). El RSC lee `searchParams` y ejecuta la query. `LeadsFilters` (client) actualiza la URL con `router.push` en cada cambio. Sin estado local. **Sin filtro de matrícula** — el campo `plate` no existe en el schema de `Vehicle`.

### hCaptcha — integración CAM-17

- Librería: `@hcaptcha/react-hcaptcha` v2 (wrapper oficial, evita gestionar manualmente el script externo)
- Widget renderiza en Step 3 del form `/vender`
- Flujo: `onVerify` → guarda token en estado → se mete en FormData como `h-captcha-response`
- Server action `submitPublicLead` llama `verifyHCaptcha(token)` antes de cualquier otra operación
- Env vars: `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` (cliente) + `HCAPTCHA_SECRET_KEY` (servidor) — ya en `.env.local`
- En dev/test: usar el sitekey de test de hCaptcha (`10000000-ffff-ffff-ffff-000000000001`) para autopasar el challenge

### Form público `/vender` — CAM-16

- Ruta pública (sin auth). `/vender` y subrutas en `PUBLIC_PATHS` del middleware.
- Wizard 3 pasos: Vehículo → Fotos → Contacto. Estado en el cliente, submit único al final.
- Fotos: buffer client-side como `File[]` (comprimidas con `lib/image/compress.ts`), se suben al submit
- Server action `submitPublicLead`: crea `SellerLead` con `canal=PRO`, luego sube fotos a Storage
- Página éxito: `/vender/success?min=X&rec=X&max=X` — rango real de tasación (implementado en CAM-24)

### Sistema de email — CAM-18 / CAM-19

Librería: `resend` v6. Sin React Email (el meta-paquete `@react-email/components` está deprecated; HTML string puro es suficiente y sin deuda técnica).

**Archivos:**

```
lib/email/
  client.ts                          — singleton Resend (lee RESEND_API_KEY, lanza si no existe)
  send.ts                            — sendSellerLeadConfirmation + sendAgentLeadNotification
  templates/
    seller-lead-confirmation.ts      — email al vendedor: confirmación de recepción + resumen vehículo
    agent-lead-notification.ts       — email interno al equipo: ficha completa lead + CTA "Ver ficha"
```

**Diseño (ambas funciones):**

- **No-bloqueantes**: capturan excepciones y las loguean a consola. Si Resend falla, el lead ya está creado y el usuario ve `/vender/success` igual.
- El from lo controla una sola variable: `EMAIL_FROM` en `.env.local`.
- En dev: `EMAIL_FROM=onboarding@resend.dev` (dominio de prueba de Resend, solo entrega a la cuenta dueña de la API key).
- En producción: cambiar a `CampersNova <info@campersnova.com>` cuando el dominio esté verificado.

**`sendAgentLeadNotification` (CAM-19):**

- Recibe `agentEmails: string[]` y envía en paralelo (`Promise.all`) un email individual a cada agente.
- El email incluye: datos completos del vendedor (nombre, email clicable, teléfono clicable), resumen del vehículo (tipo, año, km, estado de conservación, ubicación, precio deseado), badge de canal (PRO / CN), y botón "Ver ficha →" que enlaza a `NEXT_PUBLIC_APP_URL/vendedores/{leadId}`.
- La lista de destinatarios se obtiene en `submitPublicLead` con `db.user.findMany({ where: { active: true } })` — sin hardcodear emails.

**Flujo completo en `submitPublicLead` (`app/vender/actions.ts`):**

1. Verifica captcha
2. Valida datos con Zod
3. Crea `SellerLead` + `Vehicle` en Prisma (transacción)
4. Sube fotos a Storage
5. **Envía email de confirmación al vendedor** ← CAM-18
6. **Notifica a todos los usuarios activos** ← CAM-19
7. `redirect` a `/vender/success`

**Env vars:**

```
RESEND_API_KEY=re_...                 # API key Resend (ya en .env.local)
EMAIL_FROM=onboarding@resend.dev      # sandbox; cambiar a "CampersNova <info@campersnova.com>" al verificar dominio
NEXT_PUBLIC_APP_URL=http://localhost:3000  # en Vercel: URL real del proyecto
```

**Para activar en producción:** verificar `campersnova.com` en Resend → Domains, luego actualizar `EMAIL_FROM` y `NEXT_PUBLIC_APP_URL` en Vercel (CAM-46).

### Asignación de agente — CAM-20

**Restricción de permisos:**

- Solo usuarios con `role === 'ADMIN'` pueden cambiar `agentId` en un `SellerLead`.
- El server action `updateSellerLead` compara el `agentId` entrante con el valor actual en DB. Si difieren y el actor no es ADMIN, devuelve error `{ formErrors: ['Solo el admin puede reasignar el agente'] }`.
- La UI refleja esta restricción: el `Select` de "Agente asignado" en `SellerLeadEditForm` recibe `isAdmin` como prop y se deshabilita con `disabled={!isAdmin}` si el usuario no es admin. Se muestra un hint "Solo el admin puede reasignar" bajo el selector.

**Activity log:**

- Cada cambio de agente crea una fila en `activities` con `type: LEAD_ASIGNADO`.
- `content` describe el cambio: `"Asignado a X"`, `"Reasignado de X a Y"`, o `"Desasignado (antes: X)"`.
- `agentId` en la activity = el actor (quien hizo el cambio), no el nuevo agente asignado.
- La actualización del lead + creación de la activity van en una misma `db.$transaction` para garantizar consistencia.

**Flujo en `page.tsx`:**

- Se llama `requireAuth()` junto con las queries del lead/agentes en `Promise.all` para no añadir latencia.
- `isAdmin = currentUser.role === 'ADMIN'` se pasa a `SellerLeadEditForm`.

### Vitest — tests unitarios

Instalado en sprint 3 para cubrir tasación, matching y transiciones de estado.

- Config en `vitest.config.ts` — incluye `lib/**/*.test.ts` y `app/**/*.test.ts`
- Scripts: `pnpm test` (run), `pnpm test:watch`, `pnpm test:coverage`
- No usar `describe.skip` ni comentar tests para pasar CI

### Tabla de referencia CAM-21

- 80 entradas (30 CAMPER + 50 AUTOCARAVANA): marcas principales del mercado español
- `prisma/seeds/reference-prices.ts` — función `seedReferencePrices(db)`, upsert idempotente
- `prisma/data/reference-prices.csv` — CSV para UI de admin (CAM-21 P1, pendiente)
- Ejecutar: `pnpm seed` (incluye usuarios + precios de referencia)

### Algoritmo de tasación CAM-22

Módulo puro en `lib/valuation/`. No depende de Prisma directamente — usa deps inyectables para facilitar los tests.

**Flujo:**

1. Busca comparables internos: misma marca+modelo+tipo, año±2, km±20%, status=VENDIDO
2. Si ≥3 comparables: cuantil tipo-7 (p25=min, p50=recommended, p75=max)
3. Si <3: fallback a `reference_prices`, tomando el `baseYear` más cercano al año del vehículo
4. Fórmula fallback: `basePrice × yearFactor − km × depreciationPerKm` con rango ±15%
5. Ajuste final (multiplicativo): `conservationFactor × equipmentFactor`

**Ajustes:**

- Conservación: EXCELENTE ×1.05, BUENO ×1.00, NORMAL ×0.97, DETERIORADO ×0.90
- Equipamiento premium (+2% cada uno): solar, bathroom, shower, heating. Kitchen excluido.
- Year factor: cada año más viejo que baseYear ×0.92; cada año más nuevo ×1.05

**Confidence:**

- ALTA: método comparables con ≥5 ventas
- MEDIA: comparables con 3-4, o referencia con |year-baseYear| ≤1
- BAJA: referencia con año distante, o sin datos

**Archivos:**

```
lib/valuation/
  types.ts          — ValuationVehicleInput, ValuationOutput, ValuationDeps
  adjustments.ts    — conservationFactor, equipmentFactor, yearFactor
  calculate.ts      — calculateValuation (función pura con deps inyectables)
  prisma-deps.ts    — prismaValuationDeps(db): implementación real con Prisma
  index.ts          — exports públicos
```

**Nota:** El enum Prisma `ValuationMethod` (AUTO/MANUAL) indica quién tasó, no el algoritmo usado. El método del algoritmo ('COMPARABLES' | 'REFERENCIA' | 'NONE') va en `valuations.parameters` JSON.

### Histórico de tasaciones CAM-23

**Archivos:**

```
lib/valuation/
  save.ts             — persistValuation (AUTO/MANUAL) + runAndSaveAutoValuation
app/(backoffice)/vendedores/
  [id]/actions.ts     — updateVehicle re-tasa; overrideValuation crea fila MANUAL
  [id]/valuation-override-form.tsx  — form client para sobrescribir desde ficha
components/
  valuation-timeline.tsx — timeline presentacional (server component)
```

**Reglas:**

- `runAndSaveAutoValuation` captura errores internamente — nunca bloquea el flujo principal
- `persistValuation` skipea si `result.method === 'NONE'` (sin datos suficientes)
- `overrideValuation` escribe directamente sin pasar por el algoritmo — confidence siempre ALTA
- Al crear o actualizar vehículo: auto-tasación. Si el vehículo está en NUEVO y la tasación tiene resultado → avanza a TASADO
- Los campos `vehicle.valuationMin/Recommended/Max` son denormalizados (rápido para mostrar). La fuente de verdad es la tabla `valuations`
- Historial limitado a las últimas 10 filas en la query de la ficha

### Tasación en página de éxito y email CAM-24

- `submitPublicLead` captura el resultado de `runAndSaveAutoValuation` y:
  - Si `method !== 'NONE'`: añade `?min=X&rec=X&max=X` al redirect de `/vender/success`
  - Pasa `valuation` a `sendSellerLeadConfirmation`
- Página `/vender/success` muestra precio real (recomendado + rango) o "En revisión" si no hay params
- Email al vendedor muestra rango real o "En preparación" si no hay tasación
- Etiquetado siempre como "preliminar" / "tu agente confirma en 24 h"

### Archivos clave CAM-25/26 — Captación comprador

```
lib/validators/buyer-lead.ts              — createBuyerLeadSchema + updateBuyerLeadSchema + PURCHASE_TIMELINE_OPTIONS
app/(backoffice)/compradores/
  actions.ts                              — createBuyerLead (server action creación)
  buyer-leads-filters.tsx                 — client component filtros en URL
  page.tsx                                — listado con filtros, tabla y paginación
  nuevo/
    page.tsx                              — página "Nuevo comprador"
    buyer-lead-form.tsx                   — form creación (dos cards: contacto + preferencias)
  [id]/
    page.tsx                              — ficha con resumen de badges + card editable
    buyer-lead-edit-form.tsx              — form edición (contacto + estado + agente + preferencias)
    actions.ts                            — updateBuyerLead: guard ADMIN para agentId + activity log
```

### Algoritmo de matching CAM-27

Módulo puro en `lib/matching/`, mismo patrón que `lib/valuation/` (deps inyectables para los tests).

**Flujo:**

1. Filtros duros: tipo, plazas mínimas, presupuesto +10%
2. Scoring suave por 4 ejes (cada uno 0-100)
3. Score final = ponderación: equipment×40 + price×25 + ageKm×20 + zone×15 (suma 100)
4. Devuelve top 10 ordenado descendente

**Filtros duros — política con criterios vacíos:**

- Si el comprador no especifica un criterio (`null`), ese filtro pasa automáticamente.
- Si el comprador exige presupuesto pero el vehículo no tiene precio (`desiredPrice` ni `valuationRecommended`), el match se descarta.

**Scoring:**

- **Equipment (40)**: % de equipos críticos del comprador que tiene el vehículo. Sin requisitos → 100. Solo cuentan flags `=== true`.
- **Price (25)**: 100 si ≤90% del presupuesto, decae lineal a 0 al llegar a +10%. Sin presupuesto → 100. Con presupuesto pero sin precio → 50 (neutro; el filtro duro ya descartó si era exigible).
- **AgeKm (20)**: media de dos componentes lineales. Año: 100 si current year, 0 si ≥15 años. Km: 100 si 0 km, 0 si ≥200.000 km.
- **Zone (15)**: match exacto case-insensitive con trim. Sin preferencia → 100. Vehículo sin ubicación pero comprador la pide → 0.

**Estados elegibles (en `prisma-deps.ts`):**

- Vehicles: `PUBLICADO` y `TASADO`
- BuyerLeads: cualquiera excepto `CERRADO` y `PERDIDO`

**Archivos:**

```
lib/matching/
  types.ts          — MatchingVehicleInput, MatchingBuyerInput, MatchingDeps, ScoredMatch, WEIGHTS, TOP_N
  filters.ts        — passesHardFilters
  scoring.ts        — scoreEquipment, scorePrice, scoreAgeKm, scoreZone
  find.ts           — scorePair, findMatchesForVehicle, findMatchesForBuyer
  prisma-deps.ts    — prismaMatchingDeps(db): adapter real con Prisma
  index.ts          — exports públicos
  scoring.test.ts   — 19 tests por eje
  find.test.ts      — 20 tests filtros + ordering + integración
```

**Para CAM-28**: la persistencia en la tabla `matches` (estado `SUGERIDO`, idempotente) NO está incluida en este módulo — `findMatches*` solo calcula. CAM-28 hará el wrapper que llama y persiste.

### UI matches CAM-29

**Archivos:**

```
app/(backoffice)/matches/actions.ts     — updateMatchStatus(matchId, newStatus): valida transición + revalidatePath ambas fichas
components/matches-section.tsx          — Client Component: sección colapsable con tarjetas de match
```

**Sección colapsable** (`<MatchesSection side="vehicle|buyer" matches={...} />`):

- Colapsada por defecto. Header clickable muestra título + contador de matches.
- **Ficha vendedor** (`side="vehicle"`): muestra compradores interesados. Cada card: avatar inicial, nombre, tipo/plazas, presupuesto, equipamiento crítico (chips, máx 3 + overflow), score badge, estado badge.
- **Ficha comprador** (`side="buyer"`): muestra vehículos sugeridos. Cada card: miniatura foto (o placeholder), marca/modelo/año, km/precio, score badge, estado badge.
- Click en card → link a la ficha del otro lado.

**Transiciones de estado válidas** (solo avance secuencial + RECHAZADO desde cualquier estado activo):
`SUGERIDO → PROPUESTO_CLIENTE | RECHAZADO`
`PROPUESTO_CLIENTE → VISITA | RECHAZADO`
`VISITA → OFERTA | RECHAZADO`
`OFERTA → CERRADO | RECHAZADO`
`CERRADO / RECHAZADO → (solo lectura)`

**Score badge colors**: ≥80 verde, ≥60 teal, ≥40 amarillo, <40 gris.

**Serialización**: los campos `Decimal` de Prisma se convierten a `number | null` en el RSC de la página antes de pasar al Client Component (boundary RSC→Client no serializa Decimal).

**Datos**: matches se cargan mediante `include` anidado en la query principal de cada ficha (`vendedores/[id]/page.tsx` y `compradores/[id]/page.tsx`). Top 10, orden score desc.

**`updateMatchStatus`**: cualquier agente autenticado puede mover estados. Valida la transición en servidor antes de escribir. Revalida ambas fichas (`/vendedores/{sellerLeadId}` y `/compradores/{buyerLeadId}`) para sincronizar los dos lados.

**Verificación manual necesaria**: el preview headless no puede acceder al backoffice (requiere auth). Validar en `localhost:3000` con sesión activa.

### Recalculación de matches CAM-28

**Decisión: in-process, no edge function ni cron.** Se llama desde los Server Actions tras crear/actualizar entidades. Para un equipo de 3 agentes el coste es despreciable; si crece, se migra a edge function.

**Funciones (`lib/matching/recalculate.ts`):**

- `recalculateMatchesForVehicle(vehicleId, db)` — calcula top 10 con `findMatchesForVehicle` y aplica el diff
- `recalculateMatchesForBuyer(buyerLeadId, db)` — simétrico
- `computeRecalcDiff(newTop, existing)` — función pura testable: decide qué crear/actualizar/borrar

**Reglas de idempotencia (`computeRecalcDiff`):**
| En el top nuevo | Existe ya | Acción |
|---|---|---|
| Sí | No | INSERT con `SUGERIDO` |
| Sí | Sí, `SUGERIDO` | UPDATE score |
| Sí | Sí, estado posterior | NO TOCAR (decisión del agente manda) |
| No | Sí, `SUGERIDO` | DELETE |
| No | Sí, estado posterior | NO TOCAR |

**Errores no bloqueantes**: `recalculateMatchesFor*` envuelven todo en try/catch — si fallan, loguean y devuelven sin throw, igual que `runAndSaveAutoValuation`. El flujo principal del Server Action no se rompe nunca.

**Triggers conectados:**

- `app/(backoffice)/vendedores/actions.ts` `createSellerLead` — tras `runAndSaveAutoValuation`
- `app/(backoffice)/vendedores/[id]/actions.ts` `updateVehicle` — tras re-tasar
- `app/(backoffice)/vendedores/[id]/actions.ts` `overrideValuation` — tras escribir el override (cambia `valuationRecommended` → afecta al matching)
- `app/(backoffice)/compradores/actions.ts` `createBuyerLead`
- `app/(backoffice)/compradores/[id]/actions.ts` `updateBuyerLead`
- `app/vender/actions.ts` `submitPublicLead` — tras tasar

`updateSellerLead` (datos del vendedor, no del vehículo) NO recalcula — no afecta a los criterios de matching.

**Tests** (`recalculate.test.ts`): 7 casos sobre `computeRecalcDiff` cubriendo la matriz completa (insert, update, mantener, borrar, mezcla, top vacío). Total módulo `lib/matching/`: **46 tests verdes**.

### Captación comprador — decisiones CAM-25/26

**`purchaseTimeline` — valores predefinidos:**
Constante `PURCHASE_TIMELINE_OPTIONS` en `lib/validators/buyer-lead.ts` con 5 opciones: `menos_1_mes`, `1_3_meses`, `3_6_meses`, `mas_6_meses`, `sin_prisa`. El campo en DB es `String?` (no enum) para poder añadir opciones sin migración.

**Filtros del listado `/compradores` — dirección de los filtros numéricos:**

- `budgetMin`: muestra compradores con `maxBudget >= X` (tienen presupuesto suficiente para un vehículo de precio X)
- `seatsMin`: muestra compradores con `minSeats >= X` (requieren al menos X plazas)

**Ficha de comprador — un solo card:**
A diferencia de la ficha de vendedor (dos cards separados: vendedor + vehículo), la ficha de comprador agrupa todo en un único `<Card>` porque no hay entidad secundaria (sin vehículo). Encima del card se muestran pills/badges de solo lectura con el resumen de preferencias para visibilidad rápida.

**Asignación de agente en BuyerLead — mismo patrón que SellerLead:**
`updateBuyerLead` aplica el mismo guard de ADMIN y crea activity con `buyerLeadId` en lugar de `sellerLeadId`.

### Pendiente: no mezclar pnpm dev y pnpm build

`pnpm build` mientras `pnpm dev` está corriendo sobrescribe `.next/` y deja el dev server sirviendo módulos huérfanos. Si hace falta verificar el build de producción, parar el dev server primero. Si el dev server muestra errores `Cannot find module './XXX.js'`, la solución es `rm -rf .next && pnpm dev`.

### Supabase Auth — URLs permitidas

- `http://localhost:3000/auth/callback` (local dev)
- `https://campernova-crm.vercel.app/auth/callback` (producción)
- `https://campernova-crm-*-growthaiconsultant-8035s-projects.vercel.app/auth/callback` (preview deploys)

### Máquina de estados CAM-30

Módulo centralizado en `lib/state-machine.ts`. Patrón: mapa de transiciones por entidad + helper `isValidTransition<T>()` genérico. Reutiliza el mismo patrón ya existente en `matches/actions.ts`.

**Transiciones permitidas:**

- SellerLead: `NUEVO→CONTACTADO|DESCARTADO`, `CONTACTADO→CUALIFICADO|DESCARTADO`, `CUALIFICADO→EN_NEGOCIACION|DESCARTADO`, `EN_NEGOCIACION→CERRADO|DESCARTADO`
- Vehicle: `NUEVO→TASADO|DESCARTADO`, `TASADO→PUBLICADO|DESCARTADO`, `PUBLICADO→RESERVADO|DESCARTADO`, `RESERVADO→VENDIDO|PUBLICADO|DESCARTADO`
- BuyerLead: igual que SellerLead pero terminal `PERDIDO` en lugar de `DESCARTADO`
- Match: ya existía (sin cambios)

**Estados terminales** (CERRADO, DESCARTADO, VENDIDO, PERDIDO): selector de estado deshabilitado en UI; rest de campos siguen editables.

**Activity log:** cada cambio de estado en `updateSellerLead`, `updateVehicle`, `updateBuyerLead` crea una fila `CAMBIO_ESTADO` en la misma transacción. Los cambios de Vehicle se loguean bajo `sellerLeadId` (no existe `vehicleId` en activities).

**Labels y colores centralizados** en `lib/state-machine.ts` — las fichas ya no definen STATUS_COLORS/STATUS_LABELS propios.

### Activity log timeline CAM-31

**Archivos:**

```
components/activity-timeline.tsx    — server component presentacional; acepta `activities` + `currentUserId?`
```

- Icono por tipo (Lucide React): ArrowRightLeft/PenLine/Phone/Mail/MessageCircle/Zap/UserCheck
- Colores diferenciados por tipo (teal/amber/blue/indigo/green/violet/slate)
- Texto preserva saltos de línea (`whitespace-pre-wrap`) — útil para notas multilínea
- Las fichas cargan las últimas 50 activities (`orderBy: createdAt desc`) en el `Promise.all` de la página

### Notas libres CAM-32

**Archivos:**

```
app/(backoffice)/note-actions.ts        — deleteNote: guard autoría + revalidatePath polimórfico
app/(backoffice)/vendedores/[id]/actions.ts  — addSellerLeadNote
app/(backoffice)/compradores/[id]/actions.ts — addBuyerLeadNote
components/note-form.tsx                — client component; textarea 2000 chars + contador
components/delete-note-button.tsx       — client component; confirmación inline (sin dialog)
```

- `NoteForm` recibe la action vía `.bind(null, leadId)` desde la página — patrón Server Action como prop
- Solo el autor puede borrar (`activity.agentId === actor.id`); el botón de papelera solo se muestra si `currentUserId === activity.agentId`
- `deleteNote` infiere el path a revalidar desde `sellerLeadId`/`buyerLeadId` de la activity

### Click-to-WhatsApp CAM-33

**Archivos:**

```
lib/whatsapp.ts                         — formatPhoneForWhatsApp + buildWhatsAppUrl + plantillas
app/(backoffice)/whatsapp-actions.ts    — logWhatsApp: crea activity WHATSAPP_INICIADO
components/whatsapp-button.tsx          — client component; abre wa.me + log fire-and-forget
```

**Formato de teléfono**: `formatPhoneForWhatsApp` strip-ea no-dígitos. Si el resultado tiene 9 dígitos y empieza por 6/7 (móvil ES) → prepend `34`. Si empieza por `00` → quita los dos ceros. El resto se usa tal cual.

**Plantillas**:

- Vendedor: incluye marca/modelo/tipo del vehículo si existe
- Comprador: mensaje genérico

**Comportamiento**: el botón solo aparece si `lead.phone` es truthy. Al hacer click, lanza el log a `logWhatsApp` (fire-and-forget con `.catch(console.error)`) y abre `wa.me` en pestaña nueva inmediatamente — no bloquea la apertura.

### Notificación email matches CAM-34

**Decisiones clave:**

- **Umbral**: `MATCH_NOTIFICATION_THRESHOLD = 70` hardcodeado en `lib/matching/notify.ts`. La opción "configurable en ajustes admin" del backlog es P1, deferida.
- **Throttle**: 30 min por agente, persistente en `User.lastMatchEmailAt` (no in-memory, sobrevive a cold-starts de Vercel).
- **Trigger**: solo en matches `toCreate` (nuevos). Updates de score que crucen el umbral NO disparan email — coherente con el spec "trigger al crear match".
- **Destinatarios**: ambos agentes (vendedor + comprador). Si el mismo agente gestiona los dos lados, recibe un solo email. Solo agentes activos.

**Archivos:**

```
lib/email/templates/match-notification.ts  — HTML con badge de score, resúmenes vehículo/comprador, CTA
lib/email/send.ts                          — sendMatchNotification (no bloqueante, captura errores)
lib/email/client.ts                        — refactor a getResend() lazy (antes lanzaba al importar)
lib/matching/notify.ts                     — shouldThrottle (pura) + notifyHighScoreMatches
lib/matching/recalculate.ts                — llama a notifyHighScoreMatches tras los INSERT
lib/matching/notify.test.ts                — 7 tests sobre shouldThrottle
```

**`shouldThrottle(lastSentAt, now, throttleMinutes = 30)`** — función pura testable. Devuelve `false` si `lastSentAt === null` (primera vez). El umbral es exclusivo: a los 30:00.000 minutos exactos ya NO hay throttle.

**`notifyHighScoreMatches(newMatches, db)`**:

1. Filtra por score ≥ 70
2. Para cada match: lee vehicle + buyer + agentes con `Promise.all`
3. Construye `vehicleSummary` y `buyerSummary` (strings legibles)
4. Para cada agente: si activo + sin throttle → envía email + actualiza `lastMatchEmailAt = now`
5. Errores envueltos en try/catch global — nunca rompe el flujo del Server Action

### Refactor cliente Resend (CAM-34)

`lib/email/client.ts` ya no lanza al cargar el módulo. Se exporta `getResend()` que instancia el cliente lazy en la primera llamada. Razón: `lib/matching/notify.ts` importa transitivamente `lib/email/send.ts`, y los tests de Vitest no cargan `.env.local` por defecto, lo que rompía la suite.

### Vitest alias `@/` (CAM-34)

Añadido `resolve.alias` en `vitest.config.ts` apuntando `@/` a la raíz del proyecto. Permite que los tests resuelvan imports tipo `@/lib/email/send` igual que el código de producción.

### Dashboard KPIs CAM-37

**Archivos:**

```
lib/dashboard/
  queries.ts              — getSellerLeadCounts, getVehicleCounts, getBuyerLeadCounts,
                            getSalesMonthOverMonth, getProFunnel
  time-in-state.ts        — parseDestinationLabel, durationsByStateForEntity,
                            aggregateMediansByState, formatDuration
  time-in-state.test.ts   — 20 tests sobre lógica pura
app/(backoffice)/dashboard/
  page.tsx                — server component; todas las queries en Promise.all
  dashboard-filters.tsx   — client component: select de agente con persistencia ?agent= en URL
```

**KPIs mostrados:**

- 4 tarjetas arriba: total SellerLeads activos, total BuyerLeads activos, vehículos publicados, ventas del mes
- 3 columnas de distribución por estado con barras de progreso (SellerLeads / Vehicles / BuyerLeads)
- Funnel Pro: leads PRO creados → llegaron a publicado → vendidos
- 3 tablas de tiempo medio por estado (mediana, en días/horas)

**Ventas mes vs mes anterior:**
Se cuentan vía `activities` con `type = CAMBIO_ESTADO` y `content LIKE '%→ Vendido%'`. Más fiable que `vehicle.updatedAt` porque captura el momento real de la transición.

**"Llegaron a publicado" en el funnel:**
`vehicles` con `status IN (PUBLICADO, RESERVADO, VENDIDO)` — estados posteriores en la máquina de estados.

**Tiempo medio por estado:**
Calculado solo sobre estados ya transicionados (no el estado actual en curso) para evitar valores incompletos. Se parsea el `content` de las activities `CAMBIO_ESTADO` con `parseDestinationLabel` para reconstruir la secuencia.

**Filtro de agente y permisos:**

- Admin: ve el select "Todos / agente concreto" — filtra todas las queries
- Agente: el filtro se fuerza a su propio `userId`; si manipula `?agent=` en la URL, se ignora

### Páginas públicas CAM-38/39/40

#### Estructura de archivos

```
app/
  page.tsx                        — landing comercial /
  contacto/page.tsx               — información de contacto (tel/WA/email/instalaciones)
  como-funciona/page.tsx          — proceso compra/venta, 2 columnas × 4 pasos
  sobre/page.tsx                  — quiénes somos, beneficios, mapa/horario
  aviso-legal/page.tsx            — aviso legal (LSSI-CE)
  privacidad/page.tsx             — política de privacidad (RGPD)
  cookies/page.tsx                — política de cookies + tabla de cookies
components/
  public-nav.tsx                  — navbar fija compartida (todas las páginas públicas)
  public-footer.tsx               — footer compartido (todas las páginas públicas)
  legal-layout.tsx                — wrapper para páginas legales (header teal + contenido)
  cookie-banner.tsx               — banner de consentimiento de cookies (client component)
```

#### PUBLIC_PATHS en middleware.ts

`/`, `/login`, `/auth/callback`, `/vender`, `/contacto`, `/aviso-legal`, `/privacidad`, `/cookies`, `/api/valuation`, `/comprar`, `/api/chat`, `/como-funciona`, `/sobre`

El middleware usa `startsWith` — `/comprar` cubre `/comprar/[id]` y `/api/chat` cubre todas las rutas del chat. Añadir aquí cualquier nueva ruta pública; sin este paso el middleware redirige a `/login`.

#### FAQ — `<details>/<summary>` nativos

El accordion del FAQ en la landing usa HTML nativo (`<details>/<summary>`), sin librería. El efecto de rotación del chevron usa `group-open:rotate-90` de Tailwind (requiere `group` en el `<details>`). Ventaja: Server Component puro, sin JS de cliente.

#### Cookie banner — localStorage

`components/cookie-banner.tsx` es un Client Component. Guarda la preferencia en `localStorage` bajo la clave `cn_cookie_consent` (valores: `'all'` | `'essential'`). Se monta en `app/layout.tsx`. Conectado a PostHog en CAM-44.

#### Datos legales ya rellenos (CAM-46)

Los textos legales (`/aviso-legal`, `/privacidad`) ya tienen los datos reales:

- **Denominación social:** Campers Nova S.L
- **CIF:** B-22466874
- **Domicilio:** Carrer Torre de Cellers, 08150 Barcelona

No quedan badges `[PENDIENTE_*]` en las páginas legales.

### Identidad visual — logo y sistema de color

#### Logo tipográfico `components/logo-campers-nova.tsx`

El logo es tipográfico (sin PNG): Cormorant Garamond, dos líneas apiladas.

```
CAMPERS   ← peso 400, tracking 0.22em, tamaño = nova × 0.38
NOVA      ← peso 700, tracking 0.04em, tamaño controlado por --logo-nova
```

**Fuente**: `Cormorant_Garamond` cargada en `app/layout.tsx` con `next/font/google` (weights 400, 600, 700) y expuesta como `--font-cormorant`.

**Variantes de color** — prop `variant`:

- `'dark'` → `var(--cn-teal-900)` (#0a0a0a) — fondos claros (nav, footer)
- `'cream'` → `#efe9d8` — fondos oscuros (sidebar backoffice)
- `'white'` → `#ffffff` — sobre fotos o fondos muy oscuros

**Sizing responsivo via CSS custom properties**: el componente usa internamente `--logo-nova` (tamaño de "NOVA") y `--logo-campers` (tamaño de "CAMPERS"). El caller puede sobreescribirlos con Tailwind arbitrary-value classes:

```tsx
// Responsive: 24px mobile → 30px desktop (usado en public-nav.tsx)
<LogoCampersNova
  className="[--logo-nova:24px] [--logo-campers:9px] lg:[--logo-nova:30px] lg:[--logo-campers:11px]"
  variant="dark"
/>

// Tamaño fijo via prop novaSize (footer, sidebar)
<LogoCampersNova variant="dark" novaSize={24} />
<LogoCampersNova variant="cream" novaSize={20} />
```

Los defaults internos del componente son `--logo-nova: 30px` / `--logo-campers: 11px`.

**Usos actuales:**

- `components/public-nav.tsx` — responsive 24px→30px con clases Tailwind
- `components/public-footer.tsx` — fijo `novaSize={24}`
- `components/layout/sidebar.tsx` — cream, fijo `novaSize={20}`

#### Sistema de color — tokens CSS

Los tokens `--cn-*` en `app/globals.css` usan los colores de la nueva identidad (no teal/naranja). Los nombres de variables se mantienen igual para no romper componentes existentes:

| Token              | Valor nuevo             | Uso                                                |
| ------------------ | ----------------------- | -------------------------------------------------- |
| `--cn-teal-900`    | `#0a0a0a` negro         | Textos principales, fondos oscuros, CTAs primarios |
| `--cn-teal-700`    | `#584738` marrón cálido | Eyebrows, acentos secundarios                      |
| `--cn-teal-500`    | `#7a6450`               | Elementos medios                                   |
| `--cn-terra-500`   | `#b59e7d` tan acento    | CTAs secundarios, badges                           |
| `--cn-brand-cream` | `#efe9d8`               | Cream de marca (logo variant cream)                |
| `--cn-cream-100`   | `#f5f0e6`               | Fondo principal páginas públicas                   |
| `--cn-cream-50`    | `#faf7f2`               | Fondo cards                                        |

Los tokens shadcn (`--primary`, `--accent`, `--sidebar-background`) también apuntan a los nuevos valores en `app/globals.css`.

### Diseño visual páginas públicas (iteración post-sprint 5)

#### Landing `app/page.tsx` — orden de secciones y eliminaciones

Orden actual de secciones en la landing:

```
HeroSection → TrustStrip → TwoRoutes → SearchMethod → NovaAssistant →
HowItWorksSection → WhyUsPillars → SellBlock → LifestyleBanner →
PodcastSection → TestimonialsSection → FinalCta
```

Secciones eliminadas definitivamente (no restaurar):

- `WhyUsModel` — "El modelo que nos obliga a hacerlo bien."
- `InspirationSection` — banner oscuro "¿Tu camper lleva meses sin salir del garaje?"

#### Landing — componentes rediseñados

**`components/landing/lifestyle-banner.tsx`** (NUEVO):
Banner de lifestyle encima del podcast. Imagen `hero-sunset-couple.png` como fondo con overlay gradiente hacia la derecha. H2 en Fraunces blanco + CTA pill blanco → `/comprar`.

**`components/landing/sell-block.tsx`**:
Sección 2 columnas cream: izquierda imagen `sell-driver.jpg` (mujer sonriendo en camper) con card overlay de stats superpuesta + derecha checklist de 6 ítems.

**`components/landing/two-routes.tsx`** — asignación de imágenes por card:

- Card **Comprar**: `ChatGPT Image 4 may 2026, 09_39_33.png` — camper Adria en playa mediterránea con palmeras al atardecer. Gradiente terra en badge.
- Card **Vender**: `ChatGPT Image 4 may 2026, 10_04_07.png` — apretón de manos en instalaciones CampersNova. Gradiente oscuro teal.
- Ambas cards: `min-h-[440px]`, `borderRadius: 20px`, hover scale `1.03`, `fill + object-cover object-center`.

**`components/landing/podcast.tsx`**:
Imagen `podcast-studio.jpg` (640×770, portrait 5:6). Render sin recorte: `width={640} height={770} className="block h-auto w-full"` en contenedor `max-w-[460px] overflow-hidden rounded-[20px]`. No usar `fill + object-cover`.

**`components/landing/testimonials.tsx`**:
Header alineado a la izquierda (no centrado). Eyebrow: "· Quien ya viaja con nosotros". H2: "Historias reales, viajes que empiezan o terminan bien." (`max-w-[16ch]`).

**`components/landing/final-cta.tsx`**:
Card redondeada (`rounded-[28px]`) con `radial-gradient(ellipse at 50% 0%, #2e5e59, var(--cn-teal-900))`. Dos CTAs: "Quiero comprar" (terra-500) + "Quiero vender" (blanco con texto teal-900).

#### `/como-funciona` — hero cream

El hero usa fondo cream heredado del `<main>` (sin `background` explícito). H1 gigante en Fraunces: `text-[clamp(3rem,7vw,5.5rem)] leading-[1.0] tracking-[-0.03em]`, color `teal-900`, `maxWidth: '18ch'`. Eyebrow terra. Sin fondo teal oscuro.

#### `/sobre` — estructura de secciones

1. **"Instalaciones y equipo"** — grid 2 columnas texto (eyebrow terra + H2 Fraunces teal + párrafo ink-500). Sin imagen en esta sección.
2. **"Lo que nos mueve"** — 2 columnas: foto `instalaciones.jpg` (aspect 4/5, fill) + copy con lista de 5 beneficios (Check icon en círculo teal-900).
3. **"Pásate por la nave"** — 2 columnas: datos contacto/horario/dirección + iframe Google Maps.

El hero teal oscuro ("Nacimos viajando...") fue eliminado. No restaurar.

#### `/comprar` — sidebar design

**Card Esteban** (primer card): fondo `var(--cn-teal-900)`, avatar `var(--cn-terra-500)` con "E" blanco, nombre/quote en blanco, quote en Fraunces italic `rgba(255,255,255,0.85)`.

**"Por qué empezar por aquí"**: eyebrow mono uppercase terra (no `font-semibold` de heading). Checks con círculo relleno `teal-900` + SVG check blanco (no polyline simple).

**"¿Prefieres otro canal?"**: eyebrow mono uppercase terra. Items con `borderBottom: '1px solid var(--cn-line)'` entre ellos (no `gap-3`).

#### `public-nav.tsx` — estructura y decisiones

- El enlace "Saltar al contenido" (`sr-only`) fue eliminado. No restaurar.
- **Sin hamburguesa**: el menú móvil (drawer + hamburger) fue eliminado. Los links de navegación están en el footer — son suficientes para una web de marketing.
- **CTAs siempre visibles**: "Comprar" (outline) y "Vender mi vehículo" (filled tan) aparecen en todas las resoluciones. En `< sm` el botón de vender muestra "Vender" (texto corto); en `sm+` muestra "Vender mi vehículo".
- **Links de nav**: visibles solo en `lg:` (1024px+), centrales entre logo y CTAs.

### Portal comprador — chat UI y páginas de catálogo

#### Página `/comprar` — chat de captación (CAM-54)

Client Component puro (`'use client'`). Flujo de sesión:

1. El saludo (`BUYER_GREETING`) se pre-carga en `messages` en el mount — el chat aparece con texto inmediatamente sin esperar hCaptcha.
2. En **dev**: `useEffect` llama `handleCaptchaVerify('dev-bypass')` automáticamente (el widget hCaptcha no se renderiza).
   En **producción**: hCaptcha invisible → `onLoad` → `execute()` → `onVerify(token)` → `handleCaptchaVerify(token)`.
3. `handleCaptchaVerify` → `POST /api/chat/buyer/start` → recibe `sessionToken` (el greeting ya visible, no se sobreescribe).
4. Textarea habilitada solo si `sessionToken !== null`. Placeholder pre-sesión: `'Iniciando sesión segura…'`.
5. Sugerencias (`SUGGESTIONS`) visibles solo cuando `sessionToken && messages.user.length === 0`.
6. Tras cada respuesta del asistente: `GET /api/chat/buyer/status?sessionToken=...` → si devuelve `COMPLETED` o `REDIRECTED_SELLER`, actualiza `sessionStatus` y se oculta el input.

El estado de sesión vive en `sessionStatus: 'IN_PROGRESS' | 'COMPLETED' | 'REDIRECTED_SELLER'` (no se deriva del contenido de los mensajes). `isComplete` y `isRedirectedSeller` son derivadas de `sessionStatus`.

El textarea tiene placeholder dinámico — los tests E2E deben usar `getByPlaceholder('Iniciando sesión segura…')` para testar el estado pre-sesión.

#### Chat API — rutas `/api/chat/buyer/*`

```
app/api/chat/buyer/
  start/route.ts     — POST: verifica hCaptcha, rate limit 50/IP/día, crea BuyerChatSession, devuelve sessionToken + greeting
  message/route.ts   — POST: streaming Claude + tool use register_buyer_lead (crea BuyerLead en execute)
  status/route.ts    — GET ?sessionToken=...: devuelve { status, buyerLeadId } — usado por el cliente tras el stream
  complete/route.ts  — DEPRECADO: devuelve 410 Gone
lib/chat/
  system-prompt.ts   — BUYER_GREETING + system prompt del asistente (sin marcador [CONVERSATION_COMPLETE])
  tools.ts           — registerBuyerLeadSchema (Zod) + RegisterBuyerLeadArgs
```

**Rate limit**: 50 sesiones nuevas por IP por día, comprobado contra `BuyerChatSession.startedAt` en Prisma. In-process, sin Redis.

**hCaptcha en `/comprar`**: usa `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`. En dev el widget no se renderiza y el bypass es automático vía `useEffect` — el server también saltea la verificación con `NODE_ENV !== 'production'`.

#### Chat — creación BuyerLead via tool use

**Arquitectura**: el asistente invoca el tool `register_buyer_lead` (definido en `lib/chat/tools.ts`) en cuanto tiene nombre, email, teléfono y necesidad del comprador. La creación del lead ocurre en la función `execute` del tool, que corre en el servidor durante el stream (paso 1 de 2), **antes** de que llegue el texto de confirmación al cliente.

**Por qué `execute` y no `onFinish`**: con `onFinish` el lead se crearía después de que el stream termina, pero el cliente ya haría el poll de `/status` y obtendría `IN_PROGRESS`. Usando `execute`, el `$transaction` (BuyerLead + actualización sesión a `COMPLETED` + Activity) termina antes del paso 2, por lo que cuando el cliente hace el poll, `COMPLETED` ya está en la DB.

**Vercel AI SDK v6 — API relevante**:

- `tool({ inputSchema, execute })` — `inputSchema` (no `parameters`) acepta directamente el schema Zod
- `stopWhen: stepCountIs(2)` — (no `maxSteps`) paso 1: tool call; paso 2: texto de confirmación
- `onFinish(event)` — `event.totalUsage.totalTokens` para tokens agregados; `event.steps` para detectar si se invocó el tool
- No existe `maxSteps` en esta versión; usar siempre `stopWhen`

**Flujo completo**:

1. Cliente envía mensaje → `POST /api/chat/buyer/message`
2. Servidor: paso 1 — Claude llama `register_buyer_lead` con los datos capturados
3. `execute` corre: `db.$transaction` → `BuyerLead.create` + `BuyerChatSession.update(COMPLETED)` + `Activity.create`; notificación email a agentes fire-and-forget
4. Paso 2: Claude genera texto cálido de confirmación ("Un agente te contactará en 24h")
5. Stream llega al cliente; loop termina (`done: true`)
6. Cliente hace `GET /api/chat/buyer/status` → recibe `{ status: 'COMPLETED' }` → `setSessionStatus('COMPLETED')`
7. Input se oculta; se muestra bloque de confirmación

**`onFinish`** solo persiste los mensajes finales, incrementa tokens y detecta `[INTENT_VENTA]` (seller redirect, que sigue siendo texto, no tool). No crea leads.

**Notificación a agentes** (`lib/email/send.ts` → `sendBuyerChatLeadNotification`): misma estructura que `sendAgentLeadNotification` pero recibe `RegisterBuyerLeadArgs` + `agentEmails[]`. La query de agentes activos la hace el caller (`message/route.ts`) para no añadir un import de `db` al módulo de email.

#### Página `/comprar/[id]` — ficha de vehículo

RSC con `generateStaticParams` (pre-renderiza los 6 vehículos dummy). `notFound()` para slugs desconocidos → respuesta 404. Datos en `lib/dummy/vehicles.ts`.

```
lib/dummy/vehicles.ts     — tipo DummyVehicle + array DUMMY_VEHICLES (6 vehículos demo)
components/vcard.tsx       — tarjeta de vehículo enlazada a /comprar/${id}
app/comprar/[id]/page.tsx  — generateStaticParams + generateMetadata + página de detalle
```

**`DummyVehicle`** tiene: `id`, `title`, `year`, `km`, `seats`, `sleeps`, `fuel`, `transmission`, `type`, `price`, `location`, `tags`, `highlight`, `placeholder`. Es temporal — en producción se reemplazará por datos reales de Prisma.

**Diseño del detalle** (`/comprar/[id]`): grid 2fr/1fr en desktop (galería + specs / sidebar con precio y CTAs), colapsa a 1 columna en ≤1000px. Sidebar: precio en Fraunces 38px, botones "Solicitar información" y "Agendar visita", badge "Nova Assistant incluido" con fondo teal-900.

#### Páginas `/como-funciona` y `/sobre`

Server Components estáticos. Ambas en `PUBLIC_PATHS`.

- `/como-funciona`: grid 2 columnas (comprar / vender), cada columna 4 pasos numerados `01`–`04`. Números de paso como strings literales `'01'`–`'04'` (no `1`–`4`) — los tests E2E comprueban `getByText(/^0[1-4]$/)`.
- `/sobre`: hero teal + sección misión (image placeholder + 5 bullets) + bloque visita (dirección/horario/contacto + enlace Google Maps).

### E2E tests con Playwright

```
playwright.config.ts          — Chromium only, baseURL localhost:3000, reuseExistingServer en dev
e2e/public-pages.spec.ts      — 22 tests sobre 8 rutas públicas
```

**22 tests, 22 passing**. Cubre: `/` (landing, nav, navegación), `/comprar` (heading, estado pre-sesión, sidebar Esteban), `/comprar/[id]` (título/precio/specs, breadcrumb, 404, 6 vehículos demo), `/vender` (h1, tabla comparativa), `/como-funciona` (columnas, 8 pasos), `/sobre` (misión, bloque visita), `/contacto` (4 cards, link WhatsApp), legales ×3.

**Ejecutar**: `pnpm test:e2e`. Levanta `pnpm dev` automáticamente si no hay servidor en puerto 3000 (reuseExistingServer).

**Selectores clave aprendidos**:

- Nav links: scopear a `page.getByRole('navigation').first()` para evitar duplicados con el footer
- Textos ambiguos (WhatsApp, Email): scopear a `page.getByRole('main')` para excluir footer
- Placeholder dinámico en `/comprar`: usar `'Iniciando sesión segura…'` (estado pre-sesión), no el placeholder post-sesión

### Consentimiento RGPD CAM-41

**Campos en DB:** `seller_leads.gdpr_consent_at` (TIMESTAMP) + `gdpr_consent_ip` (TEXT). Solo se rellena en leads PRO (form público `/vender`). Los leads CN creados desde el backoffice NO tienen estos campos — el consentimiento es presencial/verbal.

**Flujo:**

- Zod client: `z.boolean().refine(v => v === true)` en `contactStepSchema` — bloquea el submit si no está marcado
- Server action `submitPublicLead`: guard `gdpr-consent !== 'true'` antes del captcha. IP de `x-forwarded-for` → `x-real-ip` → null
- Texto: "He leído y acepto la Política de privacidad de CampersNova. Mis datos se usarán únicamente para gestionar la tasación y posible venta del vehículo."

### Sentry CAM-43

**Archivos:**

```
sentry.client.config.ts    — browser: tracing 10% prod / 100% dev, Replay 1% sesiones / 100% errores
sentry.server.config.ts    — Node.js server: tracing 10% prod / 100% dev
sentry.edge.config.ts      — edge runtime (mismo config que server)
instrumentation.ts          — hook Next.js 14: carga server o edge config según NEXT_RUNTIME
app/global-error.tsx        — error boundary global: captureException + UI "Reintentar"
next.config.mjs             — withSentryConfig: source maps + deleteSourcemapsAfterUpload
```

**DSN único:** `NEXT_PUBLIC_SENTRY_DSN` — mismo valor para client y server. El "canal" se diferencia por el runtime, no por DSN distinto.

**Source maps en producción:**

- Requiere `SENTRY_AUTH_TOKEN` (pendiente — generar en sentry.io → Settings → Auth Tokens, scopes: `project:releases` + `org:read`)
- `deleteSourcemapsAfterUpload: true` — los source maps NO quedan expuestos en el bundle público
- Sin el token el build no falla: sube el bundle sin mapas (los errores se verán, sin línea de código exacta)

**Alerta error rate >1% (manual en Sentry UI):**
sentry.io → proyecto `campernova-crm` → Alerts → Create Alert → Metric Alert → `errors` → condición `Number of errors > 10 in 1 hour` (o usar plantilla "Error rate regression") → notificar a email del equipo

**`@sentry/cli` en `onlyBuiltDependencies`:** añadido en `package.json` para que pnpm v10 permita sus build scripts (necesario para que el webpack plugin suba source maps).

### Analytics PostHog CAM-44

**Archivos:**

```
lib/consent.ts                      — constantes CONSENT_KEY + CONSENT_EVENT (archivo neutro, no React)
components/posthog-provider.tsx     — Client Component: init PostHog, respeta consentimiento, listeners
components/cookie-banner.tsx        — dispara CustomEvent('cn:consent') al aceptar/rechazar
app/layout.tsx                      — <PostHogProvider> envuelve la app
app/vender/page.tsx                 — form_view (mount), form_step_completed (steps 1 y 2), form_submitted (redirect)
```

**Patrón de consentimiento:**

- PostHog se inicializa con `opt_out_capturing_by_default: true` — no trackea hasta obtener consentimiento
- Al cargar: lee `localStorage.cn_cookie_consent` y llama `posthog.opt_in/opt_out_capturing()`
- Mismo tab: banner despacha `CustomEvent('cn:consent', { detail: value })` → provider escucha con `window.addEventListener`
- Cross-tab: `window.addEventListener('storage')` (el storage event no se dispara en el mismo tab)
- Guard `posthog.__loaded` en el init para evitar re-inicialización en HMR/StrictMode

**Constantes en `lib/consent.ts`** (no en el componente): necesario para que Next.js Fast Refresh no haga full reload cuando `cookie-banner.tsx` (non-React consumer) importa del mismo archivo que el componente React.

**Funnel en PostHog (configuración manual):**
eu.posthog.com → Product Analytics → Funnels → New Insight → pasos: `form_view` → `form_step_completed` (step=1) → `form_step_completed` (step=2) → `form_submitted`

**Env vars necesarias:**

```
NEXT_PUBLIC_POSTHOG_KEY=phc_...     # ya en .env.local
NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com  # ya en .env.local
```

### Módulo de anuncios — P0-E

#### Arquitectura de `lib/ads/`

```
lib/ads/
  knowledge/             — 6 archivos .md: equipamiento, capacidades, modelos, pricing,
                           estructura 10 secciones, reglas por marketplace
  templates/
    sales-conditions.md  — bloque fijo "Condiciones de venta" (literal en Coches.net)
    cta.md               — "Consúltanos sin compromiso…" (literal en Coches.net)
  prompts/
    wallapop.ts          — buildWallapopSystemPrompt(knowledge) → string
    cochesnet.ts         — buildCochesnetSystemPrompt(knowledge, cta, sales) → string
  build-context.ts       — buildVehicleContext(vehicle) → JSON string para user message
  generate.ts            — generateAd({ vehicle, photoUrls, channel }) → { content, tokensUsed, model }
  download-photos.ts     — downloadVehiclePhotosZip(vehicleId) → Buffer; buildZipFilename()
  index.ts               — exports públicos
```

**Filosofía anti-alucinación**: los prompts instruccionan explícitamente a OMITIR líneas si el dato no está en la ficha, las notas del agente o las fotos. NUNCA inventar datos técnicos.

#### Carga de knowledge files

`lib/ads/generate.ts` usa `fs.readFileSync` dentro de la función `loadKnowledge()` (no en el top-level del módulo) para leer los 6 archivos `.md` de `lib/ads/knowledge/` en runtime. El path usa `process.cwd()` — funciona en Node.js (Server Actions y Route Handlers). No se puede usar en edge runtime.

#### Visión multimodal — estrategia URL + fallback base64

`generateAd` envía las fotos (top 5 por order) con `source: { type: 'url', url }`. Si la llamada falla (algunos modelos o versiones SDK no aceptan URL sources), se captura el error y se reintenta con todas las fotos descargadas a base64 (`buildBase64ImageBlocks`). El fallback es transparente para el llamador.

**Modelo por defecto**: `claude-haiku-4-5-20251001` (configurable vía `ANTHROPIC_MODEL` en `.env.local`).  
**Coste estimado**: ~$0.005–0.010 por anuncio (5 imágenes + ~3000 tokens). Negligible para un equipo de 3 agentes.

#### VehicleAd — sin único por canal, historial completo

Cada llamada a `generateVehicleAd` crea una nueva fila en `vehicle_ads` (no upsert). La ficha muestra siempre el último (`orderBy: createdAt desc, take: 1` por canal). Historial completo disponible en DB para auditoría.

#### publicNotes — autosave debounced, sin form submit

`PublicNotesEditor` guarda con debounce de 1 s usando `setTimeout` + `clearTimeout`. No usa `react-hook-form` — es un campo de texto libre sin validación. El server action `updateVehiclePublicNotes` no tiene guard de ADMIN (cualquier agente puede anotar).

#### Download ZIP — Route Handler, no Server Action

Los Server Actions no pueden devolver binarios directamente. El ZIP se sirve desde `GET /api/vendedores/[id]/photos.zip` (el `[id]` es el `sellerLeadId`, que busca el vehicle asociado). El cliente dispara la descarga con `window.location.href` para evitar bloquear el hilo UI.

#### Archivos clave — P0-E

```
lib/ads/                                        — módulo completo (ver estructura arriba)
prisma/migrations/20260504000000_add_vehicle_ads/ — migración Schema
app/(backoffice)/vendedores/[id]/
  ads-actions.ts                                — generateVehicleAd, updateVehicleAdContent,
                                                   updateVehiclePublicNotes
app/api/vendedores/[id]/photos.zip/route.ts     — descarga autenticada del ZIP
components/vehicle-ads/
  public-notes-editor.tsx                       — textarea autosave 1 s
  generate-ad-button.tsx                        — Dialog con spinner/contador/copiar/regenerar
  download-photos-button.tsx                    — trigger de descarga vía window.location
```

#### Env vars añadidas

```
ANTHROPIC_API_KEY=sk-ant-...          # ya en .env.local (usada también por chat comprador)
ANTHROPIC_MODEL=claude-haiku-4-5-20251001  # opcional; este es el default
```

### Módulo Expediente Legal (Block 4)

#### Arquitectura de `lib/vehicle-legal/`

```
lib/vehicle-legal/
  types.ts          — VehicleLegalInput, DocumentSummary, MissingRequirement, TargetStatus, ITV_WARNING_DAYS
  requirements.ts   — TASADO_MIN_PHOTOS, PUBLICADO_REQUIRED_DOCS (7 categorías), PUBLICADO_MIN_PHOTOS, DOC_LABELS
  validate.ts       — listMissingRequirements, isReadyForStatus, calculateCompletionPercent
  prisma-deps.ts    — getVehicleLegalInput(db, vehicleId), getVehicleDocumentSummary(db, vehicleId)
  index.ts          — barrel exports
  validate.test.ts  — 17 tests
```

Módulo puro sin side-effects. Las funciones de `validate.ts` no tocan Prisma — reciben `VehicleLegalInput` + `DocumentSummary[]` como datos planos. `prisma-deps.ts` hace las queries y construye esas estructuras. Mismo patrón que `lib/valuation/` y `lib/matching/`.

#### Reglas de completitud por estado

**TASADO** — requisitos mínimos:

- `plate` presente (matrícula)
- `desiredPrice` presente (precio deseado del vendedor)
- Al menos 1 foto (`photoCount ≥ 1`)

**PUBLICADO** — todo lo anterior más:

- `vin` presente (número de bastidor)
- `itvValidUntil` presente y no vencida
- `chargeCheckedAt` presente (cargas DGT verificadas)
- `purchasePrice` y `salePrice` presentes
- 7 documentos obligatorios (`PUBLICADO_REQUIRED_DOCS`): DNI_VENDEDOR, CONTRATO_COMPRAVENTA, FICHA_TECNICA, PERMISO_CIRCULACION, ITV_VIGENTE, JUSTIFICANTE_PAGO, INFORME_CARGAS_DGT
- Al menos 5 fotos (`photoCount ≥ 5`)
- Sin órdenes de taller activas (`workOrdersBlockingCount === 0`)

**ITV próxima a vencer** (< 60 días = `ITV_WARNING_DAYS`): genera `severity: 'warning'`, que NO bloquea `isReadyForStatus`. Solo `severity: 'error'` bloquea.

#### Punto de cumplimiento (completion %)

15 puntos en total: 7 campos del vehículo (plate, vin, itvValidUntil, chargeCheckedAt, purchasePrice, salePrice, desiredPrice) + 7 documentos obligatorios + 1 pack visual (≥ 5 fotos). `calculateCompletionPercent` devuelve un entero 0-100. Semáforo en `CompletionBadge`: verde ≥90%, amber 60-89%, rojo <60%.

#### Guard en `updateVehicle`

La comprobación se dispara solo cuando hay una transición real al estado objetivo:

```typescript
const isTransitioningTo = (s: string) => status === s && vehicle.status !== s
if (isTransitioningTo('TASADO') || isTransitioningTo('PUBLICADO')) { … }
```

Esto evita re-validar si el vehículo ya está en ese estado y el agente solo edita datos. Si el guard falla:

1. Loguea `PUBLICACION_BLOQUEADA` en `activities` (con la lista de errores en el `content`)
2. Devuelve el error con `formErrors` describiendo cada requisito pendiente

El `desiredPrice` del formulario (aún no guardado en DB) se fusiona con `legalInput` antes de evaluar, para que la validación de TASADO funcione incluso si el agente pone el precio por primera vez en el mismo submit.

#### Permisos por acción

| Acción                           | Rol mínimo |
| -------------------------------- | ---------- |
| Subir documento                  | AGENTE     |
| Ver documento (signed URL)       | AGENTE     |
| Editar plate/vin/ITV/titularidad | ADMIN      |
| Marcar cargas verificadas        | ADMIN      |
| Eliminar documento               | ADMIN      |

#### Bucket `vehicle-documents` — privado, URLs firmadas

A diferencia de `vehicle-photos` (público, URLs directas), los documentos legales van en el bucket `vehicle-documents` (privado). Se generan signed URLs con 1 año de expiración al subir y se almacenan en `VehicleDocument.url`. `getVehicleDocumentSignedUrl` detecta si el valor ya es una URL completa (la devuelve tal cual) o un path (regenera con 1 hora de expiración).

Path en storage: `docs/{vehicleId}/{category}_{timestamp}.{ext}` — el prefijo `docs/` distingue de otras posibles rutas en el mismo bucket.

#### Alertas del Dashboard

Las 3 consultas nuevas (`vehiclesTasadosRaw`, `vehiclesItvExpiring`, `vehiclesChargesPending`) se añaden al `Promise.all` existente. Solo ADMIN y AGENTE ven la sección "Alertas legales":

- **Expedientes incompletos**: vehículos en TASADO o PUBLICADO con `calculateCompletionPercent < 100%`. Top 5, enlace a cada ficha.
- **ITV próxima a vencer**: `itvValidUntil` entre `now` y `now + 60 días`. Top 5.
- **Cargas DGT sin verificar**: `chargeCheckedAt IS NULL` en vehículos activos (estados TASADO/PUBLICADO/RESERVADO). Top 5.

#### Archivos clave

```
prisma/migrations/20260511100000_add_vehicle_legal_docs/migration.sql
lib/vehicle-legal/                                        — módulo puro (ver arriba)
app/(backoffice)/vendedores/[id]/
  legal-actions.ts                                        — server actions
  legal-actions.test.ts                                   — 13 tests
  actions.ts                                              — guard TASADO/PUBLICADO añadido a updateVehicle
  actions.test.ts                                         — 7 tests de bloqueo
components/vehicle-legal/
  vehicle-legal-fields-form.tsx                           — formulario plate/vin/ITV/titularidad + marcar cargas
  vehicle-documents-list.tsx                              — listado 11 categorías con upload inline
  missing-for-publish-card.tsx                            — tarjeta verde/amber de requisitos pendientes
  completion-badge.tsx                                    — semáforo % expediente
app/vender/empezar/page.tsx                               — campo matrícula opcional step 1
app/vender/empezar/actions.ts                             — plate → Vehicle.plate en vehicle.create
lib/validators/seller-lead.ts                             — plate: z.string().max(20).optional() en createSellerLeadSchema
```

### Módulo Taller

Módulo de gestión de órdenes de trabajo del taller mecánico propio (Manolo). Las órdenes van ligadas a un `Vehicle` y, por tanto, a un `SellerLead`.

#### Archivos clave

```
app/(backoffice)/taller/
  page.tsx                        — listado de órdenes con filtros por estado y mecánico
  actions.ts                      — server actions: createWorkOrder, updateWorkOrderStatus,
                                     updateChecklistItem, addTimeEntry, deleteTimeEntry,
                                     addPart, deletePart, approveWorkOrder, rejectWorkOrder,
                                     updateEstimatedCost
  actions.test.ts                 — 30+ tests Vitest (166 en total con el resto)
  nueva/page.tsx                  — página "Nueva orden"
  nueva/work-order-form.tsx       — formulario de creación (client component)
  [id]/page.tsx                   — ficha con 5 tabs: Resumen / Checklist / Horas / Piezas / Costes
  [id]/work-order-tabs.tsx        — WorkOrderTabs + TabPanel (Context + CSS hidden)
  [id]/work-order-actions-bar.tsx — botones de transición de estado y aprobación CEO
  [id]/checklist-item-row.tsx     — fila de checklist: resultado + notas
  [id]/time-entry-form.tsx        — TimeEntrySection: imputar horas + tabla de entradas
  [id]/parts-section.tsx          — PartsSection: añadir piezas + tabla (solo admin borra)
```

#### Máquina de estados WorkOrder

```
PENDIENTE → EN_DIAGNOSTICO → PRESUPUESTADA → EN_CURSO → COMPLETADA
                                                       → RECHAZADA
(cualquier estado activo → RECHAZADA)
```

- `COMPLETADA` y `RECHAZADA` son terminales; no hay transiciones de salida.
- El mapa `VALID_TRANSITIONS` vive directamente en `actions.ts` (no en `lib/state-machine.ts`), ya que es la única entidad que lo usa.

#### Aprobación CEO

Si `estimatedCost > approvalLimit` al crear la orden, `approvalLevel` se pone a `REQUIERE_CEO`. La transición a `EN_CURSO` queda bloqueada en el servidor hasta que un ADMIN llame a `approveWorkOrder` (pasa a `APROBADA_CEO`). El admin también puede rechazar con `rejectWorkOrder` (pasa a `RECHAZADA_CEO`, que bloquea igualmente la transición).

`approvalLimit` por defecto: 500 €. Se puede sobreescribir en el formulario de creación.

#### Checklist inicial — 21 ítems

Se crean automáticamente al crear la orden. Tres categorías:

| Categoría    | Ítems                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------- |
| MECANICA     | Motor, Caja de cambios, Frenos, Suspensión, Neumáticos, Batería motor, ITV y documentación   |
| CAMPER       | Agua, Gas, Calefacción, Boiler, Nevera, Placas solares, Limpieza interior, Limpieza exterior |
| ELECTRICIDAD | Centralita, Inversor, Baterías auxiliares, Luces, Tomas 230V, Cargadores                     |

Cada ítem puede marcarse como `PENDIENTE | OK | NECESITA_REPARACION | NO_APLICA`.

#### Generación de VehicleCost al completar

Al pasar a `COMPLETADA`, `updateWorkOrderStatus` genera automáticamente filas en `vehicle_costs` en la misma `$transaction`:

- `MANO_OBRA_TALLER` → suma de `hours × hourlyRate` de todas las entradas de tiempo
- `PIEZAS` → suma de `quantity × unitCost` de todas las piezas

Solo se generan si el importe es > 0. Si no hay horas ni piezas, la transacción solo actualiza el estado + activity.

#### Permisos por acción

| Acción               | Rol mínimo |
| -------------------- | ---------- |
| Crear orden          | AGENTE     |
| Cambiar estado       | AGENTE     |
| Actualizar checklist | AGENTE     |
| Imputar horas        | AGENTE     |
| Borrar horas propias | AGENTE     |
| Borrar horas ajenas  | ADMIN      |
| Añadir piezas        | AGENTE     |
| Borrar piezas        | ADMIN      |
| Aprobar/rechazar CEO | ADMIN      |

#### WorkOrderTabs — patrón Context + TabPanel

**Problema resuelto**: el patrón render-prop (`children: (activeTab) => ReactNode`) falla en navegación client-side con App Router porque las funciones no son serializables en el payload RSC. Al hacer `router.push('/taller/{id}')` tras crear una orden, `children` llegaba como `null` al cliente → `TypeError: Cannot read properties of null (reading 'get')`.

**Solución**: `WorkOrderTabs` expone un `TabContext` y un componente `TabPanel`. Cada panel llama `useContext(TabContext)` y se oculta con la clase CSS `hidden` — no hay funciones en el árbol de props, todo es serializable.

```tsx
// page.tsx (Server Component)
<WorkOrderTabs>
  <TabPanel tab="resumen">...</TabPanel>
  <TabPanel tab="checklist">...</TabPanel>
  ...
</WorkOrderTabs>
```

No usar `return null` en `TabPanel` para ocultar — causaría hidratación incorrecta entre SSR (que renderiza todo) y la navegación cliente. CSS `hidden` es la forma correcta.

#### Activity log

Cada acción relevante crea una fila en `activities` con `sellerLeadId` del vehículo asociado (no existe `workOrderId` en la tabla `activities`). Tipos usados: `ORDEN_TALLER_CREADA`, `ORDEN_TALLER_COMPLETADA`, `ORDEN_TALLER_RECHAZADA`, `ORDEN_TALLER_APROBADA`, `CAMBIO_ESTADO`.

#### `build` script — `prisma generate`

`package.json` incluye `"build": "prisma generate && next build"` para garantizar que el cliente Prisma se regenera en cada deploy de Vercel, independientemente de si `node_modules` está cacheado.

### Módulo Entregas

Gestión del proceso de entrega física del vehículo al comprador. Las entregas se crean manualmente desde el backoffice cuando se formaliza la venta.

#### Archivos clave

```
app/(backoffice)/entregas/
  page.tsx                      — listado con filtro de estado
  actions.ts                    — createDelivery, updateDeliveryStatus,
                                   updateChecklistItem, signDelivery
  nueva/page.tsx                — carga vehículos (PUBLICADO/RESERVADO) + compradores + usuarios
  nueva/new-delivery-form.tsx   — formulario de creación (client component)
  [id]/page.tsx                 — ficha con 4 tabs: Resumen / Checklist / Documentos / Firma
  [id]/delivery-tabs.tsx        — DeliveryTabs + TabPanel (Context + CSS hidden, mismo patrón que taller)
  [id]/checklist-section.tsx    — grupos por categoría, progreso done/total
  [id]/sign-form.tsx            — firma nombre + DNI; "Completar entrega" si canComplete
lib/email/templates/
  delivery-confirmation.ts      — email HTML al comprador con fecha y datos de entrega
```

#### Máquina de estados Delivery

```
PROGRAMADA → EN_CURSO → COMPLETADA
           ↘          → CANCELADA
             CANCELADA (directo desde PROGRAMADA)
```

- `COMPLETADA` y `CANCELADA` son terminales.
- Al pasar a `COMPLETADA`: `createWarrantyForDelivery` crea la `Warranty` + 2 `PostventaFollowup` (DIA_7, DIA_30) en la misma transacción. Si falla, el cambio de estado se revierte.

#### Checklist de entrega — 10 ítems

| Categoría    | Ítems                                                                      |
| ------------ | -------------------------------------------------------------------------- |
| PRE_ENTREGA  | Documentación en regla, Revisión técnica, Limpieza, Depósito, Llaves extra |
| EXPLICACION  | Funcionamiento eléctrico, Gas y agua, Calefacción, Conducción básica       |
| FIRMA_SALIDA | Contrato firmado                                                           |

Cada ítem: `PENDIENTE | COMPLETADO | NO_APLICA`. `canComplete = pendingChecklist === 0 && isSigned` (ningún ítem en `PENDIENTE` + entrega firmada).

#### Firma digital simplificada

No hay firma PNG. Se captura nombre completo + DNI del receptor → `delivery.signedByName`, `delivery.signedByDni`, `delivery.signedAt`. Es requisito para completar la entrega.

#### Campo `Vehicle.type` vs `BuyerLead.vehicleType`

El modelo `Vehicle` tiene `type VehicleType` (nombre de campo: `type`). El campo `vehicleType` pertenece a `BuyerLead`. Un campo incorrecto en un `select` de Prisma provoca que TypeScript rechace el `include` entero, haciendo que todas las relaciones anidadas aparezcan como `undefined`. Siempre usar `type: true` al seleccionar el tipo de vehículo en `Vehicle`.

### Módulo Postventa

Gestión de garantías, tickets de incidencia y follow-ups post-entrega. Las garantías se crean automáticamente al completar una entrega — no se crean manualmente.

#### Archivos clave

```
lib/postventa/
  create-warranty.ts          — createWarrantyForDelivery: Warranty + 2 Followups en $transaction
  impute-ticket-cost.ts       — imputeTicketCostToVehicle: crea VehicleCost desde costReal del ticket
  extend-warranty.ts          — extendWarranty: amplía desde extendedTo o endDate
  *.test.ts                   — 4 tests por archivo (12 total)
app/(backoffice)/postventa/
  page.tsx                    — listado de garantías con tickets recientes + follow-ups pendientes
  actions.ts                  — changeTicketStatus, setTicketCost, createTicket, extendWarranty
  followup-actions.ts         — recordFollowupResponse
  [id]/page.tsx               — ficha: info garantía + extend (ADMIN) + tickets + follow-ups
  [id]/create-ticket-form.tsx — toggle botón → formulario inline
  [id]/ticket-card.tsx        — TicketCard (expandible: estado + costes) + FollowupCard (respuesta)
app/api/cron/
  postventa-followups/route.ts — GET diario 09:00 UTC; procesa followups PENDIENTE → ENVIADO/FALLIDO
lib/email/templates/
  ticket-opened.ts            — email admin para tickets ALTA/CRITICA
```

#### Lifecycle garantía

```
Delivery → COMPLETADA
  └→ createWarrantyForDelivery
       ├→ Warranty (startDate = completedAt, endDate = +12 meses)
       ├→ PostventaFollowup DIA_7  (scheduledFor = completedAt + 7d)
       └→ PostventaFollowup DIA_30 (scheduledFor = completedAt + 30d)

PostventaFollowup.status: PENDIENTE → ENVIADO → RESPONDIDO
                                    ↘ FALLIDO (error al enviar)
```

#### Máquina de estados Ticket

```
ABIERTO → EN_PROGRESO → RESUELTO → CERRADO
        ↘ ANULADO ←──────────────↗ (desde cualquier estado activo)
EN_PROGRESO ← RESUELTO (reapertura)
```

`CERRADO` y `ANULADO` son terminales. Al cerrar un ticket con `costReal > 0`: `imputeTicketCostToVehicle` crea `VehicleCost` tipo `GARANTIA` en la misma transacción.

#### Cron job — follow-ups automáticos

`vercel.json` ejecuta `GET /api/cron/postventa-followups` diariamente a las 09:00 UTC.

- **Auth**: `Authorization: Bearer $CRON_SECRET` (solo validado en producción; en dev cualquier request pasa)
- **Lógica**: busca `PostventaFollowup` con `status = PENDIENTE` y `scheduledFor ≤ now`; por cada uno envía email HTML al comprador; actualiza a `ENVIADO` o `FALLIDO`
- **Respuesta**: `{ sent, failed, total }`

```
CRON_SECRET=...   # openssl rand -hex 32; añadir en Vercel como variable de entorno
```

#### Ampliación de garantía

Solo ADMIN. `extendWarranty(warrantyId, months)` extiende desde `extendedTo` (si ya fue ampliada antes) o desde `endDate` (primera ampliación). Guarda `extendedAt = now`. Sin límite de ampliaciones. Opciones UI: +6, +12, +24 meses.

#### Notificación tickets prioritarios

`sendTicketOpenedNotification` se llama en `createTicket` cuando `priority === 'ALTA' || priority === 'CRITICA'`. Notifica en paralelo a todos los admins activos (`role === 'ADMIN'`). No bloqueante (`.catch(console.error)`).

### Dashboard Financiero Block 5 — decisiones técnicas

#### `lib/dashboard/metrics.ts` — arquitectura

- Todas las funciones toman `database: PrismaClient` y `filter: DashboardFilter` (mismo patrón que `queries.ts`).
- `getStockHistorySnapshot` usa `unstable_cache` con `revalidate: 300` (5 min). Usa `db` del singleton directamente (no como param) para poder ser envuelta por `unstable_cache` (requiere función sin argumentos).
- La función raw SQL genera una serie de meses con `generate_series` y hace LEFT JOIN con `vehicles` para aproximar el stock histórico mes a mes. Es una aproximación: cuenta vehículos cuyo `created_at < fin_de_mes` y que no estaban `VENDIDO/DESCARTADO` antes de iniciar ese mes (usando `updated_at >= mes_inicio`). No es 100% precisa pero es funcional para el gráfico de tendencia.
- `getStagnantVehicles` usa `updatedAt` como proxy de "cuándo cambió el estado por última vez". Es una aproximación válida para la mayoría de casos. En el futuro se puede mejorar leyendo el último `CAMBIO_ESTADO` de activities.

#### recharts — integración

- `StockEvolutionChart` y `VehiclesPerCommercial` son `'use client'` (recharts requiere DOM APIs).
- Dual Y-axis en `StockEvolutionChart`: eje izquierdo en € (formateado en k€), eje derecho en unidades.
- Colores: teal `hsl(177, 31%, 23%)` para barras de valor/stock, naranja `hsl(24, 78%, 45%)` para la línea de conteo y barras de publicados — consistentes con la paleta Campernova.
- **Formatter del Tooltip**: el prop `formatter` de recharts recibe `value: ValueType` (no `number`). Siempre castear con `Number(value)` antes de formatearlo con `EUR.format()`. Tiparlo como `(value: number)` directamente rompe el build de Vercel.

#### Tooltips informativos en el dashboard

`components/info-tooltip.tsx` — componente reutilizable `'use client'`:

```tsx
<InfoTooltip text="Explicación..." side="top" maxWidth={260} />
```

- Usa `@radix-ui/react-tooltip` (instalado vía `npx shadcn@latest add tooltip`).
- Icono `Info` de lucide-react (h-3.5 w-3.5, color `text-muted-foreground/60`).
- `delayDuration={200}` — aparece con un pequeño delay para no molestar al navegar.
- `maxWidth` configurable via CSS custom property `--tooltip-max-w` (default 260px).
- Para usarlo en un card, envolver el label en `<div className="flex items-center gap-1">` con el `<InfoTooltip>` al lado.
- Para usarlo en un `<CardTitle>`, añadir `flex items-center gap-1.5` al className del título.
- Todos los tooltips del dashboard tienen `side="right"` en los `CardTitle` y `side="top"` (default) en los KPI inline.

#### TypeScript + Vercel — iteración de Set y Map

El `tsconfig.json` usa un target que no permite el spread de iteradores (`...new Set()`, `[...map.values()]`). El build local con `tsc --noEmit` muestra el warning pero Next.js dev lo ignora; Vercel lo trata como error y falla el build.

**Regla**: nunca usar spread en `Set` ni en `Map.values()`. Usar siempre `Array.from()`:

```typescript
// ❌ rompe en Vercel
const ids = [...new Set(arr)]
const vals = [...map.values()]

// ✅ correcto
const ids = Array.from(new Set(arr))
const vals = Array.from(map.values())
```

#### Permisos por sección

| Sección                          | ADMIN | AGENTE | TALLER | ENTREGAS | MARKETING |
| -------------------------------- | ----- | ------ | ------ | -------- | --------- |
| Resumen operativo                | ✓     | ✓      | ✓      | ✓        | ✓         |
| Resumen financiero               | ✓     | —      | —      | —        | ✓         |
| Stock y rotación                 | ✓     | ✓      | —      | ✓        | ✓         |
| Operativas (alertas+dist+funnel) | ✓     | ✓      | ✓      | ✓        | ✓         |
| Análisis avanzado (gráficos)     | ✓     | —      | —      | —        | —         |
| Vehículos estancados             | ✓     | ✓      | —      | ✓        | ✓         |
| Tiempo medio por estado          | ✓     | ✓      | ✓      | ✓        | ✓         |

### Ficha Vendedor — diseño Block 6

#### Estructura de layout

```
<div className="-mx-6 -mt-6 flex min-h-full flex-col">
  <header>                  ← sticky top-0 z-20 h-[73px]
  <section>                 ← hero (identity + KPI bar + tabs), no sticky
    <div className="-mx-10">  ← tabs con margen negativo para flush-edge
  <div grid grid-cols-[1fr_360px]>   ← body
    <div>                   ← main content p-8 pb-16
    <aside>                 ← 360px, border-l
      <div sticky top-[130px]>  ← sidebar widgets
```

El `top-[130px]` de la sidebar es la suma aproximada de topbar (73px) + tabs (~48px) + pequeño gap. Si se añaden más elementos sticky encima, ajustar este valor.

#### Dark gradient card — próxima acción

```tsx
<div style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #2a221c 100%)' }}>
  {/* Glow blob */}
  <div style={{ background: 'var(--sidebar-primary)', filter: 'blur(40px)' }}
       className="absolute right-[-40px] top-[-40px] h-[140px] w-[140px] rounded-full opacity-40" />
```

- Color eyebrow: `#b59e7d` (tan brand, `--cn-terra-500`)
- Botón primario: `background: '#b59e7d'`, texto negro
- Botón secundario: `background: rgba(255,255,255,0.08)`, `border: 1px solid rgba(255,255,255,0.15)`, texto blanco

#### KPI bar — grid vs flex

El diseño usa `grid-cols-[repeat(5,1fr)_auto]` para que las 5 columnas de métricas sean exactamente iguales independientemente del contenido. La columna `auto` final es el link "Estado". En el diseño anterior era `flex min-w-0 flex-1` — el grid es más predecible.

#### Status ring del avatar

El avatar de 84px tiene `border-4` + color dependiendo del estado del lead:

- `CERRADO` → `border-green-500 bg-green-600`
- `DESCARTADO` → `border-red-400 bg-slate-500`
- `EN_NEGOCIACION` → `border-amber-400 bg-foreground`
- Resto → `border-sidebar-primary/30 bg-foreground`

#### Tabs flush-edge

Las tabs usan `<div className="-mx-10">` para compensar el `px-10` de la sección hero y quedar alineadas a los bordes de la pantalla (igual que en el diseño).

### Ficha Comprador — diseño Block 7

#### Estructura de layout

Idéntica a la ficha vendedor pero `defaultTab="ficha"` (no `"resumen"`):

```
<div className="-mx-6 -mt-6 flex min-h-full flex-col">
  <header>                  ← sticky top-0 z-20 h-[73px]
  <section>                 ← hero (identity + KPI strip + tabs), no sticky
  <div grid grid-cols-[1fr_360px]>   ← body
    <div>                   ← main content p-8 pb-16 (contenido del tab activo)
    <aside>                 ← 360px, border-l, siempre visible
      <div sticky top-[130px]>  ← ProximaAccionCard + asignación + preferencias + resumen
```

#### KPI strip comprador — 4 columnas

A diferencia del vendedor (5 KPIs + estado), el comprador tiene 4: Canal, Presupuesto, Días pipeline, Vehículos sugeridos. No hay columna de "Margen" ni "Vehículo".

#### Sidebar comprador — widgets

- **Próxima acción**: `ProximaAccionCard` con texto contextual según estado (NUEVO="Contactar al comprador", CUALIFICADO="Presentar vehículos match", etc.)
- **Asignación**: mismo widget que vendedor
- **Preferencias**: card con pills de tipo vehículo, plazas mínimas, presupuesto máximo, zona de uso, plazo de compra
- **Resumen**: canal (badge CN/PRO/CHAT), días en pipeline, última actividad, nº matches

#### Tab Postventa en ficha comprador

Muestra la garantía si `lead.warranty` existe (relación directa via `delivery.buyerLeadId`). La query en `page.tsx` usa:

```ts
include: {
  warranty: {
    include: {
      tickets: { where: { status: { notIn: ['CERRADO', 'ANULADO'] } }, orderBy: { createdAt: 'desc' }, take: 5 },
    },
  },
}
```

Progress bar de vigencia: `daysElapsed / totalDays * 100%`, color verde/amber/rojo según % restante.

### Patrón ProximaAccionCard (RSC → Client Component)

**Problema**: el sidebar dark card necesita `onClick` para llamar `logWhatsApp()` antes de abrir WhatsApp. En un RSC no hay event handlers.

**Solución**: extraer la card completa a un `'use client'` component (`proxima-accion-card.tsx`) dentro de la carpeta `[id]/` de cada ficha. El RSC pasa los datos como props; el cliente gestiona el evento.

**Patrón general**: cuando un widget del sidebar de una ficha RSC necesite interactividad, crear `{nombre}-card.tsx` con `'use client'` en la carpeta `[id]/`, no convertir la página entera.

```tsx
// page.tsx (RSC) — solo pasa datos, sin lógica
;<ProximaAccionCard phone={lead.phone} leadId={lead.id} leadName={lead.name} status={lead.status} />

// proxima-accion-card.tsx ('use client') — gestiona eventos
function handleWhatsApp() {
  logWhatsApp({ leadId, leadType: 'buyer', phone }).catch(console.error)
  window.open(
    buildWhatsAppUrl(phone, buyerWhatsAppMessage(leadName)),
    '_blank',
    'noopener,noreferrer'
  )
}
```

**Texto próxima acción por estado** (`ProximaAccionCard` de compradores):

```ts
const NEXT_ACTION_TEXT: Record<string, string> = {
  NUEVO: 'Contactar al comprador',
  CONTACTADO: 'Cualificar sus necesidades',
  CUALIFICADO: 'Presentar vehículos match',
  EN_NEGOCIACION: 'Cerrar la operación',
  CERRADO: 'Coordinar la entrega',
  PERDIDO: 'Revisar si reactivar',
}
```

### Patrón TopbarActions (Archive + MoreHorizontal)

Los botones Archive y MoreHorizontal del topbar de ambas fichas viven en `{buyer|seller}-topbar-actions.tsx` (`'use client'`).

**Archive** — Dialog de confirmación con `useTransition`:

```tsx
function handleArchive() {
  startTransition(async () => {
    const result = await archiveBuyerLead(leadId) // o archiveSellerLead
    if (!result.error) {
      setArchiveOpen(false)
      router.refresh()
    }
  })
}
```

- Deshabilitado cuando `isTerminal`. La página RSC calcula `isTerminal` y lo pasa como prop:
  - Comprador: `!BUYER_LEAD_TRANSITIONS[lead.status as BuyerLeadStatus]` (sin entradas en el mapa de transiciones)
  - Vendedor: `!nextLeadStatuses.length` (array de estados siguientes vacío)

**MoreHorizontal** — `DropdownMenu` shadcn con 3 ítems:

1. "Copiar enlace" → `navigator.clipboard.writeText(window.location.href)`
2. "Abrir en nueva pestaña" → `window.open(window.location.href, '_blank', 'noopener,noreferrer')`
3. (Opcional, solo si no terminal) "Marcar como perdido" / "Descartar" → abre el mismo Dialog del Archive

**Archivos:**

```
app/(backoffice)/compradores/[id]/
  buyer-topbar-actions.tsx     — BuyerTopbarActions
  proxima-accion-card.tsx      — ProximaAccionCard (comprador)
app/(backoffice)/vendedores/[id]/
  seller-topbar-actions.tsx    — SellerTopbarActions
  proxima-accion-card.tsx      — ProximaAccionCard (vendedor)
```

### `archiveSellerLead` y `archiveBuyerLead` server actions

Ambas en las respectivas `actions.ts` de cada ficha. Patrón idéntico:

1. `requireAgente()` — auth guard
2. `findUnique` con `select: { status }` — verificar que existe
3. `isValidTransition(transitions, lead.status, terminalStatus)` — guard máquina de estados (evita archivar lo ya archivado)
4. `$transaction`: `update(status)` + `activity.create(CAMBIO_ESTADO)`
5. `revalidatePath(ficha)` + `revalidatePath(listado)`

Terminal state: `PERDIDO` para BuyerLead, `DESCARTADO` para SellerLead.

### `LeadTabNav` — prop `defaultTab`

Antes el componente tenía hardcodeado `?? 'resumen'` como tab por defecto. Añadida prop `defaultTab?: string` (default `'resumen'`) para que compradores pueda usar `'ficha'` como su primer tab.

```tsx
// vendedores/[id]/page.tsx
<LeadTabNav tabs={tabs} />  // defaultTab='resumen' por defecto

// compradores/[id]/page.tsx
<LeadTabNav tabs={tabs} defaultTab="ficha" />
```

### Tabs URL-driven en ficha comprador

El RSC de la ficha de comprador lee `searchParams.tab` y renderiza el contenido condicionalmente:

```tsx
// page.tsx (RSC)
export default async function Page({ searchParams }: { searchParams: { tab?: string } }) {
  const activeTab = searchParams.tab ?? 'ficha'
  // ...
  return (
    <>
      <LeadTabNav tabs={tabs} defaultTab="ficha" />
      {activeTab === 'ficha' && <BuyerLeadEditForm ... />}
      {activeTab === 'actividad' && <NoteForm ... />}
      {activeTab === 'matches' && <MatchesSection ... />}
      {activeTab === 'postventa' && (warranty ? <WarrantyCard ... /> : <EmptyState />)}
      {activeTab === 'documentos' && <EmptyState ... />}
    </>
  )
}
```

El sidebar (ProximaAccionCard, asignación, preferencias, resumen) está **fuera** del condicional de tabs — siempre visible.

### Listado Vendedores — diseño Block 8 (v2)

La v2 abandona el visual system cream/brand y adopta exactamente el mismo diseño que `/compradores`. La tabla ya no es un Client Component separado — está inline en el RSC.

#### Visual system (v2)

| Elemento        | Valor                                             |
| --------------- | ------------------------------------------------- |
| Fondo página    | `#fff`                                            |
| Bordes          | `#e2e8f0`                                         |
| Texto principal | `#0a0a0a`                                         |
| Texto muted     | `#64748b`                                         |
| Header height   | `h-[73px]` sticky                                 |
| Tabla           | Grid inline en RSC, sin `<table>` element         |
| Grid cols       | `'32px 2fr 1.6fr 2.2fr 1.5fr 1fr 1fr 1.1fr 60px'` |

#### Pipeline strip (v2)

```tsx
// CSS Grid: columna "Total" (auto) + 6 etapas (1fr cada una) + columna "Sin tasar" (auto)
<div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(6,1fr) auto' }}>
```

Barras de progreso normalizadas con `pipelineMax = Math.max(...stages.map(s => s.count), 1)`. CUALIFICADO se muestra como "Tasado". La última columna es "Sin tasar".

**Separador visual**: `borderLeft: '1px solid #e6dfd0'` entre columnas.

#### CUALIFICADO → "Tasado" en UI

```typescript
const PIPELINE_STAGES = [
  { key: 'CUALIFICADO', label: 'Tasado', color: '#0891b2' }, // relabel solo en display
]
const STATUS_LABELS: Record<string, string> = { CUALIFICADO: 'Tasado' /* ... */ }
```

El DB enum permanece `CUALIFICADO`. Solo cambia la cadena mostrada en UI.

#### Columna TASACIÓN — lógica

```typescript
const valuationMin = Number(vehicle.valuationMin)
const valuationMax = Number(vehicle.valuationMax)
const desiredPrice = Number(vehicle.desiredPrice)
const hasValuation = !!vehicle.valuationRecommended
const overpriced = hasValuation && desiredPrice > 0 && desiredPrice > valuationMax * 1.15
// Sin tasación: dashed "— Sin tasar"
// Con tasación: "{formatK(min)}k – {formatK(max)}k" en verde
// Sobreprecio: pill amber + "⚠ sobreprecio"
```

`formatK(n)` = `Math.round(n / 1000)`.

#### Vehicle type badges

CAMPER → `bg #eff6ff`/`text #2563eb`. AUTOCARAVANA → `bg #f5f3ff`/`text #7c3aed`. Otro → slate. Badge muestra `{brand} {model}`.

#### Canal display (v2)

| DB value | Display          | Color           |
| -------- | ---------------- | --------------- |
| `CN`     | `BACKOFFICE`     | slate `#64748b` |
| `PRO`    | `FORMULARIO WEB` | amber `#d97706` |

#### Avatar gradient

```typescript
function getAvatarGradient(name: string): string {
  const gradients = [
    'from-blue-500 to-indigo-600',
    'from-violet-500 to-purple-600',
    'from-teal-500 to-cyan-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
  ]
  return gradients[(name.charCodeAt(0) ?? 0) % 5]
}
```

#### Row flags (v2)

```typescript
const lastAct = activities[0]?.createdAt ?? createdAt
const daysSince = Math.floor((Date.now() - new Date(lastAct).getTime()) / 86400000)
const isTerminal = ['CERRADO', 'DESCARTADO'].includes(status)
// Rojo #dc2626 si >7d, amber #d97706 si >2d, null si terminal o reciente
```

Flag: `borderLeft: '3px solid {color}'` en la fila. Cálculo en el RSC.

#### Vistas guardadas (v2)

```typescript
const SAVED_VIEWS = [
  { key: 'todos', label: 'Todos' },
  { key: 'mis-leads', label: 'Mis leads' },
  { key: 'sin-asignar', label: 'Sin asignar' },
  { key: 'necesitan-accion', label: 'Necesitan acción' },
  { key: 'sin-tasar', label: 'Sin tasar' }, // nuevo en v2
]
```

Filtro `sin-tasar`: `OR: [{ vehicle: null }, { vehicle: { valuationRecommended: null } }]`.

#### Chip filters (v2) — `<label>` + `<select>` overlay

```tsx
<label className="relative cursor-pointer">
  <span className={isActive ? chipActive : chipBase}>{displayLabel}<ChevronDownIcon /></span>
  <select className="absolute inset-0 cursor-pointer opacity-0" value={currentValue}
    onChange={(e) => push({ key: e.target.value === '__all__' ? '' : e.target.value })}>
    <option value="__all__">Todos</option>
    {options.map(...)}
  </select>
</label>
```

Chips: Búsqueda (form `onSubmit`), Estado (dot coloreado), Marca, Precio máx., Agente, Limpiar, Ordenar.

#### "Necesitan acción" — query Prisma

```typescript
db.sellerLead.count({
  where: {
    status: { notIn: TERMINAL_STATUSES },
    activities: { none: { createdAt: { gte: twoDaysAgo } } },
  },
})
```

Incluye leads sin ninguna actividad nunca.

#### Archivos clave — Block 8 v2

```
app/(backoffice)/vendedores/
  page.tsx                    — RSC: pipeline + 11 queries + tabla inline + TASACIÓN col
  leads-filters.tsx           — Client: chips <label>+<select> (Estado/Marca/Precio/Agente/Ordenar)
  seller-leads-table.tsx      — Obsoleto (no importado). Mantenido por referencia.
```

#### CANAL_OPTIONS — solo CN y PRO

El enum `LeadCanal` en Prisma solo tiene `CN` y `PRO`. El valor `CHAT` no existe. En `leads-filters.tsx` y en la query de `page.tsx`, usar siempre solo estos dos valores.

## Pendientes externos

- 🔲 Verificar dominio `campersnova.com` en Resend → Domains (DNS records) — CAM-18 y CAM-19 ya funcionales en sandbox; necesario para enviar desde `info@campersnova.com` en producción
- ✅ Identidad legal — Campers Nova S.L · B-22466874 · Carrer Torre de Cellers, 08150 Barcelona (ya en aviso-legal y privacidad)
- ✅ Número de teléfono/WhatsApp — actualizado a `645 63 91 85` / `wa.me/34645639185` en todo el proyecto
- ✅ Extensión `vector` activa en Supabase (hecho en CAM-7)
- ✅ Deploy Vercel — `campernova-crm.vercel.app` activo, env vars subidas, Supabase Auth URLs configuradas
- 🔲 Conectar dominio real `campersnova.com` en Vercel (DNS + HTTPS)
- 🔲 `SENTRY_AUTH_TOKEN` — generar en sentry.io y añadir en Vercel (source maps en producción)
- 🔲 Alerta error rate >1% en Sentry UI — configurar tras conectar el dominio real
- 🔲 `CRON_SECRET` — generar con `openssl rand -hex 32` y añadir en Vercel para activar auth del cron de follow-ups en producción
