# PUB-1 — Categorías de foto y despublicación de anuncios

> **Estado:** PR abierto (`feat/pub1-photo-categories-unpublish`). Sin migración remota ni despliegue
> hasta el gate de rollout. Este documento describe el cambio tal como está implementado con CI local
> en verde.

## Context

El CRM podía **publicar** un vehículo pero no **retirar** el anuncio (`PUBLICADO` era terminal en la
máquina de edición manual), las fotos no tenían **categoría**, y `vehicles.published_at` nunca se
escribía. PUB-1 cubre las tres cosas.

## Decisiones (dueño, 2026-07-29)

1. **Categorías de foto** con requisito de publicación **detrás de un flag** (relajado ahora).
2. **Despublicar** (`PUBLICADO → TASADO`) habilitado para **AGENTE y ADMIN**.

## Parte A — Categorías de foto

- Enum `PhotoCategory` (EXTERIOR/INTERIOR/DETALLE/DOCUMENTAL) + columna **nullable**
  `vehicle_photos.category` (fotos previas quedan sin categoría; sin backfill).
- El uploader (`components/vehicle-photo-uploader.tsx`) permite etiquetar cada foto; la subida acepta
  `category` y hay `setVehiclePhotoCategory` (resuelve Photo → Vehicle → SellerLead para revalidar).
- **Gate tras flag** `PUBLICACION_REQUIERE_FOTOS_CATEGORIZADAS = false` (`lib/vehicle-legal/config.ts`):
  con el flag **desactivado** (hoy) publicar **no** exige categorías. Con el flag activo se exige
  `≥1 EXTERIOR + ≥1 INTERIOR` (`PUBLICACION_CATEGORIAS_REQUERIDAS`). El **mínimo TOTAL de fotos**
  (`PUBLICADO_MIN_PHOTOS = 5`) sigue vigente **siempre**, con o sin flag. El gate es testeable por
  parámetro (`isReadyForStatus(..., { requireCategorizedPhotos })`). Endurecer = flag a `true`.

## Parte B — Despublicación `PUBLICADO → TASADO`

- Transición **dedicada** (`lib/vehicle-unpublish.ts` → `unpublishVehicleTx`), NO el `updateVehicle`
  genérico (que rechaza cualquier camino a `TASADO` con `OFFICIAL_VALUATION_REQUIRED`). Bajo
  `withLockedRoots(buildVehicleUpdateRoots)`: relectura bajo lock, raíz consistente, vendedor no
  archivado, debe estar `PUBLICADO`, **guard de ofertas activas bajo el lock** (`ACTIVE_OFFER_STATUSES`,
  derivado de `isActiveHold`), CAS `PUBLICADO → TASADO`, traza `PUBLICACION_RETIRADA`.
- **Concurrencia:** el lock del root `vehicle` serializa despublicar con crear/aceptar ofertas (ambas
  toman el mismo lock). Dos despublicaciones concurrentes → una gana, la otra ve `NOT_PUBLISHED`.
- **Permiso:** `unpublishVehicle` (server action) usa `requireAgente` (AGENTE + ADMIN). Botón "Retirar
  anuncio" en la pestaña Publicación (`unpublish-button.tsx`), con motivo opcional.
- **`published_at` = primera publicación:** se fija al pasar a `PUBLICADO` si es null
  (`applyManualVehicleUpdateTx`); republicar tras despublicar **conserva** la fecha original; sin
  backfill. La UI muestra la fecha o **"fecha desconocida"** para publicaciones históricas (`null`).

## Caché pública

Publicar/despublicar (y editar un vehículo publicado) invalidan el **catálogo público (ISR)**:
`/comprar`, `/comprar/vehiculos` y el patrón `/comprar/[id]` (la ficha pública usa el slug, no el id).

## Permisos de fotos

Subir/editar categoría de foto usa `requireCanGenerateAds` = **ADMIN + AGENTE + MARKETING** (sin
cambios respecto al resto de gestión de fotos/anuncios).

## Migración

`20260729130000_add_photo_category_and_unpublish` — aditiva: `CREATE TYPE PhotoCategory`,
`ALTER TABLE vehicle_photos ADD COLUMN category`, `ALTER TYPE ActivityType ADD VALUE
'PUBLICACION_RETIRADA'`. Sin DML/backfill. Deltas de catálogo: columns +1, enums +1, enum_values +5.

## Tests

- Unit: núcleo de despublicación (`lib/vehicle-unpublish.test.ts` — guards, CAS, oferta activa),
  gate de fotos con flag true/false + fotos legacy (`lib/vehicle-legal/validate.test.ts`),
  `setVehiclePhotoCategory` (`photo-actions.test.ts`).
- Integración PG (`tests/integration/vehicle-unpublish.test.ts`): happy, bloqueo por oferta activa,
  no-publicado, concurrencia, y `published_at` (primera publicación + republicación conserva).

## Fuera de alcance

B1A (señales económicas), DATA-1, historial de `salePrice`, marketplace/SaaS/multiempresa. El
endurecimiento del gate de fotos (flag a `true`) es una decisión posterior.
