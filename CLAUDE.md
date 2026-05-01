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
- **Supabase**: proyecto `campersnova-crm` en Frankfurt (eu-central-1), pgvector pendiente de activar
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

## Pendientes externos (no bloqueantes para sprint 1)

- Registrar dominio `campersnova.com` y verificar DNS en Resend
- Identidad legal del operador (autónomo / S.L.) para los avisos legales
- Activar extensión `vector` en Supabase: `CREATE EXTENSION IF NOT EXISTS vector;`
