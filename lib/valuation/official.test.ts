import { describe, it, expect, vi, beforeEach } from 'vitest'

// El algoritmo se mockea: los tests de gate/escritura no dependen de comparables/referencia.
vi.mock('./calculate', () => ({ calculateValuation: vi.fn() }))
vi.mock('./prisma-deps', () => ({ prismaValuationDeps: vi.fn(() => ({})) }))

import type { Prisma } from '@prisma/client'
import { calculateValuation } from './calculate'
import { officialValuationTx, buildOfficialValuationRoots } from './official'
import { isValuationError } from './errors'
import type { OfficialValuationMode } from './official'
import type { ValuationOutput } from './types'

type TxState = {
  vehicle?: {
    status: string
    sellerLeadId: string
    entryValidatedAt: Date | null
    entryAnnulledAt: Date | null
  } | null
  seller?: { archivedAt: Date | null } | null
  completedInspections?: number
  casCount?: number
}

function makeTx(state: TxState) {
  const calls = {
    attempts: [] as unknown[],
    valuations: [] as unknown[],
    updates: [] as unknown[],
    updateMany: [] as unknown[],
    activities: [] as unknown[],
  }
  const tx = {
    vehicle: {
      findUnique: vi.fn().mockResolvedValue(state.vehicle ?? null),
      update: vi.fn((args: unknown) => {
        calls.updates.push(args)
        return Promise.resolve({})
      }),
      updateMany: vi.fn((args: unknown) => {
        calls.updateMany.push(args)
        return Promise.resolve({ count: state.casCount ?? 1 })
      }),
    },
    sellerLead: { findUnique: vi.fn().mockResolvedValue(state.seller ?? { archivedAt: null }) },
    workOrder: { count: vi.fn().mockResolvedValue(state.completedInspections ?? 1) },
    vehicleValuationAttempt: {
      create: vi.fn((args: unknown) => {
        calls.attempts.push(args)
        return Promise.resolve({ id: `att-${calls.attempts.length}` })
      }),
    },
    valuation: {
      create: vi.fn((args: unknown) => {
        calls.valuations.push(args)
        return Promise.resolve({ id: 'val-1' })
      }),
    },
    activity: {
      create: vi.fn((args: unknown) => {
        calls.activities.push(args)
        return Promise.resolve({})
      }),
    },
  }
  return { tx: tx as unknown as Prisma.TransactionClient, calls }
}

const VALID_VEHICLE = {
  status: 'NUEVO',
  sellerLeadId: 's1',
  entryValidatedAt: new Date(),
  entryAnnulledAt: null,
}

const MANUAL: OfficialValuationMode = {
  kind: 'MANUAL',
  min: 10000,
  recommended: 12000,
  max: 14000,
  confidence: 'MEDIA',
  reason: 'Tras inspección con Manolo',
}

function run(
  tx: Prisma.TransactionClient,
  over: Partial<Parameters<typeof officialValuationTx>[1]> = {}
) {
  return officialValuationTx(tx, {
    vehicleId: 'v1',
    resolvedSellerLeadId: 's1',
    actorId: 'u1',
    mode: MANUAL,
    ...over,
  })
}

const codeOf = (err: unknown) => (isValuationError(err) ? err.code : null)

beforeEach(() => vi.clearAllMocks())

describe('buildOfficialValuationRoots', () => {
  it('bloquea Vehicle → SellerLead', () => {
    expect(buildOfficialValuationRoots({ vehicleId: 'v1', sellerLeadId: 's1' })).toEqual([
      { type: 'vehicle', id: 'v1' },
      { type: 'sellerLead', id: 's1' },
    ])
  })
})

describe('officialValuationTx · gates', () => {
  it('VEHICLE_ROOT_CHANGED si el vendedor releído difiere', async () => {
    const { tx } = makeTx({ vehicle: { ...VALID_VEHICLE, sellerLeadId: 'other' } })
    expect(codeOf(await run(tx).catch((e) => e))).toBe('VEHICLE_ROOT_CHANGED')
  })

  it('LEAD_ARCHIVED si el vendedor está archivado', async () => {
    const { tx } = makeTx({ vehicle: VALID_VEHICLE, seller: { archivedAt: new Date() } })
    expect(codeOf(await run(tx).catch((e) => e))).toBe('LEAD_ARCHIVED')
  })

  it('VEHICLE_STATUS_NOT_ELIGIBLE en VENDIDO/DESCARTADO', async () => {
    for (const status of ['VENDIDO', 'DESCARTADO']) {
      const { tx } = makeTx({ vehicle: { ...VALID_VEHICLE, status } })
      expect(codeOf(await run(tx).catch((e) => e))).toBe('VEHICLE_STATUS_NOT_ELIGIBLE')
    }
  })

  it('ENTRY_NOT_ACTIVE si la entrada no está validada', async () => {
    const { tx } = makeTx({ vehicle: { ...VALID_VEHICLE, entryValidatedAt: null } })
    expect(codeOf(await run(tx).catch((e) => e))).toBe('ENTRY_NOT_ACTIVE')
  })

  it('ENTRY_NOT_ACTIVE si la entrada fue anulada', async () => {
    const { tx } = makeTx({ vehicle: { ...VALID_VEHICLE, entryAnnulledAt: new Date() } })
    expect(codeOf(await run(tx).catch((e) => e))).toBe('ENTRY_NOT_ACTIVE')
  })

  it('INSPECTION_NOT_COMPLETED si no hay inspección COMPLETADA', async () => {
    const { tx } = makeTx({ vehicle: VALID_VEHICLE, completedInspections: 0 })
    expect(codeOf(await run(tx).catch((e) => e))).toBe('INSPECTION_NOT_COMPLETED')
  })
})

describe('officialValuationTx · manual (fin del hardcode ALTA)', () => {
  it('usa la confianza DECLARADA, no ALTA; crea Valuation OFICIAL + intento + denormalizado + transición', async () => {
    const { tx, calls } = makeTx({ vehicle: VALID_VEHICLE })
    const res = await run(tx)
    expect(res.outcome).toBe('COMPLETADA')
    expect(res.transitioned).toBe(true)
    const val = calls.valuations[0] as {
      data: { confidence: string; purpose: string; method: string }
    }
    expect(val.data.confidence).toBe('MEDIA') // NO ALTA
    expect(val.data.purpose).toBe('OFICIAL')
    expect(val.data.method).toBe('MANUAL')
    const att = calls.attempts[0] as { data: { outcome: string; purpose: string; reason: string } }
    expect(att.data.outcome).toBe('COMPLETADA')
    expect(att.data.purpose).toBe('OFICIAL')
    expect(att.data.reason).toContain('Manolo')
    expect(calls.updates).toHaveLength(1) // denormalizados oficiales
    expect(calls.updateMany).toHaveLength(1) // CAS NUEVO→TASADO
  })

  it('vehículo ya TASADO: re-tasación sin transición (CAS count 0)', async () => {
    const { tx, calls } = makeTx({ vehicle: { ...VALID_VEHICLE, status: 'TASADO' }, casCount: 0 })
    const res = await run(tx)
    expect(res.outcome).toBe('COMPLETADA')
    expect(res.transitioned).toBe(false)
    expect(calls.valuations).toHaveLength(1)
  })

  it('rango inválido → INVALID_RANGE (sin escribir)', async () => {
    const { tx, calls } = makeTx({ vehicle: VALID_VEHICLE })
    const bad: OfficialValuationMode = { ...MANUAL, min: 15000 }
    expect(codeOf(await run(tx, { mode: bad }).catch((e) => e))).toBe('INVALID_RANGE')
    expect(calls.valuations).toHaveLength(0)
    expect(calls.attempts).toHaveLength(0)
  })

  it('motivo vacío → REASON_REQUIRED', async () => {
    const { tx } = makeTx({ vehicle: VALID_VEHICLE })
    const bad: OfficialValuationMode = { ...MANUAL, reason: '  ' }
    expect(codeOf(await run(tx, { mode: bad }).catch((e) => e))).toBe('REASON_REQUIRED')
  })
})

describe('officialValuationTx · auto', () => {
  const autoOutput = (method: ValuationOutput['method']): ValuationOutput => ({
    min: 9000,
    recommended: 11000,
    max: 13000,
    method,
    confidence: 'BAJA',
    parameters: {
      input: {
        brand: 'Adria',
        model: 'Coral',
        type: 'AUTOCARAVANA',
        year: 2020,
        km: 1000,
        conservationState: 'BUENO',
        equipment: {},
      },
      method: method === 'NONE' ? 'NONE' : 'COMPARABLES',
      comparablesCount: method === 'NONE' ? 0 : 4,
      adjustments: { conservationFactor: 1, equipmentFactor: 1 },
    },
  })

  const AUTO: OfficialValuationMode = {
    kind: 'AUTO',
    input: {
      brand: 'Adria',
      model: 'Coral',
      type: 'AUTOCARAVANA',
      year: 2020,
      km: 1000,
      conservationState: 'BUENO',
      equipment: {},
    },
  }

  it('sin datos (NONE) → intento OFICIAL SIN_REFERENCIA, sin Valuation ni transición', async () => {
    vi.mocked(calculateValuation).mockResolvedValue(autoOutput('NONE'))
    const { tx, calls } = makeTx({ vehicle: VALID_VEHICLE })
    const res = await run(tx, { mode: AUTO })
    expect(res.outcome).toBe('SIN_REFERENCIA')
    expect(res.transitioned).toBe(false)
    expect(res.valuationId).toBeNull()
    expect(calls.valuations).toHaveLength(0)
    expect(calls.updates).toHaveLength(0)
    expect(calls.updateMany).toHaveLength(0)
    const att = calls.attempts[0] as { data: { outcome: string } }
    expect(att.data.outcome).toBe('SIN_REFERENCIA')
  })

  it('con datos → Valuation OFICIAL con confianza del algoritmo + transición', async () => {
    vi.mocked(calculateValuation).mockResolvedValue(autoOutput('COMPARABLES'))
    const { tx, calls } = makeTx({ vehicle: VALID_VEHICLE })
    const res = await run(tx, { mode: AUTO })
    expect(res.outcome).toBe('COMPLETADA')
    expect(res.transitioned).toBe(true)
    const val = calls.valuations[0] as { data: { confidence: string; method: string } }
    expect(val.data.confidence).toBe('BAJA')
    expect(val.data.method).toBe('AUTO')
  })
})
