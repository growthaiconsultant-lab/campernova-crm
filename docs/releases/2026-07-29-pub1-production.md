# Release — PUB-1 en producción (categorías de foto + despublicación)

**Fecha:** 2026-07-29 · **PR:** #155 (squash `be8707c`) · **Migración:** `20260729130000_add_photo_category_and_unpublish`

## Alcance

- **Categorías de foto** (Exterior/Interior/Detalle/Documental): enum `PhotoCategory` + columna
  **nullable** `vehicle_photos.category`; selector por foto en el uploader; gate de publicación por
  categoría **detrás de un flag** (`PUBLICACION_REQUIERE_FOTOS_CATEGORIZADAS=false` → hoy no bloquea).
  El mínimo TOTAL de fotos (`PUBLICADO_MIN_PHOTOS=5`) sigue vigente siempre.
- **Despublicar** `PUBLICADO → TASADO`: transición dedicada (`unpublishVehicleTx`, lock/CAS, guard de
  ofertas activas bajo el lock, traza `PUBLICACION_RETIRADA`), acción `unpublishVehicle`
  (**AGENTE + ADMIN**), botón "Retirar anuncio" con motivo. Invalida el catálogo público (ISR).
- **`published_at` = primera publicación**: se fija al publicar si es null; republicar la conserva;
  UI "fecha desconocida" para publicaciones históricas.

## Migración (DB-first)

Aditiva: `CREATE TYPE PhotoCategory` + `ALTER TABLE vehicle_photos ADD COLUMN category` +
`ALTER TYPE ActivityType ADD VALUE 'PUBLICACION_RETIRADA'`. Sin DML/backfill. Checksum SHA-256
`7c6a0f8056986480c44b4301ce5e494cee73621473f55ec911980c996c38c28c`. Aplicada con `prisma migrate
deploy` (conexión directa `.env` → prod `bbmglaatlyilxutzomxd`) **antes** del merge/deploy del cliente;
`migrate status` previo: PUB-1 única pendiente.

## Preflight / Postflight (read-only)

| Métrica                                                                        | Preflight                      | Postflight                                 |
| ------------------------------------------------------------------------------ | ------------------------------ | ------------------------------------------ |
| catálogo tables/columns/enums/enum_values/FK/indexes                           | 33 / 480 / 55 / 293 / 77 / 124 | 33 / **481** / **56** / **298** / 77 / 124 |
| tablas sin RLS                                                                 | 0                              | 0                                          |
| counts de negocio (vehicles/seller_leads/buyer_leads/photos/offers/activities) | 62 / 62 / 117 / 90 / 2 / 328   | **idénticos**                              |

Deltas exactos esperados: columns +1, enums +1, enum_values +5. Migración registrada
(`applied=true`, `rolledBack=false`). **Cero DML/backfill.**

## Merge + Deployment

PR #155 → squash a `main` = `be8707c`; Vercel deployment **READY**, target production, alias
`campersnova.com`.

## Smoke autenticado

App renderiza contra el schema migrado; el **selector de categoría de foto** aparece y funciona en la
pestaña Preparación (13 fotos con dropdown de categoría). Público + Sentry sin issues nuevas tras el
deploy. **No se probó funcionalmente "retirar anuncio" en producción** (no hay vehículos `PUBLICADO`
reales y no se tocan anuncios reales ni se crean datos sintéticos sin autorización): la lógica de
despublicación (concurrencia, guard de ofertas, `published_at`, republicación) está **probada por los
tests de integración con Postgres en CI**.

## Hallazgo (deuda pre-existente, no de PUB-1)

Warning de hidratación de React (#425 text-content mismatch) en la pestaña Preparación de la ficha de
vendedor, por texto de tiempo relativo ("PRÓXIMA ACCIÓN": hoy/mañana/vencida) calculado con
`new Date()` en render — componente compartido con `/compradores/[id]` (el error de hidratación
conocido). **Corregido aparte** (mount-gating del texto relativo + `timeZone: 'Europe/Madrid'` en
formateadores de fecha del expediente legal). No lo causó PUB-1 (el `<select>` de categoría controla
un atributo, no un nodo de texto).

## Pendiente

Observación de 24 h de PUB-1. Endurecer el gate de fotos (flag a `true`) es decisión posterior.

## No incluido

B1A (señales económicas), DATA-1, historial de `salePrice`, marketplace/SaaS/multiempresa.
