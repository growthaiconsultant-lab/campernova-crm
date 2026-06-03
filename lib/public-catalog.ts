/**
 * Catálogo público: lee del CRM (Prisma) los vehículos PUBLICADO y los expone
 * con una forma SEGURA para la web pública.
 *
 * ⚠️ Regla de oro: NUNCA exponer datos internos (purchasePrice, margin,
 * valuaciones, sellerLead, costes…). El precio público es SIEMPRE `salePrice`.
 */
import { db } from '@/lib/db'
import type { Vehicle, VehiclePhoto, VehicleType } from '@prisma/client'

export type PublicVehicleEquipment = {
  solar: boolean
  kitchen: boolean
  bathroom: boolean
  shower: boolean
  heating: boolean
}

export type PublicVehiclePhoto = { url: string; alt: string }

export type PublicVehicle = {
  /** Slug SEO: `marca-modelo-año-id`. */
  slug: string
  brand: string
  model: string
  /** `${brand} ${model}` */
  title: string
  year: number
  km: number
  seats: number
  length: number | null
  /** 'Camper' | 'Autocaravana' */
  typeLabel: string
  type: VehicleType
  location: string | null
  /** Precio de venta al cliente (salePrice). `null` → "Precio a consultar". */
  price: number | null
  description: string | null
  equipment: PublicVehicleEquipment
  photos: PublicVehiclePhoto[]
}

const TYPE_LABELS: Record<VehicleType, string> = {
  CAMPER: 'Camper',
  AUTOCARAVANA: 'Autocaravana',
}

const EQUIPMENT_LABELS: Record<keyof PublicVehicleEquipment, string> = {
  solar: 'Placas solares',
  kitchen: 'Cocina',
  bathroom: 'Baño',
  shower: 'Ducha',
  heating: 'Calefacción',
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Construye el slug SEO de un vehículo. El id (cuid, sin guiones) va al final. */
export function vehicleSlug(v: Pick<Vehicle, 'id' | 'brand' | 'model' | 'year'>): string {
  return `${slugify(`${v.brand} ${v.model} ${v.year}`)}-${v.id}`
}

/** Extrae el id de cuid del slug (último segmento tras el guion). */
export function idFromSlug(slug: string): string {
  return slug.split('-').pop() ?? ''
}

/** Convierte las etiquetas legibles del equipamiento activo. */
export function equipmentLabels(eq: PublicVehicleEquipment): string[] {
  return (Object.keys(EQUIPMENT_LABELS) as (keyof PublicVehicleEquipment)[])
    .filter((k) => eq[k])
    .map((k) => EQUIPMENT_LABELS[k])
}

type VehicleWithPhotos = Vehicle & { photos: VehiclePhoto[] }

/** Mapea un Vehicle del CRM a su forma pública SEGURA (sin datos internos). */
export function mapToPublicVehicle(v: VehicleWithPhotos): PublicVehicle {
  const eqRaw = (v.equipment ?? {}) as Record<string, unknown>
  const equipment: PublicVehicleEquipment = {
    solar: eqRaw.solar === true,
    kitchen: eqRaw.kitchen === true,
    bathroom: eqRaw.bathroom === true,
    shower: eqRaw.shower === true,
    heating: eqRaw.heating === true,
  }

  return {
    slug: vehicleSlug(v),
    brand: v.brand,
    model: v.model,
    title: `${v.brand} ${v.model}`,
    year: v.year,
    km: v.km,
    seats: v.seats,
    length: v.length ?? null,
    type: v.type,
    typeLabel: TYPE_LABELS[v.type] ?? 'Vehículo',
    location: v.location ?? null,
    // Precio público = SOLO salePrice. Nunca desiredPrice/purchasePrice/valuación/margen.
    price: v.salePrice != null ? Number(v.salePrice) : null,
    description: v.publicNotes ?? null,
    equipment,
    photos: v.photos
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((p) => ({ url: p.url, alt: p.altText ?? `${v.brand} ${v.model} ${v.year}` })),
  }
}

/** Todos los vehículos publicados, listos para el catálogo y el sitemap. */
export async function getPublishedVehicles(): Promise<PublicVehicle[]> {
  const vehicles = await db.vehicle.findMany({
    where: { status: 'PUBLICADO' },
    include: { photos: true },
    orderBy: { publishedAt: 'desc' },
  })
  return vehicles.map(mapToPublicVehicle)
}

/**
 * Un vehículo publicado por su slug (o null si no existe / no está publicado).
 * Resiliente: si la DB falla, devuelve null (la página hará 404) en vez de un 500.
 */
export async function getPublishedVehicleBySlug(slug: string): Promise<PublicVehicle | null> {
  const id = idFromSlug(slug)
  if (!id) return null
  try {
    const v = await db.vehicle.findFirst({
      where: { id, status: 'PUBLICADO' },
      include: { photos: true },
    })
    return v ? mapToPublicVehicle(v) : null
  } catch (err) {
    console.error('[public-catalog] error al cargar vehículo por slug:', err)
    return null
  }
}
