import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createGuardedTestPrisma, uniqueSuffix } from './db'
import { searchPayload } from '../fixtures/search-request'
import {
  saveSearchRequest,
  searchRequestId,
  searchSnapshotId,
  searchRequestSummary,
  SearchRequestConflict,
} from '../../lib/search-request/intake'
import { LandingRateLimitError } from '../../lib/landing/seller-intake'
import { defaultNextActionData } from '../../lib/next-action'
const db = createGuardedTestPrisma()
const other = createGuardedTestPrisma()
const prefix = `search_${uniqueSuffix()}`
let agents: string[] = []
beforeAll(async () => {
  agents = (
    await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        db.user.create({
          data: {
            name: `Asesor de prueba ${i}`,
            email: `${prefix}_${i}@example.invalid`,
            role: 'AGENTE',
          },
        })
      )
    )
  ).map((u) => u.id)
})
async function cleanup() {
  await db.$executeRaw`DELETE FROM buyer_lead_assignment`
  await db.kpiEvent.deleteMany({ where: { entityId: { startsWith: 'search_request_' } } })
  await db.buyerLead.deleteMany({ where: { id: { startsWith: 'search_request_' } } })
}
beforeEach(async () => {
  await cleanup()
  await db.user.updateMany({ where: { id: { in: agents } }, data: { active: true } })
  await db.$executeRaw`INSERT INTO buyer_lead_assignment (id, enabled, agent_ids, next_index) VALUES (1, true, ${agents}::text[], 0)`
})
afterAll(async () => {
  await cleanup()
  await db.user.deleteMany({ where: { id: { in: agents } } })
  await Promise.all([db.$disconnect(), other.$disconnect()])
})
describe('search request with real PostgreSQL and assignment trigger', () => {
  it('stores every answer, canonical facts, consent and a call with the assigned commercial', async () => {
    const input = searchPayload(true)
    input.answers.seats = '4'
    input.answers.sleeping = '2'
    input.answers.budgetLimit = '75000'
    input.answers.minInteriorHeight = '1.95'
    const now = new Date()
    await saveSearchRequest(db, input, '192.0.2.1', now)
    const id = searchRequestId(input.requestId)
    const lead = await db.buyerLead.findUniqueOrThrow({
      where: { id },
      include: { activities: true },
    })
    expect(lead).toMatchObject({
      name: input.answers.name,
      phone: input.answers.phone,
      email: input.answers.email,
      status: 'NUEVO',
      source: 'WEB',
      agentId: agents[0],
      minSeats: 4,
      sleepingPlacesRequired: 2,
      maxHeightM: null,
      maxBudget: null,
      gdprConsentAt: now,
      gdprConsentIp: '192.0.2.1',
      ...defaultNextActionData(now),
    })
    expect(lead.activities).toHaveLength(1)
    expect(lead.activities[0].content).toBe(searchRequestSummary(input))
    // Dedicated lookup is not lost when the last 50 activities no longer contain the snapshot.
    await db.activity.createMany({
      data: Array.from({ length: 51 }, () => ({
        type: 'NOTA',
        buyerLeadId: id,
        content: 'Nota posterior',
      })),
    })
    expect(
      (await db.activity.findUniqueOrThrow({ where: { id: searchSnapshotId(id) } })).content
    ).toContain('Altura interior mínima deseada (m): 1.95')
  })
  it('two independent clients retrying the same submission create one lead, snapshot, KPI and turn', async () => {
    const input = searchPayload()
    await Promise.all([saveSearchRequest(db, input, null), saveSearchRequest(other, input, null)])
    const id = searchRequestId(input.requestId)
    expect(await db.buyerLead.count({ where: { id } })).toBe(1)
    expect(await db.activity.count({ where: { buyerLeadId: id } })).toBe(1)
    expect(await db.kpiEvent.count({ where: { entityId: id } })).toBe(1)
    expect(await db.$queryRaw`SELECT next_index FROM buyer_lead_assignment`).toEqual([
      { next_index: 1 },
    ])
    await expect(
      saveSearchRequest(db, { ...input, answers: { ...input.answers, name: 'Otra persona' } }, null)
    ).rejects.toBeInstanceOf(SearchRequestConflict)
  })
  it('serializes the IP quota under a race, including missing IP; a retry remains accepted at quota', async () => {
    const inputs = Array.from({ length: 11 }, () => searchPayload())
    const results = await Promise.allSettled(
      inputs.map((input, i) => saveSearchRequest(i % 2 ? db : other, input, null))
    )
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(10)
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(rejected.reason).toBeInstanceOf(LandingRateLimitError)
    const accepted = inputs[results.findIndex((r) => r.status === 'fulfilled')]
    await saveSearchRequest(db, accepted, null)
    expect(await db.buyerLead.count({ where: { id: { startsWith: 'search_request_' } } })).toBe(10)
    const counts = await db.buyerLead.groupBy({
      by: ['agentId'],
      where: { id: { startsWith: 'search_request_' } },
      _count: true,
    })
    expect(counts.map((c) => c._count).sort()).toEqual([2, 2, 3, 3])
  })
  it('rolls back lead, snapshot and rotation if KPI insertion fails', async () => {
    const input = searchPayload()
    const id = searchRequestId(input.requestId)
    // Test-only DB trigger injects a late failure after the lead and assignment were written.
    await db.$executeRawUnsafe(
      "CREATE FUNCTION fail_search_kpi_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_id LIKE 'search_request_%' THEN RAISE EXCEPTION 'test fault'; END IF; RETURN NEW; END $$"
    )
    await db.$executeRawUnsafe(
      'CREATE TRIGGER fail_search_kpi_test BEFORE INSERT ON kpi_events FOR EACH ROW EXECUTE FUNCTION fail_search_kpi_test()'
    )
    try {
      await expect(saveSearchRequest(db, input, null)).rejects.toThrow()
      expect(await db.buyerLead.count({ where: { id } })).toBe(0)
      expect(await db.activity.count({ where: { buyerLeadId: id } })).toBe(0)
      expect(await db.$queryRaw`SELECT next_index FROM buyer_lead_assignment`).toEqual([
        { next_index: 0 },
      ])
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER fail_search_kpi_test ON kpi_events')
      await db.$executeRawUnsafe('DROP FUNCTION fail_search_kpi_test()')
    }
    await saveSearchRequest(db, input, null)
  })
  it('keeps requests when the pool is inactive and never updates an existing buyer by phone', async () => {
    await db.user.updateMany({ where: { id: { in: agents } }, data: { active: false } })
    const first = searchPayload()
    const second = searchPayload()
    await saveSearchRequest(db, first, null)
    await saveSearchRequest(db, second, null)
    const leads = await db.buyerLead.findMany({
      where: { id: { in: [searchRequestId(first.requestId), searchRequestId(second.requestId)] } },
    })
    expect(leads).toHaveLength(2)
    expect(leads.every((l) => l.agentId === null && l.nextActionType === 'LLAMAR')).toBe(true)
  })
})
