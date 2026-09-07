import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAgente: vi.fn() }))

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    sellerLead: { findUnique: vi.fn(), updateMany: vi.fn() },
    activity: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/db', () => ({ db: mockDb }))

import { revalidatePath } from 'next/cache'
import { requireAgente } from '@/lib/auth'
import { decideSellerIntake } from './intake-actions'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAgente).mockResolvedValue({ id: 'agent-1', role: 'AGENTE' } as never)
  mockDb.$transaction.mockImplementation(async (fn: (tx: typeof mockDb) => Promise<unknown>) =>
    fn(mockDb)
  )
  mockDb.sellerLead.findUnique.mockResolvedValue({ canal: 'PRO', intakeStatus: 'PENDIENTE' })
  mockDb.sellerLead.updateMany.mockResolvedValue({ count: 1 })
  mockDb.activity.create.mockResolvedValue({ id: 'activity-1' })
})

describe('decideSellerIntake', () => {
  it('autoriza antes de leer o mutar', async () => {
    await decideSellerIntake({ leadId: 'lead-1', target: 'ADMITIDO' })
    expect(requireAgente).toHaveBeenCalledOnce()
    expect(mockDb.sellerLead.findUnique).toHaveBeenCalledOnce()
  })

  it('no consulta datos si el rol no supera el guard server-side', async () => {
    vi.mocked(requireAgente).mockRejectedValueOnce(new Error('forbidden: TALLER'))

    await expect(decideSellerIntake({ leadId: 'lead-1', target: 'ADMITIDO' })).rejects.toThrow(
      'forbidden: TALLER'
    )
    expect(mockDb.sellerLead.findUnique).not.toHaveBeenCalled()
    expect(mockDb.sellerLead.updateMany).not.toHaveBeenCalled()
    expect(mockDb.activity.create).not.toHaveBeenCalled()
  })

  it('admite por CAS, registra Activity y revalida las bandejas', async () => {
    const result = await decideSellerIntake({ leadId: 'lead-1', target: 'ADMITIDO' })

    expect(result).toEqual({ status: 'admitted' })
    expect(mockDb.sellerLead.updateMany).toHaveBeenCalledWith({
      where: { id: 'lead-1', canal: 'PRO', intakeStatus: 'PENDIENTE' },
      data: {
        intakeStatus: 'ADMITIDO',
        intakeReviewedAt: expect.any(Date),
        intakeReviewedById: 'agent-1',
      },
    })
    expect(mockDb.activity.create).toHaveBeenCalledWith({
      data: {
        type: 'SOLICITUD_WEB_ADMITIDA',
        content: 'Solicitud web admitida en el CRM.',
        agentId: 'agent-1',
        sellerLeadId: 'lead-1',
      },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/vendedores')
    expect(revalidatePath).toHaveBeenCalledWith('/vehiculos')
  })

  it('rechaza una pendiente sin alterar sus estados comerciales', async () => {
    const result = await decideSellerIntake({ leadId: 'lead-1', target: 'RECHAZADO' })
    expect(result).toEqual({ status: 'rejected' })
    expect(mockDb.sellerLead.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ intakeStatus: 'RECHAZADO' }) })
    )
    expect(mockDb.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'SOLICITUD_WEB_RECHAZADA' }),
      })
    )
  })

  it('es idempotente y no duplica Activity al repetir la decisión', async () => {
    mockDb.sellerLead.findUnique.mockResolvedValue({ canal: 'PRO', intakeStatus: 'ADMITIDO' })
    const result = await decideSellerIntake({ leadId: 'lead-1', target: 'ADMITIDO' })
    expect(result).toEqual({ status: 'unchanged' })
    expect(mockDb.sellerLead.updateMany).not.toHaveBeenCalled()
    expect(mockDb.activity.create).not.toHaveBeenCalled()
  })

  it('rechaza entidades inexistentes y altas internas', async () => {
    mockDb.sellerLead.findUnique.mockResolvedValueOnce(null)
    await expect(decideSellerIntake({ leadId: 'missing', target: 'ADMITIDO' })).resolves.toEqual({
      error: 'La solicitud ya no existe.',
    })

    mockDb.sellerLead.findUnique.mockResolvedValueOnce({
      canal: 'CN',
      intakeStatus: 'ADMITIDO',
    })
    await expect(decideSellerIntake({ leadId: 'internal', target: 'ADMITIDO' })).resolves.toEqual({
      error: 'Solo se revisan solicitudes procedentes de la web.',
    })
    expect(mockDb.sellerLead.updateMany).not.toHaveBeenCalled()
  })

  it('detecta una decisión concurrente y no crea Activity', async () => {
    mockDb.sellerLead.updateMany.mockResolvedValue({ count: 0 })
    const result = await decideSellerIntake({ leadId: 'lead-1', target: 'ADMITIDO' })
    expect(result).toEqual({ error: 'Otra persona revisó esta solicitud. Actualiza la ficha.' })
    expect(mockDb.activity.create).not.toHaveBeenCalled()
  })
})
