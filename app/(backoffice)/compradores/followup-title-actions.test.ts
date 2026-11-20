import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveBuyerFollowupTitle } from './followup-title-actions'

const { updateMany, revalidatePath } = vi.hoisted(() => ({
  updateMany: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireAgente: async () => ({ id: 'agent-1', role: 'AGENTE' }),
}))
vi.mock('@/lib/db', () => ({ db: { buyerLead: { updateMany } } }))
vi.mock('next/cache', () => ({ revalidatePath }))

describe('saveBuyerFollowupTitle', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('actualiza solo el título de un lead vigente asignado al comercial', async () => {
    updateMany.mockResolvedValue({ count: 1 })

    await expect(
      saveBuyerFollowupTitle({ leadId: 'lead-1', previousTitle: null, title: ' Busca Marco Polo ' })
    ).resolves.toEqual({ ok: true })

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'lead-1', agentId: 'agent-1', mergedIntoId: null, followupTitle: null },
      data: { followupTitle: 'Busca Marco Polo' },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/compradores/pipeline')
  })

  it('conserva el título si cambió desde que se abrió el editor', async () => {
    updateMany.mockResolvedValue({ count: 0 })
    await expect(
      saveBuyerFollowupTitle({ leadId: 'lead-1', previousTitle: 'Busca Marco Polo', title: '' })
    ).resolves.toHaveProperty('error')
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('rechaza títulos demasiado largos antes de escribir', async () => {
    await expect(
      saveBuyerFollowupTitle({ leadId: 'lead-1', previousTitle: null, title: 'x'.repeat(121) })
    ).resolves.toHaveProperty('error')
    expect(updateMany).not.toHaveBeenCalled()
  })
})
