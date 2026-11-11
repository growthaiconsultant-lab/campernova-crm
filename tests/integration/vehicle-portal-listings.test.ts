import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { uniqueSuffix } from './db'
vi.mock('@/lib/db', async () => ({ db: (await import('./db')).createGuardedTestPrisma() }))
vi.mock('@/lib/auth', () => ({ requireAgente: async () => ({ id: 'qa', role: 'AGENTE' }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import { db } from '@/lib/db'
import { savePortalListing } from '@/app/(backoffice)/vendedores/[id]/portal-actions'
let ownerId: string, otherId: string, vehicleId: string, buyerId: string, userId: string
beforeAll(async () => {
  const seller = await db.sellerLead.create({ data: { name: 'Prueba de venta' } }),
    other = await db.sellerLead.create({ data: { name: 'Otro vendedor' } })
  ownerId = seller.id
  otherId = other.id
  vehicleId = (await db.vehicle.create({ data: { sellerLeadId: ownerId, status: 'RESERVADO' } })).id
  buyerId = (await db.buyerLead.create({ data: { name: 'Prueba', phone: '0000' } })).id
  userId = (
    await db.user.create({ data: { email: uniqueSuffix() + '@example.test', name: 'Agente' } })
  ).id
  await db.match.create({ data: { vehicleId, buyerLeadId: buyerId, score: 70, status: 'VISITA' } })
  await db.offer.create({
    data: {
      vehicleId,
      buyerLeadId: buyerId,
      amount: 48500.25,
      depositAmount: 1000.5,
      reservedUntil: new Date('2027-01-31'),
      status: 'ACEPTADA',
      createdById: userId,
    },
  })
})
afterAll(async () => {
  if (vehicleId) await db.vehicle.delete({ where: { id: vehicleId } })
  if (buyerId) await db.buyerLead.delete({ where: { id: buyerId } })
  if (ownerId) await db.sellerLead.deleteMany({ where: { id: { in: [ownerId, otherId] } } })
  if (userId) await db.user.delete({ where: { id: userId } })
  await db.$disconnect()
})
const input = {
  action: 'publish',
  channel: 'WALLAPOP',
  revision: 0,
  url: 'https://es.wallapop.com/item/qa-camper',
  publishedOn: '2025-02-28',
}
it('guarda ambos portales, protege las ediciones concurrentes y mantiene la reserva y los compradores originales', async () => {
  const before = await db.offer.findMany({ where: { vehicleId } }),
    matches = await db.match.findMany({ where: { vehicleId } })
  const save = (data: unknown) => savePortalListing(ownerId, vehicleId, data)
  expect(await savePortalListing(otherId, vehicleId, input)).toHaveProperty('error')
  const results = await Promise.all([
    save(input),
    save(input),
    save({ ...input, channel: 'COCHESNET', url: 'https://www.coches.net/camper-qa' }),
  ])
  expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }])
  const race = await Promise.all(
    ['03-04', '03-05'].map((day) => save({ ...input, revision: 1, publishedOn: '2025-' + day }))
  )
  expect(race.filter((x) => 'ok' in x && x.ok)).toHaveLength(1)
  expect(race.filter((x) => 'stale' in x && x.stale)).toHaveLength(1)
  expect(await save({ action: 'withdraw', channel: 'WALLAPOP', revision: 2 })).toEqual({ ok: true })
  expect(await save({ ...input, revision: 1 })).toHaveProperty('stale', true)
  expect(
    await db.vehiclePortalListing.findMany({ where: { vehicleId }, orderBy: { channel: 'asc' } })
  ).toMatchObject([
    { channel: 'WALLAPOP', revision: 3, withdrawnAt: expect.any(Date) },
    { channel: 'COCHESNET', revision: 1, withdrawnAt: null, publishedOn: new Date('2025-02-28') },
  ])
  expect(await db.offer.findMany({ where: { vehicleId } })).toEqual(before)
  expect(await db.match.findMany({ where: { vehicleId } })).toEqual(matches)
  await db.sellerLead.update({ where: { id: ownerId }, data: { archivedAt: new Date() } })
  expect(await save({ ...input, revision: 3 })).toHaveProperty('error')
})
