import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── mocks ───────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAgente: vi.fn() }))
vi.mock('@/lib/kpi/emit', () => ({ emitKpiEvent: vi.fn(() => Promise.resolve()) }))

// El servicio atómico se mockea para controlar éxito/conflicto/error inesperado.
// OfferConflictError y los guards puros se mantienen REALES (importOriginal).
vi.mock('@/lib/offers-reservation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/offers-reservation')>()
  return { ...actual, applyOfferStatusChangeTx: vi.fn() }
})

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    offer: { findUnique: vi.fn() },
    // El $transaction se simula ejecutando el callback con el propio mock como tx.
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/db', () => ({ db: mockDb }))

import type { User } from '@prisma/client'
import { requireAgente } from '@/lib/auth'
import { emitKpiEvent } from '@/lib/kpi/emit'
import { revalidatePath } from 'next/cache'
import { applyOfferStatusChangeTx, OfferConflictError } from '@/lib/offers-reservation'
import { KPI_EVENTS } from '@/lib/kpi/events'
import { updateOfferStatus } from './actions'

const actor = { id: 'user-1', role: 'AGENTE' } as User

const offerRow = {
  id: 'offer-1',
  status: 'PROPUESTA' as const,
  amount: 25000,
  buyerLeadId: 'buyer-1',
  vehicle: { id: 'veh-1', sellerLeadId: 'seller-1', brand: 'Adria', model: 'Coral' },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAgente).mockResolvedValue(actor)
  mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockDb)
  )
  vi.mocked(applyOfferStatusChangeTx).mockResolvedValue({ reserved: true, released: false })
})

describe('updateOfferStatus · validación previa (sin tocar el servicio)', () => {
  it('rechaza un estado no válido', async () => {
    const res = await updateOfferStatus('offer-1', 'NOPE')
    expect(res).toEqual({ error: 'Estado no válido' })
    expect(mockDb.offer.findUnique).not.toHaveBeenCalled()
    expect(applyOfferStatusChangeTx).not.toHaveBeenCalled()
  })

  it('error si la oferta no existe', async () => {
    mockDb.offer.findUnique.mockResolvedValue(null)
    const res = await updateOfferStatus('x', 'ACEPTADA')
    expect(res).toEqual({ error: 'Oferta no encontrada' })
    expect(applyOfferStatusChangeTx).not.toHaveBeenCalled()
  })

  it('rechaza una transición no permitida (ACEPTADA → PROPUESTA)', async () => {
    mockDb.offer.findUnique.mockResolvedValue({ ...offerRow, status: 'ACEPTADA' })
    const res = await updateOfferStatus('offer-1', 'PROPUESTA')
    expect(res.error).toContain('Transición no permitida')
    expect(applyOfferStatusChangeTx).not.toHaveBeenCalled()
  })

  it('rechaza un motivo de rechazo no válido', async () => {
    mockDb.offer.findUnique.mockResolvedValue({ ...offerRow })
    const res = await updateOfferStatus('offer-1', 'RECHAZADA', { rejectionReason: 'INVENTADO' })
    expect(res).toEqual({ error: 'Motivo no válido' })
    expect(applyOfferStatusChangeTx).not.toHaveBeenCalled()
  })

  it('rechaza una fecha de reserva inválida al aceptar', async () => {
    mockDb.offer.findUnique.mockResolvedValue({ ...offerRow })
    const res = await updateOfferStatus('offer-1', 'ACEPTADA', { reservedUntil: 'not-a-date' })
    expect(res).toEqual({ error: 'Fecha de reserva no válida' })
    expect(applyOfferStatusChangeTx).not.toHaveBeenCalled()
  })
})

describe('updateOfferStatus · aceptación (camino exitoso)', () => {
  it('llama al servicio atómico con reserve=true y emite RESERVATION_CREATED tras el commit', async () => {
    mockDb.offer.findUnique.mockResolvedValue({ ...offerRow })
    const res = await updateOfferStatus('offer-1', 'ACEPTADA', {
      depositAmount: 1000,
      reservedUntil: '2026-08-01T10:00:00.000Z',
    })
    expect(res).toEqual({})

    const params = vi.mocked(applyOfferStatusChangeTx).mock.calls[0][1]
    expect(params).toMatchObject({
      offerId: 'offer-1',
      fromStatus: 'PROPUESTA',
      toStatus: 'ACEPTADA',
      vehicleId: 'veh-1',
      reserve: true,
      release: false,
      buyerLeadId: 'buyer-1',
      sellerLeadId: 'seller-1',
    })
    expect(params.offerData.depositAmount).toBe(1000)
    expect(params.offerData.reservedUntil).toBeInstanceOf(Date)

    expect(emitKpiEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: KPI_EVENTS.RESERVATION_CREATED })
    )
    expect(revalidatePath).toHaveBeenCalledWith('/vendedores')
  })
})

describe('updateOfferStatus · conflicto de negocio vs error técnico', () => {
  it('traduce OfferConflictError a { error } claro y NO emite KPI ni revalida', async () => {
    mockDb.offer.findUnique.mockResolvedValue({ ...offerRow })
    vi.mocked(applyOfferStatusChangeTx).mockRejectedValue(new OfferConflictError('vehicle'))

    const res = await updateOfferStatus('offer-1', 'ACEPTADA', { depositAmount: 1000 })
    expect(res).toEqual({ error: 'El vehículo ya no está disponible para reservar.' })
    expect(emitKpiEvent).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('propaga un error técnico inesperado (no lo oculta como "no disponible")', async () => {
    mockDb.offer.findUnique.mockResolvedValue({ ...offerRow })
    vi.mocked(applyOfferStatusChangeTx).mockRejectedValue(new Error('DB caída'))

    await expect(updateOfferStatus('offer-1', 'ACEPTADA', { depositAmount: 1000 })).rejects.toThrow(
      'DB caída'
    )
    expect(emitKpiEvent).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('updateOfferStatus · liberación y conversión', () => {
  it('cancela una reserva: release=true y emite RESERVATION_CANCELLED', async () => {
    mockDb.offer.findUnique.mockResolvedValue({ ...offerRow, status: 'ACEPTADA' })
    vi.mocked(applyOfferStatusChangeTx).mockResolvedValue({ reserved: false, released: true })

    const res = await updateOfferStatus('offer-1', 'CANCELADA')
    expect(res).toEqual({})
    const params = vi.mocked(applyOfferStatusChangeTx).mock.calls[0][1]
    expect(params).toMatchObject({ reserve: false, release: true, toStatus: 'CANCELADA' })
    expect(emitKpiEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: KPI_EVENTS.RESERVATION_CANCELLED })
    )
  })

  it('convierte en venta: reserve=false, release=false, emite SALE_CLOSED', async () => {
    mockDb.offer.findUnique.mockResolvedValue({ ...offerRow, status: 'ACEPTADA' })
    vi.mocked(applyOfferStatusChangeTx).mockResolvedValue({ reserved: false, released: false })

    const res = await updateOfferStatus('offer-1', 'CONVERTIDA')
    expect(res).toEqual({})
    const params = vi.mocked(applyOfferStatusChangeTx).mock.calls[0][1]
    expect(params).toMatchObject({ reserve: false, release: false, toStatus: 'CONVERTIDA' })
    expect(emitKpiEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: KPI_EVENTS.SALE_CLOSED })
    )
  })
})

describe('superficie del módulo (I2A)', () => {
  it('no expone una edición genérica de oferta', async () => {
    // Comprobación estructural, no de texto: `updateOffer` permitía fijar `depositAmount` en
    // cualquier estado, sin transacción, sin Activity y sin sincronizar el vehículo.
    const mod = await import('./actions')
    expect(Object.keys(mod)).not.toContain('updateOffer')
  })

  it('solo expone las dos operaciones del dominio', async () => {
    const mod = await import('./actions')
    expect(Object.keys(mod).sort()).toEqual(['createOffer', 'updateOfferStatus'])
  })
})

describe('validación de señal (I2A)', () => {
  it.each([-1, -0.5, -5000])(
    'rechaza una señal negativa (%s) sin escribir nada',
    async (deposit) => {
      mockDb.offer.findUnique.mockResolvedValue({ ...offerRow, status: 'PROPUESTA' })

      const res = await updateOfferStatus('offer-1', 'ACEPTADA', { depositAmount: deposit })

      expect(res.error).toBe('La señal no puede ser negativa')
      expect(mockDb.$transaction).not.toHaveBeenCalled()
      expect(applyOfferStatusChangeTx).not.toHaveBeenCalled()
      expect(emitKpiEvent).not.toHaveBeenCalled()
      expect(revalidatePath).not.toHaveBeenCalled()
    }
  )

  it('rechaza una señal no finita', async () => {
    mockDb.offer.findUnique.mockResolvedValue({ ...offerRow, status: 'PROPUESTA' })
    const res = await updateOfferStatus('offer-1', 'ACEPTADA', { depositAmount: Number.NaN })
    expect(res.error).toBe('La señal no puede ser negativa')
    expect(mockDb.$transaction).not.toHaveBeenCalled()
  })

  it('sigue aceptando señal nula: aceptar sin señal es legítimo', async () => {
    mockDb.offer.findUnique.mockResolvedValue({ ...offerRow, status: 'PROPUESTA' })
    mockDb.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(mockDb))
    vi.mocked(applyOfferStatusChangeTx).mockResolvedValue({ reserved: true, released: false })

    const res = await updateOfferStatus('offer-1', 'ACEPTADA', { depositAmount: null })

    expect(res.error).toBeUndefined()
    expect(applyOfferStatusChangeTx).toHaveBeenCalled()
  })

  it('sigue aceptando una señal positiva', async () => {
    mockDb.offer.findUnique.mockResolvedValue({ ...offerRow, status: 'PROPUESTA' })
    mockDb.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(mockDb))
    vi.mocked(applyOfferStatusChangeTx).mockResolvedValue({ reserved: true, released: false })

    const res = await updateOfferStatus('offer-1', 'ACEPTADA', { depositAmount: 1500 })

    expect(res.error).toBeUndefined()
    const params = vi.mocked(applyOfferStatusChangeTx).mock.calls[0][1]
    expect(params.offerData.depositAmount).toBe(1500)
  })
})
