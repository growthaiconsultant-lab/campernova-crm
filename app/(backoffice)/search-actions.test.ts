import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    buyerLead: { findMany: vi.fn() },
    sellerLead: { findMany: vi.fn() },
    vehicle: { findMany: vi.fn() },
    vehicleCapture: { findMany: vi.fn() },
  },
}))

import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { globalSearch } from './search-actions'

const authMock = vi.mocked(requireAuth)
const buyerFindMany = vi.mocked(db.buyerLead.findMany)
const sellerFindMany = vi.mocked(db.sellerLead.findMany)
const vehicleFindMany = vi.mocked(db.vehicle.findMany)
const captureFindMany = vi.mocked(db.vehicleCapture.findMany)

function mockRole(role: 'ADMIN' | 'AGENTE' | 'TALLER' | 'ENTREGAS' | 'MARKETING') {
  authMock.mockResolvedValue({ role } as never)
}

function mockEmptyQueries() {
  buyerFindMany.mockResolvedValue([])
  sellerFindMany.mockResolvedValue([])
  vehicleFindMany.mockResolvedValue([])
  captureFindMany.mockResolvedValue([])
}

describe('globalSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('no consulta entidades con una búsqueda de menos de dos caracteres', async () => {
    mockRole('ADMIN')

    await expect(globalSearch(' a ')).resolves.toEqual({
      compradores: [],
      vendedores: [],
      vehiculos: [],
      captaciones: [],
    })
    expect(buyerFindMany).not.toHaveBeenCalled()
    expect(sellerFindMany).not.toHaveBeenCalled()
    expect(vehicleFindMany).not.toHaveBeenCalled()
    expect(captureFindMany).not.toHaveBeenCalled()
  })

  it('construye destinos exactos para un usuario comercial autorizado', async () => {
    mockRole('ADMIN')
    buyerFindMany.mockResolvedValue([
      { id: 'buyer-1', name: 'Comprador Test', phone: '600000000', status: 'NUEVO' },
    ] as never)
    sellerFindMany.mockResolvedValue([
      {
        id: 'seller-1',
        name: 'Vendedor Test',
        vehicle: { brand: 'Ford', model: 'Transit', year: 2020 },
      },
    ] as never)
    vehicleFindMany.mockResolvedValue([
      {
        id: 'vehicle-1',
        brand: 'Ford',
        model: 'Transit',
        year: 2020,
        plate: '0000AAA',
        status: 'PUBLICADO',
        sellerLeadId: 'seller-1',
      },
    ] as never)
    captureFindMany.mockResolvedValue([
      {
        id: 'capture-active',
        title: 'Captación activa',
        phone: null,
        status: 'EN_CURSO',
        sellerLeadId: null,
      },
      {
        id: 'capture-converted',
        title: 'Captación convertida',
        phone: null,
        status: 'CONVERTIDO',
        sellerLeadId: 'seller-2',
      },
    ] as never)

    const results = await globalSearch('ford')

    expect(results.compradores[0]?.href).toBe('/compradores/buyer-1')
    expect(results.vendedores[0]?.href).toBe('/vendedores/seller-1')
    expect(results.vehiculos[0]?.href).toBe('/vendedores/seller-1')
    expect(results.captaciones.map((hit) => hit.href)).toEqual([
      '/captaciones?focus=capture-active',
      '/vendedores/seller-2',
    ])
  })

  it.each(['TALLER', 'ENTREGAS', 'MARKETING'] as const)(
    'no consulta ni devuelve resultados comerciales al rol %s',
    async (role) => {
      mockRole(role)

      await expect(globalSearch('ford')).resolves.toEqual({
        compradores: [],
        vendedores: [],
        vehiculos: [],
        captaciones: [],
      })
      expect(buyerFindMany).not.toHaveBeenCalled()
      expect(sellerFindMany).not.toHaveBeenCalled()
      expect(vehicleFindMany).not.toHaveBeenCalled()
      expect(captureFindMany).not.toHaveBeenCalled()
    }
  )

  it('permite las mismas queries al rol AGENTE', async () => {
    mockRole('AGENTE')
    mockEmptyQueries()

    await globalSearch('ford')

    expect(buyerFindMany).toHaveBeenCalledOnce()
    expect(sellerFindMany).toHaveBeenCalledOnce()
    expect(vehicleFindMany).toHaveBeenCalledOnce()
    expect(captureFindMany).toHaveBeenCalledOnce()
  })

  it('propaga la ausencia de sesión antes de consultar datos', async () => {
    authMock.mockRejectedValue(new Error('NEXT_REDIRECT'))

    await expect(globalSearch('ford')).rejects.toThrow('NEXT_REDIRECT')
    expect(buyerFindMany).not.toHaveBeenCalled()
    expect(sellerFindMany).not.toHaveBeenCalled()
    expect(vehicleFindMany).not.toHaveBeenCalled()
    expect(captureFindMany).not.toHaveBeenCalled()
  })

  it('devuelve grupos vacíos cuando no existe ninguna entidad coincidente', async () => {
    mockRole('ADMIN')
    mockEmptyQueries()

    await expect(globalSearch('inexistente')).resolves.toEqual({
      compradores: [],
      vendedores: [],
      vehiculos: [],
      captaciones: [],
    })
  })
})
