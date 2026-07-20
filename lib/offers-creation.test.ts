import { describe, it, expect, vi } from 'vitest'
import type { VehicleStatus } from '@prisma/client'
import {
  OFFER_CREATION_ALLOWED_VEHICLE_STATUSES,
  OFFER_CREATION_ERROR_MESSAGES,
  OfferCreationError,
  buildOfferCreationRoots,
  OFFER_CREATION_VEHICLE_STATUS_POLICY,
  canCreateOfferForVehicleStatus,
  createOfferTx,
  isOfferCreationError,
} from './offers-creation'

const ALL_VEHICLE_STATUSES: VehicleStatus[] = [
  'NUEVO',
  'TASADO',
  'PUBLICADO',
  'RESERVADO',
  'VENDIDO',
  'DESCARTADO',
]

describe('estados permitidos para crear oferta', () => {
  it('la lista derivada contiene exactamente los tres acordados', () => {
    expect(OFFER_CREATION_ALLOWED_VEHICLE_STATUSES).toEqual(['TASADO', 'PUBLICADO', 'RESERVADO'])
  })

  it.each(['TASADO', 'PUBLICADO', 'RESERVADO'] as VehicleStatus[])('permite %s', (status) => {
    expect(canCreateOfferForVehicleStatus(status)).toBe(true)
  })

  it.each(['NUEVO', 'VENDIDO', 'DESCARTADO'] as VehicleStatus[])('rechaza %s', (status) => {
    expect(canCreateOfferForVehicleStatus(status)).toBe(false)
  })

  it('la política declara una decisión para cada valor del enum', () => {
    // La garantía real es de COMPILACIÓN: `Record<VehicleStatus, boolean>` obliga a declarar el
    // estado nuevo. Este test comprueba en runtime que la política y el enum siguen alineados.
    expect(Object.keys(OFFER_CREATION_VEHICLE_STATUS_POLICY).sort()).toEqual(
      [...ALL_VEHICLE_STATUSES].sort()
    )
    for (const status of ALL_VEHICLE_STATUSES) {
      expect(typeof OFFER_CREATION_VEHICLE_STATUS_POLICY[status]).toBe('boolean')
    }
  })

  it('la lista derivada no es una segunda fuente: sale de la política', () => {
    const esperados = (Object.keys(OFFER_CREATION_VEHICLE_STATUS_POLICY) as VehicleStatus[]).filter(
      (s) => OFFER_CREATION_VEHICLE_STATUS_POLICY[s]
    )
    expect(OFFER_CREATION_ALLOWED_VEHICLE_STATUSES).toEqual(esperados)
  })

  it('es fail-closed ante un estado no declarado que llegue sin tipar', () => {
    // p. ej. un valor procedente de la base que el enum de la app todavía no conoce.
    expect(canCreateOfferForVehicleStatus('ESTADO_FUTURO' as VehicleStatus)).toBe(false)
    expect(canCreateOfferForVehicleStatus(undefined as unknown as VehicleStatus)).toBe(false)
  })
})

describe('resolución de raíces', () => {
  it('incluye vehículo, vendedor y comprador cuando el vehículo tiene vendedor', () => {
    expect(
      buildOfferCreationRoots({ vehicleId: 'v1', sellerLeadId: 's1', buyerLeadId: 'b1' })
    ).toEqual([
      { type: 'vehicle', id: 'v1' },
      { type: 'sellerLead', id: 's1' },
      { type: 'buyerLead', id: 'b1' },
    ])
  })

  it('omite el vendedor cuando es null — nunca construye una raíz vacía', () => {
    const roots = buildOfferCreationRoots({
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

  it('nunca devuelve una lista vacía', () => {
    expect(
      buildOfferCreationRoots({ vehicleId: 'v1', sellerLeadId: null, buyerLeadId: 'b1' }).length
    ).toBeGreaterThan(0)
  })
})

// ─── núcleo transaccional ─────────────────────────────────────────────────────

type TxOverrides = {
  vehicle?: Record<string, unknown> | null
  buyer?: Record<string, unknown> | null
  seller?: Record<string, unknown> | null
  offerCreate?: () => Promise<{ id: string }>
  activityCreateMany?: () => Promise<unknown>
}

function fakeTx(o: TxOverrides = {}) {
  const calls = { offerCreate: 0, activityCreateMany: 0 }
  const activityData: unknown[] = []
  const tx = {
    vehicle: {
      findUnique: vi.fn(async () =>
        o.vehicle === undefined
          ? { id: 'v1', status: 'PUBLICADO', sellerLeadId: 's1', brand: 'Adria', model: 'Coral' }
          : o.vehicle
      ),
    },
    buyerLead: {
      findUnique: vi.fn(async () =>
        o.buyer === undefined ? { id: 'b1', name: 'Comprador', archivedAt: null } : o.buyer
      ),
    },
    sellerLead: {
      findUnique: vi.fn(async () =>
        o.seller === undefined ? { id: 's1', archivedAt: null } : o.seller
      ),
    },
    offer: {
      create: vi.fn(async () => {
        calls.offerCreate++
        return o.offerCreate ? o.offerCreate() : { id: 'offer-1' }
      }),
    },
    activity: {
      createMany: vi.fn(async (args: { data: unknown[] }) => {
        calls.activityCreateMany++
        activityData.push(...args.data)
        return o.activityCreateMany ? o.activityCreateMany() : { count: args.data.length }
      }),
    },
  }
  return { tx, calls, activityData }
}

const params = {
  vehicleId: 'v1',
  buyerLeadId: 'b1',
  resolvedSellerLeadId: 's1' as string | null,
  matchId: null,
  amount: 25000,
  notes: null,
  actorId: 'user-1',
}

const run = (tx: unknown, p = params, hooks = {}) =>
  createOfferTx(tx as never, p as never, hooks as never)

describe('createOfferTx — validaciones', () => {
  it('crea la oferta cuando todo es válido', async () => {
    const { tx, calls } = fakeTx()
    const res = await run(tx)
    expect(res.offerId).toBe('offer-1')
    expect(res.sellerLeadId).toBe('s1')
    expect(calls.offerCreate).toBe(1)
    expect(calls.activityCreateMany).toBe(1)
  })

  it('vehículo inexistente → VEHICLE_NOT_FOUND, sin escribir', async () => {
    const { tx, calls } = fakeTx({ vehicle: null })
    await expect(run(tx)).rejects.toMatchObject({ code: 'VEHICLE_NOT_FOUND' })
    expect(calls.offerCreate).toBe(0)
    expect(calls.activityCreateMany).toBe(0)
  })

  it('comprador inexistente → BUYER_LEAD_NOT_FOUND, sin escribir', async () => {
    const { tx, calls } = fakeTx({ buyer: null })
    await expect(run(tx)).rejects.toMatchObject({ code: 'BUYER_LEAD_NOT_FOUND' })
    expect(calls.offerCreate).toBe(0)
  })

  it('vendedor inexistente → SELLER_LEAD_NOT_FOUND, sin escribir', async () => {
    const { tx, calls } = fakeTx({ seller: null })
    await expect(run(tx)).rejects.toMatchObject({ code: 'SELLER_LEAD_NOT_FOUND' })
    expect(calls.offerCreate).toBe(0)
  })

  it('comprador archivado → LEAD_ARCHIVED, sin escribir', async () => {
    const { tx, calls } = fakeTx({ buyer: { id: 'b1', name: 'X', archivedAt: new Date() } })
    await expect(run(tx)).rejects.toMatchObject({ code: 'LEAD_ARCHIVED' })
    expect(calls.offerCreate).toBe(0)
    expect(calls.activityCreateMany).toBe(0)
  })

  it('vendedor archivado → LEAD_ARCHIVED, sin escribir', async () => {
    const { tx, calls } = fakeTx({ seller: { id: 's1', archivedAt: new Date() } })
    await expect(run(tx)).rejects.toMatchObject({ code: 'LEAD_ARCHIVED' })
    expect(calls.offerCreate).toBe(0)
  })

  it('la raíz cambió de vendedor → OFFER_ROOT_CHANGED, sin escribir', async () => {
    // El vehículo cuelga ahora de otro vendedor: las raíces bloqueadas ya no cubren la operación.
    const { tx, calls } = fakeTx({
      vehicle: { id: 'v1', status: 'PUBLICADO', sellerLeadId: 's2', brand: 'A', model: 'B' },
    })
    await expect(run(tx)).rejects.toMatchObject({ code: 'OFFER_ROOT_CHANGED' })
    expect(calls.offerCreate).toBe(0)
  })

  it('el vehículo pasó a tener vendedor donde no lo había (null → S2) → OFFER_ROOT_CHANGED', async () => {
    const { tx } = fakeTx()
    await expect(run(tx, { ...params, resolvedSellerLeadId: null })).rejects.toMatchObject({
      code: 'OFFER_ROOT_CHANGED',
    })
  })

  it('el vehículo PERDIÓ su vendedor (S1 → null) → OFFER_ROOT_CHANGED, sin escribir', async () => {
    // Tercera dirección del cambio de raíz: se bloqueó S1, pero la relectura ya no ve ningún
    // vendedor. Continuar dejaría la operación apoyada en un lock que ya no describe la realidad.
    const { tx, calls } = fakeTx({
      vehicle: { id: 'v1', status: 'PUBLICADO', sellerLeadId: null, brand: 'A', model: 'B' },
    })

    await expect(run(tx, { ...params, resolvedSellerLeadId: 's1' })).rejects.toMatchObject({
      code: 'OFFER_ROOT_CHANGED',
    })
    expect(tx.sellerLead.findUnique).not.toHaveBeenCalled()
    expect(calls.offerCreate).toBe(0)
    expect(calls.activityCreateMany).toBe(0)
  })

  it.each(['NUEVO', 'VENDIDO', 'DESCARTADO'] as VehicleStatus[])(
    'vehículo en %s → VEHICLE_NOT_AVAILABLE, sin escribir',
    async (status) => {
      const { tx, calls } = fakeTx({
        vehicle: { id: 'v1', status, sellerLeadId: 's1', brand: 'A', model: 'B' },
      })
      await expect(run(tx)).rejects.toMatchObject({ code: 'VEHICLE_NOT_AVAILABLE' })
      expect(calls.offerCreate).toBe(0)
    }
  )

  it.each(['TASADO', 'PUBLICADO', 'RESERVADO'] as VehicleStatus[])(
    'vehículo en %s → se crea la oferta',
    async (status) => {
      const { tx, calls } = fakeTx({
        vehicle: { id: 'v1', status, sellerLeadId: 's1', brand: 'A', model: 'B' },
      })
      await expect(run(tx)).resolves.toMatchObject({ offerId: 'offer-1' })
      expect(calls.offerCreate).toBe(1)
    }
  )

  it('vehículo sin vendedor: no consulta sellerLead y crea una sola Activity', async () => {
    const { tx, calls, activityData } = fakeTx({
      vehicle: { id: 'v1', status: 'PUBLICADO', sellerLeadId: null, brand: 'A', model: 'B' },
    })
    const res = await run(tx, { ...params, resolvedSellerLeadId: null })

    expect(tx.sellerLead.findUnique).not.toHaveBeenCalled()
    expect(res.sellerLeadId).toBeNull()
    expect(calls.offerCreate).toBe(1)
    expect(activityData).toHaveLength(1)
  })
})

describe('createOfferTx — atomicidad y traza', () => {
  it('crea Activity en ambos lados cuando hay vendedor', async () => {
    const { tx, activityData } = fakeTx()
    await run(tx)
    expect(activityData).toHaveLength(2)
    expect(activityData).toEqual([
      expect.objectContaining({ type: 'OFERTA_REGISTRADA', buyerLeadId: 'b1' }),
      expect.objectContaining({ type: 'OFERTA_REGISTRADA', sellerLeadId: 's1' }),
    ])
  })

  it('mantiene el texto de la Activity con el formato de importe vigente', async () => {
    const { tx, activityData } = fakeTx()
    await run(tx)
    const content = (activityData[0] as { content: string }).content
    expect(content).toContain('Oferta registrada:')
    expect(content).toContain('Comprador')
    expect(content).toContain('Adria Coral')
    // Formato es-ES sin decimales.
    expect(content).toMatch(/25\.000/)
  })

  it('si falla la Activity, el error se propaga para que la transacción revierta', async () => {
    const boom = new Error('fallo al escribir la traza')
    const { tx, calls } = fakeTx({
      activityCreateMany: () => Promise.reject(boom),
    })
    await expect(run(tx)).rejects.toBe(boom)
    // La oferta se intentó escribir, pero al propagarse el error la transacción la revierte.
    expect(calls.offerCreate).toBe(1)
  })

  it('los hooks permiten forzar solapamiento sin alterar el resultado', async () => {
    const order: string[] = []
    const { tx } = fakeTx()
    await run(tx, params, {
      beforeOfferWrite: async () => void order.push('beforeOffer'),
      beforeActivityWrite: async () => void order.push('beforeActivity'),
    })
    expect(order).toEqual(['beforeOffer', 'beforeActivity'])
  })
})

describe('errores de dominio', () => {
  it('son discriminables y seguros', () => {
    const err = new OfferCreationError('LEAD_ARCHIVED')
    expect(isOfferCreationError(err)).toBe(true)
    expect(err.name).toBe('OfferCreationError')
    expect(err.code).toBe('LEAD_ARCHIVED')
    expect(isOfferCreationError(new Error('otro'))).toBe(false)
  })

  it('los mensajes no exponen ids, estado interno, SQL ni Prisma', () => {
    for (const message of Object.values(OFFER_CREATION_ERROR_MESSAGES)) {
      expect(message).not.toMatch(
        /select|update|insert|prisma|postgres|55P03|40P01|PUBLICADO|RESERVADO|VENDIDO|DESCARTADO|[0-9a-f]{20,}/i
      )
      expect(message.length).toBeGreaterThan(10)
    }
  })

  it('VEHICLE_NOT_AVAILABLE usa el mensaje acordado', () => {
    expect(OFFER_CREATION_ERROR_MESSAGES.VEHICLE_NOT_AVAILABLE).toBe(
      'El vehículo no está disponible para registrar una nueva oferta.'
    )
  })
})
