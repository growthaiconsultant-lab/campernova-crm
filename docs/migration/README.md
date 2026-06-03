# Migración SEO — WordPress antiguo → web nueva (Next.js)

Plan de redirecciones 301 para preservar el posicionamiento al cambiar el dominio `campersnova.com` del WordPress actual a la nueva app.

## Sitemap capturado (jun 2026)

Descargado de `https://campersnova.com/wp-sitemap.xml` — **183 URLs únicas**. Ficheros:

- `old-sitemap-urls.txt` — todas las URLs (183).
- `pages.txt` — páginas institucionales (9).
- `listings.txt` — fichas de vehículo (42).

### Desglose

| Tipo | Nº | Patrón de URL | Acción 301 |
| ---- | -- | ------------- | ---------- |
| Páginas | 9 | `/contacto/`, `/tasacion/`, `/cars/`… | mapeo 1:1 (abajo) |
| Listings (vehículos) | 42 | `/listings/{slug}/` | → `/comprar` (catálogo) |
| Productos (WooCommerce demo) | 2 | `/producto/{slug}/` | → `/comprar` |
| listing_template | 5 | plantillas internas | no relevante |
| Taxonomías (make, mileage, serie, fuel…) | ~125 | `/?taxonomy=make&term=ford` (query string) | **auto-resueltas**: cargan `/` ignorando los params, sin 404 |

## ¿Qué redirigir y qué no? (criterio SEO)

**Principio**: se redirige por **valor y relevancia**, no por completitud. Redirigir en masa
URLs sin valor a una página genérica puede leerse como _soft 404_ y no transfiere autoridad.
Lo que no tiene valor SEO se deja **caer en 404** (le indica a Google "ya no existe").

De las 183 URLs, solo tienen valor SEO **~6 reglas**:

- ✅ **Páginas institucionales** cuyo slug cambia (autoridad + enlaces).
- ✅ **Fichas de vehículo** (`/listings/*`) → catálogo (sí rankean; el catálogo es relevante).
- ❌ **Taxonomías** (~125, `/?taxonomy=…`): query-string, thin/duplicadas, bajo valor — y además se auto-resuelven sin 404.
- ❌ **Productos demo** (`/producto/business|enterprise`), **carrito**, **plantillas**: cero valor SEO.

## Mapa de redirecciones 301

Implementadas en `middleware.ts` (vía `lib/legacy-redirects.ts`) — el middleware corre
**antes** que `next.config.redirects()`, por eso van ahí. 308 permanente. Se activan al
apuntar el dominio a esta app.

| URL antigua (WordPress) | URL nueva | Notas |
| ----------------------- | --------- | ----- |
| `/` | `/` | igual — sin redirect |
| `/contacto/` · `/aviso-legal/` | iguales | Next gestiona el trailing slash |
| `/tasacion/` | `/vender` | tasación = flujo de venta |
| `/gestion-de-venta/` | `/vender` | servicio de depósito-venta |
| `/cars/` | `/comprar` | catálogo de vehículos |
| `/politica-de-cookies/` | `/cookies` | |
| `/privacy-policy/` | `/privacidad` | |
| `/listings/{slug}/` | `/comprar` | 42 fichas → catálogo (ver pendiente) |
| `/carrito/` · `/producto/*` · `/categoria-producto/*` · taxonomías | **sin redirect (404)** | sin valor SEO |

## Pendiente / mejora futura

- **Listings 1:1**: hoy las 42 fichas redirigen al catálogo `/comprar`. Cuando la web nueva tenga inventario real en `/comprar/[id]`, conviene mapear cada vehículo que siga en stock a su ficha nueva (mejor SEO que un redirect masivo al catálogo). Los vehículos ya vendidos se quedan con el 301 al catálogo.
- **Taxonomías**: las URLs `/?taxonomy=...` no dan 404 en la web nueva (cargan la home), así que no rompen nada. Si se quisiera, se podrían redirigir a `/comprar` con reglas `has` por query param, pero es bajo valor.

## Cómo activar

1. Conectar `campersnova.com` a esta app en Vercel (cutover del dominio desde WordPress).
2. Las redirecciones de `next.config.mjs` entran en vigor automáticamente.
3. Tras el cutover: re-enviar el `sitemap.xml` nuevo en Google Search Console y vigilar errores de rastreo (404) los primeros días.
