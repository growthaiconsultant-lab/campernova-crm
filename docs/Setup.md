# Setup Claude Code — Campernova CRM

Guía operativa para arrancar el desarrollo. Sigue los pasos en orden. Tiempo estimado: medio día (4-5h) bien aprovechadas.

---

## 1. Servicios externos a crear (antes de tocar código)

Ten todo esto listo antes de abrir Claude Code. Te ahorras horas de bloqueos después.

| Servicio | Para qué | Tier | Tiempo |
|---|---|---|---|
| **GitHub** | Repo del proyecto | Free | 2 min |
| **Vercel** | Deploy + previews | Hobby | 5 min |
| **Supabase** | Postgres + Auth + Storage + pgvector | Free al inicio, Pro cuando lances ($25/mes) | 10 min |
| **Resend** | Emails transaccionales | Free hasta 3k/mes | 10 min (verificar dominio) |
| **Sentry** | Error monitoring | Developer (free) | 5 min |
| **Plausible** o **PostHog** | Analytics web | Plausible $9/mes / PostHog free | 5 min |
| **hCaptcha** o **Cloudflare Turnstile** | Captcha del form público | Free | 5 min |
| **Dominio** | campersnova.com (o el que decidas) apuntando a Vercel | — | 30 min para propagar DNS |

**Pendientes a resolver fuera de tickets:**
- Identidad legal del operador (autónomo / S.L.) para los avisos legales — habla con tu gestor esta semana
- Confirmar nombre comercial: "Campernova" vs "Campersnova" (la web actual usa la segunda forma)
- Logo y tipografía: extraer de campersnova.com o pedir versión limpia

---

## 2. Skills a tener activas en Claude Code

De las que ya tienes instaladas, estas son las que vas a usar de verdad para Campernova. No instales más por ahora.

**Para planificación y producto (las que ya hemos usado):**
- `product-management:write-spec` — para specs de features grandes en cada nueva fase (v2, v3)
- `product-management:roadmap-update` — para reorganizar prioridades cuando aparezcan cosas nuevas
- `product-management:product-brainstorming` — cuando estés atascado en un diseño (matching v2, embeddings, etc.)
- `product-management:write-spec` — para subspecs por épica si las necesitas

**Para diseño y UX:**
- `design:ux-copy` — el form `/vender` es crítico para conversión, vas a iterar copy varias veces
- `design:design-critique` — cuando tengas un mockup o pantalla y quieras feedback
- `design:accessibility-review` — revisión a11y antes del lanzamiento (sprint 5)

**Para datos:**
- `data:write-query` — para SQL de reports, dashboard, exports
- `data:explore-data` — cuando tengas datos reales y quieras explorar comportamientos

**Para documentos:**
- `anthropic-skills:docx` — informes a inversores o stakeholders
- `anthropic-skills:pptx` — pitch deck si toca presentar a partners
- `anthropic-skills:pdf` — generar PDFs de contratos en el futuro

**No instales todavía** (las verás aparecer pero ignóralas):
- Brand voice plugin completo — para v2 cuando tengas marca consolidada
- Otros skills de PM más allá de los listados

---

## 3. MCPs / Conectores a configurar

Orden estricto de prioridad. Instala solo cuando los necesites — no satures el contexto.

### Día 1 (imprescindibles)

| MCP | Para qué | Notas |
|---|---|---|
| **GitHub** | Que Claude Code pueda leer el repo, abrir PRs, gestionar issues | Token con scope `repo` |
| **Linear** o **Notion** | Donde vas a tener el backlog y tracking | Recomendación: **Linear** (rápido, dev-friendly, free para 1-10 users). Importa el backlog de este doc directamente |
| **Supabase / Postgres MCP** | Para que Claude consulte el esquema y haga migraciones más fluidas | Connection string read-only para queries, write para migraciones manuales |

### Semana 2

| MCP | Para qué |
|---|---|
| **Vercel** | Deploys, logs de runtime, env vars |
| **Resend** (si tiene MCP, si no via API) | Diseñar templates desde Claude |

### Semana 4

| MCP | Para qué |
|---|---|
| **Slack** | Notificaciones internas + canal con los agentes para feedback post-launch |

### Más adelante (no antes)

- **WhatsApp Business / Twilio** — solo cuando vayas a la API real (P1, después del MVP)
- **Stripe** — si decides cobrar la comisión digitalmente
- **Google Drive / Box** — si manejas docs administrativos del cambio de titularidad

---

## 4. Estructura sugerida del repo

```
campernova-crm/
├── app/
│   ├── (public)/              # Landing, /vender, /contacto, legal
│   │   ├── page.tsx
│   │   ├── vender/
│   │   ├── contacto/
│   │   └── (legal)/
│   ├── (backoffice)/          # Todo lo que requiere auth
│   │   ├── layout.tsx         # Sidebar + topbar + middleware
│   │   ├── dashboard/
│   │   ├── vendedores/
│   │   ├── compradores/
│   │   ├── vehiculos/
│   │   ├── matches/
│   │   └── ajustes/
│   ├── api/                   # Webhooks, jobs
│   └── login/
├── components/
│   ├── ui/                    # shadcn
│   ├── forms/
│   ├── lead/
│   └── shared/
├── lib/
│   ├── db.ts                  # Prisma client
│   ├── supabase.ts            # Supabase clients
│   ├── auth.ts                # Helpers de sesión
│   ├── email.ts               # Wrapper Resend
│   ├── valuation/             # Algoritmo tasación
│   ├── matching/              # Algoritmo matching
│   └── validators/            # Zod schemas
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── tests/
│   ├── unit/
│   └── e2e/
├── public/
└── docs/                      # Mete aquí PRD, Roadmap, Backlog para que Claude Code los lea
    ├── PRD.md
    ├── Roadmap.md
    └── Backlog.md
```

---

## 5. Plan de día 1 con Claude Code

Cuando abras Claude Code en el repo recién creado, este es el orden óptimo de las primeras horas:

### Hora 1 — Contexto y arquitectura
1. Crea `docs/` y mete los 3 documentos generados (PRD, Roadmap, Backlog).
2. Crea `CLAUDE.md` en la raíz con un resumen ultra-corto del proyecto y referencias a `docs/`.
3. Pídele: "Lee `docs/PRD.md` y `docs/Backlog.md`. Empezamos por el sprint 1. Tu primera tarea es CAM-001: scaffold del proyecto."

### Hora 2-3 — Sprint 1 tickets CAM-001 a CAM-003
- Scaffold Next.js + Tailwind + shadcn
- Configurar Supabase (esto es manual en su dashboard, Claude Code te guía)
- Definir Prisma schema completo a partir del PRD sección 7

### Hora 4 — Auth y layout
- Implementar magic link
- Layout con sidebar y theme

**Regla de oro:** después de cada ticket, haz commit y push. Vercel preview URL te valida que todo sigue funcionando.

---

## 6. CLAUDE.md sugerido (raíz del repo)

```markdown
# Campernova CRM

CRM interno para gestionar la compraventa de autocaravanas y campers semi-nuevas.

## Stack
- Next.js 14 (App Router) + TypeScript
- Supabase (Postgres + Auth + Storage + pgvector)
- Prisma ORM
- Tailwind + shadcn/ui
- Vercel (deploy)
- Resend (email)
- Sentry (monitoring)

## Documentos clave
- `docs/PRD.md` — qué construimos y por qué
- `docs/Roadmap.md` — plan por sprints
- `docs/Backlog.md` — tickets ordenados, IDs CAM-XXX

## Convenciones
- Server Components por defecto, Client Components solo cuando necesario
- Server Actions para mutaciones, no API routes salvo webhooks
- Validación con Zod en client + server
- Estados como enums en Prisma + types compartidos
- Tests: Vitest para lógica, Playwright para flujos
- No introducir librerías sin discutirlo

## Reglas de trabajo
- Cada sesión: pregúntame en qué ticket trabajamos antes de empezar
- Commits pequeños y atómicos, mensaje en imperativo
- Haz preguntas si algo del PRD no es claro, no inventes requisitos
- Si modificas el schema, genera migración y actualiza el seed si aplica
```

---

## 7. Convenciones de tickets en Linear

Si usas Linear (recomendado):

- **Project:** "Campernova CRM v1"
- **Workflows:** Backlog → Todo → In Progress → In Review → Done
- **Labels:** `frontend`, `backend`, `infra`, `legal`, `bug`, `quick-win`
- **Priority:** Urgent / High / Medium / Low (mapea a P0/P1/P2)
- **Cycles:** semanal, alineado a los 5 sprints
- **Estimación:** puntos de Fibonacci 1-2-3-5-8 (no horas, te das cuenta de que estimas mal y se ajusta solo)

Importar el backlog: copia los tickets de `Backlog-Campernova-CRM-v1.md` directamente. Linear soporta markdown en bulk import.

---

## 8. Checklist final antes de empezar

Antes de la primera línea de código, deberías poder marcar todo esto:

- [ ] Repo creado en GitHub
- [ ] Vercel conectado al repo
- [ ] Supabase project creado, env vars copiadas
- [ ] Resend cuenta lista (la verificación de dominio puede tardar, hazlo ya)
- [ ] Sentry project creado
- [ ] Linear/Notion con el backlog importado
- [ ] PRD, Roadmap y Backlog metidos en `docs/` del repo
- [ ] `CLAUDE.md` creado en la raíz
- [ ] Identidad legal en marcha con tu gestor
- [ ] Decisión final del nombre comercial (Campernova vs Campersnova)
- [ ] Acceso al diseño/colores de campersnova.com (al menos screenshots)

Cuando todo esté en verde, abres Claude Code y le dices:

> "Lee `docs/PRD.md`, `docs/Roadmap.md`, `docs/Backlog.md` y `CLAUDE.md`. Estamos en sprint 1, ticket CAM-001. Vamos."

Y a partir de ahí, todo va a ser mucho más fluido.
