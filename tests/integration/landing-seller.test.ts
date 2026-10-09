import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { createGuardedTestPrisma } from './db'
import { landingPayload } from '../fixtures/landing-seller'
import {
  landingSellerSchema,
  landingLeadId,
  LANDING_SOURCE,
  LandingRateLimitError,
  saveLandingSeller,
} from '@/lib/landing/seller-intake'

let db: PrismaClient, other: PrismaClient
const ids: string[] = []
beforeAll(() => {
  db = createGuardedTestPrisma()
  other = createGuardedTestPrisma()
})
afterEach(async () => {
  await db.kpiEvent.deleteMany({ where: { entityId: { in: ids } } })
  await db.sellerLead.deleteMany({ where: { id: { in: ids } } })
  ids.length = 0
})
afterAll(async () => {
  await Promise.all([db.$disconnect(), other.$disconnect()])
})
function input() {
  const parsed = landingSellerSchema.parse(landingPayload(randomUUID()))
  ids.push(landingLeadId(parsed))
  return parsed
}

describe('landing seller · PostgreSQL real', () => {
  it('persists pending seller, vehicle, consent, original answers and one KPI atomically', async () => {
    const data = input(),
      now = new Date()
    await saveLandingSeller(db, data, '192.0.2.71', now)
    const lead = await db.sellerLead.findUniqueOrThrow({
      where: { id: landingLeadId(data) },
      include: { vehicle: true, activities: true },
    })
    expect(lead).toMatchObject({
      name: data.nombre,
      phone: data.contacto,
      email: null,
      canal: 'PRO',
      intakeStatus: 'PENDIENTE',
      status: 'NUEVO',
      gdprConsentAt: now,
      gdprConsentIp: '192.0.2.71',
    })
    expect(lead.vehicle).toMatchObject({
      brand: null,
      model: 'Volkswagen California Ocean',
      year: 2019,
      km: 85000,
      status: 'NUEVO',
      type: 'CAMPER',
      location: 'Sabadell',
    })
    expect(lead.activities).toHaveLength(1)
    expect(lead.activities[0].content).toContain('utm_campaign=landing')
    expect(await db.kpiEvent.count({ where: { entityId: lead.id } })).toBe(1)
  })
  it('serializes the same request from two clients/IPs without duplicates', async () => {
    const data = input(),
      id = landingLeadId(data)
    await Promise.all([
      saveLandingSeller(db, data, '192.0.2.72'),
      saveLandingSeller(other, data, '192.0.2.73'),
    ])
    await saveLandingSeller(db, data, '192.0.2.72')
    expect(await db.sellerLead.count({ where: { id } })).toBe(1)
    expect(await db.vehicle.count({ where: { sellerLeadId: id } })).toBe(1)
    expect(await db.activity.count({ where: { sellerLeadId: id } })).toBe(1)
    expect(await db.kpiEvent.count({ where: { entityId: id } })).toBe(1)
  })
  it('enforces quota under race, allows confirmed retries and leaves no partial lead', async () => {
    const ip = `test-${randomUUID()}`,
      now = new Date()
    for (let i = 0; i < 9; i++) {
      const data = input()
      await saveLandingSeller(db, data, ip, now)
    }
    const a = input(),
      b = input()
    const results = await Promise.allSettled([
      saveLandingSeller(db, a, ip, now),
      saveLandingSeller(other, b, ip, now),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const failure = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(failure.reason).toBeInstanceOf(LandingRateLimitError)
    expect(
      await db.sellerLead.count({ where: { source: LANDING_SOURCE, gdprConsentIp: ip } })
    ).toBe(10)
    const accepted = results[0].status === 'fulfilled' ? a : b
    await expect(saveLandingSeller(db, accepted, ip, now)).resolves.toBeUndefined()
    const rejectedId = landingLeadId(results[0].status === 'fulfilled' ? b : a)
    expect(await db.sellerLead.count({ where: { id: rejectedId } })).toBe(0)
  })
})
