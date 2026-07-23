import { describe, it, expect, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import {
  updateChecklistItemTx,
  writeSignatureTx,
  DeliveryPreconditionError,
  isDeliveryPreconditionError,
  type UpdateChecklistItemParams,
  type WriteSignatureParams,
} from './delivery-precondition'

/* eslint-disable @typescript-eslint/no-explicit-any */

type TxOpts = {
  status?: string
  deliveryVehicleId?: string
  deliveryBuyerId?: string
  vehicleSeller?: string | null
  vehicleExists?: boolean
  responsableId?: string | null
  /** deliveryId al que pertenece el ítem releído; `null` → ítem no existe. */
  itemDeliveryId?: string | null
}

function makeTx(o: TxOpts = {}) {
  const delivery =
    o.status === '__missing__'
      ? null
      : {
          status: o.status ?? 'EN_CURSO',
          vehicleId: o.deliveryVehicleId ?? 'veh-1',
          buyerLeadId: o.deliveryBuyerId ?? 'buyer-1',
          responsableId: o.responsableId === undefined ? 'user-1' : o.responsableId,
        }
  return {
    delivery: {
      findUnique: vi.fn().mockResolvedValue(delivery),
      update: vi.fn().mockResolvedValue({}),
    },
    vehicle: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          (o.vehicleExists ?? true)
            ? { sellerLeadId: o.vehicleSeller === undefined ? 'seller-1' : o.vehicleSeller }
            : null
        ),
    },
    deliveryChecklistItem: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          o.itemDeliveryId === null ? null : { deliveryId: o.itemDeliveryId ?? 'del-1' }
        ),
      update: vi.fn().mockResolvedValue({}),
    },
  }
}
const asTx = (tx: any) => tx as unknown as Prisma.TransactionClient

const checklistParams: UpdateChecklistItemParams = {
  itemId: 'item-1',
  deliveryId: 'del-1',
  vehicleId: 'veh-1',
  buyerLeadId: 'buyer-1',
  resolvedSellerLeadId: 'seller-1',
  result: 'OK',
  notes: null,
}

const signParams: WriteSignatureParams = {
  deliveryId: 'del-1',
  vehicleId: 'veh-1',
  buyerLeadId: 'buyer-1',
  resolvedSellerLeadId: 'seller-1',
  actorId: 'user-1',
  actorIsAdmin: false,
  signedByName: 'Cliente',
  signedByDni: '12345678Z',
  signatureUrl: 'sig.png',
}

async function code(p: Promise<unknown>): Promise<string | null> {
  try {
    await p
    return null
  } catch (e) {
    return isDeliveryPreconditionError(e) ? e.code : 'OTHER'
  }
}

describe('updateChecklistItemTx · edición bajo lock', () => {
  it('camino feliz: relee, valida pertenencia y actualiza el ítem', async () => {
    const tx = makeTx()
    await updateChecklistItemTx(asTx(tx), checklistParams)
    expect(tx.deliveryChecklistItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { result: 'OK', notes: null },
    })
  })

  it('DELIVERY_NOT_FOUND si la entrega no existe; no muta', async () => {
    const tx = makeTx({ status: '__missing__' })
    expect(await code(updateChecklistItemTx(asTx(tx), checklistParams))).toBe('DELIVERY_NOT_FOUND')
    expect(tx.deliveryChecklistItem.update).not.toHaveBeenCalled()
  })

  it('DELIVERY_ROOT_CHANGED si el vehículo de la entrega cambió', async () => {
    const tx = makeTx({ deliveryVehicleId: 'otro' })
    expect(await code(updateChecklistItemTx(asTx(tx), checklistParams))).toBe(
      'DELIVERY_ROOT_CHANGED'
    )
  })

  it('DELIVERY_ROOT_CHANGED si el vendedor del vehículo cambió', async () => {
    const tx = makeTx({ vehicleSeller: 'otro' })
    expect(await code(updateChecklistItemTx(asTx(tx), checklistParams))).toBe(
      'DELIVERY_ROOT_CHANGED'
    )
    expect(tx.deliveryChecklistItem.update).not.toHaveBeenCalled()
  })

  for (const status of ['COMPLETADA', 'CANCELADA'] as const) {
    it(`rechaza en estado terminal ${status}; no muta`, async () => {
      const tx = makeTx({ status })
      expect(await code(updateChecklistItemTx(asTx(tx), checklistParams))).toBe(
        status === 'COMPLETADA' ? 'DELIVERY_ALREADY_COMPLETED' : 'DELIVERY_ALREADY_CANCELLED'
      )
      expect(tx.deliveryChecklistItem.update).not.toHaveBeenCalled()
    })
  }

  it('CHECKLIST_ITEM_NOT_FOUND si el ítem no existe', async () => {
    const tx = makeTx({ itemDeliveryId: null })
    expect(await code(updateChecklistItemTx(asTx(tx), checklistParams))).toBe(
      'CHECKLIST_ITEM_NOT_FOUND'
    )
    expect(tx.deliveryChecklistItem.update).not.toHaveBeenCalled()
  })

  it('CHECKLIST_ITEM_MISMATCH si el ítem pertenece a otra entrega', async () => {
    const tx = makeTx({ itemDeliveryId: 'otra-del' })
    expect(await code(updateChecklistItemTx(asTx(tx), checklistParams))).toBe(
      'CHECKLIST_ITEM_MISMATCH'
    )
    expect(tx.deliveryChecklistItem.update).not.toHaveBeenCalled()
  })
})

describe('writeSignatureTx · firma bajo lock', () => {
  it('camino feliz (responsable): relee y escribe la firma', async () => {
    const tx = makeTx()
    await writeSignatureTx(asTx(tx), signParams)
    expect(tx.delivery.update).toHaveBeenCalledWith({
      where: { id: 'del-1' },
      data: { signedByName: 'Cliente', signedByDni: '12345678Z', signatureUrl: 'sig.png' },
    })
  })

  it('camino feliz (admin sobre entrega de otro responsable)', async () => {
    const tx = makeTx({ responsableId: 'otro' })
    await writeSignatureTx(asTx(tx), { ...signParams, actorIsAdmin: true })
    expect(tx.delivery.update).toHaveBeenCalledOnce()
  })

  it('SIGNATURE_FORBIDDEN si no es responsable ni admin; no muta', async () => {
    const tx = makeTx({ responsableId: 'otro' })
    expect(await code(writeSignatureTx(asTx(tx), signParams))).toBe('SIGNATURE_FORBIDDEN')
    expect(tx.delivery.update).not.toHaveBeenCalled()
  })

  for (const status of ['COMPLETADA', 'CANCELADA'] as const) {
    it(`rechaza firmar en estado terminal ${status}; no muta`, async () => {
      const tx = makeTx({ status })
      expect(await code(writeSignatureTx(asTx(tx), signParams))).toBe(
        status === 'COMPLETADA' ? 'DELIVERY_ALREADY_COMPLETED' : 'DELIVERY_ALREADY_CANCELLED'
      )
      expect(tx.delivery.update).not.toHaveBeenCalled()
    })
  }

  it('DELIVERY_ROOT_CHANGED si el vendedor del vehículo cambió; no muta', async () => {
    const tx = makeTx({ vehicleSeller: 'otro' })
    expect(await code(writeSignatureTx(asTx(tx), signParams))).toBe('DELIVERY_ROOT_CHANGED')
    expect(tx.delivery.update).not.toHaveBeenCalled()
  })

  it('la clasificación terminal precede a la autorización (terminal + no responsable → terminal)', async () => {
    const tx = makeTx({ status: 'COMPLETADA', responsableId: 'otro' })
    expect(await code(writeSignatureTx(asTx(tx), signParams))).toBe('DELIVERY_ALREADY_COMPLETED')
  })
})

describe('DeliveryPreconditionError', () => {
  it('expone code + mensaje sin PII y el type guard funciona', () => {
    const e = new DeliveryPreconditionError('DELIVERY_ROOT_CHANGED')
    expect(e.code).toBe('DELIVERY_ROOT_CHANGED')
    expect(e.message).not.toMatch(/prisma|select|veh-1|[0-9a-f]{20,}/i)
    expect(isDeliveryPreconditionError(e)).toBe(true)
    expect(isDeliveryPreconditionError(new Error('x'))).toBe(false)
  })
})
