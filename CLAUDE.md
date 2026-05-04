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
- Modelo de negocio: comisión 4% sobre venta (intermediación, no propiedad del vehículo)
- Equipo: 3 agentes comerciales + 1 admin (Joel)
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

## Estado actual (sprint 4 COMPLETADO ✅ — sprint 5 pendiente)

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

#### `public-nav.tsx` — enlace skip eliminado

El enlace "Saltar al contenido" (`<a href="#main-content" className="sr-only ...">`) fue eliminado. No restaurar.

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

## Pendientes externos

- 🔲 Verificar dominio `campersnova.com` en Resend → Domains (DNS records) — CAM-18 y CAM-19 ya funcionales en sandbox; necesario para enviar desde `info@campersnova.com` en producción
- ✅ Identidad legal — Campers Nova S.L · B-22466874 · Carrer Torre de Cellers, 08150 Barcelona (ya en aviso-legal y privacidad)
- ✅ Número de teléfono/WhatsApp — actualizado a `645 63 91 85` / `wa.me/34645639185` en todo el proyecto
- ✅ Extensión `vector` activa en Supabase (hecho en CAM-7)
- ✅ Deploy Vercel — `campernova-crm.vercel.app` activo, env vars subidas, Supabase Auth URLs configuradas
- 🔲 Conectar dominio real `campersnova.com` en Vercel (DNS + HTTPS)
- 🔲 `SENTRY_AUTH_TOKEN` — generar en sentry.io y añadir en Vercel (source maps en producción)
- 🔲 Alerta error rate >1% en Sentry UI — configurar tras conectar el dominio real
