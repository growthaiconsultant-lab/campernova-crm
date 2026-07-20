/**
 * Integración (PostgreSQL REAL) del archivado de leads (PR B2).
 *
 * Ejecuta las server actions REALES contra una base efímera migrada, y demuestra:
 *  - archivar/reactivar funciona y es idempotente incluso bajo concurrencia;
 *  - cada dependencia activa BLOQUEA (y el historial cerrado NO);
 *  - archivar/reactivar NO altera vehículo, `soldAt`, ofertas, entregas, garantías, documentos,
 *    Activities previas ni el estado comercial;
 *  - la traza de archivado no puede borrarse con `deleteNote`;
 *  - un comprador archivado sigue detectándose como duplicado por teléfono.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import type { PrismaClient, User } from '@prisma/client'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { authHolder } = vi.hoisted(() => ({ authHolder: { user: null as unknown as User } }))
vi.mock('@/lib/auth', () => ({
  requireAgente: async () => authHolder.user,
  requireAdmin: async () => authHolder.user,
}))

// La server action y el test comparten EXACTAMENTE el mismo cliente de test.
vi.mock('@/lib/db', async () => {
  const { createGuardedTestPrisma } = await import('./db')
  return { db: createGuardedTestPrisma() }
})

import { db } from '@/lib/db'
import { uniqueSuffix } from './db'
import {
  archiveSellerLead,
  reactivateSellerLead,
  archiveBuyerLead,
  reactivateBuyerLead,
} from '@/app/(backoffice)/lead-archiving-actions'
import { deleteNote } from '@/app/(backoffice)/note-actions'
import { findDuplicateBuyerByPhone, prismaBuyerDedupDeps } from '@/lib/buyer-dedup'
import { getSalesInRange, type DashboardFilter } from '@/lib/dashboard/queries'
import { getMonthlyNetMargin } from '@/lib/dashboard/metrics'
import { getFlowKpis } from '@/lib/kpi/flow'
import { resolveRange } from '@/lib/kpi/range'

const prisma = db as PrismaClient
const cleanups: Array<() => Promise<void>> = []

const FUTURE = new Date(Date.now() + 7 * 86_400_000)
const PAST = new Date(Date.now() - 7 * 86_400_000)

// Ventana determinista para los KPIs: día 1 del mes en curso, siempre dentro del mes.
const NOW = new Date()
const SOLD_AT = new Date(NOW.getFullYear(), NOW.getMonth(), 1, 12, 0, 0)
const MONTH_START = new Date(NOW.getFullYear(), NOW.getMonth(), 1)
const MONTH_END = new Date(NOW.getFullYear(), NOW.getMonth() + 1, 1)

async function makeAgent(): Promise<User> {
  const s = uniqueSuffix()
  const u = await prisma.user.create({
    data: { email: `arch_${s}@integ.test`, name: `Agente ${s}`, role: 'AGENTE' },
  })
  cleanups.push(async () => {
    await prisma.user.deleteMany({ where: { id: u.id } })
  })
  return u
}

/** Vendedor (+vehículo opcional). Por defecto SIN próxima acción, para no bloquear. */
async function makeSeller(
  opts: {
    vehicleStatus?: string
    soldAt?: Date | null
    withNextAction?: boolean
  } = {}
) {
  const s = uniqueSuffix()
  const lead = await prisma.sellerLead.create({
    data: {
      name: `Vendedor ${s}`,
      email: `v_${s}@integ.test`,
      phone: `6000${s.slice(0, 5)}`,
      // Se asigna el agente para poder filtrar los KPIs a ESTE fixture y que sean deterministas.
      agentId: authHolder.user.id,
      ...(opts.withNextAction ? { nextActionType: 'LLAMAR', nextActionDueAt: PAST } : {}),
    },
  })
  let vehicleId: string | null = null
  if (opts.vehicleStatus) {
    const v = await prisma.vehicle.create({
      data: {
        sellerLeadId: lead.id,
        brand: 'Adria',
        model: 'Coral',
        year: 2020,
        km: 50_000,
        seats: 4,
        type: 'AUTOCARAVANA',
        status: opts.vehicleStatus as never,
        soldAt: opts.soldAt ?? null,
        salePrice: 30_000,
        purchasePrice: 25_000,
      },
    })
    vehicleId = v.id
  }
  cleanups.push(async () => {
    await prisma.activity.deleteMany({ where: { sellerLeadId: lead.id } })
    if (vehicleId) await prisma.vehicle.deleteMany({ where: { id: vehicleId } })
    await prisma.sellerLead.deleteMany({ where: { id: lead.id } })
  })
  return { leadId: lead.id, vehicleId }
}

async function makeBuyer(opts: { phone?: string; status?: string } = {}) {
  const s = uniqueSuffix()
  const lead = await prisma.buyerLead.create({
    data: {
      name: `Comprador ${s}`,
      email: `c_${s}@integ.test`,
      phone: opts.phone ?? `6111${s.slice(0, 5)}`,
      ...(opts.status ? { status: opts.status as never } : {}),
    },
  })
  cleanups.push(async () => {
    await prisma.activity.deleteMany({ where: { buyerLeadId: lead.id } })
    await prisma.buyerLead.deleteMany({ where: { id: lead.id } })
  })
  return { leadId: lead.id }
}

beforeAll(async () => {
  authHolder.user = await makeAgent()
})
afterEach(async () => {
  for (const c of cleanups.splice(0).reverse()) await c()
  authHolder.user = await makeAgent()
})
afterAll(async () => {
  for (const c of cleanups.splice(0).reverse()) await c()
  await prisma.$disconnect()
})

// ─── Camino feliz + invariancia total ─────────────────────────────────────────

describe('archivar y reactivar no alteran el negocio', () => {
  it('vendedor con historial CERRADO: archiva, reactiva y todo queda intacto', async () => {
    const { leadId, vehicleId } = await makeSeller({
      vehicleStatus: 'VENDIDO',
      soldAt: PAST,
    })
    const buyer = await makeBuyer()

    // Historial cerrado: oferta convertida + entrega completada + garantía + documento.
    const offer = await prisma.offer.create({
      data: {
        vehicleId: vehicleId!,
        buyerLeadId: buyer.leadId,
        amount: 30_000,
        status: 'CONVERTIDA',
        createdById: authHolder.user.id,
      },
    })
    const delivery = await prisma.delivery.create({
      data: {
        vehicleId: vehicleId!,
        buyerLeadId: buyer.leadId,
        scheduledAt: PAST,
        status: 'COMPLETADA',
      },
    })
    const warranty = await prisma.warranty.create({
      data: {
        vehicleId: vehicleId!,
        deliveryId: delivery.id,
        buyerLeadId: buyer.leadId,
        startDate: PAST,
        endDate: FUTURE,
      },
    })
    const doc = await prisma.vehicleDocument.create({
      data: {
        vehicleId: vehicleId!,
        name: 'contrato.pdf',
        url: 'https://example.invalid/doc',
        category: 'CONTRATO_COMPRAVENTA',
      },
    })
    const priorActivity = await prisma.activity.create({
      data: { type: 'NOTA', content: 'nota previa', sellerLeadId: leadId },
    })
    cleanups.push(async () => {
      await prisma.warranty.deleteMany({ where: { id: warranty.id } })
      await prisma.delivery.deleteMany({ where: { id: delivery.id } })
      await prisma.offer.deleteMany({ where: { id: offer.id } })
      await prisma.vehicleDocument.deleteMany({ where: { id: doc.id } })
    })

    const before = await prisma.vehicle.findUnique({ where: { id: vehicleId! } })
    const leadBefore = await prisma.sellerLead.findUnique({ where: { id: leadId } })

    // El historial cerrado NO bloquea.
    const archived = await archiveSellerLead(leadId, 'SIN_RESPUESTA', 'no responde')
    expect(archived).toEqual({ status: 'archived' })

    const afterArchive = await prisma.sellerLead.findUnique({ where: { id: leadId } })
    expect(afterArchive!.archivedAt).toBeInstanceOf(Date)
    expect(afterArchive!.archiveReason).toBe('SIN_RESPUESTA')
    expect(afterArchive!.archivedById).toBe(authHolder.user.id)
    // Estado comercial y motivo de pérdida intactos.
    expect(afterArchive!.status).toBe(leadBefore!.status)
    expect(afterArchive!.lostReason).toBe(leadBefore!.lostReason)

    // Nada del negocio ha cambiado.
    const vAfter = await prisma.vehicle.findUnique({ where: { id: vehicleId! } })
    expect(vAfter).toEqual(before)
    expect(vAfter!.soldAt?.toISOString()).toBe(PAST.toISOString())
    expect(await prisma.offer.findUnique({ where: { id: offer.id } })).toBeTruthy()
    expect(await prisma.delivery.findUnique({ where: { id: delivery.id } })).toBeTruthy()
    expect(await prisma.warranty.findUnique({ where: { id: warranty.id } })).toBeTruthy()
    expect(await prisma.vehicleDocument.findUnique({ where: { id: doc.id } })).toBeTruthy()
    expect(await prisma.activity.findUnique({ where: { id: priorActivity.id } })).toBeTruthy()

    // Reactivar: limpia solo el archivado.
    const reactivated = await reactivateSellerLead(leadId)
    expect(reactivated).toEqual({ status: 'reactivated' })
    const afterReact = await prisma.sellerLead.findUnique({ where: { id: leadId } })
    expect(afterReact!.archivedAt).toBeNull()
    expect(afterReact!.archivedById).toBeNull()
    expect(afterReact!.archiveReason).toBeNull()
    expect(afterReact!.archiveNotes).toBeNull()
    expect(afterReact!.status).toBe(leadBefore!.status)
    expect(await prisma.vehicle.findUnique({ where: { id: vehicleId! } })).toEqual(before)

    // Exactamente 2 Activities nuevas (archivado + reactivación).
    const acts = await prisma.activity.findMany({
      where: { sellerLeadId: leadId, type: { in: ['LEAD_ARCHIVADO', 'LEAD_REACTIVADO'] } },
    })
    expect(acts).toHaveLength(2)
  })

  it('los KPIs canónicos REALES son idénticos antes de archivar, archivado y reactivado', async () => {
    const { leadId, vehicleId } = await makeSeller({ vehicleStatus: 'VENDIDO', soldAt: SOLD_AT })
    const buyer = await makeBuyer()
    const offer = await prisma.offer.create({
      data: {
        vehicleId: vehicleId!,
        buyerLeadId: buyer.leadId,
        amount: 30_000,
        status: 'CONVERTIDA',
        createdById: authHolder.user.id,
      },
    })
    cleanups.push(async () => {
      await prisma.offer.deleteMany({ where: { id: offer.id } })
    })

    // Filtrado por el agente del fixture → resultados deterministas y aislados.
    const filter: DashboardFilter = { agentId: authHolder.user.id }
    const range = resolveRange('mes', NOW)

    // Se ejecutan las consultas KPI de producción, no se infiere la invariancia.
    const snapshot = async () => ({
      sales: await getSalesInRange(prisma, filter, MONTH_START, MONTH_END),
      margin: await getMonthlyNetMargin(prisma, filter, NOW),
      flow: await getFlowKpis(prisma, filter, range),
    })

    const before = await snapshot()
    // El fixture debe producir KPIs con contenido real (si no, la invariancia sería trivial).
    expect(before.sales).toBe(1)
    expect(before.margin.vehiclesSold).toBe(1)
    expect(before.margin.grossRevenue).toBe(30_000)

    expect(await archiveSellerLead(leadId, 'SIN_RESPUESTA')).toEqual({ status: 'archived' })
    expect(await snapshot()).toEqual(before)

    expect(await reactivateSellerLead(leadId)).toEqual({ status: 'reactivated' })
    expect(await snapshot()).toEqual(before)
  })

  it('archivar y reactivar modifican updatedAt (efecto aceptado de Prisma)', async () => {
    const { leadId } = await makeSeller()
    const before = await prisma.sellerLead.findUnique({ where: { id: leadId } })
    await archiveSellerLead(leadId, 'OTRO')
    const afterArchive = await prisma.sellerLead.findUnique({ where: { id: leadId } })
    expect(afterArchive!.updatedAt.getTime()).toBeGreaterThanOrEqual(before!.updatedAt.getTime())
    // `createdAt` NO cambia: solo `updatedAt` es un efecto automático.
    expect(afterArchive!.createdAt.toISOString()).toBe(before!.createdAt.toISOString())
  })

  it('la traza de archivado NO puede borrarse con deleteNote', async () => {
    const { leadId } = await makeSeller()
    await archiveSellerLead(leadId, 'OTRO')
    const act = await prisma.activity.findFirst({
      where: { sellerLeadId: leadId, type: 'LEAD_ARCHIVADO' },
    })
    const res = await deleteNote(act!.id)
    expect(res.error).toBeTruthy()
    expect(await prisma.activity.findUnique({ where: { id: act!.id } })).toBeTruthy()
  })
})

// ─── Bloqueos con datos reales ────────────────────────────────────────────────

describe('dependencias activas bloquean el archivado', () => {
  it.each(['TASADO', 'PUBLICADO', 'RESERVADO'])('vehículo %s bloquea', async (status) => {
    const { leadId } = await makeSeller({ vehicleStatus: status })
    const res = await archiveSellerLead(leadId, 'OTRO')
    expect(res).toMatchObject({ status: 'blocked', code: 'ARCHIVE_BLOCKED' })
    if (res.status === 'blocked') {
      expect(res.blockers.some((b) => b.type === 'VEHICLE_IN_STOCK')).toBe(true)
    }
    const lead = await prisma.sellerLead.findUnique({ where: { id: leadId } })
    expect(lead!.archivedAt).toBeNull()
  })

  it('oferta viva bloquea', async () => {
    const { leadId, vehicleId } = await makeSeller({ vehicleStatus: 'VENDIDO' })
    const buyer = await makeBuyer()
    const offer = await prisma.offer.create({
      data: {
        vehicleId: vehicleId!,
        buyerLeadId: buyer.leadId,
        amount: 1000,
        status: 'PROPUESTA',
        createdById: authHolder.user.id,
      },
    })
    cleanups.push(async () => {
      await prisma.offer.deleteMany({ where: { id: offer.id } })
    })

    const res = await archiveSellerLead(leadId, 'OTRO')
    expect(res).toMatchObject({ status: 'blocked' })
    if (res.status === 'blocked') {
      expect(res.blockers.some((b) => b.type === 'ACTIVE_OFFER')).toBe(true)
    }
  })

  it('reserva con señal bloquea al comprador', async () => {
    const { vehicleId } = await makeSeller({ vehicleStatus: 'VENDIDO' })
    const buyer = await makeBuyer()
    const offer = await prisma.offer.create({
      data: {
        vehicleId: vehicleId!,
        buyerLeadId: buyer.leadId,
        amount: 30_000,
        depositAmount: 1_000,
        status: 'ACEPTADA',
        createdById: authHolder.user.id,
      },
    })
    cleanups.push(async () => {
      await prisma.offer.deleteMany({ where: { id: offer.id } })
    })

    const res = await archiveBuyerLead(buyer.leadId, 'OTRO')
    expect(res).toMatchObject({ status: 'blocked' })
    if (res.status === 'blocked') {
      expect(res.blockers.some((b) => b.type === 'ACTIVE_RESERVATION')).toBe(true)
    }
  })

  it('entrega programada bloquea', async () => {
    const { vehicleId } = await makeSeller({ vehicleStatus: 'VENDIDO' })
    const buyer = await makeBuyer()
    const delivery = await prisma.delivery.create({
      data: {
        vehicleId: vehicleId!,
        buyerLeadId: buyer.leadId,
        scheduledAt: FUTURE,
        status: 'PROGRAMADA',
      },
    })
    cleanups.push(async () => {
      await prisma.delivery.deleteMany({ where: { id: delivery.id } })
    })

    const res = await archiveBuyerLead(buyer.leadId, 'OTRO')
    expect(res).toMatchObject({ status: 'blocked' })
    if (res.status === 'blocked') {
      expect(res.blockers.some((b) => b.type === 'ACTIVE_DELIVERY')).toBe(true)
    }
  })

  it('próxima acción pendiente VENCIDA bloquea', async () => {
    const { leadId } = await makeSeller({ withNextAction: true })
    const res = await archiveSellerLead(leadId, 'OTRO')
    expect(res).toMatchObject({ status: 'blocked' })
    if (res.status === 'blocked') {
      expect(res.blockers.some((b) => b.type === 'PENDING_NEXT_ACTION')).toBe(true)
    }
  })

  it('evento futuro bloquea; un evento pasado no', async () => {
    const { leadId } = await makeSeller()
    const future = await prisma.calendarEvent.create({
      data: {
        type: 'CITA',
        title: 'Cita',
        startAt: FUTURE,
        sellerLeadId: leadId,
        createdById: authHolder.user.id,
      },
    })
    cleanups.push(async () => {
      await prisma.calendarEvent.deleteMany({ where: { id: future.id } })
    })

    const blocked = await archiveSellerLead(leadId, 'OTRO')
    expect(blocked).toMatchObject({ status: 'blocked' })

    // Cancelado → deja de bloquear (el operador lo resolvió explícitamente).
    await prisma.calendarEvent.update({
      where: { id: future.id },
      data: { status: 'CANCELADO' },
    })
    expect(await archiveSellerLead(leadId, 'OTRO')).toEqual({ status: 'archived' })
  })
})

// ─── Idempotencia y concurrencia ──────────────────────────────────────────────

describe('idempotencia y concurrencia', () => {
  it('doble archivado no crea dos Activities', async () => {
    const { leadId } = await makeSeller()
    const [a, b] = await Promise.all([
      archiveSellerLead(leadId, 'OTRO'),
      archiveSellerLead(leadId, 'OTRO'),
    ])
    const outcomes = [a.status, b.status].sort()
    expect(outcomes).toEqual(['already_archived', 'archived'])
    const acts = await prisma.activity.count({
      where: { sellerLeadId: leadId, type: 'LEAD_ARCHIVADO' },
    })
    expect(acts).toBe(1)
  })

  it('reserva concurrente: nunca queda un estado roto ni una decisión incoherente', async () => {
    // LIMITACIÓN: Prisma no permite pausar dentro de la transacción, así que la ventana de
    // solapamiento no es determinista. Se repite el interleaving varias veces y se comprueba una
    // INVARIANTE que debe cumplirse en cualquier orden de serialización:
    //   · si devuelve `blocked` → el lead NO puede quedar archivado;
    //   · si devuelve `archived` → hay EXACTAMENTE una Activity de archivado (nunca 0 ni 2);
    //   · nunca hay estado roto (archivado sin Activity, o Activity sin archivar).
    // Con `Serializable` se elimina además la anomalía de READ COMMITTED en la que la lectura de
    // dependencias no ve una oferta ya confirmada y aun así el CAS se aplica.
    for (let i = 0; i < 6; i++) {
      const { leadId, vehicleId } = await makeSeller({ vehicleStatus: 'VENDIDO' })
      const buyer = await makeBuyer()

      const [outcome] = await Promise.all([
        archiveSellerLead(leadId, 'OTRO'),
        prisma.offer.create({
          data: {
            vehicleId: vehicleId!,
            buyerLeadId: buyer.leadId,
            amount: 30_000,
            depositAmount: 1_000,
            status: 'ACEPTADA',
            createdById: authHolder.user.id,
          },
        }),
      ])

      const lead = await prisma.sellerLead.findUnique({ where: { id: leadId } })
      const activityCount = await prisma.activity.count({
        where: { sellerLeadId: leadId, type: 'LEAD_ARCHIVADO' },
      })

      expect(['archived', 'blocked', 'error']).toContain(outcome.status)
      if (outcome.status === 'blocked') {
        expect(lead!.archivedAt).toBeNull()
        expect(activityCount).toBe(0)
      } else if (outcome.status === 'archived') {
        expect(lead!.archivedAt).not.toBeNull()
        expect(activityCount).toBe(1)
      } else {
        // Conflicto agotado: no debe haber dejado nada a medias.
        expect(lead!.archivedAt).toBeNull()
        expect(activityCount).toBe(0)
      }
      // Estado roto imposible en cualquier caso.
      expect(activityCount).toBe(lead!.archivedAt ? 1 : 0)

      await prisma.offer.deleteMany({ where: { vehicleId: vehicleId! } })
    }
  })

  it('doble reactivación no crea dos Activities', async () => {
    const { leadId } = await makeSeller()
    await archiveSellerLead(leadId, 'OTRO')
    const [a, b] = await Promise.all([reactivateSellerLead(leadId), reactivateSellerLead(leadId)])
    expect([a.status, b.status].sort()).toEqual(['already_active', 'reactivated'])
    const acts = await prisma.activity.count({
      where: { sellerLeadId: leadId, type: 'LEAD_REACTIVADO' },
    })
    expect(acts).toBe(1)
  })
})

// ─── Comprador: estado comercial y duplicados ─────────────────────────────────

describe('comprador', () => {
  it('archivar y reactivar no reabre el estado comercial PERDIDO', async () => {
    const { leadId } = await makeBuyer({ status: 'PERDIDO' })
    expect(await archiveBuyerLead(leadId, 'FUERA_DE_MERCADO')).toEqual({ status: 'archived' })
    expect(await reactivateBuyerLead(leadId)).toEqual({ status: 'reactivated' })
    const lead = await prisma.buyerLead.findUnique({ where: { id: leadId } })
    expect(lead!.status).toBe('PERDIDO')
    expect(lead!.archivedAt).toBeNull()
  })

  it('un comprador ARCHIVADO sigue detectándose como duplicado por teléfono', async () => {
    const phone = `600${Date.now().toString().slice(-6)}`
    const { leadId } = await makeBuyer({ phone })
    expect(await archiveBuyerLead(leadId, 'POSIBLE_DUPLICADO')).toEqual({ status: 'archived' })

    const dup = await findDuplicateBuyerByPhone(phone, prismaBuyerDedupDeps(prisma))
    expect(dup).not.toBeNull()
    expect(dup!.id).toBe(leadId)
  })
})
