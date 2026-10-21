import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { User } from '@prisma/client'
import { uniqueSuffix } from './db'

vi.mock('@/lib/db', async () => {
  const { createGuardedTestPrisma } = await import('./db')
  return { db: createGuardedTestPrisma() }
})
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAgente: vi.fn() }))
vi.mock('@/lib/matching', () => ({ recalculateMatchesForBuyer: vi.fn() }))

import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { updateBuyerLead } from '@/app/(backoffice)/compradores/[id]/actions'

let actor: User
const ids: string[] = []
const staleForm = {
  name: 'Nombre anterior',
  email: null,
  phone: '600000000',
  status: 'NUEVO',
  agentId: null,
  maxBudget: 50000,
  useZone: '',
}
beforeAll(async () => {
  actor = await db.user.create({
    data: {
      authId: uniqueSuffix(),
      email: `${uniqueSuffix()}@example.test`,
      name: 'Agente de prueba',
      role: 'AGENTE',
    },
  })
  vi.mocked(requireAgente).mockResolvedValue(actor)
})
afterEach(async () => {
  await db.buyerLead.deleteMany({ where: { id: { in: ids.splice(0) } } })
  vi.mocked(requireAgente).mockResolvedValue(actor)
})
afterAll(async () => {
  if (actor) await db.user.delete({ where: { id: actor.id } })
  await db.$disconnect()
})
async function buyer() {
  const lead = await db.buyerLead.create({
    data: {
      name: 'Nombre actualizado',
      phone: '600000000',
      status: 'CONTACTADO',
      agentId: actor.id,
      maxBudget: 50000,
      useZone: '',
    },
  })
  ids.push(lead.id)
  return lead
}

describe('COM-11 autoguardado parcial — PostgreSQL', () => {
  it('dos fichas guardan campos distintos sin revertir datos, estado ni comercial', async () => {
    const lead = await buyer()
    const results = await Promise.all([
      updateBuyerLead(lead.id, { ...staleForm, maxBudget: 65000 }, ['maxBudget']),
      updateBuyerLead(lead.id, { ...staleForm, useZone: 'Costa' }, ['useZone']),
    ])
    expect(results).toEqual([{ ok: true }, { ok: true }])
    const persisted = await db.buyerLead.findUniqueOrThrow({ where: { id: lead.id } })
    expect(persisted).toMatchObject({
      name: 'Nombre actualizado',
      status: 'CONTACTADO',
      agentId: actor.id,
      useZone: 'Costa',
    })
    expect(Number(persisted.maxBudget)).toBe(65000)
    expect(await db.activity.count({ where: { buyerLeadId: lead.id } })).toBe(0)
  })
  it('persiste casillas y permite vaciar preferencias opcionales', async () => {
    const lead = await buyer()
    expect(
      await updateBuyerLead(
        lead.id,
        { ...staleForm, maxBudget: null, needsWinter: true, criticalEquipment: { solar: true } },
        ['maxBudget', 'needsWinter', 'criticalEquipment']
      )
    ).toEqual({ ok: true })
    expect(await db.buyerLead.findUniqueOrThrow({ where: { id: lead.id } })).toMatchObject({
      maxBudget: null,
      needsWinter: true,
      criticalEquipment: { solar: true },
    })
  })
  it('rechaza datos inválidos, nombres arbitrarios y cierre sin entrega', async () => {
    const lead = await buyer()
    expect(
      await updateBuyerLead(lead.id, { ...staleForm, maxBudget: -1 }, ['maxBudget'])
    ).toHaveProperty('error')
    expect(await updateBuyerLead(lead.id, staleForm, ['archivedAt'])).toHaveProperty('error')
    expect(
      await updateBuyerLead(lead.id, { ...staleForm, status: 'CERRADO' }, ['status'])
    ).toHaveProperty('error')
    const persisted = await db.buyerLead.findUniqueOrThrow({ where: { id: lead.id } })
    expect(Number(persisted.maxBudget)).toBe(50000)
    expect(persisted.status).toBe('CONTACTADO')
  })
  it('exige autorización antes de persistir', async () => {
    const lead = await buyer()
    vi.mocked(requireAgente).mockRejectedValueOnce(Error('Unauthorized'))
    await expect(
      updateBuyerLead(lead.id, { ...staleForm, useZone: 'Costa' }, ['useZone'])
    ).rejects.toThrow('Unauthorized')
    expect((await db.buyerLead.findUniqueOrThrow({ where: { id: lead.id } })).useZone).toBe('')
  })
})
