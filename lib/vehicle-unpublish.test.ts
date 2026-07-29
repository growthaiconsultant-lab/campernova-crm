import { describe, it, expect, vi, beforeEach } from 'vitest'
import { unpublishVehicleTx, isUnpublishError, UnpublishError } from './vehicle-unpublish'
import { VehicleStatusConflictError } from './vehicle-status'

// Mock `tx` — solo los métodos que usa unpublishVehicleTx.
function makeTx() {
  return {
    vehicle: { findUnique: vi.fn(), updateMany: vi.fn() },
    sellerLead: { findUnique: vi.fn() },
    offer: { count: vi.fn() },
    activity: { create: vi.fn() },
  }
}

const PARAMS = { vehicleId: 'v1', resolvedSellerLeadId: 's1', actorId: 'a1', reason: null }

let tx: ReturnType<typeof makeTx>
beforeEach(() => {
  tx = makeTx()
  tx.vehicle.findUnique.mockResolvedValue({
    status: 'PUBLICADO',
    sellerLeadId: 's1',
    publishedAt: new Date('2026-01-01'),
  })
  tx.sellerLead.findUnique.mockResolvedValue({ archivedAt: null })
  tx.offer.count.mockResolvedValue(0)
  tx.vehicle.updateMany.mockResolvedValue({ count: 1 })
  tx.activity.create.mockResolvedValue({})
})

const codeOf = (e: unknown) => (isUnpublishError(e) ? e.code : e instanceof Error ? e.name : null)

describe('unpublishVehicleTx', () => {
  it('camino feliz: PUBLICADO → TASADO, traza PUBLICACION_RETIRADA, sin tocar publishedAt', async () => {
    const res = await unpublishVehicleTx(tx as never, { ...PARAMS, reason: '  vendido fuera  ' })
    expect(res).toEqual({ vehicleId: 'v1' })

    const upd = tx.vehicle.updateMany.mock.calls[0][0]
    expect(upd.where).toEqual({ id: 'v1', status: 'PUBLICADO' })
    expect(upd.data).toEqual({ status: 'TASADO' }) // publishedAt NO se toca
    expect(tx.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'PUBLICACION_RETIRADA' }) })
    )
    // el motivo se recorta y se incluye en la traza
    expect(tx.activity.create.mock.calls[0][0].data.content).toContain('vendido fuera')
  })

  it('bloquea si hay ofertas activas (guard bajo el lock), sin escribir', async () => {
    tx.offer.count.mockResolvedValue(1)
    const err = await unpublishVehicleTx(tx as never, PARAMS).catch((e) => e)
    expect(codeOf(err)).toBe('ACTIVE_OFFERS')
    expect(tx.vehicle.updateMany).not.toHaveBeenCalled()
  })

  it('rechaza si el vehículo no está publicado', async () => {
    tx.vehicle.findUnique.mockResolvedValue({
      status: 'TASADO',
      sellerLeadId: 's1',
      publishedAt: null,
    })
    const err = await unpublishVehicleTx(tx as never, PARAMS).catch((e) => e)
    expect(codeOf(err)).toBe('NOT_PUBLISHED')
    expect(tx.vehicle.updateMany).not.toHaveBeenCalled()
  })

  it('rechaza si la raíz (vendedor) cambió entre la lectura preliminar y la relectura', async () => {
    tx.vehicle.findUnique.mockResolvedValue({
      status: 'PUBLICADO',
      sellerLeadId: 's2',
      publishedAt: null,
    })
    const err = await unpublishVehicleTx(tx as never, PARAMS).catch((e) => e)
    expect(codeOf(err)).toBe('VEHICLE_ROOT_CHANGED')
  })

  it('rechaza si el vendedor está archivado', async () => {
    tx.sellerLead.findUnique.mockResolvedValue({ archivedAt: new Date() })
    const err = await unpublishVehicleTx(tx as never, PARAMS).catch((e) => e)
    expect(codeOf(err)).toBe('LEAD_ARCHIVED')
    expect(tx.vehicle.updateMany).not.toHaveBeenCalled()
  })

  it('CAS: si el estado cambió entre el guard y la escritura → conflicto', async () => {
    tx.vehicle.updateMany.mockResolvedValue({ count: 0 })
    const err = await unpublishVehicleTx(tx as never, PARAMS).catch((e) => e)
    expect(err).toBeInstanceOf(VehicleStatusConflictError)
  })

  it('vehículo inexistente → VEHICLE_NOT_FOUND', async () => {
    tx.vehicle.findUnique.mockResolvedValue(null)
    const err = await unpublishVehicleTx(tx as never, PARAMS).catch((e) => e)
    expect(codeOf(err)).toBe('VEHICLE_NOT_FOUND')
  })
})

describe('UnpublishError', () => {
  it('isUnpublishError discrimina', () => {
    expect(isUnpublishError(new UnpublishError('ACTIVE_OFFERS'))).toBe(true)
    expect(isUnpublishError(new Error('x'))).toBe(false)
  })
})
