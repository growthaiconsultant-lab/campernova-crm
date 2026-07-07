import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAgente: vi.fn() }))

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    calendarEvent: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/lib/db', () => ({ db: mockDb }))

import { requireAgente } from '@/lib/auth'
import { createCalendarEvent, updateCalendarEventStatus } from './actions'

const validInput = {
  type: 'CITA',
  title: 'Cita — ver McLouis',
  startAt: '2026-07-09T18:00:00.000Z',
  durationMinutes: 60,
  priority: 'ALTA',
  buyerLeadId: 'b1',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAgente).mockResolvedValue({ id: 'agent-1', role: 'AGENTE' } as never)
  mockDb.calendarEvent.create.mockResolvedValue({ id: 'ev1' })
  mockDb.calendarEvent.update.mockResolvedValue({})
})

describe('createCalendarEvent', () => {
  it('crea el evento y calcula endAt desde la duración', async () => {
    const res = await createCalendarEvent(validInput)
    expect(res.id).toBe('ev1')
    const data = mockDb.calendarEvent.create.mock.calls[0][0].data
    expect(data.type).toBe('CITA')
    expect(data.createdById).toBe('agent-1')
    expect(data.buyerLeadId).toBe('b1')
    // 18:00 + 60min = 19:00
    expect((data.endAt as Date).toISOString()).toBe('2026-07-09T19:00:00.000Z')
  })

  it('rechaza título vacío', async () => {
    const res = await createCalendarEvent({ ...validInput, title: '  ' })
    expect(res.error).toBeTruthy()
    expect(mockDb.calendarEvent.create).not.toHaveBeenCalled()
  })

  it('rechaza fecha no válida', async () => {
    const res = await createCalendarEvent({ ...validInput, startAt: 'nope' })
    expect(res.error).toContain('Fecha')
  })
})

describe('updateCalendarEventStatus', () => {
  it('permite PROGRAMADO → COMPLETADO y guarda resultNotes + completedAt', async () => {
    mockDb.calendarEvent.findUnique.mockResolvedValue({
      status: 'PROGRAMADO',
      buyerLeadId: 'b1',
      sellerLeadId: null,
    })
    const res = await updateCalendarEventStatus('ev1', 'COMPLETADO', {
      resultNotes: 'Cliente interesado',
    })
    expect(res.error).toBeUndefined()
    const data = mockDb.calendarEvent.update.mock.calls[0][0].data
    expect(data.status).toBe('COMPLETADO')
    expect(data.resultNotes).toBe('Cliente interesado')
    expect(data.completedAt).toBeInstanceOf(Date)
  })

  it('rechaza transición inválida (COMPLETADO → EN_CURSO)', async () => {
    mockDb.calendarEvent.findUnique.mockResolvedValue({
      status: 'COMPLETADO',
      buyerLeadId: null,
      sellerLeadId: null,
    })
    const res = await updateCalendarEventStatus('ev1', 'EN_CURSO')
    expect(res.error).toContain('no permitida')
    expect(mockDb.calendarEvent.update).not.toHaveBeenCalled()
  })

  it('cancelar guarda motivo + cancelledAt', async () => {
    mockDb.calendarEvent.findUnique.mockResolvedValue({
      status: 'CONFIRMADO',
      buyerLeadId: null,
      sellerLeadId: null,
    })
    await updateCalendarEventStatus('ev1', 'CANCELADO', { cancellationReason: 'Cliente aplaza' })
    const data = mockDb.calendarEvent.update.mock.calls[0][0].data
    expect(data.cancellationReason).toBe('Cliente aplaza')
    expect(data.cancelledAt).toBeInstanceOf(Date)
  })
})
