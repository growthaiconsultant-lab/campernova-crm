# Sprint 1 — Sesión 1: Cierre y handoff

**Proyecto:** Campernova CRM  
**Sprint:** 1 de 5  
**Sesión:** 1  
**Fecha:** 1 de mayo de 2026  
**Tickets trabajados:** CAM-001 (completado) + configuración MCPs  
**Estado al cierre:** ✅ CAM-001 cerrado · 🟡 MCPs configurados, pendientes de verificar

---

## 1. Qué se hizo en esta sesión

### CAM-001 — Scaffold Next.js 14 + stack base ✅

El repositorio arranca ahora con toda la fontanería lista para empezar a escribir código de producto sin fricciones:

| Qué                  | Detalle                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Framework**        | Next.js 14.2.35 (App Router, sin `src/`, `app/` en raíz)                                                        |
| **Lenguaje**         | TypeScript 5 con `strict: true`                                                                                 |
| **Package manager**  | pnpm                                                                                                            |
| **UI base**          | shadcn/ui — estilo `default`, color base `zinc`, CSS custom properties activadas                                |
| **Estilos**          | Tailwind CSS v3 con todos los tokens de shadcn (incluyendo sidebar) + `tailwindcss-animate`                     |
| **Linting**          | ESLint (`next/core-web-vitals` + `next/typescript` + `prettier` para neutralizar conflictos)                    |
| **Formato**          | Prettier con `prettier-plugin-tailwindcss` — single quotes, sin semicolon, trailing comma `es5`, printWidth 100 |
| **Pre-commit hooks** | husky v9 + lint-staged → ESLint fix + Prettier write antes de cada commit                                       |
| **Line endings**     | `.gitattributes` (`* text=auto eol=lf`) + `.editorconfig` — LF forzado en Windows                               |
| **Node target**      | `.nvmrc` fijado a `20`                                                                                          |

**Archivos clave creados:**

```
campernova-crm/
├── app/
│   ├── globals.css          # tokens CSS zinc (light + dark) para todos los componentes shadcn
│   ├── layout.tsx           # metadata, lang="es", body antialiased
│   └── page.tsx             # placeholder Sprint 1
├── lib/
│   └── utils.ts             # cn() helper (clsx + twMerge)
├── components/              # vacío, listo para shadcn add <component>
│   ├── forms/
│   ├── lead/
│   ├── shared/
│   └── ui/
├── tests/
│   ├── unit/
│   └── e2e/
├── .claude/
│   ├── settings.json        # plantilla MCP sin secretos (commiteado)
│   └── settings.local.json  # tokens reales (gitignored)
├── .editorconfig
├── .gitattributes
├── .eslintrc.json
├── .nvmrc
├── .prettierrc
├── components.json          # configuración shadcn/ui
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

**Decisiones técnicas tomadas durante la implementación:**

- **`pnpm` obligatorio** — `create-next-app` se ejecutó vía `npx` (no `pnpm dlx`) porque `pnpm dlx create-next-app` falla con `ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND` en directorio ya inicializado. El scaffold se hizo en `/tmp/campernova-next` y se movió manualmente para evitar el bloqueo de "directorio no vacío" de `create-next-app`.
- **`tailwindcss-animate` importado como ES module** — el pre-commit hook rechazó el `require()` inicial por la regla `@typescript-eslint/no-require-imports`. Se corrigió con `import tailwindcssAnimate from 'tailwindcss-animate'`.
- **Tokens CSS completos desde el día 1** — se incluyeron los tokens de `sidebar` en `globals.css` para no tener que volver cuando se construya el layout en CAM-005.

**Estado del repo al cierre:**

```
branch: main
commits:
  b2b8d62  fix: corregir configuración de MCPs
  2b3341b  chore: configurar MCPs de Supabase y Linear a nivel de proyecto
  7f00797  chore: align commit author with Vercel team owner
  38f58f5  feat(cam-001): scaffold Next.js 14 + stack base
  daa73b9  docs: initial project scaffold with PRD, roadmap, backlog and configuration
```

Todo pusheado a `growthaiconsultant-lab/campernova-crm`. Vercel detectará el `package.json` y creará el proyecto automáticamente en el siguiente push a main (o ya lo habrá hecho con el `feat(cam-001)` commit).

---

### MCPs del proyecto — configurados 🟡

Se configuraron dos MCP servers a nivel de proyecto (no global) para que cualquier sesión de Claude Code en este repo los cargue automáticamente.

| MCP        | Paquete npm correcto                   | Para qué                                             |
| ---------- | -------------------------------------- | ---------------------------------------------------- |
| `supabase` | `@supabase/mcp-server-supabase@latest` | Inspeccionar schema, ejecutar SQL, gestionar Storage |
| `linear`   | `mcp-linear@latest`                    | Crear tickets, actualizar estados, consultar backlog |

> ⚠️ **El paquete correcto de Linear es `mcp-linear`**, no `@linear/mcp-server` (ese no existe en npm y devuelve 404).

**Arquitectura de configuración:**

```
.claude/
├── settings.json         # commiteado — plantilla con tokens vacíos (""), solo documenta la estructura
└── settings.local.json   # gitignored — tokens reales + permissions allow[]
```

`settings.local.json` ya tiene los tokens reales rellenados:

- **Supabase PAT:** `sbp_ba1...` (generado en supabase.com/dashboard/account/tokens)
- **Linear API key:** `lin_api_GrO...` (generado en linear.app/campersnova/settings/api)

**Estado:** configurados pero **no verificados todavía** — los MCP servers solo se cargan al arrancar Claude Code, no en caliente. Requieren un reinicio para activarse.

---

## 2. Estado pendiente: verificar MCPs

Antes de empezar CAM-002, hay que confirmar que los dos MCPs responden correctamente.

### Pasos para verificar en la próxima sesión

1. **Cierra Claude Code completamente** (no solo el panel, sino el proceso completo).
2. **Vuelve a abrirlo** en el directorio `C:\Users\Asus\Code\campernova-crm`.
3. **Al arrancar**, Claude Code debería mostrar en la inicialización que cargó los MCP servers `supabase` y `linear`.
4. Pídele a Claude: _"Verifica que los MCPs están funcionando — intenta listar las tablas de Supabase y el workspace de Linear"_.
5. Si ambos responden, los MCPs están listos. Si falla alguno, revisa la sección de troubleshooting más abajo.

### Troubleshooting MCPs

**Si los tools de Supabase/Linear no aparecen:**

1. Abre un terminal en el repo y ejecuta:
   ```bash
   npx -y @supabase/mcp-server-supabase@latest --project-ref bbmglaatlyilxutzomxd
   # Debe responder con un error de protocolo MCP, no un 404 — eso confirma que el paquete existe
   ```
2. Confirma que `.claude/settings.local.json` tiene los tokens reales (no los strings vacíos de `settings.json`).
3. Comprueba que `settings.local.json` está en `.gitignore` (así debe ser — no se commitea).
4. Si los tools aparecen en ToolSearch pero con schema vacío, es el problema de "deferred tools" — usa `ToolSearch` con `select:` para cargar el schema antes de llamarlos.

**Si el token de Supabase da 401:**

- Regenera el PAT en [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) y actualiza `settings.local.json`.

**Si el token de Linear da error de auth:**

- Regenera la API key en [linear.app/campersnova/settings/api](https://linear.app/campersnova/settings/api) y actualiza `settings.local.json`.

---

## 3. Tickets restantes del Sprint 1

Una vez verificados los MCPs, el orden de ejecución es:

### CAM-002 — Configurar Supabase (Postgres + Auth + Storage)

**Dependencias:** MCPs verificados (para ejecutar SQL desde Claude Code)

**Qué hacer:**

1. **Activar pgvector** — en el SQL Editor de Supabase ejecutar:

   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

   (O que Claude Code lo ejecute vía MCP Supabase)

2. **Crear buckets de Storage:**
   - `vehicle-photos` — público, solo agentes pueden subir
   - `lead-documents` — privado, solo agentes pueden leer/escribir

3. **Configurar Storage RLS policies** para ambos buckets.

4. **Instalar y configurar el cliente Supabase en Next.js:**

   ```bash
   pnpm add @supabase/supabase-js @supabase/ssr
   ```

   - `lib/supabase/server.ts` — cliente para Server Components y Server Actions
   - `lib/supabase/client.ts` — cliente para Client Components
   - `lib/supabase/middleware.ts` — helper para el middleware de auth

5. **Añadir env vars a Vercel** — las mismas que están en `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
   - `DATABASE_URL`
   - `DIRECT_URL`

**Acceptance criteria:**

- `pgvector` habilitado (verificar con `SELECT * FROM pg_extension WHERE extname = 'vector'`)
- Buckets `vehicle-photos` y `lead-documents` creados con políticas correctas
- `import { createClient } from '@/lib/supabase/server'` funciona sin errores de tipo

---

### CAM-003 — Schema Prisma completo + primera migración

**Dependencias:** CAM-002 (DATABASE_URL configurado)

**Qué hacer:**

1. Instalar Prisma:

   ```bash
   pnpm add prisma @prisma/client --save-dev
   pnpm prisma init
   ```

2. Definir el schema completo con todos los modelos del PRD:
   - `User` (roles: ADMIN, AGENT)
   - `SellerLead` (estados: NEW, CONTACTED, QUALIFIED, NEGOTIATING, CLOSED, LOST)
   - `Vehicle` (estados: NEW, VALUED, PUBLISHED, RESERVED, SOLD, DISCARDED)
   - `VehiclePhoto`
   - `Valuation`
   - `BuyerLead` (estados: NEW, CONTACTED, QUALIFIED, NEGOTIATING, CLOSED, LOST)
   - `Match` (estados: SUGGESTED, PROPOSED, VISIT, OFFER, CLOSED, REJECTED)
   - `Activity`
   - `Document`
   - `ReferencePrice`

3. Aplicar migración:

   ```bash
   pnpm prisma migrate dev --name init
   ```

4. Crear `lib/db.ts` con singleton del Prisma Client.

**Acceptance criteria:**

- Migración aplicada en Supabase sin errores
- `import { prisma } from '@/lib/db'` funciona
- `pnpm typecheck` pasa limpio
- `pnpm prisma studio` abre y muestra todas las tablas

---

### CAM-004 — Auth con magic link y roles

**Dependencias:** CAM-002 + CAM-003

**Qué hacer:**

1. Crear `app/login/page.tsx` — formulario con campo email + botón "Enviar enlace".
2. Server Action `sendMagicLink(email)` usando Supabase Auth.
3. Callback de auth en `app/auth/callback/route.ts` que sincroniza usuario en tabla `User` (crea fila si es la primera vez).
4. Middleware `middleware.ts` en raíz que:
   - Protege todas las rutas de `/app` (o `/dashboard`)
   - Redirige a `/login` si no hay sesión
   - Refresca la sesión en cada request
5. Helpers en `lib/auth.ts`:
   - `requireAuth()` — lanza error si no hay sesión
   - `requireAdmin()` — lanza error si no es ADMIN

**Acceptance criteria:**

- Joel puede entrar con su email vía magic link
- Sin sesión, cualquier ruta del backoffice redirige a `/login`
- `requireAdmin()` lanza 403 si el usuario es AGENT

---

### CAM-005 — Layout backoffice + theme CampersNova

**Dependencias:** CAM-004

**Qué hacer:**

1. Visitar [campersnova.com](https://campersnova.com) y extraer la paleta de colores principal (naranja/verde característico).
2. Actualizar las CSS custom properties en `globals.css` con los colores reales de la marca.
3. Construir `app/(dashboard)/layout.tsx` con:
   - **Sidebar** — logo CampersNova + 6 secciones: Dashboard, Vendedores, Compradores, Vehículos, Matches, Ajustes
   - **Topbar** — avatar del usuario, email, botón de logout
   - **Breadcrumbs** — componente reutilizable
4. Páginas placeholder (`page.tsx` mínima) en cada sección del sidebar.

**Acceptance criteria:**

- Sidebar navega correctamente entre las 6 secciones
- Topbar muestra el email del usuario logueado
- Logout funciona y redirige a `/login`
- Paleta visual es reconociblemente CampersNova

---

### CAM-006 — Seed: 3 agentes + 1 admin

**Dependencias:** CAM-004 (auth creado, tabla User existe)

**Qué hacer:**

1. Crear `prisma/seed.ts`.
2. El seed invoca Supabase Auth Admin API para crear los 4 usuarios:
   - `joel@campersnova.com` — rol ADMIN
   - `agente1@campersnova.com` — rol AGENT
   - `agente2@campersnova.com` — rol AGENT
   - `agente3@campersnova.com` — rol AGENT
3. Añadir script al `package.json`:
   ```json
   "seed": "ts-node prisma/seed.ts"
   ```
4. Añadir configuración en `package.json` para que `pnpm prisma db seed` funcione.

**Acceptance criteria:**

- `pnpm prisma db seed` crea los 4 usuarios sin errores
- Cada uno puede recibir y usar un magic link
- Joel ve todos los usuarios en la sección Ajustes (aunque solo sea lista)

---

## 4. Estado global del Sprint 1

| Ticket  | Descripción                                    | Estado                                   |
| ------- | ---------------------------------------------- | ---------------------------------------- |
| CAM-001 | Scaffold Next.js 14 + stack base               | ✅ Completado                            |
| MCPs    | Supabase + Linear a nivel de proyecto          | 🟡 Configurados, pendientes de verificar |
| CAM-002 | Supabase: pgvector + Storage + cliente Next.js | ⏳ Siguiente                             |
| CAM-003 | Prisma: schema completo + migración            | ⏳ Pendiente                             |
| CAM-004 | Auth: magic link + roles + middleware          | ⏳ Pendiente                             |
| CAM-005 | Layout backoffice + theme CampersNova          | ⏳ Pendiente                             |
| CAM-006 | Seed: 3 agentes + 1 admin                      | ⏳ Pendiente                             |

**Al cerrar CAM-006, el Sprint 1 estará completo** y el Sprint 2 puede arrancar con CAM-101 (formulario de captación de vendedor).

---

## 5. Cómo arrancar la próxima sesión

1. **Abre Claude Code** en `C:\Users\Asus\Code\campernova-crm` (reinicio limpio para cargar MCPs).
2. **Pídele a Claude** que verifique los MCPs antes de nada:
   > _"Verifica que los MCPs de Supabase y Linear están funcionando"_
3. Si ambos responden correctamente, di:
   > _"Arrancamos con CAM-002"_
4. Claude leerá `CLAUDE.md` automáticamente, así que no necesitas re-explicar el proyecto.

---

_Documento generado al cierre de la Sesión 1 del Sprint 1 · 1 de mayo de 2026_
