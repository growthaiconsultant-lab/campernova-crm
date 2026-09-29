import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { uniqueSuffix } from './db'

vi.mock('@/lib/auth', () => ({
  requireAuth: async () => ({ id: 'qa-search-3', role: 'AGENTE' }),
  requireAgente: async () => ({ id: 'qa-search-3', role: 'AGENTE' }),
  requireCanViewVehiculos: async () => ({ id: 'qa-search-3', role: 'AGENTE' }),
}))
vi.mock('@/app/(backoffice)/vendedores/leads-filters', () => ({ LeadsFilters: () => null }))
vi.mock('@/app/(backoffice)/vehiculos/vehicle-filters', () => ({ VehicleFilters: () => null }))
vi.mock('@/lib/db', async () => {
  const { createGuardedTestPrisma } = await import('./db')
  return { db: createGuardedTestPrisma() }
})
import { db } from '@/lib/db'
import { globalSearch } from '@/app/(backoffice)/search-actions'
import VendedoresPage from '@/app/(backoffice)/vendedores/page'
import VehiculosPage from '@/app/(backoffice)/vehiculos/page'
import { vehiclePlateSearchConditions } from '@/lib/vehicle-plate-search'

const marker = `search-3-${uniqueSuffix()}`
const sellers = Array.from({ length: 6 }, (_, i) => `${marker}-seller-${i}`)
const vehicles = sellers.map((_, i) => `${marker}-vehicle-${i}`)
const digits = String(parseInt(uniqueSuffix().slice(0, 6), 16) % 10000).padStart(4, '0')
const plate = `${digits}QAZ`
const formats = [plate, `${digits} QAZ`, `${digits}-QAZ`]

beforeAll(async () => {
  await db.sellerLead.createMany({
    data: sellers.map((id, i) => ({
      id,
      name: marker,
      canal: i === 1 || i === 5 ? 'PRO' : 'CN',
      intakeStatus: i === 5 ? 'PENDIENTE' : 'ADMITIDO',
    })),
  })
  await db.vehicle.createMany({
    data: vehicles.map((id, i) => ({
      id,
      sellerLeadId: sellers[i],
      brand: marker,
      model: 'Modelo QA',
      plate: i < 3 ? formats[i] : i === 3 ? '9999ZZZ' : i === 4 ? null : plate,
      status: i === 2 ? 'PUBLICADO' : 'NUEVO',
    })),
  })
})

afterAll(async () => {
  await db.vehicle.deleteMany({ where: { id: { in: vehicles } } })
  await db.sellerLead.deleteMany({ where: { id: { in: sellers } } })
  await db.$disconnect()
})

function destinations(html: string): string[] {
  return Array.from(
    new Set(
      Array.from(html.matchAll(/href="\/vendedores\/([^"]+)"/g))
        .map((match) => match[1])
        .filter((id) => sellers.includes(id))
    )
  ).sort()
}

describe('SEARCH-3 with real PostgreSQL', () => {
  it.each([0, 1, 2])(
    'finds stored formats through global and both lists, input format %i',
    async (index) => {
      const q = formats[index].toLowerCase()
      const results = await globalSearch(q)
      // Global historically searches all commercial records, including pending web leads.
      expect(
        results.vehiculos
          .map((hit) => hit.id)
          .filter((id) => vehicles.includes(id))
          .sort()
      ).toEqual([vehicles[0], vehicles[1], vehicles[2], vehicles[5]].sort())
      expect(
        results.vendedores
          .map((hit) => hit.id)
          .filter((id) => sellers.includes(id))
          .sort()
      ).toEqual([sellers[0], sellers[1], sellers[2], sellers[5]].sort())
      for (const hit of results.vehiculos.filter((hit) => vehicles.includes(hit.id))) {
        expect(hit.href).toBe(`/vendedores/${sellers[vehicles.indexOf(hit.id)]}`)
      }
      // Operational lists retain admission filters: pending web vehicle never leaks into stock.
      expect(
        destinations(renderToStaticMarkup(await VehiculosPage({ searchParams: { brand: q } })))
      ).toEqual(sellers.slice(0, 3).sort())
      expect(
        destinations(renderToStaticMarkup(await VendedoresPage({ searchParams: { q } })))
      ).toEqual(sellers.slice(0, 3).sort())
    }
  )

  it('supports fragments and combines plate with origin/status filters', async () => {
    const partial = `${digits.slice(2)}qa`
    expect(
      destinations(
        renderToStaticMarkup(
          await VehiculosPage({
            searchParams: { brand: partial, origin: 'PRO' },
          })
        )
      )
    ).toEqual([sellers[1]])
    expect(
      destinations(
        renderToStaticMarkup(
          await VehiculosPage({
            searchParams: { brand: plate, status: 'PUBLICADO' },
          })
        )
      )
    ).toEqual([sellers[2]])
    expect(
      destinations(
        renderToStaticMarkup(
          await VendedoresPage({
            searchParams: { q: plate, canal: 'CN' },
          })
        )
      )
    ).toEqual([sellers[0], sellers[2]].sort())
  })

  it('keeps brand/contact search and treats plate wildcard input literally', async () => {
    const results = await globalSearch(marker)
    expect(results.vehiculos.length).toBeGreaterThan(0)
    expect(results.vendedores.length).toBeGreaterThan(0)
    for (const q of ['%', '_', '\\', 'never-a-plate']) {
      expect(
        await db.vehicle.findMany({
          where: {
            id: { in: vehicles },
            OR: vehiclePlateSearchConditions(q),
          },
        })
      ).toEqual([])
    }
  })
})
