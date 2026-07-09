# ADR 0007 — CRM en subdominio (`crm.campersnova.com`) vía routing por host

**Estado**: Aceptado (código listo; cutover pendiente de pasos manuales)

## Contexto

La web pública (marketing/marketplace) y el backoffice/CRM son la misma app Next.js en el mismo dominio `campersnova.com`, separados solo por rutas + auth en el middleware. Por buena práctica de separación de superficies (seguridad, operación y encaje con el futuro portal profesional/API) se separa el CRM interno a **`crm.campersnova.com`**, dejando la web pública en el apex. **No es por SEO** (el SEO ya está clavado al apex vía `SITE_URL` y no se ve afectado). Coste de infraestructura: 0 (subdominio = DNS gratis + SSL automático).

## Decisión

- **Una sola app, routing por host** (no se parte en dos proyectos). El apex sirve lo público; `crm.` sirve el backoffice.
- Helper puro **`lib/host-routing.ts`** (`resolveHostRedirect`) + llamada en `middleware.ts`: apex + ruta de backoffice → 308 al CRM; CRM + `/` → `/dashboard`; CRM + marketing público → 308 al apex. **Nunca** se mueven `/api/chat` ni `/api/valuation` (los usan páginas públicas).
- **Gated por env var `CRM_HOST`**: si no está definida (o el host es `localhost`/`*.vercel.app`) el comportamiento es idéntico al actual → el código se despliega sin riesgo y el **cutover es un flip de env var**, reversible.
- `NEXT_PUBLIC_APP_URL` (magic-link + deep-links de emails al backoffice) pasa a `https://crm.campersnova.com` en el cutover. `NEXT_PUBLIC_SITE_URL` (SEO, apex) no cambia.
- El único enlace de email a página pública (`postventa-day-7` → `/contacto`) se fija al apex vía `SITE_URL`.

## Consecuencias

- El equipo entra por `crm.campersnova.com` (por marcador; sin enlace público — decisión del dueño). Cookies host-only: la sesión vive en `crm.`, no se comparte con el apex (no hace falta, el público es anónimo).
- SEO intacto (todo pinneado al apex por `SITE_URL`). No hay cross-links internos que arreglar.
- Pasos manuales del cutover (dueño): añadir el dominio en Vercel, `CNAME crm` en dinahosting, URLs de Supabase Auth, y set de `CRM_HOST` + `NEXT_PUBLIC_APP_URL`. Orden importa: activar `CRM_HOST` solo cuando el subdominio resuelva con SSL.
- Alternativa descartada: partir en dos proyectos/monorepo (Nivel 2) — más trabajo, innecesario a este tamaño; queda para cuando el portal profesional lo justifique.
