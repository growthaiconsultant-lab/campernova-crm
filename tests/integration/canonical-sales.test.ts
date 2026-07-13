/**
 * Tests de integración con PostgreSQL REAL (Fase 1A-1) — fact de venta canónico.
 *
 * Demuestran, sobre una base efímera migrada, que las ventas se cuentan desde el HECHO
 * CANÓNICO del vehículo (`status = VENDIDO` con `soldAt` en el periodo) y NUNCA desde el
 * texto de la timeline (`Activity`):
 *  - una venta canónica se cuenta aunque NO exista ninguna Activity;
 *  - una Activity con texto "→ Vendido" NO crea una venta si el vehículo no es VENDIDO;
 *  - cambiar/duplicar el texto de Activity no altera el conteo;
 *  - `soldAt` fuera del rango, o estado ≠ VENDIDO, o `soldAt` null no se cuentan como venta
 *    del periodo (las anomalías NO se reconstruyen desde Activity).
 *
 * Cada escenario usa su PROPIO agente y filtra por `agentId`, de modo que los tests quedan
 * aislados entre sí y de cualquier dato residual en la base.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import type { PrismaClient, VehicleStatus } from '@prisma/client'
import { getSalesInRange, type DashboardFilter } from '@/lib/dashboard/queries'
import { getFlowKpis } from '@/lib/kpi/flow'
import { getMonthlyNetMargin } from '@/lib/dashboard/metrics'
import { resolveRange } from '@/lib/kpi/range'
import { createGuardedTestPrisma, uniqueSuffix } from './db'

let prisma: PrismaClient

const cleanups: Array<() => Promise<void>> = []

// Ventana determinista: marzo 2026. `soldAt` a mediodía UTC → dentro de marzo en cualquier TZ.
const RANGE_START = new Date('2026-03-01T00:00:00.000Z')
const RANGE_END = new Date('2026-04-01T00:00:00.000Z')
const IN_RANGE = new Date('2026-03-15T12:00:00.000Z')
const OUT_OF_RANGE = new Date('2026-01-15T12:00:00.000Z')
// Ventana anterior de resolveRange('mes', 2026-03-20): [start−duración, start) ≈ [~9 feb, 1 mar).
// 15-feb-mediodía cae dentro tanto con runner UTC como Europe/Madrid.
const PREV_IN_RANGE = new Date('2026-02-15T12:00:00.000Z')

type SaleSeed = {
  status?: VehicleStatus
  soldAt?: Date | null
  salePrice?: number
  purchasePrice?: number
  /** Contenido de una Activity CAMBIO_ESTADO a crear (p. ej. "…→ Vendido"). */
  activityContents?: string[]
  /** Reutiliza un agente existente (para sembrar varias ventas del MISMO agente/periodos). */
  agentId?: string
}

/** Crea (o reutiliza) agente + vendedor (con agentId) + vehículo (+ activities). Aislado por agente. */
async function seedSale(opts: SaleSeed): Promise<{ agentId: string }> {
  const s = uniqueSuffix()
  const ownsAgent = !opts.agentId
  let agentId = opts.agentId
  if (!agentId) {
    const agent = await prisma.user.create({
      data: { email: `agent_${s}@integ.test`, name: `Agent ${s}`, role: 'AGENTE' },
    })
    agentId = agent.id
  }
  const seller = await prisma.sellerLead.create({
    data: { name: `Seller ${s}`, email: `seller_${s}@integ.test`, phone: '600000000', agentId },
  })
  const vehicle = await prisma.vehicle.create({
    data: {
      sellerLeadId: seller.id,
      brand: 'Adria',
      model: 'Coral',
      year: 2020,
      km: 50_000,
      seats: 4,
      type: 'AUTOCARAVANA',
      status: opts.status ?? 'VENDIDO',
      soldAt: opts.soldAt === undefined ? IN_RANGE : opts.soldAt,
      salePrice: opts.salePrice ?? null,
      purchasePrice: opts.purchasePrice ?? null,
    },
  })
  for (const content of opts.activityContents ?? []) {
    await prisma.activity.create({
      data: { type: 'CAMBIO_ESTADO', content, sellerLeadId: seller.id, agentId },
    })
  }
  cleanups.push(async () => {
    await prisma.activity.deleteMany({ where: { sellerLeadId: seller.id } })
    await prisma.vehicle.deleteMany({ where: { id: vehicle.id } })
    await prisma.sellerLead.deleteMany({ where: { id: seller.id } })
    // Solo borra el agente el seedSale que lo creó (los que lo reutilizan no lo tocan).
    if (ownsAgent) await prisma.user.deleteMany({ where: { id: agentId } })
  })
  return { agentId: agentId! }
}

const filterFor = (agentId: string): DashboardFilter => ({ agentId })

beforeAll(() => {
  prisma = createGuardedTestPrisma()
})
afterEach(async () => {
  for (const c of cleanups.splice(0).reverse()) await c()
})
afterAll(async () => {
  await prisma.$disconnect()
})

describe('fact de venta canónico — getSalesInRange', () => {
  it('cuenta una venta canónica (VENDIDO + soldAt en rango) aunque NO exista Activity', async () => {
    const { agentId } = await seedSale({
      status: 'VENDIDO',
      soldAt: IN_RANGE,
      activityContents: [],
    })
    const n = await getSalesInRange(prisma, filterFor(agentId), RANGE_START, RANGE_END)
    expect(n).toBe(1)
  })

  it('NO cuenta una Activity "→ Vendido" si el vehículo no es VENDIDO', async () => {
    const { agentId } = await seedSale({
      status: 'RESERVADO',
      soldAt: null,
      activityContents: ['Vehículo: Publicado → Vendido'],
    })
    const n = await getSalesInRange(prisma, filterFor(agentId), RANGE_START, RANGE_END)
    expect(n).toBe(0)
  })

  it('el texto de la Activity es irrelevante: variantes/mayúsculas/traducciones no crean ventas', async () => {
    const { agentId } = await seedSale({
      status: 'PUBLICADO',
      soldAt: null,
      activityContents: ['VENDIDO', 'vendido', 'Sold', 'marcado como VENDIDO', '→ Vendido'],
    })
    const n = await getSalesInRange(prisma, filterFor(agentId), RANGE_START, RANGE_END)
    expect(n).toBe(0)
  })

  it('varias Activities sobre el mismo vehículo vendido NO duplican la venta', async () => {
    const { agentId } = await seedSale({
      status: 'VENDIDO',
      soldAt: IN_RANGE,
      activityContents: ['x → Vendido', 'y → Vendido', 'z → Vendido'],
    })
    const n = await getSalesInRange(prisma, filterFor(agentId), RANGE_START, RANGE_END)
    expect(n).toBe(1)
  })

  it('NO cuenta una venta con soldAt fuera del rango', async () => {
    const { agentId } = await seedSale({ status: 'VENDIDO', soldAt: OUT_OF_RANGE })
    const n = await getSalesInRange(prisma, filterFor(agentId), RANGE_START, RANGE_END)
    expect(n).toBe(0)
  })

  it('NO cuenta un vehículo con soldAt en rango pero estado ≠ VENDIDO (anomalía)', async () => {
    const { agentId } = await seedSale({ status: 'RESERVADO', soldAt: IN_RANGE })
    const n = await getSalesInRange(prisma, filterFor(agentId), RANGE_START, RANGE_END)
    expect(n).toBe(0)
  })

  it('NO reconstruye una venta VENDIDO con soldAt null (anomalía, no cae a Activity)', async () => {
    const { agentId } = await seedSale({
      status: 'VENDIDO',
      soldAt: null,
      activityContents: ['algo → Vendido'],
    })
    const n = await getSalesInRange(prisma, filterFor(agentId), RANGE_START, RANGE_END)
    expect(n).toBe(0)
  })

  it('respeta el filtro de agente (no cuenta ventas de otro agente)', async () => {
    const mine = await seedSale({ status: 'VENDIDO', soldAt: IN_RANGE })
    await seedSale({ status: 'VENDIDO', soldAt: IN_RANGE }) // otro agente
    const n = await getSalesInRange(prisma, filterFor(mine.agentId), RANGE_START, RANGE_END)
    expect(n).toBe(1)
  })

  it('INCLUYE una venta con soldAt exactamente en el inicio del rango (gte)', async () => {
    const { agentId } = await seedSale({ status: 'VENDIDO', soldAt: RANGE_START })
    const n = await getSalesInRange(prisma, filterFor(agentId), RANGE_START, RANGE_END)
    expect(n).toBe(1)
  })

  it('EXCLUYE una venta con soldAt exactamente en el fin del rango (lt, intervalo medio-abierto)', async () => {
    const { agentId } = await seedSale({ status: 'VENDIDO', soldAt: RANGE_END })
    const n = await getSalesInRange(prisma, filterFor(agentId), RANGE_START, RANGE_END)
    expect(n).toBe(0)
  })
})

describe('fact de venta canónico — getFlowKpis.sales', () => {
  it('cuenta ventas del periodo desde el hecho canónico, no desde Activity', async () => {
    const { agentId } = await seedSale({
      status: 'VENDIDO',
      soldAt: IN_RANGE,
      activityContents: [], // sin Activity: aun así debe contarse
    })
    const range = resolveRange('mes', new Date('2026-03-20T12:00:00.000Z'))
    const kpis = await getFlowKpis(prisma, filterFor(agentId), range)
    expect(kpis.sales.current).toBe(1)
  })

  it('aísla las ventas por agente (getFlowKpis reimplementa el filtro; no debe filtrar a otro agente)', async () => {
    const { agentId } = await seedSale({ status: 'VENDIDO', soldAt: IN_RANGE })
    await seedSale({ status: 'VENDIDO', soldAt: IN_RANGE }) // otro agente, mismo periodo
    const range = resolveRange('mes', new Date('2026-03-20T12:00:00.000Z'))
    const kpis = await getFlowKpis(prisma, filterFor(agentId), range)
    expect(kpis.sales.current).toBe(1)
  })

  it('cuenta la ventana anterior y la variación (previous + deltaPct) desde el hecho canónico', async () => {
    const { agentId } = await seedSale({ status: 'VENDIDO', soldAt: IN_RANGE })
    // Mismo agente, una venta en la ventana ANTERIOR de resolveRange('mes', 20-mar).
    await seedSale({ agentId, status: 'VENDIDO', soldAt: PREV_IN_RANGE })
    const range = resolveRange('mes', new Date('2026-03-20T12:00:00.000Z'))
    const kpis = await getFlowKpis(prisma, filterFor(agentId), range)
    expect(kpis.sales.current).toBe(1)
    expect(kpis.sales.previous).toBe(1)
    expect(kpis.sales.deltaPct).toBe(0) // 1 vs 1 → 0% (bloquea un swap cur/prev en salesWhere)
  })
})

describe('fact de venta canónico — getMonthlyNetMargin', () => {
  it('calcula el margen desde los vehículos VENDIDO con soldAt en el mes', async () => {
    const { agentId } = await seedSale({
      status: 'VENDIDO',
      soldAt: IN_RANGE,
      salePrice: 30_000,
      purchasePrice: 25_000,
    })
    const result = await getMonthlyNetMargin(
      prisma,
      filterFor(agentId),
      new Date('2026-03-15T12:00:00.000Z')
    )
    expect(result.vehiclesSold).toBe(1)
    expect(result.grossRevenue).toBe(30_000)
    expect(result.netMargin).toBe(30_000 - 25_000)
  })

  it('ignora una Activity "→ Vendido" sin hecho canónico (0 ventas)', async () => {
    const { agentId } = await seedSale({
      status: 'RESERVADO',
      soldAt: null,
      salePrice: 30_000,
      purchasePrice: 25_000,
      activityContents: ['→ Vendido'],
    })
    const result = await getMonthlyNetMargin(
      prisma,
      filterFor(agentId),
      new Date('2026-03-15T12:00:00.000Z')
    )
    expect(result.vehiclesSold).toBe(0)
    expect(result.netMargin).toBe(0)
  })

  it('aísla el margen por agente (no mezcla la venta de otro agente en el mismo mes)', async () => {
    const { agentId } = await seedSale({
      status: 'VENDIDO',
      soldAt: IN_RANGE,
      salePrice: 30_000,
      purchasePrice: 25_000,
    })
    // Otro agente, misma ventana: no debe entrar en el margen filtrado.
    await seedSale({
      status: 'VENDIDO',
      soldAt: IN_RANGE,
      salePrice: 99_000,
      purchasePrice: 10_000,
    })
    const result = await getMonthlyNetMargin(
      prisma,
      filterFor(agentId),
      new Date('2026-03-15T12:00:00.000Z')
    )
    expect(result.vehiclesSold).toBe(1)
    expect(result.grossRevenue).toBe(30_000)
    expect(result.netMargin).toBe(30_000 - 25_000)
  })
})
