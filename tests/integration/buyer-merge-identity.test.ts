import { randomInt } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createGuardedTestPrisma, uniqueSuffix } from './db'
import { buyerMergePreview, mergeBuyerLeads } from '@/lib/buyer-merge'
import { buyerSearchWhere } from '@/lib/buyer-search'
import { BuyerIdentityConflict, findBuyerIdentity, lockBuyerIdentity } from '@/lib/buyer-identity'
import { saveLandingBuyer, landingBuyerSchema } from '@/lib/landing/buyer-intake'
import { saveSearchRequest } from '@/lib/search-request/intake'
import { landingBuyerPayload } from '../fixtures/landing-buyer'
import { searchPayload } from '../fixtures/search-request'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAgente: vi.fn() }))
vi.mock('@/lib/matching', () => ({ recalculateMatchesForBuyer: vi.fn() }))
vi.mock('@/lib/db', async () => {
  const { createGuardedTestPrisma } = await import('./db')
  return { db: createGuardedTestPrisma() }
})
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { createBuyerLead } from '@/app/(backoffice)/compradores/actions'
import { addBuyerLeadNote } from '@/app/(backoffice)/compradores/[id]/actions'

const other = createGuardedTestPrisma()
const prefix = `merge-${uniqueSuffix()}`
let agents: string[] = []
let adminId: string
const phone = () => `6${randomInt(10000000, 99999999)}`
beforeAll(async () => {
  const admin = await db.user.create({
    data: { name: prefix, email: `${prefix}-admin@example.test`, role: 'ADMIN' },
  })
  adminId = admin.id
  vi.mocked(requireAgente).mockResolvedValue(admin)
  agents = (
    await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        db.user.create({
          data: {
            name: `${prefix}-${i}`,
            email: `${prefix}-${i}@example.test`,
            role: 'AGENTE',
          },
        })
      )
    )
  ).map((a) => a.id)
})
afterEach(async () => {
  await db.$executeRaw`DELETE FROM buyer_lead_assignment`
  const rows = await db.buyerLead.findMany({
    where: { name: { startsWith: prefix } },
    select: { id: true },
  })
  await db.kpiEvent.deleteMany({ where: { entityId: { in: rows.map((r) => r.id) } } })
  await db.buyerLead.deleteMany({
    where: { name: { startsWith: prefix }, mergedIntoId: { not: null } },
  })
  await db.buyerLead.deleteMany({ where: { name: { startsWith: prefix } } })
})
afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: [...agents, adminId] } } })
  await Promise.all([db.$disconnect(), other.$disconnect()])
})
async function pair() {
  const contact = phone()
  const target = await db.buyerLead.create({
    data: {
      name: `${prefix}-first`,
      phone: contact,
      agentId: agents[0],
      createdAt: new Date('2026-01-01'),
    },
  })
  const source = await db.buyerLead.create({
    data: {
      name: `${prefix}-second`,
      phone: `+34 ${contact}`,
      agentId: agents[1],
      createdAt: new Date('2026-02-01'),
    },
  })
  return { target, source }
}
async function plan(ids: string[]) {
  const p = await buyerMergePreview(db, ids)
  return {
    ids,
    actorId: adminId,
    responsibleId: p.responsible.id,
    targetVersion: p.target.updatedAt.toISOString(),
    sourceVersion: p.source.updatedAt.toISOString(),
  }
}
describe('buyer merge and identity against PostgreSQL', () => {
  it('keeps the first actual handler, every note and both original conversations; retries are idempotent', async () => {
    const { target, source } = await pair()
    const dates = [new Date('2026-03-01'), new Date('2026-03-02')]
    const notes = await Promise.all(
      [source, target].map((lead, i) =>
        db.activity.create({
          data: {
            type: 'NOTA',
            content: `Nota ${i}`,
            agentId: agents[1 - i],
            buyerLeadId: lead.id,
            createdAt: dates[i],
          },
        })
      )
    )
    await Promise.all(
      [target, source].map((lead) =>
        db.buyerChatSession.create({
          data: {
            sessionToken: uniqueSuffix(),
            buyerLeadId: lead.id,
            messages: [
              {
                role: 'user',
                content: `Conversación ${lead.id}`,
                timestamp: new Date().toISOString(),
              },
            ],
          },
        })
      )
    )
    const input = await plan([source.id, target.id])
    expect(input.responsibleId).toBe(agents[1])
    expect(await mergeBuyerLeads(db, input)).toBe(target.id)
    expect(await mergeBuyerLeads(other, input)).toBe(target.id)
    const unified = await db.buyerLead.findUniqueOrThrow({
      where: { id: target.id },
      include: { activities: true, chatSessions: true },
    })
    expect(unified.agentId).toBe(agents[1])
    expect(unified.chatSessions).toHaveLength(2)
    expect(
      (await db.buyerLead.findMany({ where: buyerSearchWhere(source.name) })).map((row) => row.id)
    ).toEqual([target.id])
    for (const original of notes)
      expect(unified.activities.find((a) => a.id === original.id)).toEqual({
        ...original,
        buyerLeadId: target.id,
      })
    expect(unified.activities.filter((a) => a.id === `buyer_merge_${source.id}`)).toHaveLength(1)
    expect(await db.buyerLead.findUniqueOrThrow({ where: { id: source.id } })).toMatchObject({
      mergedIntoId: target.id,
      agentId: agents[1],
    })
    await addBuyerLeadNote(source.id, 'Nota desde una pestaña antigua')
    expect(
      await db.activity.count({
        where: { buyerLeadId: target.id, content: 'Nota desde una pestaña antigua' },
      })
    ).toBe(1)
    const late = await db.activity.create({
      data: { buyerLeadId: source.id, type: 'NOTA', content: 'Actividad concurrente tardía' },
    })
    expect(late.buyerLeadId).toBe(target.id)
  })
  it('rejects stale previews and rolls back all moves if persistence fails', async () => {
    const { target, source } = await pair()
    await db.activity.create({
      data: { buyerLeadId: source.id, type: 'NOTA', content: 'Conservar' },
    })
    const input = await plan([target.id, source.id])
    await expect(
      mergeBuyerLeads(db, { ...input, sourceVersion: new Date(0).toISOString() })
    ).rejects.toThrow('cambiado')
    await expect(mergeBuyerLeads(db, { ...input, actorId: 'missing-actor' })).rejects.toThrow()
    expect(
      (await db.buyerLead.findUniqueOrThrow({ where: { id: source.id } })).mergedIntoId
    ).toBeNull()
    expect(
      await db.activity.count({ where: { buyerLeadId: source.id, content: 'Conservar' } })
    ).toBe(1)
  })
  it('blocks documents instead of silently reparenting private files', async () => {
    const { target, source } = await pair()
    await db.document.create({
      data: { buyerLeadId: source.id, type: 'OTROS', url: 'https://example.invalid/test' },
    })
    await expect(mergeBuyerLeads(db, await plan([target.id, source.id]))).rejects.toThrow(
      'documentos'
    )
    expect(
      (await db.buyerLead.findUniqueOrThrow({ where: { id: source.id } })).mergedIntoId
    ).toBeNull()
  })
  it('serializes web, questionnaire and manual intake into one buyer and one rotation turn', async () => {
    await db.$executeRaw`INSERT INTO buyer_lead_assignment(id,enabled,agent_ids,next_index) VALUES(1,true,${agents}::text[],0)`
    const contact = phone()
    const landing = landingBuyerPayload()
    landing.nombre = `${prefix}-race`
    landing.contacto = contact
    landing.respuestas.nombre = landing.nombre
    landing.respuestas.telefono = contact
    const search = searchPayload()
    search.answers.name = landing.nombre
    search.answers.phone = `+34${contact}`
    await Promise.all([
      saveLandingBuyer(db, landingBuyerSchema.parse(landing), '192.0.2.181'),
      saveSearchRequest(other, search, '192.0.2.182'),
      createBuyerLead({ name: landing.nombre, phone: contact, email: null }, true),
    ])
    const rows = await db.buyerLead.findMany({ where: { name: landing.nombre } })
    expect(rows).toHaveLength(1)
    expect(rows[0].agentId).toBe(agents[0])
    expect(await db.$queryRaw`SELECT next_index FROM buyer_lead_assignment`).toEqual([
      { next_index: 1 },
    ])
    expect(
      await db.kpiEvent.count({ where: { entityId: rows[0].id, eventName: 'buyer_created' } })
    ).toBe(1)
  })
  it('remembers a new telephone supplied on an existing email without changing responsibility', async () => {
    const original = await db.buyerLead.create({
      data: {
        name: `${prefix}-aliases`,
        phone: phone(),
        email: `${prefix}@example.test`,
        agentId: agents[2],
      },
    })
    const search = searchPayload()
    search.answers.name = original.name
    search.answers.email = original.email!
    search.answers.phone = phone()
    await saveSearchRequest(db, search, '192.0.2.185')
    const found = await other.$transaction(async (tx) => {
      await lockBuyerIdentity(tx)
      return findBuyerIdentity(tx, { phone: String(search.answers.phone) })
    })
    expect(found).toMatchObject({ id: original.id, agentId: agents[2] })
  })
  it('rejects conflicting phone/email identities without creating a third record', async () => {
    const first = await db.buyerLead.create({
      data: { name: `${prefix}-conflict-1`, phone: phone(), email: `${prefix}-one@example.test` },
    })
    const second = await db.buyerLead.create({
      data: { name: `${prefix}-conflict-2`, phone: phone(), email: `${prefix}-two@example.test` },
    })
    const search = searchPayload()
    search.answers.name = `${prefix}-conflict-3`
    search.answers.phone = first.phone
    search.answers.email = second.email!
    await expect(saveSearchRequest(db, search, '192.0.2.184')).rejects.toBeInstanceOf(
      BuyerIdentityConflict
    )
    expect(
      await db.buyerLead.count({ where: { name: { startsWith: `${prefix}-conflict` } } })
    ).toBe(2)
  })
})
