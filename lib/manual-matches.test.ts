import { describe, expect, it, vi } from 'vitest'
import {
  manualMatchSchema,
  manualMatchSearchSchema,
  searchManualMatchCandidates,
  ManualMatchError,
} from './manual-matches'
import { eligibleBuyerWhere, eligibleVehicleWhere } from './matching/eligibility'

describe('COM-4 selección y búsqueda de intereses', () => {
  it('rechaza IDs vacíos, campos ajenos, SQL en IDs y paginación/texto sin límite', () => {
    for (const input of [
      { vehicleId: '', buyerLeadId: 'b1' },
      { vehicleId: 'v1', buyerLeadId: 'b1', status: 'CERRADO' },
      { vehicleId: "v'; DROP", buyerLeadId: 'b1' },
    ])
      expect(manualMatchSchema.safeParse(input).success).toBe(false)
    for (const input of [
      { page: -1 },
      { page: 1.5 },
      { page: 1001 },
      { query: 'a'.repeat(101) },
      { side: 'seller' },
    ])
      expect(
        manualMatchSearchSchema.safeParse({ side: 'buyer', fixedId: 'b1', ...input }).success
      ).toBe(false)
    expect(manualMatchSchema.parse({ vehicleId: ' v1 ', buyerLeadId: 'b1' })).toEqual({
      vehicleId: 'v1',
      buyerLeadId: 'b1',
    })
  })
  it('vehículos por términos, filtro operativo, paginación, sólo IDs de asociaciones de ese comprador', async () => {
    const client = {
      buyerLead: { findFirst: vi.fn().mockResolvedValue({ id: 'b1' }) },
      vehicle: {
        findMany: vi
          .fn()
          .mockResolvedValue(
            Array.from({ length: 7 }, (_, i) => ({
              id: `vehicle${i}`,
              brand: 'Citroen',
              model: 'Jumpy',
              year: 2018,
              plate: `QA${i}`,
              matches: i === 0 ? [{ id: 'm1' }] : [],
            }))
          ),
      },
    }
    const result = await searchManualMatchCandidates(client as never, {
      side: 'buyer',
      fixedId: 'b1',
      query: 'Citroen Jumpy',
      page: 2,
    })
    expect(result.items).toHaveLength(6)
    expect(result.hasMore).toBe(true)
    expect(result.items[0]).toEqual({
      id: 'vehicle0',
      label: 'Citroen Jumpy (2018)',
      detail: 'QA0 · #vehicle0',
      associated: true,
    })
    expect(client.buyerLead.findFirst).toHaveBeenCalledWith({
      where: { ...eligibleBuyerWhere, id: 'b1' },
      select: { id: true },
    })
    const args = client.vehicle.findMany.mock.calls[0][0]
    expect(args.where).toEqual(expect.objectContaining(eligibleVehicleWhere))
    expect(args.where.AND).toHaveLength(2)
    expect(args).toMatchObject({ take: 7, skip: 12 })
    expect(args.select.matches.where).toEqual({ buyerLeadId: 'b1', generatedBy: 'manual' })
    expect(Object.keys(args.select)).not.toContain('sellerLead')
  })
  it('compradores con ID visible para homónimos y sin contacto en selección ni respuesta', async () => {
    const client = {
      vehicle: { findFirst: vi.fn().mockResolvedValue({ id: 'v1' }) },
      buyerLead: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            {
              id: 'buyer-12345678',
              name: 'QA Persona',
              vehicleType: 'CAMPER',
              minSeats: 4,
              matches: [],
            },
          ]),
      },
    }
    const result = await searchManualMatchCandidates(client as never, {
      side: 'vehicle',
      fixedId: 'v1',
      query: 'QA Persona',
      page: 0,
    })
    expect(result.items[0].detail).toBe('Camper · 4+ plazas · #12345678')
    const args = client.buyerLead.findMany.mock.calls[0][0]
    expect(args.where).toEqual(expect.objectContaining(eligibleBuyerWhere))
    expect(args.select.matches.where).toEqual({ vehicleId: 'v1', generatedBy: 'manual' })
    expect(args.select).not.toHaveProperty('email')
    expect(args.select).not.toHaveProperty('phone')
    expect(result.hasMore).toBe(false)
  })
  it.each(['buyer', 'vehicle'] as const)(
    'rechaza sujeto no elegible antes de buscar contrapartes: %s',
    async (side) => {
      const client = {
        vehicle: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn() },
        buyerLead: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn() },
      }
      await expect(
        searchManualMatchCandidates(client as never, {
          side,
          fixedId: 'missing',
          query: '',
          page: 0,
        })
      ).rejects.toBeInstanceOf(ManualMatchError)
      expect(client.vehicle.findMany).not.toHaveBeenCalled()
      expect(client.buyerLead.findMany).not.toHaveBeenCalled()
    }
  )
})
