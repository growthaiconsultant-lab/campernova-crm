import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { uniqueSuffix } from './db'
import type { User } from '@prisma/client'

vi.mock('@/lib/db', async () => {
  const { createGuardedTestPrisma } = await import('./db')
  return { db: createGuardedTestPrisma() }
})
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAgente: vi.fn() }))
vi.mock('@/lib/matching', () => ({ recalculateMatchesForBuyer: vi.fn() }))
vi.mock('@/lib/kpi/emit', () => ({ emitKpiEvent: vi.fn() }))

import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { emitKpiEvent } from '@/lib/kpi/emit'
import { createBuyerLead } from '@/app/(backoffice)/compradores/actions'
import { updateBuyerLead } from '@/app/(backoffice)/compradores/[id]/actions'
import { buyerSourceFilter } from '@/lib/buyer-source'

const ids: string[] = []
afterEach(async () => {
  await db.buyerLead.deleteMany({ where: { id: { in: ids.splice(0) } } })
  vi.clearAllMocks()
})
afterAll(() => db.$disconnect())
async function create(source?: string | null) {
  vi.mocked(requireAgente).mockResolvedValue({ id: 'qa-actor', role: 'AGENTE' } as User)
  const suffix = uniqueSuffix()
  const contact = {
    name: 'QA source',
    email: `${suffix}@example.test`,
    phone: `6${Date.now()}${suffix}`,
    source,
  }
  const result = await createBuyerLead(contact, true)
  if (!('leadId' in result) || !result.leadId) throw Error('Expected lead')
  ids.push(result.leadId)
  return { id: result.leadId, contact }
}
describe('COM-1 alta/edición comercial — persistencia PostgreSQL real', () => {
  it.each(['INSTAGRAM', 'COCHES_NET', 'WALLAPOP', 'WEB', 'PRESENCIAL', 'LLAMADA', 'OTROS'])(
    'guarda y encuentra %s',
    async (source) => {
      const f = await create(source)
      expect((await db.buyerLead.findUniqueOrThrow({ where: { id: f.id } })).source).toBe(source)
      expect(await db.buyerLead.count({ where: { id: f.id, ...buyerSourceFilter(source) } })).toBe(
        1
      )
      expect(emitKpiEvent).toHaveBeenCalledWith(expect.objectContaining({ source: 'ui' }))
      expect(
        await updateBuyerLead(f.id, {
          ...f.contact,
          source: 'WALLAPOP',
          status: 'NUEVO',
          agentId: null,
        })
      ).toEqual({ ok: true })
      expect((await db.buyerLead.findUniqueOrThrow({ where: { id: f.id } })).source).toBe(
        'WALLAPOP'
      )
    }
  )
  it('alta anterior queda null; edición omitida conserva source legacy y null explícito lo borra', async () => {
    const f = await create()
    expect((await db.buyerLead.findUniqueOrThrow({ where: { id: f.id } })).source).toBeNull()
    await db.buyerLead.update({ where: { id: f.id }, data: { source: 'REFERIDO_ANTIGUO' } })
    const patch = { ...f.contact, status: 'NUEVO', agentId: null }
    expect(await updateBuyerLead(f.id, patch)).toEqual({ ok: true })
    expect((await db.buyerLead.findUniqueOrThrow({ where: { id: f.id } })).source).toBe(
      'REFERIDO_ANTIGUO'
    )
    expect(await updateBuyerLead(f.id, { ...patch, source: null })).toEqual({ ok: true })
    expect((await db.buyerLead.findUniqueOrThrow({ where: { id: f.id } })).source).toBeNull()
  })
  it.each(['CHAT', 'CHAT_WEB', 'PRO'])(
    'Web y filtros específicos recuperan %s histórico',
    async (source) => {
      const f = await create(source)
      expect(await db.buyerLead.count({ where: { id: f.id, ...buyerSourceFilter('WEB') } })).toBe(1)
      expect(await db.buyerLead.count({ where: { id: f.id, ...buyerSourceFilter(source) } })).toBe(
        1
      )
    }
  )
  it('rechaza fuente inválida y sesión no autorizada sin crear ficha', async () => {
    const before = await db.buyerLead.count()
    vi.mocked(requireAgente).mockResolvedValue({ id: 'qa-actor', role: 'AGENTE' } as User)
    expect(
      await createBuyerLead({
        name: 'QA',
        email: 'qa@example.test',
        phone: '600111222',
        source: 'INVENTADO',
      })
    ).toHaveProperty('error')
    vi.mocked(requireAgente).mockRejectedValue(new Error('No autorizado'))
    await expect(
      createBuyerLead({
        name: 'QA',
        email: 'qa@example.test',
        phone: '600111222',
        source: 'INSTAGRAM',
      })
    ).rejects.toThrow('No autorizado')
    expect(await db.buyerLead.count()).toBe(before)
  })
})
