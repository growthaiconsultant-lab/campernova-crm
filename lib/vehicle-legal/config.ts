import type { PhotoCategory } from '@prisma/client'

/**
 * PUB-1 (fase de arranque) — Publicar un vehículo NO exige, de momento, cobertura fotográfica por
 * categoría (p. ej. ≥1 exterior + ≥1 interior). Se añade la infraestructura (categorías de foto y
 * conteo por categoría) pero el gate **no bloquea** publicar. Se endurece poniendo este flag a
 * `true`. Es independiente del mínimo TOTAL de fotos (`PUBLICADO_MIN_PHOTOS`), que sigue vigente
 * SIEMPRE, con o sin este flag.
 *
 * Sin dependencias de Prisma más allá del tipo → importable desde servidor y cliente.
 */
export const PUBLICACION_REQUIERE_FOTOS_CATEGORIZADAS = false

/** Categorías mínimas exigidas al publicar cuando el flag está activo. */
export const PUBLICACION_CATEGORIAS_REQUERIDAS = ['EXTERIOR', 'INTERIOR'] as const

/** Etiquetas legibles de cada categoría (para mensajes de UI/gate). */
export const PHOTO_CATEGORY_LABELS: Record<PhotoCategory, string> = {
  EXTERIOR: 'exterior',
  INTERIOR: 'interior',
  DETALLE: 'detalle',
  DOCUMENTAL: 'documental',
}
