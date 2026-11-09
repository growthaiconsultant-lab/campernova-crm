import { afterAll, expect, it, vi } from 'vitest'
import { createGuardedTestPrisma, uniqueSuffix } from './db'
import { saveSearchRequest, searchRequestId } from '@/lib/search-request/intake'
import { searchPayload } from '../fixtures/search-request'
import { assessPair } from '@/lib/matching/assessment'
import { prismaMatchingDeps } from '@/lib/matching/prisma-deps'
import { saveCatalog } from '@/app/(backoffice)/matches/catalog-actions'

const db = createGuardedTestPrisma()
vi.mock('@/lib/db', () => ({
  get db() {
    return db
  },
}))
vi.mock('@/lib/auth', () => ({ requireAgente: async () => ({ id: 'qa' }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/matching/notify', () => ({ notifyHighScoreMatches: vi.fn() }))
afterAll(() => db.$disconnect())
it('Marta: captación web, dos vehículos, datos pendientes, edición simultánea y límite firme', async () => {
  const sellers: string[] = []
  const request = searchPayload()
  request.answers.phone = String(600000000 + parseInt(uniqueSuffix().slice(0, 6), 16))
  request.answers.seats = '4'
  request.answers.sleeping = '4'
  request.vehicleBudget = 60000
  request.catalog = { solar: { values: ['Sí'] }, showerOptions: { values: ['Interior'] } }
  const id = searchRequestId(request.requestId)
  try {
    const vehicle = async (name: string, seats: number | null, solar: string) => {
      const seller = await db.sellerLead.create({ data: { name: 'QA ' + name } })
      sellers.push(seller.id)
      return db.vehicle.create({
        data: {
          sellerLeadId: seller.id,
          model: name,
          status: 'PUBLICADO',
          entryValidatedAt: new Date(),
          seats,
          sleepingPlaces: 4,
          salePrice: 60000,
          matchCatalog: { solar: { values: [solar] }, showerOptions: { values: ['Interior'] } },
        },
      })
    }
    const sierra = await vehicle('Sierra', 4, 'Sí'),
      costa = await vehicle('Costa', null, 'No')
    await saveSearchRequest(db, request, '192.0.2.120')
    const deps = prismaMatchingDeps(db),
      buyer = await deps.getBuyer(id)
    const check = async (vid: string) => assessPair((await deps.getVehicle(vid))!, buyer!)
    expect((await check(sierra.id)).confirmed).toHaveLength(2)
    expect((await check(costa.id)).state).toBe('pendiente')
    const suggestions = () =>
      db.match.findMany({ where: { buyerLeadId: id }, orderBy: { score: 'desc' } })
    expect((await suggestions()).map((m) => m.vehicleId)).toContain(sierra.id)
    expect((await suggestions()).map((m) => m.vehicleId)).not.toContain(costa.id)
    await db.vehicle.update({ where: { id: costa.id }, data: { seats: 4 } })
    const before = { solar: { values: ['No'] }, showerOptions: { values: ['Interior'] } }
    const edit = {
      side: 'vehicle',
      id: costa.id,
      before,
      after: { ...before, awning: { values: ['Sí'] } },
    }
    expect(await saveCatalog(edit)).toHaveProperty('ok', true)
    expect(await saveCatalog({ ...edit, after: {} })).toHaveProperty('error')
    expect(
      (await suggestions())
        .filter((m) => [sierra.id, costa.id].includes(m.vehicleId))
        .map((m) => m.score)
    ).toEqual([100, 50])
    await db.vehicle.update({ where: { id: costa.id }, data: { seats: 3 } })
    expect((await check(costa.id)).state).toBe('descartado')
    await db.vehicle.update({ where: { id: costa.id }, data: { seats: 4, salePrice: 60001 } })
    expect((await check(costa.id)).failed).toContain('Precio (€) ≤ 60000')
  } finally {
    await db.buyerLead.deleteMany({ where: { id } })
    await db.sellerLead.deleteMany({ where: { id: { in: sellers } } })
  }
})
