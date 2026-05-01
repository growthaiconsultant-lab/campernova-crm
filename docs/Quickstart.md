# Quickstart Campernova — De cero a tu primer sprint

Receta paso a paso para arrancar. Sigue el orden. Marca cada casilla a medida que la completas. **Plan realista:** secciones 0 a 4 las haces hoy y mañana, sección 5 (la primera sesión real con Claude Code) la atacas pasado mañana o el lunes.

---

## Sección 0 — Decisiones que tienes que cerrar (sin código, ~30 min)

Estas no las puede hacer Claude Code por ti. Bloquean todo lo demás.

- [ ] **Nombre comercial definitivo:** decide entre "Campernova" o "Campersnova". A partir de aquí, todo (dominio, marca, contratos, ficha de Google, etc.) usa ese nombre.
- [ ] **Dominio principal:** verifica que tienes acceso a `campersnova.com` (o registra el definitivo en Namecheap, IONOS o GoDaddy — ~10-15€/año).
- [ ] **Email principal del proyecto:** elige uno (sugerencia: `hola@campersnova.com` o `joel@campersnova.com`). Lo configurarás cuando verifiques dominio en Resend.
- [ ] **Llamada al gestor:** inicia el trámite de identidad legal (autónomo o S.L.). No bloquea desarrollo, sí bloquea el lanzamiento de sprint 5.

---

## Sección 1 — Crear cuentas externas (~1-2 horas, en paralelo)

Las puedes crear todas en paralelo. Para cada una, **guarda credenciales en un gestor de contraseñas** (1Password, Bitwarden) o en una nota segura.

### Repositorio y deploy
- [ ] **GitHub** — github.com (si no tienes cuenta). Activa 2FA.
- [ ] **Vercel** — vercel.com/signup. Sign up con tu cuenta de GitHub. No crees el proyecto todavía, lo conectarás cuando exista el repo.

### Backend y datos
- [ ] **Supabase** — supabase.com/dashboard
  - Crear proyecto: nombre `campernova-crm`
  - Región: **Frankfurt (eu-central-1)** — más cerca de España
  - Plan Free al inicio
  - Apunta: URL del proyecto, **anon key**, **service role key** (Settings → API)
  - En el SQL Editor, ejecuta una vez: `CREATE EXTENSION IF NOT EXISTS vector;`

### Email transaccional
- [ ] **Resend** — resend.com
  - Sign up
  - Añadir tu dominio (Domains → Add Domain) — Resend te da unos registros DNS (SPF, DKIM, DMARC) que tienes que añadir donde tengas el dominio. Tarda 10-30 min en verificar.
  - Apunta: **API key**

### Monitoring y analytics
- [ ] **Sentry** — sentry.io. Crear proyecto Next.js. Apunta el **DSN**.
- [ ] **PostHog** — posthog.com (recomendación: tier free generoso, también te sirve para feature flags más adelante). Apunta **project API key** y **host**.

### Captcha
- [ ] **hCaptcha** — hcaptcha.com. Sign up. Crear sitekey. Apunta **site key** y **secret**.

### Tracker de tickets
- [ ] **Linear** — linear.app
  - Plan Free
  - Crear workspace "Campernova"
  - Crear team "Engineering" o "Producto"

---

## Sección 2 — Preparar tu máquina (~30-45 min)

### Software base que tiene que estar instalado
- [ ] **Node.js 20+** — descarga desde nodejs.org (LTS). Tras instalar, abre PowerShell o cmd y verifica:
  ```
  node --version
  npm --version
  ```
- [ ] **pnpm** (gestor de paquetes más rápido que npm):
  ```
  npm install -g pnpm
  ```
- [ ] **Git** — git-scm.com. Tras instalar:
  ```
  git config --global user.name "Joel Martínez"
  git config --global user.email "joel.martinez@tutete.com"
  ```
- [ ] **VSCode o Cursor** instalado y abierto al menos una vez
- [ ] **Claude Code** — sigue las instrucciones oficiales actuales en docs.claude.com. Tras instalar, ejecuta `claude login` para autenticarte.

### Carpeta de trabajo
- [ ] Crea una carpeta para tus proyectos si no la tienes (ej: `C:\Users\Asus\Code\`).

---

## Sección 3 — Crear el repo y meter los documentos (~30 min)

### En GitHub (5 min)
- [ ] Ve a github.com/new y crea repo:
  - Nombre: `campernova-crm`
  - Privado al inicio
  - **NO** marques "Add README" ni "Add .gitignore" — los crearemos nosotros

### En tu máquina (15 min)
Abre PowerShell y ejecuta paso a paso:

```
cd C:\Users\Asus\Code
mkdir campernova-crm
cd campernova-crm
git init
git remote add origin https://github.com/TU_USUARIO/campernova-crm.git
mkdir docs
```

- [ ] Copia los **4 documentos** que te he generado dentro de `docs/`:
  - `PRD-Campernova-CRM-v1.md` → renómbralo a `docs/PRD.md`
  - `Roadmap-Campernova-CRM-v1.md` → `docs/Roadmap.md`
  - `Backlog-Campernova-CRM-v1.md` → `docs/Backlog.md`
  - `Setup-Claude-Code-Campernova.md` → `docs/Setup.md`
  - Este mismo documento → `docs/Quickstart.md`

- [ ] Crea `CLAUDE.md` en la raíz del repo (copia exactamente este contenido):

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

## Documentos clave (LEER PRIMERO)
- `docs/PRD.md` — qué construimos y por qué
- `docs/Roadmap.md` — plan por sprints
- `docs/Backlog.md` — tickets ordenados, IDs CAM-XXX
- `docs/Setup.md` — referencias de stack y MCPs

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

- [ ] Crea `.gitignore` en la raíz con:
```
node_modules/
.next/
.env
.env*.local
.DS_Store
*.log
```

- [ ] Primer commit y push:
```
git add .
git commit -m "docs: initial PRD, roadmap, backlog, quickstart"
git branch -M main
git push -u origin main
```

### Conectar Vercel al repo (5 min)
- [ ] Entra en vercel.com/new
- [ ] Selecciona el repo `campernova-crm`
- [ ] Por ahora no añadas env vars — Claude Code te guiará cuando toque
- [ ] Deploy (fallará porque no hay código aún, no pasa nada)

---

## Sección 4 — Importar el backlog a Linear (~30-45 min)

- [ ] En Linear, abre tu workspace "Campernova"
- [ ] Crea **project**: "CRM v1 (MVP)"
- [ ] Crea **cycles** (sprints) semanales: Sprint 1, 2, 3, 4, 5 — cada uno de lunes a viernes
- [ ] Crea **labels**: `frontend`, `backend`, `infra`, `legal`, `quick-win`, `bug`
- [ ] Abre `docs/Backlog.md` y por cada ticket:
  - Crea issue en Linear con el título (`CAM-XXX — Título`)
  - Descripción: copia/pega la descripción y los acceptance criteria
  - Sprint: el indicado en el ticket
  - Priority: Urgent (P0) o High (P1)
  - Labels: las que apliquen

> **Atajo para no morir copiando:** dile a Claude Code en la primera sesión que importe el backlog a Linear vía MCP. Pero antes asegúrate de tener el conector de Linear configurado (siguiente paso).

---

## Sección 5 — Primera sesión con Claude Code (~2 horas)

Llegado aquí, todo está listo. Abres terminal en la carpeta del proyecto:

```
cd C:\Users\Asus\Code\campernova-crm
claude
```

### Antes de pedirle nada, configura los MCPs prioritarios

Dentro de Claude Code:
- [ ] Conecta el MCP de **GitHub** (te pedirá un token con scope `repo`)
- [ ] Conecta el MCP de **Linear**
- [ ] Conecta el MCP de **Supabase** o **Postgres** (con la connection string que apuntaste)

### Tu primer mensaje a Claude Code (copia/pega)

> Lee los siguientes documentos en orden: docs/PRD.md, docs/Roadmap.md, docs/Backlog.md, docs/Setup.md, docs/Quickstart.md y CLAUDE.md.
>
> Cuando termines de leerlos, confirma con un resumen breve: el alcance del MVP, el stack, y la convención de tickets.
>
> Después arrancamos con el Sprint 1, ticket CAM-001 (Setup repositorio y stack base). Antes de tocar código, dime los pasos que vas a seguir y pregúntame todo lo que no esté claro. Cuando esté validado, ejecutas.

A partir de aquí Claude Code hace su trabajo. Tú validas, haces commit + push, y avanzas al siguiente ticket.

---

## Reglas de oro trabajando con Claude Code

1. **Una sesión, un ticket o grupo pequeño relacionado.** No metas 5 cosas distintas en la misma conversación: pierdes contexto y aumentan los errores.
2. **Commits pequeños y atómicos.** Cada vez que cierres un ticket: `git add` → `commit` → `push`. Vercel te valida con un preview deploy.
3. **No le dejes inventar.** Si propone una librería nueva ("voy a usar X para Y"), pregúntale por qué y si no convence dile que use lo que ya está en el stack.
4. **Tests donde duele.** Tasación, matching y transiciones de estado siempre con tests. El backlog ya los lista como acceptance criteria.
5. **Si dudas, vuelves aquí.** Cualquier decisión de producto, arquitectura o trade-off que no esté en el PRD: vuelves a hablar conmigo antes de que Claude Code se ponga a programar en una dirección equivocada.

---

## Bloqueos previsibles y cómo desatascarlos

| Bloqueo | Qué hacer |
|---|---|
| Verificación de dominio Resend tarda | Sigue avanzando con un sandbox/test inbox de Resend |
| Magic link de Supabase Auth no llega | Revisa Authentication → Email Templates y SMTP en el dashboard |
| Vercel preview falla en deploy | Mira los logs — casi siempre es una env var faltante |
| Tabla `reference_prices` sin data al llegar al sprint 3 | Continúa con casos comparables internos. Pobla la tabla en paralelo, no bloquees |
| Te sientes perdido en un ticket | Vuelves aquí y lo desatascamos antes de seguir |

---

## Cuándo volver a hablar conmigo

- **Antes de cada sprint:** revisión rápida de lo conseguido y ajuste de lo siguiente.
- **Cuando aparezca una decisión de producto** que no esté en el PRD (pasa siempre).
- **Cuando algo se atasque más de medio día.** No te claves más de eso solo.
- **Al terminar el MVP**, para planificar v2 (chat IA público + furgo conversable).

---

## Resumen ultracorto

1. Hoy: cierra las 4 decisiones de la sección 0 + crea cuentas (sección 1)
2. Mañana: setup local (sección 2) + repo + docs (sección 3) + Linear (sección 4)
3. Pasado: primera sesión con Claude Code (sección 5)
4. Semanas 1-5: ejecutas sprints, vuelves aquí cuando lo necesites
5. Semana 6: lanzamiento + planificación v2

Sin pensar. Solo siguiendo.
