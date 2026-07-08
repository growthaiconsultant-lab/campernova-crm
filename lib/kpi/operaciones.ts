import type { PrismaClient, WorkOrderStatus } from '@prisma/client'
import type { DashboardFilter } from '@/lib/dashboard/queries'
import {
  calculateCompletionPercent,
  listMissingRequirements,
  PUBLICADO_REQUIRED_DOCS,
  type VehicleLegalInput,
  type DocumentSummary,
  type MissingRequirement,
} from '@/lib/vehicle-legal'

/**
 * Bloque F2 KPIs — Dashboard Operaciones + Trust. Controla todo lo que impide
 * publicar/reservar/vender/entregar: stock por estado, vehículos bloqueados por
 * motivo, aging de stock, Trust Passport pendiente y entregas próximas. Lectura.
 */

const BLOCKING_WORKORDER: WorkOrderStatus[] = [
  'PENDIENTE',
  'EN_DIAGNOSTICO',
  'PRESUPUESTADA',
  'EN_CURSO',
]

/** Agrupa un `field` de requisito en un motivo de bloqueo legible. */
function reasonForField(field: string): string {
  if (field === 'plate' || field === 'vin') return 'Datos identificativos'
  if (field === 'desiredPrice' || field === 'purchasePrice' || field === 'salePrice')
    return 'Precio'
  if (field === 'itvValidUntil') return 'ITV'
  if (field === 'chargeCheckedAt') return 'Cargas DGT'
  if (field.startsWith('doc_')) return 'Documentación'
  if (field === 'photos') return 'Fotos'
  if (field === 'workOrders') return 'Taller'
  return 'Otro'
}

export type BucketRow = { label: string; count: number }
export type OpRow = { id: string; href: string; name: string; detail: string }

export type OperacionesKpis = {
  vehicleByStatus: BucketRow[]
  stockActive: number
  blockedCount: number
  agingOver45: number
  trustPending: number
  upcomingDeliveries: number
  agingBuckets: BucketRow[]
  blockedByReason: BucketRow[]
  blockedRows: OpRow[]
  trustPendingRows: OpRow[]
  deliveryRows: OpRow[]
}

const STATUS_LABELS: Record<string, string> = {
  NUEVO: 'Nuevo',
  TASADO: 'Tasado',
  PUBLICADO: 'Publicado',
  RESERVADO: 'Reservado',
  VENDIDO: 'Vendido',
  DESCARTADO: 'Descartado',
}

export async function getOperacionesKpis(
  db: PrismaClient,
  filter: DashboardFilter
): Promise<OperacionesKpis> {
  const vehWhere = filter.agentId ? { sellerLead: { agentId: filter.agentId } } : {}
  const now = new Date()

  const [statusGroups, prepVehicles, deliveries] = await Promise.all([
    db.vehicle.groupBy({ by: ['status'], _count: { _all: true }, where: vehWhere }),
    // Vehículos en preparación/venta: se evalúa su expediente para detectar bloqueos
    db.vehicle.findMany({
      where: { ...vehWhere, status: { in: ['TASADO', 'PUBLICADO'] } },
      select: {
        id: true,
        brand: true,
        model: true,
        year: true,
        status: true,
        plate: true,
        vin: true,
        itvValidUntil: true,
        chargeCheckedAt: true,
        desiredPrice: true,
        purchasePrice: true,
        salePrice: true,
        publishedAt: true,
        createdAt: true,
        trustVerifiedAt: true,
        sellerLead: { select: { id: true } },
        photos: { select: { id: true } },
        documents: { select: { category: true } },
        workOrders: { where: { status: { in: BLOCKING_WORKORDER } }, select: { id: true } },
      },
    }),
    db.delivery.findMany({
      where: {
        status: { in: ['PROGRAMADA', 'EN_CURSO'] },
        ...(filter.agentId ? { vehicle: { sellerLead: { agentId: filter.agentId } } } : {}),
      },
      select: {
        id: true,
        scheduledAt: true,
        vehicle: { select: { brand: true, model: true, sellerLead: { select: { id: true } } } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 10,
    }),
  ])

  const vehicleByStatus: BucketRow[] = statusGroups
    .map((g) => ({
      label: STATUS_LABELS[g.status] ?? g.status,
      count: g._count._all,
      status: g.status,
    }))
    .filter((r) => r.status !== 'DESCARTADO')
    .map(({ label, count }) => ({ label, count }))
  const stockActive = statusGroups
    .filter((g) => ['NUEVO', 'TASADO', 'PUBLICADO', 'RESERVADO'].includes(g.status))
    .reduce((s, g) => s + g._count._all, 0)

  // Análisis de bloqueos + trust + aging
  const reasonCounts = new Map<string, number>()
  const blockedRows: OpRow[] = []
  const trustPendingRows: OpRow[] = []
  const agingBucketMap = { '0-15': 0, '16-30': 0, '31-45': 0, '45+': 0 }
  let agingOver45 = 0
  let blockedTotal = 0

  for (const v of prepVehicles) {
    const legalInput: VehicleLegalInput = {
      id: v.id,
      plate: v.plate,
      vin: v.vin,
      itvValidUntil: v.itvValidUntil,
      chargeCheckedAt: v.chargeCheckedAt,
      desiredPrice: v.desiredPrice,
      purchasePrice: v.purchasePrice,
      salePrice: v.salePrice,
      photoCount: v.photos.length,
      workOrdersBlockingCount: v.workOrders.length,
    }
    const docSummary: DocumentSummary[] = PUBLICADO_REQUIRED_DOCS.map((category) => ({
      category,
      exists: v.documents.some((d) => d.category === category),
    }))
    const pct = calculateCompletionPercent(legalInput, docSummary)
    const target = v.status === 'PUBLICADO' ? 'PUBLICADO' : 'TASADO'
    const missing: MissingRequirement[] = listMissingRequirements(
      legalInput,
      target,
      docSummary,
      now
    )
    const errors = missing.filter((m) => m.severity === 'error')

    if (pct < 100 && errors.length > 0) {
      blockedTotal++
      const reason = reasonForField(errors[0].field)
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1)
      if (blockedRows.length < 10) {
        blockedRows.push({
          id: v.id,
          href: v.sellerLead ? `/vendedores/${v.sellerLead.id}` : '#',
          name: `${v.brand} ${v.model} ${v.year}`,
          detail: `${reason} · ${pct}% listo`,
        })
      }
    }

    // Trust pendiente: publicado/tasado sin sello
    if (!v.trustVerifiedAt && trustPendingRows.length < 10) {
      trustPendingRows.push({
        id: v.id,
        href: v.sellerLead ? `/vendedores/${v.sellerLead.id}?tab=preparacion` : '#',
        name: `${v.brand} ${v.model} ${v.year}`,
        detail: STATUS_LABELS[v.status] ?? v.status,
      })
    }

    // Aging (solo publicados)
    if (v.status === 'PUBLICADO') {
      const ref = v.publishedAt ?? v.createdAt
      const days = Math.floor((now.getTime() - ref.getTime()) / 86_400_000)
      if (days <= 15) agingBucketMap['0-15']++
      else if (days <= 30) agingBucketMap['16-30']++
      else if (days <= 45) agingBucketMap['31-45']++
      else {
        agingBucketMap['45+']++
        agingOver45++
      }
    }
  }

  const trustPending = prepVehicles.filter((v) => !v.trustVerifiedAt).length

  return {
    vehicleByStatus,
    stockActive,
    blockedCount: blockedTotal,
    agingOver45,
    trustPending,
    upcomingDeliveries: deliveries.length,
    agingBuckets: Object.entries(agingBucketMap).map(([label, count]) => ({ label, count })),
    blockedByReason: Array.from(reasonCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    blockedRows,
    trustPendingRows,
    deliveryRows: deliveries.map((d) => ({
      id: d.id,
      href: d.vehicle.sellerLead ? `/entregas/${d.id}` : `/entregas/${d.id}`,
      name: `${d.vehicle.brand} ${d.vehicle.model}`,
      detail: d.scheduledAt
        ? d.scheduledAt.toLocaleString('es-ES', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Madrid',
          })
        : 'Sin fecha',
    })),
  }
}
