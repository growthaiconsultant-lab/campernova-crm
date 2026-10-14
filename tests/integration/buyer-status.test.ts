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
import { setBuyerStatus } from '@/app/(backoffice)/compradores/status-actions'

const ids: string[] = []
let actor: User
beforeAll(async () => {
  actor = await db.user.create({
    data: {
      authId: uniqueSuffix(),
      name: 'QA status',
      email: `${uniqueSuffix()}@example.test`,
      role: 'AGENTE',
    },
  })
  vi.mocked(requireAgente).mockResolvedValue(actor)
})
afterEach(async () => {
  vi.restoreAllMocks()
  await db.buyerLead.deleteMany({ where: { id: { in: ids.splice(0) } } })
})
afterAll(async () => {
  if (actor) await db.user.delete({ where: { id: actor.id } })
  await db.$disconnect()
})
async function fixture() {
  const lead = await db.buyerLead.create({
    data: {
      name: 'QA status',
      phone: '600000000',
      status: 'NUEVO',
      agentId: actor.id,
      source: 'INSTAGRAM',
      maxBudget: 50000,
      minSeats: 4,
      temperature: 'WARM',
      criticalEquipment: { heating: true },
    },
  })
  ids.push(lead.id)
  return lead
}

describe('COM-5 estado del comprador — PostgreSQL real', () => {
  it('COM-7 enum migrado, filtrado y corrección de No contesta conservan la ficha', async () => {
    const lead = await fixture()
    expect(
      await setBuyerStatus({ leadId: lead.id, expectedStatus: 'NUEVO', status: 'NO_CONTESTA' })
    ).toEqual({ ok: true })
    expect(await db.buyerLead.count({ where: { id: lead.id, status: 'NO_CONTESTA' } })).toBe(1)
    expect(await db.buyerLead.findUniqueOrThrow({ where: { id: lead.id } })).toEqual({
      ...lead,
      status: 'NO_CONTESTA',
      updatedAt: expect.any(Date),
    })
    expect(
      await setBuyerStatus({ leadId: lead.id, expectedStatus: 'NO_CONTESTA', status: 'CONTACTADO' })
    ).toEqual({ ok: true })
    expect(
      await db.activity.count({ where: { buyerLeadId: lead.id, type: 'CAMBIO_ESTADO' } })
    ).toBe(2)
    const values = await db.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'BuyerLeadStatus' AND e.enumlabel = 'NO_CONTESTA'
    `
    expect(values).toHaveLength(1)
  })
  it('persiste sólo estado y una Activity; permite filtrar y repetir sin duplicación', async () => {
    const lead = await fixture()
    const input = { leadId: lead.id, expectedStatus: 'NUEVO', status: 'CONTACTADO' }
    expect(await setBuyerStatus(input)).toEqual({ ok: true })
    expect(await setBuyerStatus(input)).toEqual({ ok: true })
    const saved = await db.buyerLead.findUniqueOrThrow({ where: { id: lead.id } })
    expect(saved).toEqual({ ...lead, status: 'CONTACTADO', updatedAt: expect.any(Date) })
    expect(await db.buyerLead.count({ where: { id: lead.id, status: 'CONTACTADO' } })).toBe(1)
    const activities = await db.activity.findMany({ where: { buyerLeadId: lead.id } })
    expect(activities).toHaveLength(1)
    expect(activities[0]).toMatchObject({
      type: 'CAMBIO_ESTADO',
      agentId: actor.id,
      content: 'Estado cambiado: Nuevo → Contactado',
    })
  })

  it('dos peticiones concurrentes no pisan destinos ni duplican auditoría', async () => {
    const lead = await fixture()
    const results = await Promise.all([
      setBuyerStatus({ leadId: lead.id, expectedStatus: 'NUEVO', status: 'CONTACTADO' }),
      setBuyerStatus({ leadId: lead.id, expectedStatus: 'NUEVO', status: 'CUALIFICADO' }),
    ])
    expect(results.filter((result) => 'ok' in result)).toHaveLength(1)
    expect(results.filter((result) => 'error' in result)).toHaveLength(1)
    const saved = await db.buyerLead.findUniqueOrThrow({ where: { id: lead.id } })
    expect(['CONTACTADO', 'CUALIFICADO']).toContain(saved.status)
    expect(await db.activity.count({ where: { buyerLeadId: lead.id } })).toBe(1)
  })

  it('revierte el estado si la auditoría falla por una FK inválida', async () => {
    const lead = await fixture()
    vi.mocked(requireAgente).mockResolvedValueOnce({ ...actor, id: 'missing-actor' })
    await expect(
      setBuyerStatus({ leadId: lead.id, expectedStatus: 'NUEVO', status: 'CONTACTADO' })
    ).rejects.toThrow()
    expect((await db.buyerLead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe('NUEVO')
    expect(await db.activity.count({ where: { buyerLeadId: lead.id } })).toBe(0)
  })

  it('Cerrado sin entrega conserva el estado y no crea Activity', async () => {
    const lead = await fixture()
    expect(
      await setBuyerStatus({ leadId: lead.id, expectedStatus: 'NUEVO', status: 'CERRADO' })
    ).toHaveProperty('error')
    expect((await db.buyerLead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe('NUEVO')
    expect(await db.activity.count({ where: { buyerLeadId: lead.id } })).toBe(0)
  })
})
