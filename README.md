# Campernova CRM

CRM interno de **CampersNova** (Campers Nova S.L) para gestionar la compraventa de autocaravanas y campers seminuevas en régimen de depósito-venta: captación de vendedores y compradores, tasación automática, matching, expediente legal del vehículo, taller, entregas, postventa/garantías y un portal público con asistente de chat.

> **Stack**: Next.js 14 (App Router) · TypeScript · Supabase (Postgres + Auth + Storage + pgvector) · Prisma · Tailwind + shadcn/ui · Vercel · Resend · Sentry · PostHog · hCaptcha.

Documentación relacionada: [`ARCHITECTURE.md`](ARCHITECTURE.md) · [`CONTRIBUTING.md`](CONTRIBUTING.md) · [`CHANGELOG.md`](CHANGELOG.md) · [`docs/`](docs/) (PRD, Roadmap, Backlog, ADRs) · `CLAUDE.md` / `AGENTS.md` (memoria operativa para agentes IA).

---

## Quick start

Requisitos: **Node ≥ 20**, **pnpm 10** (`corepack enable` o `npm i -g pnpm`).

```bash
# 1. Instalar dependencias
pnpm install

# 2. Configurar variables de entorno
cp .env.example .env.local        # rellena los valores reales (ver § Entornos)
grep -E "^(DATABASE_URL|DIRECT_URL)" .env.local > .env   # Prisma CLI lee .env

# 3. Generar el cliente Prisma y sembrar datos
pnpm prisma generate
pnpm seed                          # usuarios + precios de referencia (idempotente)

# 4. Arrancar
pnpm dev                           # http://localhost:3000
```

La app pública está en `/`; el backoffice requiere login (magic link) en `/login`.

---

## Scripts

| Script               | Qué hace                                              |
| -------------------- | ----------------------------------------------------- |
| `pnpm dev`           | Servidor de desarrollo (Next.js)                      |
| `pnpm build`         | `prisma generate && next build` (build de producción) |
| `pnpm start`         | Sirve el build de producción                          |
| `pnpm typecheck`     | `tsc --noEmit` (chequeo de tipos)                     |
| `pnpm lint`          | `next lint` (ESLint)                                  |
| `pnpm format`        | Prettier sobre todo el repo                           |
| `pnpm test`          | Tests unitarios (Vitest)                              |
| `pnpm test:watch`    | Vitest en watch                                       |
| `pnpm test:coverage` | Cobertura de tests                                    |
| `pnpm test:e2e`      | Tests end-to-end (Playwright)                         |
| `pnpm seed`          | Siembra usuarios + precios de referencia              |

---

## Calidad y flujo de trabajo

Flujo **trunk-based** con PRs y CI. Detalle completo en [`CONTRIBUTING.md`](CONTRIBUTING.md).

- **Hooks locales (husky)**: `pre-commit` (eslint+prettier sobre staged) · `commit-msg` (Conventional Commits vía commitlint) · `pre-push` (`typecheck` + `test`).
- **CI (GitHub Actions)**: el workflow `quality` (`.github/workflows/ci.yml`) corre `typecheck + lint + test` en cada push a `main` y en todos los PR. `main` está protegida: exige `quality` en verde.
- **E2E** (`.github/workflows/e2e.yml`): autenticado contra staging, lanzable a mano o nightly; no bloquea el merge.

---

## Entornos

| Entorno         | Contexto           | Base de datos        | URL                                 |
| --------------- | ------------------ | -------------------- | ----------------------------------- |
| **Development** | local (`pnpm dev`) | Supabase staging     | http://localhost:3000               |
| **Preview**     | cualquier PR       | Supabase **staging** | preview-\*.vercel.app (auto por PR) |
| **Production**  | `main`             | Supabase **prod**    | campernova-crm.vercel.app → dominio |

Cada PR genera un **Preview de Vercel** que pega contra **staging**, de modo que las migraciones y los cambios se prueban sin tocar producción.

### Variables de entorno

`.env.example` es la fuente de verdad (se commitea, sin secretos). Cópialo a `.env.local`.

**Difieren por entorno** (staging vs prod): `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`.

**Compartidas**: `ANTHROPIC_API_KEY`, `RESEND_API_KEY` (+ `EMAIL_FROM`), `HCAPTCHA_*`, `CRON_SECRET`, `SENTRY_*`, `NEXT_PUBLIC_POSTHOG_*`.

En **Vercel** las variables se configuran con _scope_ por entorno: Production → Supabase prod; Preview → Supabase staging.

---

## Estructura

```
app/
  (auth)/            login + callback de auth
  (backoffice)/      CRM protegido (dashboard, vendedores, compradores, taller, entregas, postventa, …)
  api/               route handlers (chat, cron, webhooks)
  vender/ comprar/   portal público (formulario vendedor + chat comprador)
  …                  landing y páginas legales
components/          UI (shadcn/ui, landing, dashboard, dominio)
lib/                 lógica de negocio pura (valuation, matching, postventa, vehicle-legal, ads, margin, dashboard, email, chat, supabase, validators)
prisma/             schema, migraciones y seed
e2e/                tests Playwright
docs/               PRD, Roadmap, Backlog, ADRs
```

Mapa detallado de módulos y flujos en [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## Servicios externos

GitHub (`growthaiconsultant-lab/campernova-crm`) · Vercel · Supabase (Frankfurt, eu-central-1) · Resend · Sentry · PostHog (EU) · hCaptcha · Linear. Detalle y estado en `CLAUDE.md` § "Servicios externos".

## Licencia

Privado — © Campers Nova S.L. Todos los derechos reservados.
