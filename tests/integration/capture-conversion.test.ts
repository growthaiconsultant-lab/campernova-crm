/**
 * Tests de integración con PostgreSQL REAL (PR4) — conversión atómica de captaciones.
 *
 * Demuestran que convertir una captación (reclamo CAS + vendedor + vehículo + vínculo +
 * trazas) ocurre en una ÚNICA transacción: o se crea y vincula todo, o no se persiste nada.
 * La exclusión se decide con compare-and-swap sobre `VehicleCapture.sellerLeadId` (único),
 * no con la lectura previa. Dos conversiones concurrentes de la misma captación producen
 * exactamente 1 éxito + 1 conflicto, sin vendedores/vehículos huérfanos ni duplicados.
 *
 * La barrera de dos partes usa `beforeCaptureClaim` (primer paso del servicio): ambas
 * transacciones se sincronizan justo antes del CAS y compiten por la misma fila.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  convertCaptureTx,
  ConversionConflictError,
  type ConversionHooks,
  type ConvertCaptureParams,
} from '@/lib/capture-conversion'
import { createGuardedTestPrisma, uniqueSuffix } from './db'

let prisma: PrismaClient

const TX_OPTS = { timeout: 20_000, maxWait: 15_000 }
const cleanups: Array<() => Promise<void>> = []

type Seeded = { userId: string; captureId: string; phone: string; suffix: string }

async function seed(): Promise<Seeded> {
  const s = uniqueSuffix()
  const phone = `cap_${s}`
  const user = await prisma.user.create({
    data: { email: `agent_${s}@integ.test`, name: `Agent ${s}`, role: 'AGENTE' },
  })
  const capture = await prisma.vehicleCapture.create({
    data: {
      listingUrl: `https://coches.net/${s}`,
      phone,
      portal: 'COCHES_NET',
      title: `Adria ${s}`,
      status: 'ENTRADA_AGENDADA',
      createdById: user.id,
      assignedToId: user.id,
    },
  })

  cleanups.push(async () => {
    // FK-safe: captación (createdById Restrict) → vendedor (cascada vehículo+trazas) → user.
    await prisma.vehicleCapture.deleteMany({ where: { id: capture.id } })
    await prisma.sellerLead.deleteMany({ where: { phone } })
    await prisma.user.deleteMany({ where: { id: user.id } })
  })

  return { userId: user.id, captureId: capture.id, phone, suffix: s }
}

function captureParams(seeded: Seeded): ConvertCaptureParams {
  return {
    captureId: seeded.captureId,
    sellerData: {
      name: `Vendedor ${seeded.suffix}`,
      email: '',
      phone: seeded.phone,
      canal: 'CN',
      status: 'NUEVO',
      agentId: seeded.userId,
      vehicle: {
        create: {
          type: 'AUTOCARAVANA',
          brand: `Adria-${seeded.suffix}`,
          model: 'Coral',
          year: 2020,
          km: 0,
          seats: 4,
          conservationState: 'NORMAL',
          equipment: {},
          status: 'NUEVO',
        },
      },
      activities: { create: { type: 'NOTA', content: `Origen: captación ${seeded.suffix}` } },
    },
    linkingNotePrefix: 'Convertida a lead de vendedor desde captación (Coches.net).',
  }
}

function runConversion(seeded: Seeded, hooks?: ConversionHooks) {
  return prisma.$transaction((tx) => convertCaptureTx(tx, captureParams(seeded), hooks), TX_OPTS)
}

function twoPartyBarrier() {
  let arriveA!: () => void
  let arriveB!: () => void
  const aArrived = new Promise<void>((r) => (arriveA = r))
  const bArrived = new Promise<void>((r) => (arriveB = r))
  return {
    hookA: {
      beforeCaptureClaim: async () => {
        arriveA()
        await bArrived
      },
    } satisfies ConversionHooks,
    hookB: {
      beforeCaptureClaim: async () => {
        arriveB()
        await aArrived
      },
    } satisfies ConversionHooks,
  }
}

beforeAll(() => {
  prisma = createGuardedTestPrisma()
})
afterEach(async () => {
  for (const clean of cleanups.splice(0).reverse()) await clean()
})
afterAll(async () => {
  await prisma?.$disconnect()
})

describe('integración · conversión de captación (camino feliz)', () => {
  it('crea vendedor + vehículo, vincula la captación y deja 2 trazas, sin registros faltantes', async () => {
    const seeded = await seed()
    const result = await runConversion(seeded)
    expect(result.sellerLeadId).toBeTruthy()
    expect(result.vehicleId).toBeTruthy()

    const capture = await prisma.vehicleCapture.findUnique({ where: { id: seeded.captureId } })
    expect(capture?.status).toBe('CONVERTIDO')
    expect(capture?.sellerLeadId).toBe(result.sellerLeadId)

    const seller = await prisma.sellerLead.findUnique({
      where: { id: result.sellerLeadId },
      include: { vehicle: true, activities: true },
    })
    expect(seller?.canal).toBe('CN')
    expect(seller?.vehicle?.id).toBe(result.vehicleId)
    expect(seller?.vehicle?.status).toBe('NUEVO')
    // Actividades: origen (en el create anidado) + enlace = 2.
    expect(seller?.activities).toHaveLength(2)
  })
})

describe('integración · dos conversiones concurrentes de la misma captación', () => {
  it('exactamente 1 éxito + 1 conflicto "capture"; una captación convertida, un vendedor, un vehículo', async () => {
    const seeded = await seed()
    const { hookA, hookB } = twoPartyBarrier()

    const settled = await Promise.allSettled([
      runConversion(seeded, hookA),
      runConversion(seeded, hookB),
    ])
    const fulfilled = settled.filter((r) => r.status === 'fulfilled')
    const rejected = settled.filter((r) => r.status === 'rejected')

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    const reason = (rejected[0] as PromiseRejectedResult).reason
    expect(reason).toBeInstanceOf(ConversionConflictError)
    expect((reason as ConversionConflictError).reason).toBe('capture')

    // Una sola captación convertida y sin duplicados.
    const capture = await prisma.vehicleCapture.findUnique({ where: { id: seeded.captureId } })
    expect(capture?.status).toBe('CONVERTIDO')
    expect(capture?.sellerLeadId).toBeTruthy()

    // Exactamente un vendedor (el ganador) — el perdedor falla el CAS antes de crear nada.
    const sellers = await prisma.sellerLead.findMany({
      where: { phone: seeded.phone },
      include: { vehicle: true, activities: true },
    })
    expect(sellers).toHaveLength(1)
    expect(sellers[0].id).toBe(capture?.sellerLeadId)
    expect(sellers[0].vehicle).not.toBeNull()
    // Trazas sin duplicar: origen + enlace = 2.
    expect(sellers[0].activities).toHaveLength(2)

    // Invariante: exactamente un vehículo derivado de esta captación.
    const vehicles = await prisma.vehicle.findMany({
      where: { sellerLead: { phone: seeded.phone } },
    })
    expect(vehicles).toHaveLength(1)
  })
})

describe('integración · rollback total', () => {
  it('fallo antes del vendedor → captación sin convertir, sin vendedor/vehículo/trazas', async () => {
    const seeded = await seed()
    await expect(
      runConversion(seeded, {
        beforeSellerWrite: async () => {
          throw new Error('fallo antes del vendedor')
        },
      })
    ).rejects.toThrow('fallo antes del vendedor')

    const capture = await prisma.vehicleCapture.findUnique({ where: { id: seeded.captureId } })
    expect(capture?.status).toBe('ENTRADA_AGENDADA') // el CAS reclamado se revierte
    expect(capture?.sellerLeadId).toBeNull()
    expect(await prisma.sellerLead.count({ where: { phone: seeded.phone } })).toBe(0)
  })

  it('fallo tras crear vendedor+vehículo, antes del vínculo → todo revertido (sin huérfanos)', async () => {
    const seeded = await seed()
    await expect(
      runConversion(seeded, {
        beforeLinkWrite: async () => {
          throw new Error('fallo antes del vínculo')
        },
      })
    ).rejects.toThrow('fallo antes del vínculo')

    const capture = await prisma.vehicleCapture.findUnique({ where: { id: seeded.captureId } })
    expect(capture?.status).toBe('ENTRADA_AGENDADA')
    expect(capture?.sellerLeadId).toBeNull()
    // El vendedor+vehículo creados dentro de la tx se revierten → ningún huérfano.
    expect(await prisma.sellerLead.count({ where: { phone: seeded.phone } })).toBe(0)
    expect(await prisma.vehicle.count({ where: { sellerLead: { phone: seeded.phone } } })).toBe(0)
  })
})
