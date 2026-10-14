import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@prisma/client'

vi.mock('@/lib/auth', () => ({ requireAgente: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    buyerLead: { findUnique: vi.fn(), updateMany: vi.fn() },
    user: { findUnique: vi.fn() },
    activity: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/db', () => ({ db: mockDb }))
import { requireAgente } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { updateBuyerQuickField } from './quick-edit-actions'
import { BUYER_SOURCE_VALUES } from '@/lib/buyer-source'

const updatedAt = new Date('2026-10-14T10:00:00.000Z')
const ref = { leadId: 'buyer-1', expectedUpdatedAt: updatedAt.toISOString() }
const baseLead = {
  source: null,
  updatedAt,
  temperature: null,
  agentId: null,
  agent: null,
  nextActionType: null,
  nextActionDueAt: null,
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(requireAgente).mockResolvedValue({ id: 'actor-1', role: 'AGENTE' } as User)
  mockDb.$transaction.mockImplementation(async (fn: (tx: typeof mockDb) => Promise<unknown>) =>
    fn(mockDb)
  )
  mockDb.buyerLead.findUnique.mockResolvedValue(baseLead)
  mockDb.buyerLead.updateMany.mockResolvedValue({ count: 1 })
  mockDb.activity.create.mockResolvedValue({})
  mockDb.user.findUnique.mockResolvedValue({
    name: 'Comercial destino',
    active: true,
    role: 'AGENTE',
  })
})

describe('COM-6 opciones rápidas del comprador', () => {
  it.each(BUYER_SOURCE_VALUES)(
    'guarda origen %s sin modificar ningún otro campo',
    async (source) => {
      expect(await updateBuyerQuickField({ ...ref, field: 'source', value: source })).toEqual({
        ok: true,
      })
      expect(mockDb.buyerLead.updateMany).toHaveBeenCalledWith({
        where: { id: 'buyer-1', updatedAt },
        data: { source },
      })
      expect(mockDb.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'NOTA',
            agentId: 'actor-1',
            buyerLeadId: 'buyer-1',
          }),
        })
      )
    }
  )
  it('permite borrar explícitamente un origen legacy y deja traza', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue({ ...baseLead, source: 'REFERIDO_ANTIGUO' })
    expect(await updateBuyerQuickField({ ...ref, field: 'source', value: null })).toEqual({
      ok: true,
    })
    expect(mockDb.buyerLead.updateMany.mock.calls[0][0].data).toEqual({ source: null })
    expect(mockDb.activity.create.mock.calls[0][0].data.content).toBe(
      'Origen cambiado: REFERIDO_ANTIGUO → Sin especificar'
    )
  })
  it('cambiar temperatura conserva el origen legacy', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue({ ...baseLead, source: 'REFERIDO_ANTIGUO' })
    await updateBuyerQuickField({ ...ref, field: 'temperature', value: 'HOT' })
    expect(mockDb.buyerLead.updateMany.mock.calls[0][0].data).not.toHaveProperty('source')
  })
  it.each(['ADMIN', 'AGENTE'])(
    'guarda temperatura como %s sin cambiar otros campos',
    async (role) => {
      vi.mocked(requireAgente).mockResolvedValue({ id: 'actor-1', role } as User)
      expect(await updateBuyerQuickField({ ...ref, field: 'temperature', value: 'HOT' })).toEqual({
        ok: true,
      })
      expect(mockDb.buyerLead.updateMany).toHaveBeenCalledWith({
        where: { id: 'buyer-1', updatedAt },
        data: { temperature: 'HOT' },
      })
      expect(mockDb.activity.create).toHaveBeenCalledWith({
        data: {
          type: 'TEMPERATURA_ACTUALIZADA',
          content: 'Temperatura: Sin valorar → Caliente',
          agentId: 'actor-1',
          buyerLeadId: 'buyer-1',
        },
      })
      expect(vi.mocked(revalidatePath).mock.calls.map(([path]) => path)).toEqual([
        '/compradores',
        '/compradores/buyer-1',
        '/compradores/pipeline',
        '/dashboard',
      ])
    }
  )
  it('permite quitar temperatura', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue({ ...baseLead, temperature: 'COLD' })
    expect(await updateBuyerQuickField({ ...ref, field: 'temperature', value: null })).toEqual({
      ok: true,
    })
    expect(mockDb.buyerLead.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { temperature: null } })
    )
  })
  it.each(['ADMIN', 'AGENTE'])('asigna a un destino activo %s', async (role) => {
    mockDb.user.findUnique.mockResolvedValue({ name: 'Destino', active: true, role })
    expect(await updateBuyerQuickField({ ...ref, field: 'agentId', value: 'agent-2' })).toEqual({
      ok: true,
    })
    expect(mockDb.buyerLead.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { agentId: 'agent-2' } })
    )
    expect(mockDb.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'LEAD_ASIGNADO', content: 'Asignado a Destino' }),
      })
    )
  })
  it('reasigna con traza del responsable anterior', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue({
      ...baseLead,
      agentId: 'old',
      agent: { name: 'Anterior' },
    })
    await updateBuyerQuickField({ ...ref, field: 'agentId', value: 'agent-2' })
    expect(mockDb.activity.create.mock.calls[0][0].data.content).toBe(
      'Reasignado de Anterior a Comercial destino'
    )
  })
  it('desasigna sin buscar un nuevo usuario', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue({
      ...baseLead,
      agentId: 'old',
      agent: { name: 'Anterior' },
    })
    expect(await updateBuyerQuickField({ ...ref, field: 'agentId', value: null })).toEqual({
      ok: true,
    })
    expect(mockDb.user.findUnique).not.toHaveBeenCalled()
    expect(mockDb.activity.create.mock.calls[0][0].data.content).toBe(
      'Desasignado (antes: Anterior)'
    )
  })
  it.each([
    null,
    { active: false, role: 'AGENTE' },
    { active: true, role: 'TALLER' },
    { active: true, role: 'MARKETING' },
  ])('rechaza responsable no comercial activo %j', async (target) => {
    mockDb.user.findUnique.mockResolvedValue(target)
    expect(await updateBuyerQuickField({ ...ref, field: 'agentId', value: 'bad' })).toHaveProperty(
      'error'
    )
    expect(mockDb.buyerLead.updateMany).not.toHaveBeenCalled()
  })
  it('programa tipo y fecha de próxima acción sin cambiar el estado', async () => {
    const dueAt = '2026-10-15T08:00:00.000Z'
    expect(
      await updateBuyerQuickField({
        ...ref,
        field: 'nextAction',
        value: { type: 'WHATSAPP', dueAt },
      })
    ).toEqual({ ok: true })
    expect(mockDb.buyerLead.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { nextActionType: 'WHATSAPP', nextActionDueAt: new Date(dueAt) },
      })
    )
    expect(mockDb.activity.create.mock.calls[0][0].data.type).toBe('PROXIMA_ACCION_ACTUALIZADA')
    expect(mockDb.activity.create.mock.calls[0][0].data.content).toContain('Enviar WhatsApp')
  })
  it('permite próxima acción sin fecha', async () => {
    expect(
      await updateBuyerQuickField({
        ...ref,
        field: 'nextAction',
        value: { type: 'LLAMAR', dueAt: null },
      })
    ).toEqual({ ok: true })
    expect(mockDb.buyerLead.updateMany.mock.calls[0][0].data).toEqual({
      nextActionType: 'LLAMAR',
      nextActionDueAt: null,
    })
  })
  it('quitar acción limpia también la fecha', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue({
      ...baseLead,
      nextActionType: 'LLAMAR',
      nextActionDueAt: updatedAt,
    })
    await updateBuyerQuickField({
      ...ref,
      field: 'nextAction',
      value: { type: null, dueAt: updatedAt.toISOString() },
    })
    expect(mockDb.buyerLead.updateMany.mock.calls[0][0].data).toEqual({
      nextActionType: null,
      nextActionDueAt: null,
    })
    expect(mockDb.activity.create.mock.calls[0][0].data.content).toBe('Próxima acción eliminada')
  })
  it.each([
    { field: 'source', value: null },
    { field: 'temperature', value: null },
    { field: 'agentId', value: null },
    { field: 'nextAction', value: { type: null, dueAt: null } },
  ])('repetir %j no duplica Activity incluso con revisión antigua', async (change) => {
    expect(
      await updateBuyerQuickField({
        ...ref,
        expectedUpdatedAt: '2020-01-01T00:00:00.000Z',
        ...change,
      })
    ).toEqual({ ok: true })
    expect(mockDb.buyerLead.updateMany).not.toHaveBeenCalled()
    expect(mockDb.activity.create).not.toHaveBeenCalled()
  })
  it.each([
    null,
    {},
    { ...ref, field: 'source', value: 'INVENTADO' },
    { ...ref, field: 'source' },
    { ...ref, field: 'temperature', value: 'INVALID' },
    { ...ref, field: 'status', value: 'CONTACTADO' },
    { ...ref, field: 'agentId', value: '' },
    { ...ref, expectedUpdatedAt: 'invalid', field: 'temperature', value: 'HOT' },
    { ...ref, field: 'nextAction', value: { type: 'INVALID', dueAt: null } },
    { ...ref, field: 'nextAction', value: { type: 'LLAMAR', dueAt: 'invalid' } },
  ])('valida %j antes de acceder a DB', async (input) => {
    expect(await updateBuyerQuickField(input)).toHaveProperty('error')
    expect(mockDb.$transaction).not.toHaveBeenCalled()
  })
  it('autoriza antes de leer o escribir', async () => {
    vi.mocked(requireAgente).mockRejectedValue(new Error('No autorizado'))
    await expect(
      updateBuyerQuickField({ ...ref, field: 'temperature', value: 'HOT' })
    ).rejects.toThrow('No autorizado')
    expect(mockDb.$transaction).not.toHaveBeenCalled()
  })
  it('lead inexistente no escribe', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue(null)
    expect(await updateBuyerQuickField({ ...ref, field: 'temperature', value: 'HOT' })).toEqual({
      error: 'Comprador no encontrado',
    })
    expect(mockDb.buyerLead.updateMany).not.toHaveBeenCalled()
  })
  it('CAS perdido no deja actividad', async () => {
    mockDb.buyerLead.updateMany.mockResolvedValue({ count: 0 })
    expect(
      await updateBuyerQuickField({ ...ref, field: 'temperature', value: 'HOT' })
    ).toHaveProperty('error')
    expect(mockDb.activity.create).not.toHaveBeenCalled()
  })
  it('Activity fallida no invalida rutas y propaga el error de transacción', async () => {
    mockDb.activity.create.mockRejectedValue(new Error('Activity failed'))
    await expect(
      updateBuyerQuickField({ ...ref, field: 'temperature', value: 'HOT' })
    ).rejects.toThrow('Activity failed')
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
