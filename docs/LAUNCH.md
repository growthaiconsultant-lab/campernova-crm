# Lanzamiento a producción — CampersNova

> Estado del **go-live** en el dominio real `campersnova.com` y, sobre todo, **lo que
> queda pendiente**. Este documento es la fuente de verdad del lanzamiento.

## ✅ Cutover de DNS COMPLETADO (2026-06-03)

`campersnova.com` ya **sirve la web nueva (Next.js en Vercel)**, sustituyendo al
WordPress antiguo.

**Verificado desde fuera el día del cutover:**

- `Server: Vercel` + `X-Vercel-Id` → sirve desde Vercel.
- `Strict-Transport-Security` presente → **SSL emitido**.
- Rutas `200`: `/`, `/comprar`, `/vender`, `/comprar/vehiculos`, `/sitemap.xml`, `/robots.txt`.
- Contenido correcto (marca CampersNova, chat de Nova, etc.).
- DNS propagado en Google (8.8.8.8) y Cloudflare (1.1.1.1) → `216.198.79.1`.

**Cómo se hizo:**

1. Dominio añadido al proyecto Vercel `campernova-crm` (apex `campersnova.com` como
   principal, **sin** redirección a `www`, para que coincida con los canonicals del código).
2. El dominio estaba **enlazado a otra cuenta de Vercel** → se verificó la propiedad con un
   registro `TXT _vercel = vc-domain-verify=campersnova.com,...` en dinahosting.
3. **El cutover**: en dinahosting se cambió el registro `A @` de `82.98.132.86` (WordPress)
   → **`216.198.79.1`** (Vercel). El TTL "Auto" de dinahosting propagó en minutos.

### Otros hitos de producción cerrados ese día

- ✅ **Emails reales**: dominio `campersnova.com` verificado en Resend (DKIM + SPF + MX en
  el subdominio `send`, sin tocar el MX raíz) + `EMAIL_FROM = CampersNova <info@campersnova.com>`
  en Vercel + redeploy.
- ✅ **`CRON_SECRET`** y **`SENTRY_AUTH_TOKEN`** configurados en Vercel (Production) + redeploy.
- ✅ Seguridad **RLS deny-all** (PR #21), **catálogo navegable Fase C** (PR #22), **tests del
  chat API** (PR #23), **E2E que no falla sin staging** (PR #25).

---

## 🔴 PENDIENTE INMEDIATO (tras el cutover)

No bloquean: la web funciona. Pero conviene cerrarlos pronto.

### 1. `NEXT_PUBLIC_APP_URL` → dominio real (lo más útil — arregla el sitemap)

Ahora mismo el **sitemap lista URLs de `campernova-crm.vercel.app`** en vez de
`campersnova.com` (los canonicals de las páginas sí usan ya `campersnova.com`).
Causa: `NEXT_PUBLIC_APP_URL` apunta a la URL de Vercel.

**Pasos** (Vercel → Settings → Environment Variables):

1. Busca `NEXT_PUBLIC_APP_URL` → menú `…` → **Edit**.
2. Valor: `https://campersnova.com`
3. **Save** → en el toast, **Redeploy**.

→ Tras el redeploy, sitemap, Open Graph y enlaces de email usan `campersnova.com`.

### 2. Login del equipo en el dominio (Supabase Auth)

Para que el equipo entre al CRM en `campersnova.com/login` (de momento funciona en la
URL `*.vercel.app`).

**Pasos** (Supabase → proyecto → Authentication → URL Configuration):

- **Site URL**: `https://campersnova.com`
- **Redirect URLs**: añadir `https://campersnova.com/auth/callback`

### 3. `www.campersnova.com` (opcional pero recomendable)

`www` **sigue apuntando al WordPress** (`82.98.132.86`). Para que también lleve a la web nueva:

1. Vercel → Domains → **Add** `www.campersnova.com` → **Redirect to** `campersnova.com` (308).
2. dinahosting → Zona DNS → cambiar el registro `www` para que apunte a Vercel
   (CNAME `cname.vercel-dns.com`, o A `216.198.79.1`).

### 4. Limpieza (opcional)

- Quitar el registro `TXT _vercel` de la zona DNS — Vercel indica que se puede borrar tras
  verificar la propiedad. (Inofensivo dejarlo.)

---

## 🟠 PENDIENTE A MEDIO PLAZO

- **Publicar stock real**: los comerciales subirán vehículos durante ~2 semanas. Al ponerlos
  en estado **PUBLICADO** (con `salePrice`, fotos y `publicNotes`), aparecen solos en la web
  (ISR ~10 min) y entran al sitemap. Hasta entonces el catálogo muestra "Próximamente".
- **Supabase Pro** (decisión del dueño): el plan free **se pausa por inactividad** (7 días sin
  tráfico). El chat y el formulario de venta dependen de esa DB. Con tráfico real en vivo se
  mantiene despierta, así que el riesgo baja al lanzar; ojo solo en rachas muy muertas.
- **Rotar los tokens de `.codex/`** (Supabase + Linear) — aparecieron en salida durante la
  auditoría (no están en git).
- **Entorno de staging** (Fase 4) + **E2E autenticado** (Fase 7) — ver `PRODUCTION-READINESS.md`.

---

## 🔁 ROLLBACK (volver a WordPress)

Si algo va mal, la vuelta atrás es inmediata y segura:

1. dinahosting → Zona DNS → editar el registro **`A @`** y poner de nuevo **`82.98.132.86`**
   (o usar **"Restaurar zonas"** en el Histórico DNS, que revierte a un estado anterior).
2. Propagación: minutos (el TTL es bajo).

**El WordPress sigue vivo** en dinahosting como respaldo — no borrarlo durante las primeras
semanas. **El correo no se ve afectado** por el cutover ni por el rollback (el MX raíz nunca
se tocó; solo se añadió el subdominio `send` para Resend).

---

## Estado de la zona DNS de `campersnova.com` tras el cutover (dinahosting)

| Tipo | Host                 | Valor                                   | Para qué                         |
| ---- | -------------------- | --------------------------------------- | -------------------------------- |
| A    | `@`                  | `216.198.79.1`                          | **Web → Vercel** (cambiado)      |
| A    | `www`                | `82.98.132.86`                          | Aún WordPress — _pendiente_ (#3) |
| TXT  | `_vercel`            | `vc-domain-verify=...`                  | Verificación de propiedad Vercel |
| MX   | `@` (SOA)            | `mail.campersnova.com`                  | Correo — **intacto**             |
| MX   | `send`               | `feedback-smtp.eu-west-1.amazonses.com` | Resend (envío)                   |
| TXT  | `send`               | `v=spf1 include:amazonses.com ~all`     | Resend (SPF)                     |
| TXT  | `resend._domainkey`  | `p=MIG...`                              | Resend (DKIM)                    |
| TXT  | `_dmarc`             | `v=DMARC1; ...`                         | Correo — intacto                 |
| TXT  | `default._domainkey` | `v=DKIM1; ...`                          | Correo — intacto                 |

> Diseño SEO/redirecciones del cutover: `lib/legacy-redirects.ts` (308 de las URLs del WP
> con valor SEO). Diagnóstico y plan SEO: ver `PRODUCTION-READINESS.md` y los ADRs.
