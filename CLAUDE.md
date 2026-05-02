# Campernova CRM

CRM interno para gestionar la compraventa de autocaravanas y campers semi-nuevas en CampersNova.

## Identidad confirmada

- Marca comercial: **CampersNova**
- Dominio: `campersnova.com`
- Email contacto: `info@campersnova.com`
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
- **Vercel**: conectado al repo (proyecto se crea con primer push)
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

## Estado actual (inicio sprint 2)

### Sprint 1 — COMPLETADO ✅

- ✅ **CAM-6** — Repo, scaffold Next.js 14, Vercel, pre-commit hooks
- ✅ **CAM-7** — Supabase configurado: pgvector activo, buckets `vehicle-photos` y `lead-documents` con RLS, clientes Next.js en `lib/supabase/`
- ✅ **CAM-8** — Schema Prisma completo, migración aplicada en Supabase, `lib/db.ts`
- ✅ **CAM-9** — Auth magic link + middleware de protección de rutas
- ✅ **CAM-10** — Layout backoffice + theme Campernova (sidebar teal + topbar con usuario/logout)
- ✅ **CAM-11** — Seed: Joel (ADMIN) + Esteban (AGENTE) + Joui (AGENTE). Ejecutar con `pnpm seed`

### Sprint 2 — EN CURSO

- 🔲 **CAM-12** — Form SellerLead + Vehicle en backoffice (canal CN)
- 🔲 **CAM-13** — Subida de fotos con drag&drop
- 🔲 **CAM-14** — Listado de SellerLeads
- 🔲 **CAM-15** — Ficha SellerLead editable
- 🔲 **CAM-16** — Form público `/vender` (canal Pro)
- 🔲 **CAM-17** — Captcha en form público
- 🔲 **CAM-18** — Email confirmación al vendedor (Resend)
- 🔲 **CAM-19** — Notificación al agente cuando entra lead
- 🔲 **CAM-20** — Asignación/reasignación manual de agente

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

### shadcn/ui

- Inicializado con base `zinc`, CSS variables, RSC habilitado.
- Componentes instalados hasta sprint 1: `button`, `avatar`, `dropdown-menu`, `separator`.
- Añadir nuevos con: `npx shadcn@latest add <componente>`

### Supabase Auth — URLs permitidas

- `http://localhost:3000/auth/callback` (local dev)
- `https://campernova-crm.vercel.app/auth/callback` (producción)
- `https://campernova-crm-*-growthaiconsultant-8035s-projects.vercel.app/auth/callback` (preview deploys)

## Pendientes externos

- 🔲 Registrar dominio `campersnova.com` y verificar DNS en Resend — **bloqueante para CAM-18/19**
- 🔲 Identidad legal del operador (autónomo / S.L.) para los avisos legales
- ✅ Extensión `vector` activa en Supabase (hecho en CAM-7)
- 🔲 Añadir env vars de producción en Vercel — dejar para CAM-46 (primer deploy)
