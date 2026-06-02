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

## Mapa de redirecciones 301

Implementadas en `next.config.mjs` → `redirects()` (se activan al apuntar el dominio a esta app).

| URL antigua (WordPress) | URL nueva | Notas |
| ----------------------- | --------- | ----- |
| `/` | `/` | igual — sin redirect |
| `/contacto/` | `/contacto` | igual (Next gestiona el trailing slash) |
| `/aviso-legal/` | `/aviso-legal` | igual |
| `/tasacion/` | `/vender` | tasación = flujo de venta |
| `/gestion-de-venta/` | `/vender` | servicio de depósito-venta |
| `/cars/` | `/comprar` | catálogo de vehículos |
| `/carrito/` | `/comprar` | carrito WooCommerce (sin equivalente) |
| `/politica-de-cookies/` | `/cookies` | |
| `/privacy-policy/` | `/privacidad` | |
| `/listings/{slug}/` | `/comprar` | 42 fichas → catálogo (ver pendiente) |
| `/producto/{slug}/` | `/comprar` | productos demo |
| `/categoria-producto/{slug}/` | `/comprar` | |

## Pendiente / mejora futura

- **Listings 1:1**: hoy las 42 fichas redirigen al catálogo `/comprar`. Cuando la web nueva tenga inventario real en `/comprar/[id]`, conviene mapear cada vehículo que siga en stock a su ficha nueva (mejor SEO que un redirect masivo al catálogo). Los vehículos ya vendidos se quedan con el 301 al catálogo.
- **Taxonomías**: las URLs `/?taxonomy=...` no dan 404 en la web nueva (cargan la home), así que no rompen nada. Si se quisiera, se podrían redirigir a `/comprar` con reglas `has` por query param, pero es bajo valor.

## Cómo activar

1. Conectar `campersnova.com` a esta app en Vercel (cutover del dominio desde WordPress).
2. Las redirecciones de `next.config.mjs` entran en vigor automáticamente.
3. Tras el cutover: re-enviar el `sitemap.xml` nuevo en Google Search Console y vigilar errores de rastreo (404) los primeros días.
