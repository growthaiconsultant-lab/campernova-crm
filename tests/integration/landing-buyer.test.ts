import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { createGuardedTestPrisma } from './db'
import { landingBuyerPayload } from '../fixtures/landing-buyer'
import { landingBuyerSchema, landingBuyerId, saveLandingBuyer } from '@/lib/landing/buyer-intake'
import { LandingRateLimitError } from '@/lib/landing/seller-intake'
import { attributionFromActivities, landingCaptureSelection } from '@/lib/landing/attribution'

let db: PrismaClient, other: PrismaClient
const ids: string[] = []
beforeAll(() => {
  db = createGuardedTestPrisma()
  other = createGuardedTestPrisma()
})
afterEach(async () => {
  await db.kpiEvent.deleteMany({ where: { entityId: { in: ids } } })
  await db.buyerLead.deleteMany({ where: { id: { in: ids } } })
  ids.length = 0
})
afterAll(async () => {
  await Promise.all([db.$disconnect(), other.$disconnect()])
})
function input() {
  const p = landingBuyerSchema.parse(landingBuyerPayload(randomUUID()))
  ids.push(landingBuyerId(p))
  return p
}
describe('buyer landing · PostgreSQL real', () => {
  it('stores missing email and imprecise preferences as null with consent and one KPI', async () => {
    const p = input(),
      now = new Date()
    await saveLandingBuyer(db, p, '192.0.2.80', now)
    const lead = await db.buyerLead.findUniqueOrThrow({
      where: { id: landingBuyerId(p) },
      include: { activities: true },
    })
    expect(lead).toMatchObject({
      email: null,
      source: 'PRO',
      status: 'NUEVO',
      agentId: null,
      vehicleType: null,
      maxBudget: null,
      minSeats: null,
      sleepingPlacesRequired: null,
      useZone: null,
      purchaseTimeline: null,
      financingNeeded: null,
      hasTradeIn: null,
      gdprConsentAt: now,
      gdprConsentIp: '192.0.2.80',
    })
    expect(lead.activities).toHaveLength(1)
    expect(lead.activities[0].content).toContain('Rango de plazas para dormir indicado: 1 o 2')
    expect(lead.activities[0].content).toContain('Girona')
    expect(await db.kpiEvent.count({ where: { entityId: lead.id } })).toBe(1)
  })
  it('stores concrete choices and serializes concurrent identical requests from two clients', async () => {
    const p = input()
    p.respuestas.tipo = 'Autocaravana'
    p.respuestas.presupuesto = '50.000–65.000 €'
    p.respuestas.cuando = 'En 1 a 3 meses'
    p.respuestas.financiacion = 'Sí'
    p.respuestas.entrega = 'No'
    const id = landingBuyerId(p)
    ids.push(id)
    await Promise.all([
      saveLandingBuyer(db, p, '192.0.2.81'),
      saveLandingBuyer(other, p, '192.0.2.82'),
    ])
    await saveLandingBuyer(db, p, '192.0.2.81')
    const lead = await db.buyerLead.findUniqueOrThrow({ where: { id } })
    expect(lead).toMatchObject({
      vehicleType: 'AUTOCARAVANA',
      purchaseTimeline: '1_3_meses',
      financingNeeded: true,
      hasTradeIn: false,
    })
    expect(Number(lead.maxBudget)).toBe(65000)
    expect(await db.buyerLead.count({ where: { id } })).toBe(1)
    expect(await db.activity.count({ where: { buyerLeadId: id } })).toBe(1)
    expect(await db.kpiEvent.count({ where: { entityId: id } })).toBe(1)
  })
  it.each([
    ['instagram', 'INSTAGRAM'],
    ['facebook', 'META'],
  ])(
    'persists %s source and the complete campaign once under concurrent retries',
    async (utm_source, source) => {
      const p = input()
      p.respuestas.atribucion = {
        utm_source,
        utm_campaign: 'qa_buyer',
        utm_content: 'qa_creative',
        campaign_id: 'qa_campaign',
        adset_id: 'qa_set',
        ad_id: 'qa_ad',
      }
      const id = landingBuyerId(p)
      ids.push(id)
      await Promise.all([saveLandingBuyer(db, p, null), saveLandingBuyer(other, p, null)])
      const lead = await db.buyerLead.findUniqueOrThrow({
        where: { id },
        include: { activities: landingCaptureSelection },
      })
      expect(lead.source).toBe(source)
      expect(lead.activities).toHaveLength(1)
      expect(attributionFromActivities(lead.activities)).toMatchObject({
        landing: '/encuentra-tu-camper.html',
        params: p.respuestas.atribucion,
      })
      const events = await db.kpiEvent.findMany({ where: { entityId: id } })
      expect(events).toHaveLength(1)
      expect(events[0].metadata).toEqual({ campaign: 'encuentra-tu-camper', buyerSource: source })
    }
  )
  it('enforces per-IP quota under race and permits confirmed retries without partial writes', async () => {
    const ip = `test-${randomUUID()}`,
      now = new Date()
    for (let i = 0; i < 9; i++) {
      const p = input()
      p.respuestas.atribucion = { utm_source: ['instagram', 'facebook', 'other'][i % 3] }
      ids.push(landingBuyerId(p))
      await saveLandingBuyer(db, p, ip, now)
    }
    const a = input(),
      b = input()
    const r = await Promise.allSettled([
      saveLandingBuyer(db, a, ip, now),
      saveLandingBuyer(other, b, ip, now),
    ])
    expect(r.filter((v) => v.status === 'fulfilled')).toHaveLength(1)
    expect((r.find((v) => v.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(
      LandingRateLimitError
    )
    expect(await db.buyerLead.count({ where: { gdprConsentIp: ip } })).toBe(10)
    const accepted = r[0].status === 'fulfilled' ? a : b
    await expect(saveLandingBuyer(db, accepted, ip, now)).resolves.toBeUndefined()
    const rejected = r[0].status === 'fulfilled' ? b : a
    expect(await db.buyerLead.count({ where: { id: landingBuyerId(rejected) } })).toBe(0)
  })
})
