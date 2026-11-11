import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { uniqueSuffix } from './db'
vi.mock('@/lib/db', async () => ({ db: (await import('./db')).createGuardedTestPrisma() }))
const actor = vi.hoisted(() => ({ id: '', role: 'AGENTE' }))
vi.mock('@/lib/auth', () => ({ requireCanGenerateAds: async () => actor }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import { db } from '@/lib/db'
import { saveVehicleAdText } from '@/app/(backoffice)/vendedores/[id]/ads-actions'

let vehicleId: string, sellerId: string, authorId: string, otherId: string
beforeAll(async () => {
  const user = async () =>
    (
      await db.user.create({
        data: { email: uniqueSuffix() + '@example.test', name: 'Agente de prueba' },
      })
    ).id
  authorId = await user()
  otherId = await user()
  actor.id = authorId
  sellerId = (await db.sellerLead.create({ data: {} })).id
  vehicleId = (await db.vehicle.create({ data: { sellerLeadId: sellerId } })).id
})
afterAll(async () => {
  if (vehicleId) await db.vehicle.delete({ where: { id: vehicleId } })
  if (sellerId) await db.sellerLead.delete({ where: { id: sellerId } })
  await db.user.deleteMany({ where: { id: { in: [authorId, otherId].filter(Boolean) } } })
  await db.$disconnect()
})
it('guarda por portal, protege la autoría y detecta ediciones concurrentes sin confirmar publicaciones', async () => {
  const input = { vehicleId, channel: 'WALLAPOP', content: 'Texto inicial', original: null }
  const [a, b] = await Promise.all([saveVehicleAdText(input), saveVehicleAdText(input)])
  expect(a.id).toBeTruthy()
  expect(b.id).toBe(a.id)
  const original = { id: a.id, content: input.content }
  const updates = await Promise.all(
    ['Nuevo A', 'Nuevo B'].map((content) => saveVehicleAdText({ ...input, original, content }))
  )
  expect(updates.filter((result) => result.id)).toHaveLength(1)
  expect(updates.filter((result) => result.error)).toHaveLength(1)
  const current = await db.vehicleAd.findUniqueOrThrow({ where: { id: a.id } })
  actor.id = otherId
  expect(
    (
      await saveVehicleAdText({
        ...input,
        original: { id: current.id, content: current.content },
        content: 'Cambio ajeno',
      })
    ).error
  ).toMatch(/permiso/)
  const other = await saveVehicleAdText({
    ...input,
    channel: 'COCHESNET',
    content: 'Texto independiente',
  })
  expect(other.id).toBeTruthy()
  expect(other.id).not.toBe(a.id)
  expect(await db.vehicleAd.count({ where: { vehicleId } })).toBe(2)
  expect(await db.vehiclePortalListing.count({ where: { vehicleId } })).toBe(0)
  expect((await db.vehicleAd.findUniqueOrThrow({ where: { id: a.id } })).content).toBe(
    current.content
  )
})
