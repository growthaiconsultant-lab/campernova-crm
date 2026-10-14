import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { User } from '@prisma/client'
import { uniqueSuffix } from './db'

vi.mock('@/lib/db', async () => {
  const { createGuardedTestPrisma } = await import('./db')
  return { db: createGuardedTestPrisma() }
})
vi.mock('@/lib/auth', () => ({ requireAgente: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { updateBuyerQuickField } from '@/app/(backoffice)/compradores/quick-edit-actions'

let actor: User
const ids: string[] = []
beforeAll(async () => {
  actor = await db.user.create({
    data: { name: 'QA options', email: `${uniqueSuffix()}@example.test`, role: 'AGENTE' },
  })
  vi.mocked(requireAgente).mockResolvedValue(actor)
})
afterEach(async () => {
  await db.buyerLead.deleteMany({ where: { id: { in: ids.splice(0) } } })
})
afterAll(async () => {
  if (actor) await db.user.delete({ where: { id: actor.id } })
  await db.$disconnect()
})
async function fixture() {
  const lead = await db.buyerLead.create({
    data: {
      name: 'QA options',
      phone: '600000000',
      status: 'CONTACTADO',
      source: 'WEB',
      maxBudget: 45000,
      minSeats: 4,
    },
  })
  ids.push(lead.id)
  return lead
}
describe('COM-6 edición rápida — PostgreSQL real', () => {
  it.each([
    [{ field: 'source', value: 'WALLAPOP' }, { source: 'WALLAPOP' }],
    [{ field: 'source', value: null }, { source: null }],
    [{ field: 'temperature', value: 'HOT' }, { temperature: 'HOT' }],
    [
      { field: 'nextAction', value: { type: 'LLAMAR', dueAt: null } },
      { nextActionType: 'LLAMAR', nextActionDueAt: null },
    ],
  ])('actualiza exclusivamente %j y deja una Activity en un reintento', async (change, data) => {
    const lead = await fixture()
    const input = { leadId: lead.id, expectedUpdatedAt: lead.updatedAt.toISOString(), ...change }
    expect(await updateBuyerQuickField(input)).toEqual({ ok: true })
    expect(await updateBuyerQuickField(input)).toEqual({ ok: true })
    expect(await db.buyerLead.findUniqueOrThrow({ where: { id: lead.id } })).toEqual({
      ...lead,
      ...data,
      updatedAt: expect.any(Date),
    })
    expect(await db.activity.count({ where: { buyerLeadId: lead.id } })).toBe(1)
  })
  it('asigna y desasigna conservando el resto de la ficha', async () => {
    const lead = await fixture()
    expect(
      await updateBuyerQuickField({
        leadId: lead.id,
        expectedUpdatedAt: lead.updatedAt.toISOString(),
        field: 'agentId',
        value: actor.id,
      })
    ).toEqual({ ok: true })
    const assigned = await db.buyerLead.findUniqueOrThrow({ where: { id: lead.id } })
    expect(assigned).toEqual({ ...lead, agentId: actor.id, updatedAt: expect.any(Date) })
    expect(
      await updateBuyerQuickField({
        leadId: lead.id,
        expectedUpdatedAt: assigned.updatedAt.toISOString(),
        field: 'agentId',
        value: null,
      })
    ).toEqual({ ok: true })
    expect((await db.buyerLead.findUniqueOrThrow({ where: { id: lead.id } })).agentId).toBeNull()
    expect(
      await db.activity.count({ where: { buyerLeadId: lead.id, type: 'LEAD_ASIGNADO' } })
    ).toBe(2)
  })
  it('dos escritores concurrentes sobre la misma revisión sólo guardan uno', async () => {
    const lead = await fixture()
    const ref = { leadId: lead.id, expectedUpdatedAt: lead.updatedAt.toISOString() }
    const results = await Promise.all([
      updateBuyerQuickField({ ...ref, field: 'temperature', value: 'HOT' }),
      updateBuyerQuickField({ ...ref, field: 'temperature', value: 'COLD' }),
    ])
    expect(results.filter((result) => 'ok' in result)).toHaveLength(1)
    expect(results.filter((result) => 'error' in result)).toHaveLength(1)
    expect(await db.activity.count({ where: { buyerLeadId: lead.id } })).toBe(1)
  })
  it('auditoría fallida revierte el cambio', async () => {
    const lead = await fixture()
    vi.mocked(requireAgente).mockResolvedValueOnce({ ...actor, id: 'missing-actor' })
    await expect(
      updateBuyerQuickField({
        leadId: lead.id,
        expectedUpdatedAt: lead.updatedAt.toISOString(),
        field: 'temperature',
        value: 'HOT',
      })
    ).rejects.toThrow()
    expect(await db.buyerLead.findUniqueOrThrow({ where: { id: lead.id } })).toEqual(lead)
    expect(await db.activity.count({ where: { buyerLeadId: lead.id } })).toBe(0)
  })
})
