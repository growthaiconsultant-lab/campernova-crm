import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { uniqueSuffix } from './db'
import type { VehicleStatus } from '@prisma/client'
vi.mock('@/lib/db', async () => ({ db: (await import('./db')).createGuardedTestPrisma() }))
const actor = vi.hoisted(() => ({ role: 'ADMIN', id: '' }))
vi.mock('@/lib/auth', () => ({
  requireAgente: async () => actor,
  requireCanViewVehiculos: async () => actor,
  requireCanEditEntregas: async () => actor,
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/kpi/emit', () => ({ emitKpiEvent: vi.fn() }))
vi.mock('next/navigation', async (original) => ({
  ...(await original<typeof import('next/navigation')>()),
  useRouter: () => ({}),
  usePathname: () => '/comprar/vehiculos',
}))
import { db } from '@/lib/db'
import {
  forcePublishVehicle,
  publishVehicle,
  unpublishVehicle,
} from '@/app/(backoffice)/vendedores/[id]/actions'
import { discardInventoryVehicle } from '@/app/(backoffice)/vehiculos/discard-action'
import { createOffer, updateOfferStatus } from '@/app/(backoffice)/ofertas/actions'
import { updateDeliveryStatus } from '@/app/(backoffice)/entregas/actions'
import { getPublishedVehicleBySlug, getCatalogInventory, vehicleSlug } from '@/lib/public-catalog'
import { PUBLICADO_REQUIRED_DOCS, PUBLICADO_MIN_PHOTOS } from '@/lib/vehicle-legal/requirements'
import { readVehicleInventory } from '@/lib/vehicle-inventory'
import { emptyCriteria } from '@/lib/vehicle-inventory-filters'
import Page from '@/app/(backoffice)/vehiculos/page'
import PublicPage from '@/app/comprar/[id]/page'

const sellers: string[] = [],
  vehicles: string[] = [],
  deliveries: string[] = []
let buyerId: string
beforeAll(async () => {
  actor.id = (
    await db.user.create({
      data: { name: 'Prueba', role: 'ADMIN', email: uniqueSuffix() + '@example.test' },
    })
  ).id
  buyerId = (
    await db.buyerLead.create({ data: { name: 'Comprador de prueba privado', phone: '000000000' } })
  ).id
})
afterAll(async () => {
  await db.warranty.deleteMany({ where: { deliveryId: { in: deliveries } } })
  await db.activity.deleteMany({ where: { agentId: actor.id } })
  await db.delivery.deleteMany({ where: { id: { in: deliveries } } })
  await db.offer.deleteMany({ where: { vehicleId: { in: vehicles } } })
  await db.vehicleDocument.deleteMany({ where: { vehicleId: { in: vehicles } } })
  await db.vehicle.deleteMany({ where: { id: { in: vehicles } } })
  await db.sellerLead.deleteMany({ where: { id: { in: sellers } } })
  await db.buyerLead.delete({ where: { id: buyerId } })
  await db.user.delete({ where: { id: actor.id } })
  await db.$disconnect()
})
async function fixture(status: VehicleStatus, publishedAt: Date | null = null) {
  const brand = 'Demo' + uniqueSuffix()
  const seller = await db.sellerLead.create({
    data: {
      status: 'CONTACTADO',
      vehicle: { create: { brand, model: 'Nugget', status, publishedAt, salePrice: 46500 } },
    },
    include: { vehicle: true },
  })
  const v = seller.vehicle!
  sellers.push(seller.id)
  vehicles.push(v.id)
  return { v, slug: vehicleSlug(v), brand, seller }
}
async function delivery(vehicleId: string, offerId: string) {
  const d = await db.delivery.create({
    data: {
      vehicleId,
      offerId,
      buyerLeadId: buyerId,
      responsableId: actor.id,
      scheduledAt: new Date(),
      status: 'EN_CURSO',
      signedByName: 'Prueba',
      signedByDni: 'TEST',
      signatureUrl: 'prueba.png',
    },
  })
  deliveries.push(d.id)
  return d.id
}
it('publica sólo tras completar el expediente, retira, republica, reserva y vende conservando el enlace público', async () => {
  const { v, slug, brand } = await fixture('TASADO')
  const card = async () => renderToStaticMarkup(await Page({ searchParams: { brand } }))
  expect(await card()).toContain('Publicar en la web')
  expect(await publishVehicle(v.id)).toHaveProperty('error')
  expect(await getPublishedVehicleBySlug(slug)).toBeNull()
  await db.vehicle.update({
    where: { id: v.id },
    data: {
      plate: '1234ABC',
      vin: 'TESTVIN',
      desiredPrice: 44000,
      purchasePrice: 41000,
      itvValidUntil: new Date('2099-01-01'),
      chargeCheckedAt: new Date(),
      photos: {
        create: Array.from({ length: PUBLICADO_MIN_PHOTOS }, (_, order) => ({
          order,
          url: '/prueba.jpg',
        })),
      },
    },
  })
  await db.vehicleDocument.createMany({
    data: PUBLICADO_REQUIRED_DOCS.map((category) => ({
      vehicleId: v.id,
      category,
      name: 'Ejemplo',
      url: 'prueba',
    })),
  })
  expect(await card()).toContain('Publicar en la web')
  expect(await publishVehicle(v.id)).toEqual({ ok: true })
  expect((await getPublishedVehicleBySlug(slug))?.availability).toBe('Disponible')
  expect(await unpublishVehicle(v.id, { reason: null })).toEqual({ ok: true })
  expect(await getPublishedVehicleBySlug(slug)).toBeNull()
  expect(await publishVehicle(v.id)).toEqual({ ok: true })
  const offer = await createOffer({ vehicleId: v.id, buyerLeadId: buyerId, amount: 45200 })
  expect(offer.id).toBeTruthy()
  expect(await unpublishVehicle(v.id, { reason: null })).toHaveProperty('error')
  expect(await discardInventoryVehicle(v.id, 'PUBLICADO', '')).toHaveProperty('error')
  expect(
    await updateOfferStatus(offer.id!, 'ACEPTADA', { expectedVehicleId: 'otro' })
  ).toHaveProperty('error')
  const reserve = () =>
    updateOfferStatus(offer.id!, 'ACEPTADA', {
      expectedVehicleId: v.id,
      depositAmount: 1200,
      reservedUntil: '2027-01-15',
    })
  const both = await Promise.all([reserve(), reserve()])
  expect(both.filter((r) => !r.error)).toHaveLength(1)
  expect(
    (await db.offer.findUniqueOrThrow({ where: { id: offer.id } })).depositAmount?.toNumber()
  ).toBe(1200)
  expect((await getCatalogInventory()).reserved.map((x) => x.slug)).toContain(slug)
  expect((await getCatalogInventory()).available.map((x) => x.slug)).not.toContain(slug)
  const publicHtml = async () => renderToStaticMarkup(await PublicPage({ params: { id: slug } }))
  const reservedHtml = await publicHtml()
  expect(reservedHtml).toContain('Reservado')
  expect(reservedHtml).toContain('Ver vehículos disponibles')
  expect(reservedHtml).not.toContain('Solicitar información')
  expect(reservedHtml).not.toContain('Comprador de prueba privado')
  expect(await updateOfferStatus(offer.id!, 'CANCELADA')).toEqual({})
  expect((await getPublishedVehicleBySlug(slug))?.availability).toBe('Disponible')
  const second = await createOffer({ vehicleId: v.id, buyerLeadId: buyerId, amount: 45200 })
  expect(await updateOfferStatus(second.id!, 'ACEPTADA', { expectedVehicleId: v.id })).toEqual({})
  expect(await updateOfferStatus(second.id!, 'CONVERTIDA')).toEqual({})
  expect((await getPublishedVehicleBySlug(slug))?.availability).toBe('Reservado')
  const deliveryId = await delivery(v.id, second.id!)
  expect(await updateDeliveryStatus(deliveryId, 'COMPLETADA')).toEqual({ ok: true })
  expect((await getPublishedVehicleBySlug(slug))?.availability).toBe('Vendido')
  expect(await publicHtml()).toContain('https://schema.org/SoldOut')
  const catalogue = await getCatalogInventory()
  expect([...catalogue.available, ...catalogue.reserved].map((x) => x.slug)).not.toContain(slug)
})
it('las operaciones internas sin publicación fechada no exponen el anuncio; la primera reserva de un anuncio público antiguo conserva el enlace', async () => {
  for (const state of ['RESERVADO', 'VENDIDO'] as const) {
    const { slug } = await fixture(state)
    expect(await getPublishedVehicleBySlug(slug)).toBeNull()
  }
  const { v, slug } = await fixture('PUBLICADO')
  const offer = await createOffer({ vehicleId: v.id, buyerLeadId: buyerId, amount: 12000 })
  expect(await updateOfferStatus(offer.id!, 'ACEPTADA', { expectedVehicleId: v.id })).toEqual({})
  expect((await getPublishedVehicleBySlug(slug))?.availability).toBe('Reservado')
})
it('descarta sólo el vehículo, conserva vendedor y motivo, y tolera un reintento', async () => {
  const { v, seller, slug } = await fixture('PUBLICADO', new Date())
  expect(await discardInventoryVehicle(v.id, 'NUEVO', '')).toHaveProperty('error')
  const discard = () => discardInventoryVehicle(v.id, 'PUBLICADO', 'Coste de preparación')
  const results = await Promise.all([discard(), discard()])
  expect(results).toEqual([{ ok: true }, { ok: true }])
  expect((await db.vehicle.findUniqueOrThrow({ where: { id: v.id } })).status).toBe('DESCARTADO')
  expect((await db.sellerLead.findUniqueOrThrow({ where: { id: seller.id } })).status).toBe(
    'CONTACTADO'
  )
  expect(
    await db.activity.count({
      where: { sellerLeadId: seller.id, content: { contains: 'Coste de preparación' } },
    })
  ).toBe(1)
  expect(await getPublishedVehicleBySlug(slug)).toBeNull()
})
it('serializa oferta y descarte, y bloquea el descarte ante una entrega activa', async () => {
  const { v } = await fixture('PUBLICADO', new Date())
  const [offer, discard] = await Promise.all([
    createOffer({ vehicleId: v.id, buyerLeadId: buyerId, amount: 12000 }),
    discardInventoryVehicle(v.id, 'PUBLICADO', ''),
  ])
  expect(Boolean(offer.id)).not.toBe(Boolean(discard.ok))
  if (discard.ok) expect(await db.offer.count({ where: { vehicleId: v.id } })).toBe(0)
  else
    expect((await db.vehicle.findUniqueOrThrow({ where: { id: v.id } })).status).toBe('PUBLICADO')
  const second = await fixture('TASADO')
  const converted = await db.offer.create({
    data: {
      vehicleId: second.v.id,
      buyerLeadId: buyerId,
      amount: 12000,
      status: 'CONVERTIDA',
      createdById: actor.id,
    },
  })
  await delivery(second.v.id, converted.id)
  expect((await discardInventoryVehicle(second.v.id, 'TASADO', '')).error).toMatch(/entrega/)
  await db.vehicle.update({ where: { id: second.v.id }, data: { status: 'PUBLICADO' } })
  expect(await unpublishVehicle(second.v.id, { reason: null })).toHaveProperty(
    'error',
    expect.stringContaining('entrega activa')
  )
  const backup = await db.offer.create({
    data: {
      vehicleId: second.v.id,
      buyerLeadId: buyerId,
      amount: 12000,
      status: 'PROPUESTA',
      createdById: actor.id,
    },
  })
  expect(
    (await updateOfferStatus(backup.id, 'ACEPTADA', { expectedVehicleId: second.v.id })).error
  ).toMatch(/entrega activa/)
})

it('la tarjeta exige revisar un precio que acaba de faltar y permite publicar sin él tras revisión', async () => {
  const { v, brand, slug } = await fixture('NUEVO')
  const read = async () => {
    const inventory = await readVehicleInventory(
      db,
      { ...emptyCriteria, brand },
      'createdAt:desc',
      1
    )
    return inventory.vehicles
      .find((vehicle) => vehicle.id === v.id)!
      .publicationPending.map((item) => item.field)
  }
  const reviewed = await read()
  expect(reviewed).not.toContain('salePrice')
  await db.vehicle.update({ where: { id: v.id }, data: { salePrice: null } })
  expect(await forcePublishVehicle(v.id, reviewed)).toHaveProperty('error')
  expect(await getPublishedVehicleBySlug(slug)).toBeNull()
  const refreshed = await read()
  expect(refreshed).toContain('salePrice')
  expect(await forcePublishVehicle(v.id, refreshed)).toEqual({ ok: true })
  expect(await getPublishedVehicleBySlug(slug)).toMatchObject({
    availability: 'Disponible',
    price: null,
  })
  expect(renderToStaticMarkup(await PublicPage({ params: { id: slug } }))).toContain(
    'Precio a consultar'
  )
})
