import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── mocks ───────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAgente: vi.fn() }))
vi.mock('@/lib/kpi/emit', () => ({ emitKpiEvent: vi.fn(() => Promise.resolve()) }))

// El servicio atómico se mockea para controlar éxito/conflicto/error inesperado.
// OfferConflictError y los guards puros se mantienen REALES (importOriginal).
// `withLockedRoots` se mockea para inspeccionar las RAÍCES solicitadas y ejecutar el callback; su
// semántica real (locks, orden, fail-closed) está probada en `lib/locking` y en integración.
vi.mock('@/lib/locking', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/locking')>()
  return { ...actual, withLockedRoots: vi.fn() }
})

vi.mock('@/lib/offers-transition', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/offers-transition')>()
  return { ...actual, applyOfferTransitionTx: vi.fn() }
})

vi.mock('@/lib/offers-reservation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/offers-reservation')>()
  return { ...actual, applyOfferStatusChangeTx: vi.fn() }
})

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    offer: { findUnique: vi.fn() },
    vehicle: { findUnique: vi.fn() },
    buyerLead: { findUnique: vi.fn() },
    // El $transaction se simula ejecutando el callback con el propio mock como tx.
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/db', () => ({ db: mockDb }))

import type { User } from '@prisma/client'
import { requireAgente } from '@/lib/auth'
import { emitKpiEvent } from '@/lib/kpi/emit'
import { revalidatePath } from 'next/cache'
import { OfferConflictError } from '@/lib/offers-reservation'
import { KPI_EVENTS } from '@/lib/kpi/events'
import { withLockedRoots, LockError } from '@/lib/locking'
import { OfferCreationError } from '@/lib/offers-creation'
import {
  applyOfferTransitionTx,
  OfferTransitionError,
  type OfferTransitionResult,
} from '@/lib/offers-transition'
import { createOffer, updateOfferStatus } from './actions'

const actor = { id: 'user-1', role: 'AGENTE' } as User

const offerRow = {
  id: 'offer-1',
  status: 'PROPUESTA' as const,
  amount: 25000,
  buyerLeadId: 'buyer-1',
  vehicle: { id: 'veh-1', sellerLeadId: 'seller-1', brand: 'Adria', model: 'Coral' },
}

/** Resultado que devuelve el núcleo de transición tras el commit. */
const txResult = (over: Partial<OfferTransitionResult> = {}): OfferTransitionResult => ({
  fromStatus: 'PROPUESTA',
  toStatus: 'ACEPTADA',
  amount: 25000,
  vehicleId: 'veh-1',
  buyerLeadId: 'buyer-1',
  sellerLeadId: 'seller-1',
  reserved: true,
  released: false,
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAgente).mockResolvedValue(actor)
  mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockDb)
  )
  vi.mocked(applyOfferTransitionTx).mockResolvedValue(txResult())
  vi.mocked(withLockedRoots).mockImplementation(async (_roots, operation) =>
    operation(mockDb as never)
  )
})

describe('updateOfferStatus · validación previa (sin abrir transacción)', () => {
  it('rechaza un estado no válido', async () => {
    const res = await updateOfferStatus('offer-1', 'NOPE')
    expect(res).toEqual({ error: 'Estado no válido' })
    expect(mockDb.offer.findUnique).not.toHaveBeenCalled()
    expect(applyOfferTransitionTx).not.toHaveBeenCalled()
  })

  it('error si la oferta no existe', async () => {
    mockDb.offer.findUnique.mockResolvedValue(null)
    const res = await updateOfferStatus('x', 'ACEPTADA')
    expect(res).toEqual({ error: 'Oferta no encontrada' })
    expect(applyOfferTransitionTx).not.toHaveBeenCalled()
  })

  it('rechaza una transición no permitida (ACEPTADA → PROPUESTA)', async () => {
    mockDb.offer.findUnique.mockResolvedValue({ ...offerRow, status: 'ACEPTADA' })
    const res = await updateOfferStatus('offer-1', 'PROPUESTA')
    expect(res.error).toContain('Transición no permitida')
    expect(applyOfferTransitionTx).not.toHaveBeenCalled()
  })

  it('rechaza un motivo de rechazo no válido', async () => {
    mockDb.offer.findUnique.mockResolvedValue({ ...offerRow })
    const res = await updateOfferStatus('offer-1', 'RECHAZADA', { rejectionReason: 'INVENTADO' })
    expect(res).toEqual({ error: 'Motivo no válido' })
    expect(applyOfferTransitionTx).not.toHaveBeenCalled()
  })

  it('rechaza una fecha de reserva inválida al aceptar', async () => {
    mockDb.offer.findUnique.mockResolvedValue({ ...offerRow })
    const res = await updateOfferStatus('offer-1', 'ACEPTADA', { reservedUntil: 'not-a-date' })
    expect(res).toEqual({ error: 'Fecha de reserva no válida' })
    expect(applyOfferTransitionTx).not.toHaveBeenCalled()
  })
})

describe('updateOfferStatus · aceptación (camino exitoso)', () => {
  it('coordina la aceptación con las tres raíces y emite RESERVATION_CREATED tras el commit', async () => {
    mockDb.offer.findUnique.mockResolvedValue({ ...offerRow })
    const res = await updateOfferStatus('offer-1', 'ACEPTADA', {
      depositAmount: 1000,
      reservedUntil: '2026-08-01T10:00:00.000Z',
    })
    expect(res).toEqual({})

    // `reserve`/`release` y el estado de origen los decide ahora el núcleo tras releer dentro de
    // la transacción: la acción solo le pasa el destino y las raíces resueltas.
    const params = vi.mocked(applyOfferTransitionTx).mock.calls[0][1]
    expect(params).toMatchObject({
      offerId: 'offer-1',
      toStatus: 'ACEPTADA',
      resolvedVehicleId: 'veh-1',
      resolvedBuyerLeadId: 'buyer-1',
      resolvedSellerLeadId: 'seller-1',
      actorId: 'user-1',
    })
    expect(params.depositAmount).toBe(1000)
    expect(params.reservedUntil).toBeInstanceOf(Date)

    // Las raíces bloqueadas son las tres, en el orden del protocolo.
    expect(vi.mocked(withLockedRoots).mock.calls[0][0]).toEqual([
      { type: 'vehicle', id: 'veh-1' },
      { type: 'sellerLead', id: 'seller-1' },
      { type: 'buyerLead', id: 'buyer-1' },
    ])

    expect(emitKpiEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: KPI_EVENTS.RESERVATION_CREATED })
    )
    expect(revalidatePath).toHaveBeenCalledWith('/vendedores')
  })
})

describe('updateOfferStatus · conflicto de negocio vs error técnico', () => {
  it('traduce OfferConflictError a { error } claro y NO emite KPI ni revalida', async () => {
    mockDb.offer.findUnique.mockResolvedValue({ ...offerRow })
    vi.mocked(applyOfferTransitionTx).mockRejectedValue(new OfferConflictError('vehicle'))

    const res = await updateOfferStatus('offer-1', 'ACEPTADA', { depositAmount: 1000 })
    expect(res).toEqual({ error: 'El vehículo ya no está disponible para reservar.' })
    expect(emitKpiEvent).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('propaga un error técnico inesperado (no lo oculta como "no disponible")', async () => {
    mockDb.offer.findUnique.mockResolvedValue({ ...offerRow })
    vi.mocked(applyOfferTransitionTx).mockRejectedValue(new Error('DB caída'))

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
    vi.mocked(applyOfferTransitionTx).mockResolvedValue(
      txResult({ fromStatus: 'ACEPTADA', released: true, reserved: false })
    )

    const res = await updateOfferStatus('offer-1', 'CANCELADA')
    expect(res).toEqual({})
    const params = vi.mocked(applyOfferTransitionTx).mock.calls[0][1]
    expect(params).toMatchObject({ toStatus: 'CANCELADA' })
    expect(emitKpiEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: KPI_EVENTS.RESERVATION_CANCELLED })
    )
  })

  it('convierte en venta: reserve=false, release=false, emite SALE_CLOSED', async () => {
    mockDb.offer.findUnique.mockResolvedValue({ ...offerRow, status: 'ACEPTADA' })
    vi.mocked(applyOfferTransitionTx).mockResolvedValue(
      txResult({ fromStatus: 'ACEPTADA', reserved: false })
    )

    const res = await updateOfferStatus('offer-1', 'CONVERTIDA')
    expect(res).toEqual({})
    const params = vi.mocked(applyOfferTransitionTx).mock.calls[0][1]
    expect(params).toMatchObject({ toStatus: 'CONVERTIDA' })
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
      expect(applyOfferTransitionTx).not.toHaveBeenCalled()
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
    vi.mocked(applyOfferTransitionTx).mockResolvedValue(txResult())

    const res = await updateOfferStatus('offer-1', 'ACEPTADA', { depositAmount: null })

    expect(res.error).toBeUndefined()
    expect(applyOfferTransitionTx).toHaveBeenCalled()
  })

  it('sigue aceptando una señal positiva', async () => {
    mockDb.offer.findUnique.mockResolvedValue({ ...offerRow, status: 'PROPUESTA' })
    mockDb.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(mockDb))
    vi.mocked(applyOfferTransitionTx).mockResolvedValue(txResult())

    const res = await updateOfferStatus('offer-1', 'ACEPTADA', { depositAmount: 1500 })

    expect(res.error).toBeUndefined()
    const params = vi.mocked(applyOfferTransitionTx).mock.calls[0][1]
    expect(params.depositAmount).toBe(1500)
  })
})

// ─── I2B · creación coordinada ────────────────────────────────────────────────

const vehicleRow = { id: 'veh-1', sellerLeadId: 'seller-1' }
const buyerRow = { id: 'buyer-1' }
const createInput = { vehicleId: 'veh-1', buyerLeadId: 'buyer-1', amount: 25000 }

describe('createOffer · resolución de raíces', () => {
  beforeEach(() => {
    mockDb.vehicle.findUnique.mockResolvedValue(vehicleRow)
    mockDb.buyerLead.findUnique.mockResolvedValue(buyerRow)
    vi.mocked(withLockedRoots).mockResolvedValue({
      offerId: 'offer-1',
      sellerLeadId: 'seller-1',
    } as never)
  })

  it('bloquea vehículo, vendedor y comprador', async () => {
    await createOffer(createInput)
    const roots = vi.mocked(withLockedRoots).mock.calls[0][0]
    expect(roots).toEqual([
      { type: 'vehicle', id: 'veh-1' },
      { type: 'sellerLead', id: 'seller-1' },
      { type: 'buyerLead', id: 'buyer-1' },
    ])
  })

  it('omite el vendedor si el vehículo no tiene: nunca una raíz con id vacío', async () => {
    mockDb.vehicle.findUnique.mockResolvedValue({ id: 'veh-1', sellerLeadId: null })
    vi.mocked(withLockedRoots).mockResolvedValue({
      offerId: 'offer-1',
      sellerLeadId: null,
    } as never)

    await createOffer(createInput)
    const roots = vi.mocked(withLockedRoots).mock.calls[0][0]
    expect(roots).toEqual([
      { type: 'vehicle', id: 'veh-1' },
      { type: 'buyerLead', id: 'buyer-1' },
    ])
    expect(roots.some((r) => r.id === '')).toBe(false)
  })

  it('no abre transacción si el vehículo no existe en la lectura preliminar', async () => {
    mockDb.vehicle.findUnique.mockResolvedValue(null)
    const res = await createOffer(createInput)
    expect(res).toEqual({ error: 'Vehículo no encontrado' })
    expect(withLockedRoots).not.toHaveBeenCalled()
    expect(emitKpiEvent).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('no abre transacción si el comprador no existe en la lectura preliminar', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue(null)
    const res = await createOffer(createInput)
    expect(res).toEqual({ error: 'Comprador no encontrado' })
    expect(withLockedRoots).not.toHaveBeenCalled()
  })

  it('valida el input antes de leer nada', async () => {
    expect(await createOffer({ ...createInput, amount: 0 })).toEqual({
      error: 'Indica un importe válido',
    })
    expect(await createOffer({ ...createInput, vehicleId: '' })).toEqual({
      error: 'Falta el vehículo o el comprador',
    })
    expect(mockDb.vehicle.findUnique).not.toHaveBeenCalled()
    expect(withLockedRoots).not.toHaveBeenCalled()
  })
})

describe('createOffer · efectos externos fuera del lock', () => {
  beforeEach(() => {
    mockDb.vehicle.findUnique.mockResolvedValue(vehicleRow)
    mockDb.buyerLead.findUnique.mockResolvedValue(buyerRow)
  })

  it('emite KPI y revalida DESPUÉS del commit, nunca dentro', async () => {
    const orden: string[] = []
    vi.mocked(emitKpiEvent).mockImplementation(async () => void orden.push('kpi'))
    vi.mocked(revalidatePath).mockImplementation(() => void orden.push('revalidate'))
    vi.mocked(withLockedRoots).mockImplementation(async () => {
      orden.push('commit')
      return { offerId: 'offer-1', sellerLeadId: 'seller-1' } as never
    })

    const res = await createOffer(createInput)
    expect(res).toEqual({ id: 'offer-1' })
    expect(orden[0]).toBe('commit')
    expect(orden).toContain('kpi')
    expect(orden.indexOf('kpi')).toBeGreaterThan(orden.indexOf('commit'))
    expect(orden.indexOf('revalidate')).toBeGreaterThan(orden.indexOf('commit'))
  })

  it('revalida con el vendedor que vio la transacción, no con el de la lectura previa', async () => {
    vi.mocked(withLockedRoots).mockResolvedValue({
      offerId: 'offer-1',
      sellerLeadId: 'seller-1',
    } as never)
    await createOffer(createInput)
    expect(revalidatePath).toHaveBeenCalledWith('/vendedores/seller-1')
  })
})

describe('createOffer · errores de dominio y de coordinación', () => {
  beforeEach(() => {
    mockDb.vehicle.findUnique.mockResolvedValue(vehicleRow)
    mockDb.buyerLead.findUnique.mockResolvedValue(buyerRow)
  })

  it.each([
    [
      'LEAD_ARCHIVED',
      'No se puede registrar una oferta sobre un lead archivado. Reactívalo primero.',
    ],
    ['VEHICLE_NOT_AVAILABLE', 'El vehículo no está disponible para registrar una nueva oferta.'],
    [
      'OFFER_ROOT_CHANGED',
      'Los datos del vehículo han cambiado mientras se registraba la oferta. Inténtalo de nuevo.',
    ],
  ])('%s → mensaje seguro, sin KPI ni revalidación', async (code, message) => {
    vi.mocked(withLockedRoots).mockRejectedValue(new OfferCreationError(code as never))

    const res = await createOffer(createInput)
    expect(res).toEqual({ error: message })
    expect(emitKpiEvent).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('propaga los errores de locking como mensaje de dominio', async () => {
    vi.mocked(withLockedRoots).mockRejectedValue(new LockError('LOCK_TIMEOUT'))
    const res = await createOffer(createInput)
    expect(res.error).toContain('otro proceso')
    expect(emitKpiEvent).not.toHaveBeenCalled()
  })

  it('no disfraza un error técnico inesperado: lo propaga', async () => {
    vi.mocked(withLockedRoots).mockRejectedValue(new Error('DB caída'))
    await expect(createOffer(createInput)).rejects.toThrow('DB caída')
    expect(emitKpiEvent).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('createOffer · atomicidad delegada al núcleo', () => {
  it('Offer y Activity se escriben con el MISMO cliente transaccional', async () => {
    mockDb.vehicle.findUnique.mockResolvedValue(vehicleRow)
    mockDb.buyerLead.findUnique.mockResolvedValue(buyerRow)
    // El tx que recibe el núcleo es el que expone las escrituras; si createOfferTx usara `db`
    // global en vez de `tx`, estas llamadas no aparecerían aquí.
    const txCalls: string[] = []
    const tx = {
      vehicle: {
        findUnique: async () => ({ ...vehicleRow, status: 'PUBLICADO', brand: 'A', model: 'B' }),
      },
      buyerLead: { findUnique: async () => ({ id: 'buyer-1', name: 'C', archivedAt: null }) },
      sellerLead: { findUnique: async () => ({ id: 'seller-1', archivedAt: null }) },
      offer: { create: async () => (txCalls.push('offer'), { id: 'offer-1' }) },
      activity: { createMany: async () => (txCalls.push('activity'), { count: 2 }) },
    }
    vi.mocked(withLockedRoots).mockImplementation(async (_roots, operation) => {
      const r = await operation(tx as never)
      return r as never
    })

    const res = await createOffer(createInput)
    expect(res).toEqual({ id: 'offer-1' })
    expect(txCalls).toEqual(['offer', 'activity'])
  })
})

describe('updateOfferStatus · errores de dominio de I2C', () => {
  beforeEach(() => {
    mockDb.offer.findUnique.mockResolvedValue({ ...offerRow, status: 'ACEPTADA' })
  })

  it.each([
    ['LEAD_ARCHIVED', 'lead archivado'],
    ['RESERVATION_ALREADY_OWNED', 'otra oferta aceptada'],
    ['RESERVATION_OWNERSHIP_CONFLICT', 'otra oferta aceptada'],
    ['VEHICLE_RESERVATION_STATE_CONFLICT', 'estado del vehículo'],
    ['OFFER_ROOT_CHANGED', 'han cambiado'],
    ['VEHICLE_NOT_AVAILABLE', 'publicado'],
    ['VEHICLE_NOT_READY_FOR_CONVERSION', 'no se encuentra reservado'],
  ])('%s → mensaje seguro, sin KPI ni revalidación', async (code, fragmento) => {
    vi.mocked(applyOfferTransitionTx).mockRejectedValue(new OfferTransitionError(code as never))

    const res = await updateOfferStatus('offer-1', 'CANCELADA')
    expect(res.error).toContain(fragmento)
    expect(res.error).not.toMatch(/prisma|select|update |[0-9a-f]{20,}/i)
    expect(emitKpiEvent).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('conversión rechazada: no emite SALE_CLOSED', async () => {
    vi.mocked(applyOfferTransitionTx).mockRejectedValue(
      new OfferTransitionError('VEHICLE_NOT_READY_FOR_CONVERSION')
    )
    const res = await updateOfferStatus('offer-1', 'CONVERTIDA')
    expect(res.error).toContain('no se encuentra reservado')
    expect(emitKpiEvent).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('traduce los errores de locking a mensaje de dominio', async () => {
    vi.mocked(applyOfferTransitionTx).mockRejectedValue(new LockError('LOCK_TIMEOUT'))
    const res = await updateOfferStatus('offer-1', 'CANCELADA')
    expect(res.error).toContain('otro proceso')
    expect(emitKpiEvent).not.toHaveBeenCalled()
  })

  it('bloquea las tres raíces antes de transicionar', async () => {
    await updateOfferStatus('offer-1', 'CANCELADA')
    expect(vi.mocked(withLockedRoots).mock.calls[0][0]).toEqual([
      { type: 'vehicle', id: 'veh-1' },
      { type: 'sellerLead', id: 'seller-1' },
      { type: 'buyerLead', id: 'buyer-1' },
    ])
  })

  it('omite la raíz de vendedor si el vehículo no lo tiene', async () => {
    mockDb.offer.findUnique.mockResolvedValue({
      ...offerRow,
      status: 'ACEPTADA',
      vehicle: { id: 'veh-1', sellerLeadId: null },
    })
    vi.mocked(applyOfferTransitionTx).mockResolvedValue(
      txResult({ fromStatus: 'ACEPTADA', toStatus: 'CANCELADA', sellerLeadId: null })
    )

    await updateOfferStatus('offer-1', 'CANCELADA')
    const roots = vi.mocked(withLockedRoots).mock.calls[0][0]
    expect(roots).toEqual([
      { type: 'vehicle', id: 'veh-1' },
      { type: 'buyerLead', id: 'buyer-1' },
    ])
    expect(roots.some((r) => r.id === '')).toBe(false)
  })
})
