import { describe, it, expect, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import {
  convertCaptureTx,
  convertTradeInTx,
  ConversionConflictError,
  CONVERSION_CONFLICT_MESSAGES,
  type ConvertCaptureParams,
  type ConvertTradeInParams,
} from './capture-conversion'

type MockTx = {
  vehicleCapture: { updateMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
  buyerLead: { updateMany: ReturnType<typeof vi.fn> }
  sellerLead: { create: ReturnType<typeof vi.fn> }
  activity: { create: ReturnType<typeof vi.fn> }
}

function makeTx(opts: { captureClaim?: number; tradeInClaim?: number } = {}): MockTx {
  return {
    vehicleCapture: {
      updateMany: vi.fn().mockResolvedValue({ count: opts.captureClaim ?? 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    buyerLead: { updateMany: vi.fn().mockResolvedValue({ count: opts.tradeInClaim ?? 1 }) },
    sellerLead: { create: vi.fn().mockResolvedValue({ id: 's1', vehicle: { id: 'v1' } }) },
    activity: { create: vi.fn().mockResolvedValue({}) },
  }
}

const asTx = (tx: MockTx) => tx as unknown as Prisma.TransactionClient

const sellerData = {
  name: 'Vendedor Test',
  email: '',
  phone: '600111222',
  canal: 'CN',
  status: 'NUEVO',
  vehicle: { create: { type: 'AUTOCARAVANA', brand: 'Adria', model: 'Coral' } },
  activities: { create: { type: 'NOTA', content: 'Origen: captación' } },
} as unknown as Prisma.SellerLeadUncheckedCreateInput

const captureParams: ConvertCaptureParams = {
  captureId: 'cap-1',
  sellerData,
  linkingNotePrefix: 'Convertida a lead de vendedor desde captación (Coches.net).',
}

const tradeInParams: ConvertTradeInParams = {
  buyerLeadId: 'buyer-1',
  sellerData,
  linkingNotePrefix:
    'Creado lead de vendedor desde el vehículo de parte de pago (Camper VW California).',
}

describe('convertCaptureTx · camino feliz', () => {
  it('reclama la captación (CAS), crea el vendedor, la vincula y deja traza', async () => {
    const tx = makeTx()
    const res = await convertCaptureTx(asTx(tx), captureParams)

    expect(res).toEqual({ sellerLeadId: 's1', vehicleId: 'v1' })
    // CAS: reclama solo si sigue sin vendedor.
    expect(tx.vehicleCapture.updateMany).toHaveBeenCalledWith({
      where: { id: 'cap-1', sellerLeadId: null },
      data: { status: 'CONVERTIDO' },
    })
    expect(tx.sellerLead.create).toHaveBeenCalledWith({
      data: sellerData,
      include: { vehicle: true },
    })
    // Vincula la captación con el vendedor creado.
    expect(tx.vehicleCapture.update).toHaveBeenCalledWith({
      where: { id: 'cap-1' },
      data: { sellerLeadId: 's1' },
    })
    // Traza de enlace con la ficha.
    const act = tx.activity.create.mock.calls[0][0].data
    expect(act.sellerLeadId).toBe('s1')
    expect(act.content).toContain('/vendedores/s1')
  })
})

describe('convertCaptureTx · conflicto (CAS pierde)', () => {
  it('si la captación ya fue reclamada (count 0) no crea vendedor, vínculo ni traza', async () => {
    const tx = makeTx({ captureClaim: 0 })
    const err = await convertCaptureTx(asTx(tx), captureParams).catch((e) => e)
    expect(err).toBeInstanceOf(ConversionConflictError)
    expect((err as ConversionConflictError).reason).toBe('capture')
    expect((err as ConversionConflictError).message).toBe(CONVERSION_CONFLICT_MESSAGES.capture)
    expect(tx.sellerLead.create).not.toHaveBeenCalled()
    expect(tx.vehicleCapture.update).not.toHaveBeenCalled()
    expect(tx.activity.create).not.toHaveBeenCalled()
  })
})

describe('convertCaptureTx · hooks y propagación de errores', () => {
  it('respeta el orden: beforeCaptureClaim → claim → beforeSellerWrite → create → beforeLinkWrite → link → traza', async () => {
    const order: string[] = []
    const tx = makeTx()
    tx.vehicleCapture.updateMany.mockImplementation(async () => {
      order.push('claim')
      return { count: 1 }
    })
    tx.sellerLead.create.mockImplementation(async () => {
      order.push('create')
      return { id: 's1', vehicle: { id: 'v1' } }
    })
    tx.vehicleCapture.update.mockImplementation(async () => {
      order.push('link')
      return {}
    })
    await convertCaptureTx(asTx(tx), captureParams, {
      beforeCaptureClaim: async () => void order.push('hook:claim'),
      beforeSellerWrite: async () => void order.push('hook:seller'),
      beforeLinkWrite: async () => void order.push('hook:link'),
    })
    expect(order).toEqual(['hook:claim', 'claim', 'hook:seller', 'create', 'hook:link', 'link'])
  })

  it('un throw en beforeSellerWrite se propaga (no es conflicto) y no crea vendedor', async () => {
    const tx = makeTx()
    const err = await convertCaptureTx(asTx(tx), captureParams, {
      beforeSellerWrite: async () => {
        throw new Error('boom seller')
      },
    }).catch((e) => e)
    expect(err).not.toBeInstanceOf(ConversionConflictError)
    expect((err as Error).message).toBe('boom seller')
    expect(tx.sellerLead.create).not.toHaveBeenCalled()
  })
})

describe('convertTradeInTx · camino feliz', () => {
  it('crea el vendedor y hace CAS-vínculo sobre el comprador, con traza', async () => {
    const tx = makeTx()
    const res = await convertTradeInTx(asTx(tx), tradeInParams)

    expect(res).toEqual({ sellerLeadId: 's1', vehicleId: 'v1' })
    expect(tx.sellerLead.create).toHaveBeenCalledWith({
      data: sellerData,
      include: { vehicle: true },
    })
    // CAS-vínculo: solo si el comprador aún no tenía trade-in vinculado.
    expect(tx.buyerLead.updateMany).toHaveBeenCalledWith({
      where: { id: 'buyer-1', tradeInSellerLeadId: null },
      data: { tradeInSellerLeadId: 's1' },
    })
    const act = tx.activity.create.mock.calls[0][0].data
    expect(act.buyerLeadId).toBe('buyer-1')
    expect(act.content).toContain('/vendedores/s1')
  })
})

describe('convertTradeInTx · conflicto (CAS-vínculo pierde)', () => {
  it('si el comprador ya tenía trade-in (count 0) lanza conflicto y no deja traza', async () => {
    const tx = makeTx({ tradeInClaim: 0 })
    const err = await convertTradeInTx(asTx(tx), tradeInParams).catch((e) => e)
    expect(err).toBeInstanceOf(ConversionConflictError)
    expect((err as ConversionConflictError).reason).toBe('tradein')
    // El vendedor se intentó crear (antes del CAS), pero el conflicto aborta antes de la traza
    // (en producción, el throw revierte también la creación del vendedor).
    expect(tx.sellerLead.create).toHaveBeenCalledOnce()
    expect(tx.activity.create).not.toHaveBeenCalled()
  })
})

describe('convertTradeInTx · orden de hooks', () => {
  it('respeta el orden: beforeSellerWrite → create → beforeLinkWrite → CAS-vínculo', async () => {
    const order: string[] = []
    const tx = makeTx()
    tx.sellerLead.create.mockImplementation(async () => {
      order.push('create')
      return { id: 's1', vehicle: { id: 'v1' } }
    })
    tx.buyerLead.updateMany.mockImplementation(async () => {
      order.push('cas-link')
      return { count: 1 }
    })
    await convertTradeInTx(asTx(tx), tradeInParams, {
      beforeSellerWrite: async () => void order.push('hook:seller'),
      beforeLinkWrite: async () => void order.push('hook:link'),
    })
    expect(order).toEqual(['hook:seller', 'create', 'hook:link', 'cas-link'])
  })
})

describe('constantes de dominio', () => {
  it('ConversionConflictError expone reason y mensajes claros por tipo', () => {
    expect(new ConversionConflictError('capture').reason).toBe('capture')
    expect(new ConversionConflictError('tradein').message).toBe(
      CONVERSION_CONFLICT_MESSAGES.tradein
    )
  })
})
