import { describe, it, expect, vi } from 'vitest'
import type { OfferStatus, VehicleStatus } from '@prisma/client'
import {
  CANCELLABLE_VEHICLE_STATUS_POLICY,
  OFFER_ACCEPTANCE_REQUIRED_VEHICLE_STATUS,
  OFFER_CONVERSION_VEHICLE_STATUS_POLICY,
  OFFER_TRANSITION_ERROR_MESSAGES,
  OfferTransitionError,
  applyOfferTransitionTx,
  buildOfferTransitionRoots,
  isOfferTransitionError,
} from './offers-transition'

const ALL_VEHICLE_STATUSES: VehicleStatus[] = [
  'NUEVO',
  'TASADO',
  'PUBLICADO',
  'RESERVADO',
  'VENDIDO',
  'DESCARTADO',
]

// ─── dobles ───────────────────────────────────────────────────────────────────

type Over = {
  offer?: Record<string, unknown> | null
  vehicle?: Record<string, unknown> | null
  buyer?: Record<string, unknown> | null
  seller?: Record<string, unknown> | null
  otherAccepted?: number
}

function fakeTx(o: Over = {}) {
  const calls = { offerUpdate: 0, vehicleUpdate: 0, activity: 0 }
  const tx = {
    offer: {
      findUnique: vi.fn(async () =>
        o.offer === undefined
          ? {
              id: 'offer-1',
              status: 'PROPUESTA',
              amount: 25000,
              vehicleId: 'v1',
              buyerLeadId: 'b1',
            }
          : o.offer
      ),
      count: vi.fn(async () => o.otherAccepted ?? 0),
      updateMany: vi.fn(async () => {
        calls.offerUpdate++
        return { count: 1 }
      }),
    },
    vehicle: {
      findUnique: vi.fn(async () =>
        o.vehicle === undefined
          ? { id: 'v1', status: 'PUBLICADO', sellerLeadId: 's1', brand: 'Adria', model: 'Coral' }
          : o.vehicle
      ),
      updateMany: vi.fn(async () => {
        calls.vehicleUpdate++
        return { count: 1 }
      }),
    },
    buyerLead: {
      findUnique: vi.fn(async () =>
        o.buyer === undefined ? { id: 'b1', archivedAt: null } : o.buyer
      ),
    },
    sellerLead: {
      findUnique: vi.fn(async () =>
        o.seller === undefined ? { id: 's1', archivedAt: null } : o.seller
      ),
    },
    activity: {
      create: vi.fn(async () => {
        calls.activity++
        return {}
      }),
    },
  }
  return { tx, calls }
}

const params = {
  offerId: 'offer-1',
  toStatus: 'ACEPTADA' as OfferStatus,
  resolvedVehicleId: 'v1',
  resolvedBuyerLeadId: 'b1',
  resolvedSellerLeadId: 's1' as string | null,
  actorId: 'user-1',
}

const run = (tx: unknown, p: Record<string, unknown> = {}, hooks = {}) =>
  applyOfferTransitionTx(tx as never, { ...params, ...p } as never, hooks as never)

const acceptedOffer = {
  id: 'offer-1',
  status: 'ACEPTADA',
  amount: 25000,
  vehicleId: 'v1',
  buyerLeadId: 'b1',
}

// ─── raíces ───────────────────────────────────────────────────────────────────

describe('resolución de raíces', () => {
  it('incluye vehículo, vendedor y comprador', () => {
    expect(
      buildOfferTransitionRoots({ vehicleId: 'v1', sellerLeadId: 's1', buyerLeadId: 'b1' })
    ).toEqual([
      { type: 'vehicle', id: 'v1' },
      { type: 'sellerLead', id: 's1' },
      { type: 'buyerLead', id: 'b1' },
    ])
  })

  it('omite el vendedor si no existe — nunca una raíz vacía', () => {
    const roots = buildOfferTransitionRoots({
      vehicleId: 'v1',
      sellerLeadId: null,
      buyerLeadId: 'b1',
    })
    expect(roots).toEqual([
      { type: 'vehicle', id: 'v1' },
      { type: 'buyerLead', id: 'b1' },
    ])
    expect(roots.some((r) => r.id === '')).toBe(false)
  })
})

// ─── consistencia de raíces ───────────────────────────────────────────────────

describe('root changed', () => {
  it('la oferta cambió de vehículo → OFFER_ROOT_CHANGED, sin escribir', async () => {
    const { tx, calls } = fakeTx({
      offer: { ...acceptedOffer, status: 'PROPUESTA', vehicleId: 'v2' },
    })
    await expect(run(tx)).rejects.toMatchObject({ code: 'OFFER_ROOT_CHANGED' })
    expect(calls.offerUpdate).toBe(0)
    expect(calls.activity).toBe(0)
  })

  it('la oferta cambió de comprador → OFFER_ROOT_CHANGED', async () => {
    const { tx } = fakeTx({
      offer: { ...acceptedOffer, status: 'PROPUESTA', buyerLeadId: 'b2' },
    })
    await expect(run(tx)).rejects.toMatchObject({ code: 'OFFER_ROOT_CHANGED' })
  })

  it.each([
    ['S1 → S2', 's2', 's1'],
    ['null → S2', 's2', null],
    ['S1 → null', null, 's1'],
  ])('el vehículo cambió de vendedor (%s) → OFFER_ROOT_CHANGED', async (_l, actual, resolved) => {
    const { tx, calls } = fakeTx({
      vehicle: { id: 'v1', status: 'PUBLICADO', sellerLeadId: actual, brand: 'A', model: 'B' },
    })
    await expect(run(tx, { resolvedSellerLeadId: resolved })).rejects.toMatchObject({
      code: 'OFFER_ROOT_CHANGED',
    })
    expect(calls.offerUpdate).toBe(0)
  })

  it('oferta inexistente → OFFER_NOT_FOUND', async () => {
    const { tx } = fakeTx({ offer: null })
    await expect(run(tx)).rejects.toMatchObject({ code: 'OFFER_NOT_FOUND' })
  })

  it('vehículo inexistente → VEHICLE_NOT_FOUND', async () => {
    const { tx } = fakeTx({ vehicle: null })
    await expect(run(tx)).rejects.toMatchObject({ code: 'VEHICLE_NOT_FOUND' })
  })
})

// ─── leads archivados ─────────────────────────────────────────────────────────

describe('leads archivados', () => {
  it('comprador archivado → LEAD_ARCHIVED, sin escribir', async () => {
    const { tx, calls } = fakeTx({ buyer: { id: 'b1', archivedAt: new Date() } })
    await expect(run(tx)).rejects.toMatchObject({ code: 'LEAD_ARCHIVED' })
    expect(calls.offerUpdate).toBe(0)
  })

  it('vendedor archivado → LEAD_ARCHIVED, sin escribir', async () => {
    const { tx, calls } = fakeTx({ seller: { id: 's1', archivedAt: new Date() } })
    await expect(run(tx)).rejects.toMatchObject({ code: 'LEAD_ARCHIVED' })
    expect(calls.offerUpdate).toBe(0)
  })

  it.each(['RECHAZADA', 'EXPIRADA', 'RETIRADA'] as OfferStatus[])(
    'tampoco permite la transición terminal %s sobre un lead archivado',
    async (toStatus) => {
      const { tx, calls } = fakeTx({ buyer: { id: 'b1', archivedAt: new Date() } })
      await expect(run(tx, { toStatus })).rejects.toMatchObject({ code: 'LEAD_ARCHIVED' })
      expect(calls.offerUpdate).toBe(0)
    }
  )

  it('comprador inexistente → BUYER_LEAD_NOT_FOUND', async () => {
    const { tx } = fakeTx({ buyer: null })
    await expect(run(tx)).rejects.toMatchObject({ code: 'BUYER_LEAD_NOT_FOUND' })
  })

  it('vendedor inexistente → SELLER_LEAD_NOT_FOUND', async () => {
    const { tx } = fakeTx({ seller: null })
    await expect(run(tx)).rejects.toMatchObject({ code: 'SELLER_LEAD_NOT_FOUND' })
  })

  it('vehículo sin vendedor: no consulta sellerLead', async () => {
    const { tx } = fakeTx({
      vehicle: { id: 'v1', status: 'PUBLICADO', sellerLeadId: null, brand: 'A', model: 'B' },
    })
    await run(tx, { resolvedSellerLeadId: null })
    expect(tx.sellerLead.findUnique).not.toHaveBeenCalled()
  })
})

// ─── máquina de estados ───────────────────────────────────────────────────────

describe('máquina de estados revalidada sobre la relectura', () => {
  it('rechaza una transición no permitida aunque la lectura previa la creyera válida', async () => {
    // La oferta ya está ACEPTADA: PROPUESTA ya no es alcanzable.
    const { tx, calls } = fakeTx({ offer: acceptedOffer })
    await expect(run(tx, { toStatus: 'PROPUESTA' })).rejects.toMatchObject({
      code: 'INVALID_TRANSITION',
    })
    expect(calls.offerUpdate).toBe(0)
  })

  it('rechaza salir de un estado terminal', async () => {
    const { tx } = fakeTx({ offer: { ...acceptedOffer, status: 'CANCELADA' } })
    await expect(run(tx, { toStatus: 'ACEPTADA' })).rejects.toMatchObject({
      code: 'INVALID_TRANSITION',
    })
  })
})

// ─── aceptación ───────────────────────────────────────────────────────────────

describe('aceptación', () => {
  it('exige que el vehículo esté PUBLICADO', () => {
    expect(OFFER_ACCEPTANCE_REQUIRED_VEHICLE_STATUS).toBe('PUBLICADO')
  })

  it('acepta con el vehículo PUBLICADO', async () => {
    const { tx, calls } = fakeTx()
    const res = await run(tx)
    expect(res.toStatus).toBe('ACEPTADA')
    expect(calls.offerUpdate).toBe(1)
    expect(calls.vehicleUpdate).toBe(1)
  })

  it.each(['NUEVO', 'TASADO', 'RESERVADO', 'VENDIDO', 'DESCARTADO'] as VehicleStatus[])(
    'con el vehículo en %s → VEHICLE_NOT_AVAILABLE, sin escribir',
    async (status) => {
      const { tx, calls } = fakeTx({
        vehicle: { id: 'v1', status, sellerLeadId: 's1', brand: 'A', model: 'B' },
      })
      await expect(run(tx)).rejects.toMatchObject({ code: 'VEHICLE_NOT_AVAILABLE' })
      expect(calls.offerUpdate).toBe(0)
      expect(calls.vehicleUpdate).toBe(0)
    }
  )

  it('una oferta sobre TASADO no puede aceptarse: hay que publicar antes', async () => {
    const { tx } = fakeTx({
      vehicle: { id: 'v1', status: 'TASADO', sellerLeadId: 's1', brand: 'A', model: 'B' },
    })
    await expect(run(tx)).rejects.toMatchObject({ code: 'VEHICLE_NOT_AVAILABLE' })
  })

  it('una oferta de respaldo sobre RESERVADO no puede aceptarse', async () => {
    const { tx } = fakeTx({
      vehicle: { id: 'v1', status: 'RESERVADO', sellerLeadId: 's1', brand: 'A', model: 'B' },
    })
    await expect(run(tx)).rejects.toMatchObject({ code: 'VEHICLE_NOT_AVAILABLE' })
  })

  it('si ya existe otra ACEPTADA → RESERVATION_ALREADY_OWNED, sin escribir', async () => {
    const { tx, calls } = fakeTx({ otherAccepted: 1 })
    await expect(run(tx)).rejects.toMatchObject({ code: 'RESERVATION_ALREADY_OWNED' })
    expect(calls.offerUpdate).toBe(0)
    expect(calls.vehicleUpdate).toBe(0)
    expect(calls.activity).toBe(0)
  })

  it('la comprobación de propiedad excluye la propia oferta', async () => {
    const { tx } = fakeTx()
    await run(tx)
    expect(tx.offer.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'ACEPTADA', id: { not: 'offer-1' } }),
      })
    )
  })
})

// ─── cancelación ──────────────────────────────────────────────────────────────

describe('cancelación de una oferta aceptada', () => {
  const cancel = { toStatus: 'CANCELADA' as OfferStatus }

  it('con el vehículo RESERVADO: cancela y libera', async () => {
    const { tx, calls } = fakeTx({
      offer: acceptedOffer,
      vehicle: { id: 'v1', status: 'RESERVADO', sellerLeadId: 's1', brand: 'A', model: 'B' },
    })
    const res = await run(tx, cancel)
    expect(res.toStatus).toBe('CANCELADA')
    expect(calls.offerUpdate).toBe(1)
    expect(calls.vehicleUpdate).toBe(1)
  })

  it('con el vehículo ya PUBLICADO: cancela sin tocar el vehículo y no es un fallo', async () => {
    const { tx, calls } = fakeTx({
      offer: acceptedOffer,
      vehicle: { id: 'v1', status: 'PUBLICADO', sellerLeadId: 's1', brand: 'A', model: 'B' },
    })
    const res = await run(tx, cancel)
    expect(res.toStatus).toBe('CANCELADA')
    expect(calls.offerUpdate).toBe(1)
    expect(calls.vehicleUpdate).toBe(0)
  })

  it.each(['NUEVO', 'TASADO', 'VENDIDO', 'DESCARTADO'] as VehicleStatus[])(
    'con el vehículo en %s → VEHICLE_RESERVATION_STATE_CONFLICT, sin tocar nada',
    async (status) => {
      const { tx, calls } = fakeTx({
        offer: acceptedOffer,
        vehicle: { id: 'v1', status, sellerLeadId: 's1', brand: 'A', model: 'B' },
      })
      await expect(run(tx, cancel)).rejects.toMatchObject({
        code: 'VEHICLE_RESERVATION_STATE_CONFLICT',
      })
      expect(calls.offerUpdate).toBe(0)
      expect(calls.vehicleUpdate).toBe(0)
      expect(calls.activity).toBe(0)
    }
  )

  it('si existe otra ACEPTADA → RESERVATION_OWNERSHIP_CONFLICT, sin liberar', async () => {
    // Estado anómalo: no se puede saber de quién es la reserva. No se repara automáticamente.
    const { tx, calls } = fakeTx({
      offer: acceptedOffer,
      vehicle: { id: 'v1', status: 'RESERVADO', sellerLeadId: 's1', brand: 'A', model: 'B' },
      otherAccepted: 1,
    })
    await expect(run(tx, cancel)).rejects.toMatchObject({
      code: 'RESERVATION_OWNERSHIP_CONFLICT',
    })
    expect(calls.offerUpdate).toBe(0)
    expect(calls.vehicleUpdate).toBe(0)
    expect(calls.activity).toBe(0)
  })

  it('la política de estados cancelables es exhaustiva', () => {
    expect(Object.keys(CANCELLABLE_VEHICLE_STATUS_POLICY).sort()).toEqual(
      [...ALL_VEHICLE_STATUSES].sort()
    )
    expect(CANCELLABLE_VEHICLE_STATUS_POLICY.RESERVADO).toBe(true)
    expect(CANCELLABLE_VEHICLE_STATUS_POLICY.PUBLICADO).toBe(true)
    expect(CANCELLABLE_VEHICLE_STATUS_POLICY.VENDIDO).toBe(false)
  })
})

// ─── conversión ───────────────────────────────────────────────────────────────

describe('conversión', () => {
  const convert = { toStatus: 'CONVERTIDA' as OfferStatus }

  it('no libera el vehículo: sigue RESERVADO hasta la entrega', async () => {
    const { tx, calls } = fakeTx({
      offer: acceptedOffer,
      vehicle: { id: 'v1', status: 'RESERVADO', sellerLeadId: 's1', brand: 'A', model: 'B' },
    })
    const res = await run(tx, convert)
    expect(res.toStatus).toBe('CONVERTIDA')
    expect(res.released).toBe(false)
    expect(calls.vehicleUpdate).toBe(0)
  })

  it('con el vehículo RESERVADO: convierte y deja traza en ambos lados', async () => {
    const { tx, calls } = fakeTx({
      offer: acceptedOffer,
      vehicle: { id: 'v1', status: 'RESERVADO', sellerLeadId: 's1', brand: 'A', model: 'B' },
    })
    const res = await run(tx, convert)
    expect(res.toStatus).toBe('CONVERTIDA')
    expect(calls.offerUpdate).toBe(1)
    expect(calls.vehicleUpdate).toBe(0)
    expect(calls.activity).toBe(2)
  })

  // F1: convertir cierra una venta y emite SALE_CLOSED. Solo desde una reserva viva.
  it.each(['NUEVO', 'TASADO', 'PUBLICADO', 'VENDIDO', 'DESCARTADO'] as VehicleStatus[])(
    'con el vehículo en %s → VEHICLE_NOT_READY_FOR_CONVERSION, sin tocar nada',
    async (status) => {
      const { tx, calls } = fakeTx({
        offer: acceptedOffer,
        vehicle: { id: 'v1', status, sellerLeadId: 's1', brand: 'A', model: 'B' },
      })
      await expect(run(tx, convert)).rejects.toMatchObject({
        code: 'VEHICLE_NOT_READY_FOR_CONVERSION',
      })
      expect(calls.offerUpdate).toBe(0)
      expect(calls.vehicleUpdate).toBe(0)
      expect(calls.activity).toBe(0)
    }
  )

  it('un VehicleStatus desconocido en runtime falla cerrado', async () => {
    const { tx, calls } = fakeTx({
      offer: acceptedOffer,
      vehicle: { id: 'v1', status: 'ESTADO_FUTURO', sellerLeadId: 's1', brand: 'A', model: 'B' },
    })
    await expect(run(tx, convert)).rejects.toMatchObject({
      code: 'VEHICLE_NOT_READY_FOR_CONVERSION',
    })
    expect(calls.offerUpdate).toBe(0)
    expect(calls.activity).toBe(0)
  })

  it('la política cubre todos los VehicleStatus y solo permite RESERVADO', () => {
    // Un valor nuevo del enum rompe la compilación del Record y obliga a decidir la política.
    expect(Object.keys(OFFER_CONVERSION_VEHICLE_STATUS_POLICY).sort()).toEqual(
      [...ALL_VEHICLE_STATUSES].sort()
    )
    const permitidos = ALL_VEHICLE_STATUSES.filter((s) => OFFER_CONVERSION_VEHICLE_STATUS_POLICY[s])
    expect(permitidos).toEqual(['RESERVADO'])
  })

  it('la propiedad se valida antes que el estado del vehículo', async () => {
    // Con otra ACEPTADA y el vehículo PUBLICADO gana el conflicto de propiedad: orden determinista.
    const { tx } = fakeTx({
      offer: acceptedOffer,
      vehicle: { id: 'v1', status: 'PUBLICADO', sellerLeadId: 's1', brand: 'A', model: 'B' },
      otherAccepted: 1,
    })
    await expect(run(tx, convert)).rejects.toMatchObject({
      code: 'RESERVATION_OWNERSHIP_CONFLICT',
    })
  })

  it('si existe otra ACEPTADA → RESERVATION_OWNERSHIP_CONFLICT', async () => {
    const { tx, calls } = fakeTx({
      offer: acceptedOffer,
      vehicle: { id: 'v1', status: 'RESERVADO', sellerLeadId: 's1', brand: 'A', model: 'B' },
      otherAccepted: 1,
    })
    await expect(run(tx, convert)).rejects.toMatchObject({
      code: 'RESERVATION_OWNERSHIP_CONFLICT',
    })
    expect(calls.offerUpdate).toBe(0)
    expect(calls.activity).toBe(0)
  })
})

// ─── terminales sin efecto sobre el stock ─────────────────────────────────────

describe('transiciones terminales desde PROPUESTA / CONTRAOFERTA', () => {
  it.each(['RECHAZADA', 'EXPIRADA', 'RETIRADA'] as OfferStatus[])(
    '%s no toca el vehículo ni comprueba propiedad de reserva',
    async (toStatus) => {
      const { tx, calls } = fakeTx()
      const res = await run(tx, { toStatus })
      expect(res.toStatus).toBe(toStatus)
      expect(calls.offerUpdate).toBe(1)
      expect(calls.vehicleUpdate).toBe(0)
      expect(tx.offer.count).not.toHaveBeenCalled()
    }
  )
})

// ─── errores ──────────────────────────────────────────────────────────────────

describe('errores de dominio', () => {
  it('son discriminables', () => {
    const err = new OfferTransitionError('RESERVATION_ALREADY_OWNED')
    expect(isOfferTransitionError(err)).toBe(true)
    expect(err.name).toBe('OfferTransitionError')
    expect(err.code).toBe('RESERVATION_ALREADY_OWNED')
    expect(isOfferTransitionError(new Error('otro'))).toBe(false)
  })

  it('los mensajes no exponen ids, SQL, Prisma ni nombres internos de estado', () => {
    for (const message of Object.values(OFFER_TRANSITION_ERROR_MESSAGES)) {
      // Detalle técnico: sin distinguir mayúsculas.
      expect(message).not.toMatch(/select |update |insert |prisma|postgres|55P03|40P01/i)
      // Identificadores del enum: solo cuentan en MAYÚSCULAS. «aceptada» en una frase es
      // lenguaje de negocio legítimo; `ACEPTADA` sería una fuga del modelo interno.
      expect(message).not.toMatch(/\b(ACEPTADA|RESERVADO|PUBLICADO|VENDIDO|DESCARTADO|TASADO)\b/)
      expect(message).not.toMatch(/[0-9a-f]{20,}/)
      expect(message.length).toBeGreaterThan(10)
    }
  })

  it('usa los mensajes acordados', () => {
    expect(OFFER_TRANSITION_ERROR_MESSAGES.RESERVATION_ALREADY_OWNED).toBe(
      'El vehículo ya tiene otra oferta aceptada y no puede reservarse de nuevo.'
    )
    expect(OFFER_TRANSITION_ERROR_MESSAGES.RESERVATION_OWNERSHIP_CONFLICT).toBe(
      'No se puede cancelar la reserva porque el vehículo presenta otra oferta aceptada.'
    )
  })
})
