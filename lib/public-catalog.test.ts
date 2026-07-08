import { describe, it, expect } from 'vitest'
import {
  mapToPublicVehicle,
  vehicleSlug,
  idFromSlug,
  slugify,
  equipmentLabels,
  brandSlug,
  categoryForType,
  CATEGORIES,
} from './public-catalog'

// Vehicle "completo" del CRM con datos INTERNOS que NO deben salir nunca.
const fullVehicle = {
  id: 'clabc123xyz',
  sellerLeadId: 'lead-1',
  brand: 'Volkswagen',
  model: 'California Ocean',
  year: 2022,
  km: 45000,
  seats: 4,
  length: 4.9,
  type: 'CAMPER' as const,
  equipment: { solar: true, kitchen: true, bathroom: false, shower: true, heating: true },
  conservationState: 'BUENO' as const,
  location: 'Barcelona',
  // ── Datos INTERNOS (nunca públicos) ──
  desiredPrice: 60000,
  valuationMin: 55000,
  valuationRecommended: 58000,
  valuationMax: 62000,
  purchasePrice: 52000,
  marginPercent: 4,
  salePrice: 59900,
  publicNotes: 'Impecable, un solo dueño, libro de revisiones completo.',
  photos: [
    { id: 'p2', vehicleId: 'clabc123xyz', url: 'https://x/2.jpg', order: 1, altText: null },
    { id: 'p1', vehicleId: 'clabc123xyz', url: 'https://x/1.jpg', order: 0, altText: 'Frontal' },
  ],
} as unknown as Parameters<typeof mapToPublicVehicle>[0]

describe('mapToPublicVehicle — seguridad de datos', () => {
  it('el precio público es salePrice, NUNCA los internos', () => {
    const pub = mapToPublicVehicle(fullVehicle)
    expect(pub.price).toBe(59900)
    const serialized = JSON.stringify(pub)
    // Ningún precio/dato interno puede aparecer en la salida pública
    expect(serialized).not.toContain('52000') // purchasePrice
    expect(serialized).not.toContain('58000') // valuationRecommended
    expect(serialized).not.toContain('60000') // desiredPrice
    expect(serialized).not.toContain('marginPercent')
    expect(serialized).not.toContain('sellerLead')
  })

  it('salePrice nulo → price null ("a consultar")', () => {
    const pub = mapToPublicVehicle({ ...fullVehicle, salePrice: null })
    expect(pub.price).toBeNull()
  })

  it('expone solo los campos públicos esperados', () => {
    const pub = mapToPublicVehicle(fullVehicle)
    expect(Object.keys(pub).sort()).toEqual(
      [
        'brand',
        'description',
        'equipment',
        'km',
        'location',
        'model',
        'photos',
        'price',
        'seats',
        'slug',
        'title',
        'type',
        'typeLabel',
        'year',
        'length',
        'verified',
      ].sort()
    )
  })

  it('mapea título, tipo, descripción y equipamiento', () => {
    const pub = mapToPublicVehicle(fullVehicle)
    expect(pub.title).toBe('Volkswagen California Ocean')
    expect(pub.typeLabel).toBe('Camper')
    expect(pub.description).toBe('Impecable, un solo dueño, libro de revisiones completo.')
    expect(equipmentLabels(pub.equipment)).toEqual([
      'Placas solares',
      'Cocina',
      'Ducha',
      'Calefacción',
    ])
  })

  it('ordena las fotos por order y aplica alt por defecto', () => {
    const pub = mapToPublicVehicle(fullVehicle)
    expect(pub.photos.map((p) => p.url)).toEqual(['https://x/1.jpg', 'https://x/2.jpg'])
    expect(pub.photos[1].alt).toBe('Volkswagen California Ocean 2022') // altText null → fallback
  })
})

describe('slug', () => {
  it('genera un slug SEO con el id al final', () => {
    expect(vehicleSlug(fullVehicle)).toBe('volkswagen-california-ocean-2022-clabc123xyz')
  })
  it('idFromSlug recupera el cuid (último segmento)', () => {
    expect(idFromSlug('volkswagen-california-ocean-2022-clabc123xyz')).toBe('clabc123xyz')
  })
  it('slugify quita acentos y normaliza', () => {
    expect(slugify('Citroën Jumper Camión 2.0')).toBe('citroen-jumper-camion-2-0')
  })
})

describe('catálogo navegable — categorías y marcas', () => {
  it('brandSlug normaliza la marca a un slug SEO', () => {
    expect(brandSlug('Fiat')).toBe('fiat')
    expect(brandSlug('Mercedes-Benz')).toBe('mercedes-benz')
    expect(brandSlug('Adriá')).toBe('adria')
  })

  it('categoryForType devuelve la categoría navegable correcta', () => {
    expect(categoryForType('AUTOCARAVANA')?.slug).toBe('autocaravanas')
    expect(categoryForType('CAMPER')?.slug).toBe('campers')
  })

  it('CATEGORIES cubre exactamente los dos tipos con slugs únicos', () => {
    expect(CATEGORIES).toHaveLength(2)
    const slugs = CATEGORIES.map((c) => c.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(CATEGORIES.map((c) => c.type).sort()).toEqual(['AUTOCARAVANA', 'CAMPER'])
  })
})
