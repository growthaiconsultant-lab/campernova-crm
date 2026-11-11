import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createGuardedTestPrisma, uniqueSuffix } from './db'
import type { Prisma, LeadCanal, SellerIntakeStatus } from '@prisma/client'
import {
  emptyCriteria,
  type InventoryCriteria,
  type InventoryOrder,
} from '@/lib/vehicle-inventory-filters'
import { readVehicleInventory } from '@/lib/vehicle-inventory'
const actor = vi.hoisted(() => ({ role: 'AGENTE', id: '' }))
vi.mock('@/lib/auth', () => ({
  requireCanViewVehiculos: async () => actor,
  requireAdmin: async () => {
    if (actor.role !== 'ADMIN') throw Error('Se requiere administración')
    return actor
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import { setMissingSalePrice } from '@/app/(backoffice)/vendedores/[id]/cost-actions'
vi.mock('@/lib/db', async () => ({ db: (await import('./db')).createGuardedTestPrisma() }))
vi.mock('next/navigation', async (original) => ({
  ...(await original<typeof import('next/navigation')>()),
  useRouter: () => ({}),
}))
import Page from '@/app/(backoffice)/vehiculos/page'
import { db as routeDb } from '@/lib/db'

const db = createGuardedTestPrisma()
const marker = 'Inv' + uniqueSuffix()
const owners: string[] = []
const budget = {
  ...emptyCriteria,
  brand: marker + ' Volkswagen Crafter',
  type: 'CAMPER',
  status: 'PUBLICADO',
  origin: 'CN',
  priceMax: '60000.10',
  yearMin: '2020',
  yearMax: '2022',
  kmMax: '70000',
}
async function create(
  data: Prisma.VehicleUncheckedCreateWithoutSellerLeadInput = {},
  canal: LeadCanal = 'CN',
  intakeStatus: SellerIntakeStatus = 'ADMITIDO'
) {
  const owner = await db.sellerLead.create({
    data: {
      canal,
      intakeStatus,
      vehicle: {
        create: {
          brand: marker + ' Volkswagen',
          model: 'Crafter',
          type: 'CAMPER',
          status: 'PUBLICADO',
          year: 2020,
          km: 70000,
          salePrice: 60000.1,
          ...data,
        },
      },
    },
    include: { vehicle: true },
  })
  owners.push(owner.id)
  return owner.vehicle!
}
async function query(
  criteria: Partial<InventoryCriteria>,
  order: InventoryOrder = 'createdAt:desc',
  page = 1
) {
  return readVehicleInventory(db, { ...emptyCriteria, ...criteria }, order, page)
}
let match: string, sellerId: string
beforeAll(async () => {
  const first = await create({
    plate: '0001-DEM',
    valuationRecommended: 62000,
    desiredPrice: 64000,
    photos: {
      create: [
        { order: 2, url: '/otra.jpg' },
        { order: 1, url: '/foto-ejemplo.jpg', altText: 'Foto principal de prueba' },
      ],
    },
  })
  match = first.id
  sellerId = first.sellerLeadId
  await create({ salePrice: 60000.11, desiredPrice: 50000 })
  await create({ plate: 'REFERENCIA', salePrice: null, valuationRecommended: 48000 })
  await create({ type: 'AUTOCARAVANA' })
  await create({ status: 'RESERVADO' })
  await create({ year: 2019 })
  await create({ year: 2023 })
  await create({ km: 70001 })
  await create({ year: null })
  await create({ km: null })
  await create({}, 'PRO')
  await create({}, 'CN', 'PENDIENTE')
  await create({
    brand: marker + ' Citroën',
    model: 'Jumper 100%_XL',
    plate: '0002 DEM',
    salePrice: 0,
    km: 0,
  })
})
afterAll(async () => {
  await db.vehicle.deleteMany({ where: { sellerLeadId: { in: owners } } })
  await db.sellerLead.deleteMany({ where: { id: { in: owners } } })
  await Promise.all([db.$disconnect(), routeDb.$disconnect()])
})

it('aplica simultáneamente todos los límites e hidrata la tarjeta y su primera foto', async () => {
  const result = await query(budget)
  expect(result.error).toBeNull()
  expect(result.total).toBe(1)
  expect(result.vehicles.map((v) => v.id)).toEqual([match])
  expect(result.vehicles[0].photos.map((p) => p.url)).toEqual(['/foto-ejemplo.jpg'])
  const html = renderToStaticMarkup(await Page({ searchParams: budget }))
  for (const item of [
    '0001-DEM',
    'Foto principal de prueba',
    '60000',
    '60.000,10',
    'Alta interna',
    'Publicado',
    sellerId,
  ])
    expect(html).toContain(item)
})
it('encuentra palabras, acentos y matrículas con separadores y conserva cero como valor válido', async () => {
  for (const term of ['citroen jumper', '0002dem', '0002-dem', '0002 dem', '100%_XL']) {
    const res = await query({ brand: marker + ' ' + term, priceMax: '0', kmMax: '0' })
    expect(res.vehicles.map((v) => v.model)).toEqual(['Jumper 100%_XL'])
  }
  expect((await query({ brand: marker + ' 0001DEM' })).vehicles.map((v) => v.id)).toEqual([match])
  expect((await query({ brand: marker + ' %' })).total).toBe(1)
})
it('conserva la referencia de tasación de un vehículo sin foto ni precio de venta', async () => {
  const html = renderToStaticMarkup(await Page({ searchParams: { brand: marker + ' REFERENCIA' } }))
  expect(html).toContain('Sin precio de venta')
  expect(html).toContain('Tasación')
  expect(html).toContain('48.000')
  expect(html).not.toContain('<img')
})
it('ordena por precio real, sitúa los importes desconocidos al final y no amplía una búsqueda inválida', async () => {
  for (const order of ['salePrice:asc', 'salePrice:desc'] as const) {
    const { vehicles } = await query({ brand: marker }, order)
    expect(vehicles.at(-1)?.salePrice).toBeNull()
    const prices = vehicles.filter((v) => v.salePrice != null).map((v) => Number(v.salePrice))
    expect(prices).toEqual([...prices].sort((a, b) => (order.endsWith('asc') ? a - b : b - a)))
  }
  expect(await query({ ...budget, yearMin: '2024' })).toMatchObject({
    total: 0,
    vehicles: [],
    error: expect.any(String),
  })
  const none = await query({ ...budget, priceMax: '100' })
  expect(none).toMatchObject({ filtered: true, total: 0, vehicles: [], error: null })
})
it('pagina de forma estable cuando coinciden los precios y corrige páginas antiguas fuera de rango', async () => {
  const group = marker + ' Serie'
  const ids = Array.from({ length: 50 }, (_, i) => marker + '-owner-' + i)
  await db.sellerLead.createMany({ data: ids.map((id) => ({ id })) })
  owners.push(...ids)
  await db.vehicle.createMany({
    data: ids.map((sellerLeadId) => ({ sellerLeadId, brand: group, salePrice: 20000 })),
  })
  const first = await query({ brand: group }, 'salePrice:asc', 1),
    last = await query({ brand: group }, 'salePrice:asc', 40)
  expect(first.vehicles).toHaveLength(48)
  expect(last).toMatchObject({ total: 50, page: 2, pages: 2 })
  const all = [...first.vehicles, ...last.vehicles].map((v) => v.id)
  expect(new Set(all).size).toBe(50)
  expect(all).toEqual([...all].sort())
})

it('distingue el precio ausente del cero y de las referencias de tasación o del vendedor', async () => {
  const missing = await query({ brand: marker, priceState: 'missing' })
  expect(missing.vehicles.map((v) => v.plate)).toEqual(['REFERENCIA'])
  const priced = await query({ brand: marker, priceState: 'priced', priceMax: '0' })
  expect(priced.vehicles.map((v) => v.plate)).toEqual(['0002 DEM'])
})

it('solo administración asigna el primer precio desde una tarjeta, con una sola actividad ante carreras y reintentos', async () => {
  const target = await create({
    brand: 'Editor' + marker,
    salePrice: null,
    desiredPrice: 44000,
    valuationRecommended: 48000,
    purchasePrice: 42000,
  })
  const pending = await create({ brand: 'Captación' + marker, salePrice: null }, 'PRO', 'PENDIENTE')
  const search = { brand: 'Editor' + marker, priceState: 'missing' }
  const user = await db.user.create({
    data: {
      name: 'Administración de prueba',
      role: 'ADMIN',
      email: uniqueSuffix() + '@example.test',
    },
  })
  try {
    expect(renderToStaticMarkup(await Page({ searchParams: search }))).not.toContain(
      'Añadir precio'
    )
    await expect(setMissingSalePrice(target.id, '45500')).rejects.toThrow('administración')
    actor.id = user.id
    actor.role = 'ADMIN'
    expect(renderToStaticMarkup(await Page({ searchParams: search }))).toContain('Añadir precio')
    for (const amount of ['0', '-1', '1.999', '1e4', '100000000', '', null])
      expect((await setMissingSalePrice(target.id, amount)).ok).toBe(false)
    expect((await setMissingSalePrice(undefined as unknown as string, '1')).ok).toBe(false)
    expect((await setMissingSalePrice(pending.id, '1')).ok).toBe(false)
    const values = ['46500,25', '47500.30']
    const writes = await Promise.all(values.map((price) => setMissingSalePrice(target.id, price)))
    const index = writes.findIndex((x) => x.ok)
    expect(writes.filter((x) => x.ok)).toHaveLength(1)
    expect(await setMissingSalePrice(target.id, values[index])).toEqual({ ok: true })
    expect((await query(search)).total).toBe(0)
    const priced = await query({ ...search, priceState: 'priced' })
    expect(
      priced.vehicles.map((v) => [
        v.id,
        Number(v.salePrice),
        Number(v.desiredPrice),
        Number(v.valuationRecommended),
        Number(v.purchasePrice),
      ])
    ).toEqual([[target.id, Number(values[index].replace(',', '.')), 44000, 48000, 42000]])
    expect(
      renderToStaticMarkup(await Page({ searchParams: { ...search, priceState: 'priced' } }))
    ).not.toContain('Añadir precio')
    expect(
      await db.activity.count({
        where: {
          sellerLeadId: target.sellerLeadId,
          agentId: user.id,
          type: 'PRECIO_VENTA_AJUSTADO',
        },
      })
    ).toBe(1)
  } finally {
    actor.role = 'AGENTE'
    actor.id = ''
    await db.activity.deleteMany({ where: { agentId: user.id } })
    await db.user.delete({ where: { id: user.id } })
  }
})
