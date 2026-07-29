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
- **Reparto Claude ↔ Codex:** si se usa el plugin de OpenAI Codex, sigue `docs/governance/claude-codex-division.md` — Claude conduce las decisiones (clasificar C0–C9, invariantes, tests, observabilidad, revisión del diff, validación post-despliegue); Codex ejecuta el cambio mínimo ya planificado. El reparto NO relaja el gobierno: los criterios de bloqueo y la validación por categoría aplican igual. Nunca delegar a Codex la clasificación de riesgo, concurrencia crítica (C6), autorización (C5), migraciones (C4), secretos/PII, ni el merge.

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

> ⚠️ **Estado VIGENTE del programa I3 (coordinación de escritores):** I3A, I3B, I3C1A, I3C1B, I3C2 e
> **I3C3** están **fusionados y desplegados**. I3C3 (compleción coordinada) se fusionó por squash
> (`ae88e31`), está en producción (Vercel) y **validado técnicamente** (CI de `main` verde con
> integración PostgreSQL 17 de carreras reales; postflight read-only de prod **sin incoherencias**;
> `offer_id NOT NULL` en prod; `/entregas` carga autenticado). **Sin migración.**
> `completeDeliveryTx` adopta `withLockedRoots` (relee y valida checklist/firma **bajo el lock**,
> cierra Match/Buyer, Vehicle→VENDIDO + `soldAt`, Warranty + 2 follow-ups, todo atómico; **admite leads
> archivados** sin reactivar; **no reversible**). La **edición de checklist** (`updateChecklistItemTx`)
> y la **firma** (`writeSignatureTx`) entran en el MISMO protocolo de root locks
> (`lib/delivery-precondition.ts`): relean bajo el lock y rechazan en estados terminales, **cerrando el
> TOCTOU checklist/firma↔compleción end-to-end** (sin ventana residual; carreras demostradas con
> PostgreSQL real). **Validación autenticada END-TO-END del flujo: LIMITADA POR 0 DELIVERIES** en prod
> (no se crearon datos ficticios; deuda registrada en `docs/roadmap/i3-status.md`). **I3D** (descarte)
> e **I3E** (tasación) siguen **pendientes** — **I3 NO está completo**. Con I3C3 hay **8 callers
> productivos** de `withLockedRoots` (verificar contra código; PR #117 añade 3 callers más de
> archivado/calendario → 11 en `main`). `LEAD_ARCHIVED` **ya es
> productivo** (no depende de PR #117; #117 solo añade las _acciones_ de archivar/reactivar, **ya
> FUSIONADO** por squash `fb501ef` tras auditoría+corrección — 6/6 blockers serializados; **y
> DESPLEGADO en producción vía `4382774`** (`4382774` ⊇ `fb501ef`, diff docs-only; `target=production`
> READY, alias `campersnova.com`; sin migración; postflight read-only sin incoherencias, 0 archivados →
> vacuo). El deployment específico de `fb501ef` fue un fallo transitorio puntual, resuelto por el
> siguiente push de `main`. **Validación mutante en producción y UX de visibilidad: pendientes.**).
> **Fuente de verdad navegable:** dominio →
> `docs/domain/delivery-lifecycle.md`; estado del programa → `docs/roadmap/i3-status.md`; locking →
> `docs/adr/0009-root-lock-coordination.md`; migraciones → `docs/governance/database-migrations.md`.
> Las notas técnicas de los bloques inferiores son un **log histórico por fase** y no reflejan
> necesariamente el estado actual.

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

## Historial de bloques anteriores

El log detallado de los bloques 1–22 (secciones "Estado previo") se movió a [docs/historical/crm-block-log.md](docs/historical/crm-block-log.md) para reducir el tamaño de este archivo. Consúltalo cuando necesites contexto sobre decisiones tomadas antes del Block 23.

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
