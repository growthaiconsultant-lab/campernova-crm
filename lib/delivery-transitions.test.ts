import { describe, it, expect, vi } from 'vitest'
import {
  transitionDeliveryTx,
  isI3C2Transition,
  type TransitionDeliveryParams,
} from './delivery-transitions'

describe('isI3C2Transition — subconjunto sin COMPLETADA', () => {
  it('permite las transiciones no terminales de I3C2', () => {
    expect(isI3C2Transition('PROGRAMADA', 'EN_CURSO')).toBe(true)
    expect(isI3C2Transition('PROGRAMADA', 'CANCELADA')).toBe(true)
    expect(isI3C2Transition('EN_CURSO', 'CANCELADA')).toBe(true)
  })
  it('excluye COMPLETADA y las terminales', () => {
    expect(isI3C2Transition('EN_CURSO', 'COMPLETADA')).toBe(false)
    expect(isI3C2Transition('PROGRAMADA', 'COMPLETADA')).toBe(false)
    expect(isI3C2Transition('EN_CURSO', 'EN_CURSO')).toBe(false)
    expect(isI3C2Transition('CANCELADA', 'EN_CURSO')).toBe(false)
    expect(isI3C2Transition('COMPLETADA', 'CANCELADA')).toBe(false)
  })
})

/* eslint-disable @typescript-eslint/no-explicit-any */
function makeTx(cfg: {
  delivery?: { status: string; vehicleId: string; buyerLeadId: string } | null
  deliveryAfterCas?: { status: string } | null
  vehicle?: { sellerLeadId: string | null } | null
  seller?: { archivedAt: Date | null } | null
  buyer?: { archivedAt: Date | null } | null
  casCount?: number
}) {
  const deliveryFind = vi.fn()
  deliveryFind.mockResolvedValueOnce(
    'delivery' in cfg ? cfg.delivery : { status: 'PROGRAMADA', vehicleId: 'v1', buyerLeadId: 'b1' }
  )
  if ('deliveryAfterCas' in cfg) deliveryFind.mockResolvedValueOnce(cfg.deliveryAfterCas)
  const updateMany = vi.fn().mockResolvedValue({ count: cfg.casCount ?? 1 })
  const activityCreate = vi.fn().mockResolvedValue({})
  const tx = {
    delivery: { findUnique: deliveryFind, updateMany },
    vehicle: {
      findUnique: vi
        .fn()
        .mockResolvedValue('vehicle' in cfg ? cfg.vehicle : { sellerLeadId: 's1' }),
    },
    sellerLead: {
      findUnique: vi.fn().mockResolvedValue('seller' in cfg ? cfg.seller : { archivedAt: null }),
    },
    buyerLead: {
      findUnique: vi.fn().mockResolvedValue('buyer' in cfg ? cfg.buyer : { archivedAt: null }),
    },
    activity: { create: activityCreate },
  }
  return { tx: tx as any, updateMany, activityCreate }
}

const base: TransitionDeliveryParams = {
  deliveryId: 'd1',
  vehicleId: 'v1',
  buyerLeadId: 'b1',
  resolvedSellerLeadId: 's1',
  expectedCurrentStatus: 'PROGRAMADA',
  targetStatus: 'EN_CURSO',
  actorId: 'u1',
  cancellationReason: null,
  now: new Date('2026-07-22T10:00:00Z'),
}

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toMatchObject({ code })
}

describe('transitionDeliveryTx — clasificación fail-closed', () => {
  it('DELIVERY_NOT_FOUND si no existe', async () => {
    const { tx } = makeTx({ delivery: null })
    await expectCode(transitionDeliveryTx(tx, base), 'DELIVERY_NOT_FOUND')
  })

  it('DELIVERY_ROOT_CHANGED si el vehículo de la entrega cambió', async () => {
    const { tx } = makeTx({
      delivery: { status: 'PROGRAMADA', vehicleId: 'OTRO', buyerLeadId: 'b1' },
    })
    await expectCode(transitionDeliveryTx(tx, base), 'DELIVERY_ROOT_CHANGED')
  })

  it('DELIVERY_ROOT_CHANGED si el vehículo cambió de vendedor', async () => {
    const { tx } = makeTx({ vehicle: { sellerLeadId: 'OTRO' } })
    await expectCode(transitionDeliveryTx(tx, base), 'DELIVERY_ROOT_CHANGED')
  })

  it('LEAD_ARCHIVED si el vendedor está archivado', async () => {
    const { tx } = makeTx({ seller: { archivedAt: new Date('2026-01-01') } })
    await expectCode(transitionDeliveryTx(tx, base), 'LEAD_ARCHIVED')
  })

  it('LEAD_ARCHIVED si el comprador está archivado', async () => {
    const { tx } = makeTx({ buyer: { archivedAt: new Date('2026-01-01') } })
    await expectCode(transitionDeliveryTx(tx, base), 'LEAD_ARCHIVED')
  })

  it('DELIVERY_ALREADY_CANCELLED si el estado releído es CANCELADA', async () => {
    const { tx } = makeTx({ delivery: { status: 'CANCELADA', vehicleId: 'v1', buyerLeadId: 'b1' } })
    await expectCode(transitionDeliveryTx(tx, base), 'DELIVERY_ALREADY_CANCELLED')
  })

  it('DELIVERY_ALREADY_COMPLETED si el estado releído es COMPLETADA', async () => {
    const { tx } = makeTx({
      delivery: { status: 'COMPLETADA', vehicleId: 'v1', buyerLeadId: 'b1' },
    })
    await expectCode(transitionDeliveryTx(tx, base), 'DELIVERY_ALREADY_COMPLETED')
  })

  it('DELIVERY_STATUS_CHANGED si el estado releído difiere del esperado (cliente obsoleto)', async () => {
    const { tx } = makeTx({ delivery: { status: 'EN_CURSO', vehicleId: 'v1', buyerLeadId: 'b1' } })
    // esperado PROGRAMADA, releído EN_CURSO
    await expectCode(transitionDeliveryTx(tx, base), 'DELIVERY_STATUS_CHANGED')
  })

  it('INVALID_DELIVERY_TRANSITION para EN_CURSO → EN_CURSO', async () => {
    const { tx } = makeTx({ delivery: { status: 'EN_CURSO', vehicleId: 'v1', buyerLeadId: 'b1' } })
    await expectCode(
      transitionDeliveryTx(tx, {
        ...base,
        expectedCurrentStatus: 'EN_CURSO',
        targetStatus: 'EN_CURSO' as never,
      }),
      'INVALID_DELIVERY_TRANSITION'
    )
  })

  it('CANCELLATION_REASON_REQUIRED si el motivo está vacío', async () => {
    const { tx } = makeTx({})
    await expectCode(
      transitionDeliveryTx(tx, { ...base, targetStatus: 'CANCELADA', cancellationReason: '   ' }),
      'CANCELLATION_REASON_REQUIRED'
    )
  })

  it('reclasifica el CAS de 0 filas como ALREADY_COMPLETED (perdió la carrera con la compleción)', async () => {
    const { tx } = makeTx({
      delivery: { status: 'EN_CURSO', vehicleId: 'v1', buyerLeadId: 'b1' },
      deliveryAfterCas: { status: 'COMPLETADA' },
      casCount: 0,
    })
    await expectCode(
      transitionDeliveryTx(tx, {
        ...base,
        expectedCurrentStatus: 'EN_CURSO',
        targetStatus: 'CANCELADA',
        cancellationReason: 'x',
      }),
      'DELIVERY_ALREADY_COMPLETED'
    )
  })
})

describe('transitionDeliveryTx — caminos felices', () => {
  it('PROGRAMADA → EN_CURSO: CAS con startedAt + Activity CAMBIO_ESTADO sin flecha', async () => {
    const { tx, updateMany, activityCreate } = makeTx({})
    const res = await transitionDeliveryTx(tx, base)
    expect(res).toEqual({ previousStatus: 'PROGRAMADA', newStatus: 'EN_CURSO' })
    const casArg = updateMany.mock.calls[0][0]
    expect(casArg.where).toEqual({ id: 'd1', status: 'PROGRAMADA' })
    expect(casArg.data.status).toBe('EN_CURSO')
    expect(casArg.data.startedAt).toBeInstanceOf(Date)
    expect(casArg.data.cancellationReason).toBeUndefined()
    const act = activityCreate.mock.calls[0][0].data
    expect(act.type).toBe('CAMBIO_ESTADO')
    expect(act.content).not.toContain('→') // no contamina el time-in-state de leads
  })

  it('PROGRAMADA → CANCELADA: CAS con motivo (trim) + Activity ENTREGA_CANCELADA', async () => {
    const { tx, updateMany, activityCreate } = makeTx({})
    const res = await transitionDeliveryTx(tx, {
      ...base,
      targetStatus: 'CANCELADA',
      cancellationReason: '  el comprador aplaza  ',
    })
    expect(res.newStatus).toBe('CANCELADA')
    const casArg = updateMany.mock.calls[0][0]
    expect(casArg.data.status).toBe('CANCELADA')
    expect(casArg.data.cancellationReason).toBe('el comprador aplaza')
    expect(casArg.data.startedAt).toBeUndefined()
    const act = activityCreate.mock.calls[0][0].data
    expect(act.type).toBe('ENTREGA_CANCELADA')
    expect(act.content).toContain('el comprador aplaza')
  })

  it('EN_CURSO → CANCELADA permitido', async () => {
    const { tx } = makeTx({ delivery: { status: 'EN_CURSO', vehicleId: 'v1', buyerLeadId: 'b1' } })
    const res = await transitionDeliveryTx(tx, {
      ...base,
      expectedCurrentStatus: 'EN_CURSO',
      targetStatus: 'CANCELADA',
      cancellationReason: 'motivo',
    })
    expect(res).toEqual({ previousStatus: 'EN_CURSO', newStatus: 'CANCELADA' })
  })
})

describe('archivado: bloquea INICIAR, no CANCELAR', () => {
  it('INICIAR con vendedor archivado → LEAD_ARCHIVED', async () => {
    const { tx, updateMany } = makeTx({ seller: { archivedAt: new Date('2026-01-01') } })
    await expectCode(transitionDeliveryTx(tx, base), 'LEAD_ARCHIVED')
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('INICIAR con comprador archivado → LEAD_ARCHIVED', async () => {
    const { tx, updateMany } = makeTx({ buyer: { archivedAt: new Date('2026-01-01') } })
    await expectCode(transitionDeliveryTx(tx, base), 'LEAD_ARCHIVED')
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('CANCELAR con vendedor archivado → éxito (no bloquea)', async () => {
    const { tx, updateMany, activityCreate } = makeTx({
      seller: { archivedAt: new Date('2026-01-01') },
    })
    const res = await transitionDeliveryTx(tx, {
      ...base,
      targetStatus: 'CANCELADA',
      cancellationReason: 'incidencia',
    })
    expect(res.newStatus).toBe('CANCELADA')
    expect(updateMany.mock.calls[0][0].data.cancellationReason).toBe('incidencia')
    expect(activityCreate.mock.calls[0][0].data.type).toBe('ENTREGA_CANCELADA')
  })

  it('CANCELAR con comprador archivado → éxito (no bloquea)', async () => {
    const { tx } = makeTx({ buyer: { archivedAt: new Date('2026-01-01') } })
    const res = await transitionDeliveryTx(tx, {
      ...base,
      targetStatus: 'CANCELADA',
      cancellationReason: 'incidencia',
    })
    expect(res.newStatus).toBe('CANCELADA')
  })

  it('CANCELAR con ambos archivados → éxito', async () => {
    const { tx } = makeTx({
      seller: { archivedAt: new Date('2026-01-01') },
      buyer: { archivedAt: new Date('2026-01-01') },
    })
    const res = await transitionDeliveryTx(tx, {
      ...base,
      targetStatus: 'CANCELADA',
      cancellationReason: 'incidencia',
    })
    expect(res.newStatus).toBe('CANCELADA')
  })

  it('la clasificación terminal precede al archivado: COMPLETADA archivada → ALREADY_COMPLETED', async () => {
    const { tx } = makeTx({
      delivery: { status: 'COMPLETADA', vehicleId: 'v1', buyerLeadId: 'b1' },
      seller: { archivedAt: new Date('2026-01-01') },
      buyer: { archivedAt: new Date('2026-01-01') },
    })
    await expectCode(
      transitionDeliveryTx(tx, { ...base, targetStatus: 'CANCELADA', cancellationReason: 'x' }),
      'DELIVERY_ALREADY_COMPLETED'
    )
  })
})
