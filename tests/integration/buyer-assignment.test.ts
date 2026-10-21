import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createGuardedTestPrisma, uniqueSuffix } from './db'
import { activateBuyerAssignment } from '../../lib/buyer-assignment'

const db = createGuardedTestPrisma()
const prefix = `assignment_${uniqueSuffix()}`
let ids: string[]
let other: string
let seq = 0
const create = (agentId?: string) =>
  db.buyerLead.create({ data: { id: `${prefix}_${seq++}`, name: 'Test', phone: '000', agentId } })
async function config(next = 0) {
  await db.$executeRaw`INSERT INTO buyer_lead_assignment (id, enabled, agent_ids, next_index) VALUES (1, true, ${ids}::text[], ${next})`
}
beforeAll(async () => {
  const users = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      db.user.create({
        data: {
          name: 'Test',
          email: `${prefix}_${i}@example.invalid`,
          role: i === 0 ? 'ADMIN' : 'AGENTE',
        },
      })
    )
  )
  ids = users.slice(0, 4).map((user) => user.id)
  other = users[4].id
})
beforeEach(async () => {
  await db.$executeRaw`DELETE FROM buyer_lead_assignment`
  await db.buyerLead.deleteMany({ where: { id: { startsWith: prefix } } })
  await db.user.updateMany({ where: { id: { in: ids } }, data: { active: true } })
})
afterAll(async () => {
  await db.$executeRaw`DELETE FROM buyer_lead_assignment`
  await db.buyerLead.deleteMany({ where: { id: { startsWith: prefix } } })
  await db.user.deleteMany({ where: { email: { startsWith: prefix } } })
  await db.$disconnect()
})
describe('buyer assignment: real PostgreSQL trigger and operator', () => {
  it('is dormant until configured and preserves explicit assignment without consuming a turn', async () => {
    expect((await create()).agentId).toBeNull()
    await config()
    expect((await create(other)).agentId).toBe(other)
    for (let i = 0; i < 9; i++) expect((await create()).agentId).toBe(ids[i % 4])
  })
  it('serializes 24 concurrent inserts evenly', async () => {
    await config()
    const leads = await Promise.all(Array.from({ length: 24 }, () => create()))
    for (const id of ids) expect(leads.filter((lead) => lead.agentId === id)).toHaveLength(6)
  })
  it('rolls back the cursor with a failed intake and does not reassign updates', async () => {
    await config()
    await expect(
      db.$transaction(async (tx) => {
        await tx.buyerLead.create({ data: { name: 'Rollback', phone: '000' } })
        throw Error('ROLLBACK')
      })
    ).rejects.toThrow('ROLLBACK')
    const lead = await create()
    expect(lead.agentId).toBe(ids[0])
    expect(
      (await db.buyerLead.update({ where: { id: lead.id }, data: { agentId: null } })).agentId
    ).toBeNull()
    expect((await create()).agentId).toBe(ids[1])
  })
  it('skips inactive users and preserves intake when no eligible user exists', async () => {
    await config()
    await db.user.update({ where: { id: ids[0] }, data: { active: false } })
    expect((await create()).agentId).toBe(ids[1])
    await db.user.updateMany({ where: { id: { in: ids } }, data: { active: false } })
    expect((await create()).agentId).toBeNull()
  })
  it('backfills only null, preserves existing rows, continues cursor, and is idempotent', async () => {
    const prior = await create(other)
    for (let i = 0; i < 9; i++) await create()
    const result = await activateBuyerAssignment(db, ids)
    expect(result.assigned).toBe(9)
    expect(result.counts).toEqual({ [ids[0]]: 3, [ids[1]]: 2, [ids[2]]: 2, [ids[3]]: 2 })
    expect(await db.buyerLead.findUnique({ where: { id: prior.id } })).toEqual(prior)
    expect((await activateBuyerAssignment(db, ids)).assigned).toBe(0)
    expect((await create()).agentId).toBe(ids[1])
    expect(await db.activity.count({ where: { buyerLeadId: { startsWith: prefix } } })).toBe(9)
  })
  it('rejects wrong pools and exposes no public RLS policy or definer privileges', async () => {
    await config()
    await expect(activateBuyerAssignment(db, [...ids.slice(0, 3), other])).rejects.toThrow(
      'POOL_MISMATCH'
    )
    const rows = await db.$queryRaw<
      { relrowsecurity: boolean }[]
    >`SELECT relrowsecurity FROM pg_class WHERE oid = 'public.buyer_lead_assignment'::regclass`
    expect(rows[0].relrowsecurity).toBe(true)
    expect(
      await db.$queryRaw`SELECT * FROM pg_policies WHERE tablename = 'buyer_lead_assignment'`
    ).toEqual([])
    const functions = await db.$queryRaw<
      { prosecdef: boolean }[]
    >`SELECT prosecdef FROM pg_proc WHERE oid = 'public.assign_new_buyer_lead()'::regprocedure`
    expect(functions[0].prosecdef).toBe(false)
  })
  it('aborts a changed preflight without touching leads, activities, or configuration', async () => {
    const lead = await create()
    await expect(activateBuyerAssignment(db, ids, 2)).rejects.toThrow('PREFLIGHT_COUNT_CHANGED')
    expect(await db.buyerLead.findUnique({ where: { id: lead.id } })).toEqual(lead)
    expect(await db.$queryRaw`SELECT * FROM buyer_lead_assignment`).toEqual([])
    expect(await db.activity.count({ where: { buyerLeadId: lead.id } })).toBe(0)
  })
  it('covers bulk imports and supports disabling rotation without touching existing owners', async () => {
    await config()
    const data = Array.from({ length: 8 }, () => ({
      id: `${prefix}_${seq++}`,
      name: 'Bulk',
      phone: '000',
    }))
    await db.buyerLead.createMany({ data })
    const rows = await db.buyerLead.findMany({ where: { id: { in: data.map((row) => row.id) } } })
    for (const id of ids) expect(rows.filter((row) => row.agentId === id)).toHaveLength(2)
    await db.$executeRaw`UPDATE buyer_lead_assignment SET enabled = false WHERE id = 1`
    expect((await create()).agentId).toBeNull()
    expect(
      await db.buyerLead.findMany({ where: { id: { in: data.map((row) => row.id) } } })
    ).toEqual(rows)
  })
})
