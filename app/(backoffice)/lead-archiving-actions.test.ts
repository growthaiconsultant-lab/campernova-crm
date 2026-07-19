import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── mocks ───────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAgente: vi.fn() }))

// Se mockean SOLO los cargadores de dependencias; la lógica pura (validación, clasificación,
// etiquetas) es la real.
vi.mock('@/lib/lead-archiving', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/lead-archiving')>()
  return {
    ...actual,
    loadSellerArchiveDependencies: vi.fn(),
    loadBuyerArchiveDependencies: vi.fn(),
  }
})

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    sellerLead: { findUnique: vi.fn(), updateMany: vi.fn() },
    buyerLead: { findUnique: vi.fn(), updateMany: vi.fn() },
    activity: { create: vi.fn() },
    $transaction: vi.fn(),
  }
  return { mockDb }
})
vi.mock('@/lib/db', () => ({ db: mockDb }))

import type { User } from '@prisma/client'
import { requireAgente } from '@/lib/auth'
import {
  loadSellerArchiveDependencies,
  loadBuyerArchiveDependencies,
  type ArchiveDependencyInput,
} from '@/lib/lead-archiving'
import {
  archiveSellerLead,
  reactivateSellerLead,
  archiveBuyerLead,
  reactivateBuyerLead,
} from './lead-archiving-actions'

const agent = { id: 'agent-1', role: 'AGENTE' } as User

const NO_DEPS: ArchiveDependencyInput = {
  vehicleStatus: null,
  activeOfferCount: 0,
  activeReservationCount: 0,
  activeDeliveryCount: 0,
  hasPendingNextAction: false,
  futureEventCount: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAgente).mockResolvedValue(agent)
  vi.mocked(loadSellerArchiveDependencies).mockResolvedValue(NO_DEPS)
  vi.mocked(loadBuyerArchiveDependencies).mockResolvedValue(NO_DEPS)
  mockDb.activity.create.mockResolvedValue({})
  mockDb.sellerLead.updateMany.mockResolvedValue({ count: 1 })
  mockDb.buyerLead.updateMany.mockResolvedValue({ count: 1 })
  mockDb.$transaction.mockImplementation(async (fn: (tx: typeof mockDb) => Promise<unknown>) =>
    fn(mockDb)
  )
})

// ─── Archivar (vendedor) ──────────────────────────────────────────────────────

describe('archiveSellerLead', () => {
  it('archiva sin dependencias y escribe SOLO los 4 campos de archivado', async () => {
    mockDb.sellerLead.findUnique.mockResolvedValue({ status: 'NUEVO', archivedAt: null })

    const res = await archiveSellerLead('s1', 'SIN_RESPUESTA', '  no contesta  ')

    expect(res).toEqual({ status: 'archived' })
    const call = mockDb.sellerLead.updateMany.mock.calls[0][0]
    // Compare-and-swap: solo si sigue activo.
    expect(call.where).toEqual({ id: 's1', archivedAt: null })
    expect(Object.keys(call.data).sort()).toEqual([
      'archiveNotes',
      'archiveReason',
      'archivedAt',
      'archivedById',
    ])
    expect(call.data.archivedById).toBe('agent-1')
    expect(call.data.archiveReason).toBe('SIN_RESPUESTA')
    expect(call.data.archiveNotes).toBe('no contesta')
    expect(call.data.archivedAt).toBeInstanceOf(Date)
    // No toca estado comercial ni ningún otro campo.
    expect(call.data).not.toHaveProperty('status')
    expect(call.data).not.toHaveProperty('lostReason')
  })

  it('registra Activity LEAD_ARCHIVADO con actor, motivo y estado comercial sin cambios', async () => {
    mockDb.sellerLead.findUnique.mockResolvedValue({ status: 'CONTACTADO', archivedAt: null })
    await archiveSellerLead('s1', 'LIMPIEZA_BANDEJA')
    const a = mockDb.activity.create.mock.calls[0][0].data
    expect(a.type).toBe('LEAD_ARCHIVADO')
    expect(a.agentId).toBe('agent-1')
    expect(a.sellerLeadId).toBe('s1')
    expect(a.content).toContain('Limpieza de bandeja')
    expect(a.content).toContain('Contactado (sin cambios)')
    expect(a.content).toContain('Archivado: no → sí')
  })

  it('notas vacías → null; notas largas se recortan a 500', async () => {
    mockDb.sellerLead.findUnique.mockResolvedValue({ status: 'NUEVO', archivedAt: null })
    await archiveSellerLead('s1', 'OTRO', '   ')
    expect(mockDb.sellerLead.updateMany.mock.calls[0][0].data.archiveNotes).toBeNull()

    vi.clearAllMocks()
    vi.mocked(requireAgente).mockResolvedValue(agent)
    vi.mocked(loadSellerArchiveDependencies).mockResolvedValue(NO_DEPS)
    mockDb.sellerLead.updateMany.mockResolvedValue({ count: 1 })
    mockDb.$transaction.mockImplementation(async (fn: (tx: typeof mockDb) => Promise<unknown>) =>
      fn(mockDb)
    )
    mockDb.sellerLead.findUnique.mockResolvedValue({ status: 'NUEVO', archivedAt: null })
    await archiveSellerLead('s1', 'OTRO', 'x'.repeat(600))
    expect(mockDb.sellerLead.updateMany.mock.calls[0][0].data.archiveNotes).toHaveLength(500)
  })

  it('rechaza sin motivo o con motivo inválido, sin escribir nada', async () => {
    mockDb.sellerLead.findUnique.mockResolvedValue({ status: 'NUEVO', archivedAt: null })
    expect(await archiveSellerLead('s1', undefined)).toMatchObject({ status: 'error' })
    expect(await archiveSellerLead('s1', 'INVENTADO')).toMatchObject({ status: 'error' })
    // Un motivo de pérdida comercial no vale como motivo de archivado.
    expect(await archiveSellerLead('s1', 'PRECIO')).toMatchObject({ status: 'error' })
    expect(mockDb.sellerLead.updateMany).not.toHaveBeenCalled()
    expect(mockDb.activity.create).not.toHaveBeenCalled()
  })

  it('lead inexistente → error', async () => {
    mockDb.sellerLead.findUnique.mockResolvedValue(null)
    expect(await archiveSellerLead('nope', 'OTRO')).toMatchObject({ status: 'error' })
    expect(mockDb.sellerLead.updateMany).not.toHaveBeenCalled()
  })

  it('idempotente: ya archivado → already_archived sin escrituras', async () => {
    mockDb.sellerLead.findUnique.mockResolvedValue({ status: 'NUEVO', archivedAt: new Date() })
    const res = await archiveSellerLead('s1', 'OTRO')
    expect(res).toEqual({ status: 'already_archived' })
    expect(mockDb.sellerLead.updateMany).not.toHaveBeenCalled()
    expect(mockDb.activity.create).not.toHaveBeenCalled()
  })

  it('concurrencia: si otro proceso archivó primero (count=0) → already_archived y NO crea Activity', async () => {
    mockDb.sellerLead.findUnique.mockResolvedValue({ status: 'NUEVO', archivedAt: null })
    mockDb.sellerLead.updateMany.mockResolvedValue({ count: 0 })
    const res = await archiveSellerLead('s1', 'OTRO')
    expect(res).toEqual({ status: 'already_archived' })
    expect(mockDb.activity.create).not.toHaveBeenCalled()
  })

  it('bloquea con dependencias activas, sin escribir nada, y devuelve el detalle', async () => {
    mockDb.sellerLead.findUnique.mockResolvedValue({ status: 'CUALIFICADO', archivedAt: null })
    vi.mocked(loadSellerArchiveDependencies).mockResolvedValue({
      ...NO_DEPS,
      vehicleStatus: 'PUBLICADO',
      activeOfferCount: 1,
    })

    const res = await archiveSellerLead('s1', 'OTRO')

    expect(res).toMatchObject({ status: 'blocked', code: 'ARCHIVE_BLOCKED' })
    if (res.status === 'blocked') {
      expect(res.blockers.map((b) => b.type)).toEqual(['VEHICLE_IN_STOCK', 'ACTIVE_OFFER'])
    }
    expect(mockDb.sellerLead.updateMany).not.toHaveBeenCalled()
    expect(mockDb.activity.create).not.toHaveBeenCalled()
  })

  it('exige autorización (requireAgente)', async () => {
    vi.mocked(requireAgente).mockRejectedValue(new Error('forbidden'))
    await expect(archiveSellerLead('s1', 'OTRO')).rejects.toThrow('forbidden')
    expect(mockDb.sellerLead.updateMany).not.toHaveBeenCalled()
  })
})

// ─── Reactivar (vendedor) ─────────────────────────────────────────────────────

describe('reactivateSellerLead', () => {
  it('reactiva limpiando los 4 campos y sin tocar nada más', async () => {
    mockDb.sellerLead.findUnique.mockResolvedValue({
      status: 'CONTACTADO',
      archivedAt: new Date(),
      archiveReason: 'SIN_RESPUESTA',
    })

    const res = await reactivateSellerLead('s1')

    expect(res).toEqual({ status: 'reactivated' })
    const call = mockDb.sellerLead.updateMany.mock.calls[0][0]
    expect(call.where).toEqual({ id: 's1', archivedAt: { not: null } })
    expect(call.data).toEqual({
      archivedAt: null,
      archivedById: null,
      archiveReason: null,
      archiveNotes: null,
    })
    const a = mockDb.activity.create.mock.calls[0][0].data
    expect(a.type).toBe('LEAD_REACTIVADO')
    expect(a.content).toContain('Contactado (sin cambios)')
    expect(a.content).toContain('Archivado: sí → no')
    expect(a.content).toContain('Sin respuesta') // motivo previo, para trazabilidad
  })

  it('idempotente: ya activo → already_active sin escrituras', async () => {
    mockDb.sellerLead.findUnique.mockResolvedValue({
      status: 'NUEVO',
      archivedAt: null,
      archiveReason: null,
    })
    const res = await reactivateSellerLead('s1')
    expect(res).toEqual({ status: 'already_active' })
    expect(mockDb.sellerLead.updateMany).not.toHaveBeenCalled()
    expect(mockDb.activity.create).not.toHaveBeenCalled()
  })

  it('concurrencia: count=0 → already_active y NO crea Activity', async () => {
    mockDb.sellerLead.findUnique.mockResolvedValue({
      status: 'NUEVO',
      archivedAt: new Date(),
      archiveReason: 'OTRO',
    })
    mockDb.sellerLead.updateMany.mockResolvedValue({ count: 0 })
    const res = await reactivateSellerLead('s1')
    expect(res).toEqual({ status: 'already_active' })
    expect(mockDb.activity.create).not.toHaveBeenCalled()
  })

  it('exige autorización', async () => {
    vi.mocked(requireAgente).mockRejectedValue(new Error('forbidden'))
    await expect(reactivateSellerLead('s1')).rejects.toThrow('forbidden')
  })
})

// ─── Comprador ────────────────────────────────────────────────────────────────

describe('archiveBuyerLead / reactivateBuyerLead', () => {
  it('archiva y registra Activity sobre el comprador', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue({ status: 'NUEVO', archivedAt: null })
    const res = await archiveBuyerLead('b1', 'FUERA_DE_MERCADO')
    expect(res).toEqual({ status: 'archived' })
    expect(mockDb.buyerLead.updateMany.mock.calls[0][0].where).toEqual({
      id: 'b1',
      archivedAt: null,
    })
    const a = mockDb.activity.create.mock.calls[0][0].data
    expect(a.type).toBe('LEAD_ARCHIVADO')
    expect(a.buyerLeadId).toBe('b1')
    expect(a.sellerLeadId).toBeUndefined()
  })

  it('bloquea por reserva con señal', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue({ status: 'EN_NEGOCIACION', archivedAt: null })
    vi.mocked(loadBuyerArchiveDependencies).mockResolvedValue({
      ...NO_DEPS,
      activeOfferCount: 1,
      activeReservationCount: 1,
    })
    const res = await archiveBuyerLead('b1', 'OTRO')
    expect(res).toMatchObject({ status: 'blocked' })
    if (res.status === 'blocked') {
      expect(res.blockers[0].type).toBe('ACTIVE_RESERVATION')
    }
    expect(mockDb.buyerLead.updateMany).not.toHaveBeenCalled()
  })

  it('reactiva al comprador', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue({
      status: 'PERDIDO',
      archivedAt: new Date(),
      archiveReason: 'OTRO',
    })
    const res = await reactivateBuyerLead('b1')
    expect(res).toEqual({ status: 'reactivated' })
    // Reactivar NO reabre el estado comercial: sigue PERDIDO.
    expect(mockDb.buyerLead.updateMany.mock.calls[0][0].data).not.toHaveProperty('status')
    expect(mockDb.activity.create.mock.calls[0][0].data.content).toContain('Perdido (sin cambios)')
  })
})
