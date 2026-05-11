import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  SELLER_LEAD_STATUS_LABELS,
  SELLER_LEAD_STATUS_CLASSES,
  BUYER_LEAD_STATUS_LABELS,
  BUYER_LEAD_STATUS_CLASSES,
  VEHICLE_STATUS_LABELS,
  VEHICLE_STATUS_CLASSES,
} from '@/lib/state-machine'
import {
  getSellerLeadCounts,
  getBuyerLeadCounts,
  getVehicleCounts,
  getSalesMonthOverMonth,
  getProFunnel,
  type DashboardFilter,
} from '@/lib/dashboard/queries'
import {
  aggregateMediansByState,
  formatDuration,
  type EntityActivities,
  type StateMedianRow,
} from '@/lib/dashboard/time-in-state'
import { DashboardFilters } from './dashboard-filters'
import { ForbiddenToast } from '@/components/forbidden-toast'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  FileWarning,
  ShieldAlert,
} from 'lucide-react'
import type { SellerLeadStatus, BuyerLeadStatus, VehicleStatus } from '@prisma/client'
import { calculateCompletionPercent } from '@/lib/vehicle-legal'
import type { VehicleLegalInput, DocumentSummary } from '@/lib/vehicle-legal'
import type { VehicleDocumentCategory } from '@prisma/client'
import Link from 'next/link'

const ACTIVE_SELLER_STATUSES: SellerLeadStatus[] = [
  'NUEVO',
  'CONTACTADO',
  'CUALIFICADO',
  'EN_NEGOCIACION',
]
const ACTIVE_BUYER_STATUSES: BuyerLeadStatus[] = [
  'NUEVO',
  'CONTACTADO',
  'CUALIFICADO',
  'EN_NEGOCIACION',
]

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { agent?: string }
}) {
  const currentUser = await requireAuth()

  // Si el usuario no es admin, forzamos el filtro a su propio agentId.
  const isAdmin = currentUser.role === 'ADMIN'
  const requestedAgentId = searchParams.agent ?? null
  const effectiveAgentId = isAdmin ? requestedAgentId : currentUser.id
  const filter: DashboardFilter = { agentId: effectiveAgentId }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [
    sellerCounts,
    buyerCounts,
    vehicleCounts,
    salesMoM,
    proFunnel,
    agents,
    sellerStateMedians,
    buyerStateMedians,
    vehicleStateMedians,
    workshopCostsLast30,
    vehiclesWithMargin,
    topRentabilidad,
    activeWarranties,
    openTickets,
    pendingFollowups,
    vehiclesTasadosRaw,
    vehiclesItvExpiring,
    vehiclesChargesPending,
  ] = await Promise.all([
    getSellerLeadCounts(db, filter),
    getBuyerLeadCounts(db, filter),
    getVehicleCounts(db, filter),
    getSalesMonthOverMonth(db, filter),
    getProFunnel(db, filter),
    isAdmin
      ? db.user.findMany({
          where: { active: true },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
    fetchSellerStateMedians(filter),
    fetchBuyerStateMedians(filter),
    fetchVehicleStateMedians(filter),
    // Coste taller total último mes — solo costes procedentes de órdenes de taller
    db.vehicleCost.aggregate({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        workOrderId: { not: null },
        ...(filter.agentId ? { vehicle: { sellerLead: { agentId: filter.agentId } } } : {}),
      },
      _sum: { amount: true },
    }),
    // Vehículos con precios — calcularemos el margen
    db.vehicle.findMany({
      where: {
        purchasePrice: { not: null },
        salePrice: { not: null },
        ...(filter.agentId ? { sellerLead: { agentId: filter.agentId } } : {}),
      },
      select: {
        id: true,
        brand: true,
        model: true,
        year: true,
        purchasePrice: true,
        salePrice: true,
        marginPercent: true,
        costs: { select: { amount: true } },
        sellerLead: { select: { id: true } },
      },
    }),
    // Top 5 rentabilidad — solo admin
    isAdmin
      ? db.vehicle.findMany({
          where: {
            purchasePrice: { not: null },
            salePrice: { not: null },
          },
          select: {
            id: true,
            brand: true,
            model: true,
            year: true,
            purchasePrice: true,
            salePrice: true,
            marginPercent: true,
            costs: { select: { amount: true } },
            sellerLead: { select: { id: true } },
          },
        })
      : Promise.resolve([]),
    // Garantías activas (endDate > now)
    db.warranty.count({ where: { endDate: { gt: new Date() } } }),
    // Tickets de postventa abiertos
    db.postventaTicket.count({ where: { status: { in: ['ABIERTO', 'EN_PROGRESO'] } } }),
    // Follow-ups pendientes de envío
    db.postventaFollowup.count({ where: { status: 'PENDIENTE' } }),
    // Expedientes incompletos: vehículos TASADOS con documentos obligatorios faltantes o campos vacíos
    isAdmin || currentUser.role === 'AGENTE'
      ? db.vehicle.findMany({
          where: {
            status: 'TASADO',
            ...(filter.agentId ? { sellerLead: { agentId: filter.agentId } } : {}),
          },
          select: {
            id: true,
            brand: true,
            model: true,
            year: true,
            plate: true,
            vin: true,
            itvValidUntil: true,
            chargeCheckedAt: true,
            purchasePrice: true,
            salePrice: true,
            desiredPrice: true,
            photos: { select: { id: true } },
            documents: { select: { category: true } },
            workOrders: {
              where: {
                status: { in: ['PENDIENTE', 'EN_DIAGNOSTICO', 'PRESUPUESTADA', 'EN_CURSO'] },
              },
              select: { id: true },
            },
            sellerLead: { select: { id: true } },
          },
        })
      : Promise.resolve([]),
    // ITV próxima a vencer (< 60 días) en vehículos PUBLICADOS
    isAdmin || currentUser.role === 'AGENTE'
      ? db.vehicle.findMany({
          where: {
            status: 'PUBLICADO',
            itvValidUntil: {
              lt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            },
            ...(filter.agentId ? { sellerLead: { agentId: filter.agentId } } : {}),
          },
          select: {
            id: true,
            brand: true,
            model: true,
            year: true,
            itvValidUntil: true,
            sellerLead: { select: { id: true } },
          },
          orderBy: { itvValidUntil: 'asc' },
          take: 10,
        })
      : Promise.resolve([]),
    // Cargas DGT pendientes: vehículos con purchasePrice pero sin chargeCheckedAt, creados hace >72h
    isAdmin || currentUser.role === 'AGENTE'
      ? db.vehicle.findMany({
          where: {
            purchasePrice: { not: null },
            chargeCheckedAt: null,
            status: { notIn: ['VENDIDO', 'DESCARTADO'] },
            createdAt: { lt: new Date(Date.now() - 72 * 60 * 60 * 1000) },
            ...(filter.agentId ? { sellerLead: { agentId: filter.agentId } } : {}),
          },
          select: {
            id: true,
            brand: true,
            model: true,
            year: true,
            createdAt: true,
            sellerLead: { select: { id: true } },
          },
          orderBy: { createdAt: 'asc' },
          take: 10,
        })
      : Promise.resolve([]),
  ])

  const totalSellerActive = sumWhere(sellerCounts, ACTIVE_SELLER_STATUSES)
  const totalBuyerActive = sumWhere(buyerCounts, ACTIVE_BUYER_STATUSES)
  const totalPublicados = sumWhere(vehicleCounts, ['PUBLICADO'])

  const workshopTotal = Number(workshopCostsLast30._sum.amount ?? 0)

  // Compute net margin per vehicle
  type VehicleMarginRow = {
    id: string
    brand: string
    model: string
    year: number | null
    netMargin: number
    netMarginPct: number
    sellerLeadId: string | null
  }
  function computeMargins(vehicles: typeof vehiclesWithMargin): {
    belowTarget: number
    rows: VehicleMarginRow[]
  } {
    let belowTarget = 0
    const rows: VehicleMarginRow[] = []
    for (const v of vehicles) {
      const purchase = Number(v.purchasePrice)
      const sale = Number(v.salePrice)
      const totalCosts = v.costs.reduce((s, c) => s + Number(c.amount), 0)
      const gross = sale - purchase
      const net = gross - totalCosts
      const pct = sale > 0 ? (net / sale) * 100 : 0
      const target = Number(v.marginPercent)
      if (pct < target) belowTarget++
      rows.push({
        id: v.id,
        brand: v.brand,
        model: v.model,
        year: v.year,
        netMargin: net,
        netMarginPct: pct,
        sellerLeadId: v.sellerLead?.id ?? null,
      })
    }
    return { belowTarget, rows }
  }

  const { belowTarget, rows: marginRows } = computeMargins(vehiclesWithMargin)

  const avgMargin30 = (() => {
    if (marginRows.length === 0) return null
    const sum = marginRows.reduce((s, r) => s + r.netMarginPct, 0)
    return sum / marginRows.length
  })()

  const top5Rentabilidad = isAdmin
    ? computeMargins(topRentabilidad)
        .rows.sort((a, b) => b.netMarginPct - a.netMarginPct)
        .slice(0, 5)
    : []

  // ── Legal alerts ──────────────────────────────────────────────────────────
  const ALL_DOC_CATS: VehicleDocumentCategory[] = [
    'DNI_VENDEDOR',
    'CONTRATO_COMPRAVENTA',
    'FICHA_TECNICA',
    'PERMISO_CIRCULACION',
    'ITV_VIGENTE',
    'JUSTIFICANTE_PAGO',
    'INFORME_CARGAS_DGT',
    'LIBRO_MANTENIMIENTO',
    'FACTURA_COMPRA_ORIGINAL',
    'CONTRATO_FINAL_VENTA',
    'OTRO',
  ]

  const incompleteExpedientes = (vehiclesTasadosRaw as typeof vehiclesTasadosRaw)
    .map((v) => {
      const legalInput: VehicleLegalInput = {
        id: v.id,
        plate: v.plate ?? null,
        vin: v.vin ?? null,
        itvValidUntil: v.itvValidUntil ?? null,
        chargeCheckedAt: v.chargeCheckedAt ?? null,
        desiredPrice: v.desiredPrice,
        purchasePrice: v.purchasePrice,
        salePrice: v.salePrice,
        photoCount: v.photos.length,
        workOrdersBlockingCount: v.workOrders.length,
      }
      const docSummary: DocumentSummary[] = ALL_DOC_CATS.map((cat) => ({
        category: cat,
        exists: v.documents.some((d) => d.category === cat),
      }))
      const pct = calculateCompletionPercent(legalInput, docSummary)
      return { ...v, completionPct: pct, sellerLeadId: v.sellerLead?.id ?? null }
    })
    .filter((v) => v.completionPct < 100)
    .slice(0, 5)

  const now = new Date()

  return (
    <div className="space-y-6">
      <ForbiddenToast />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Resumen del pipeline · {new Date().toLocaleDateString('es-ES')}
          </p>
        </div>
        {isAdmin && <DashboardFilters agents={agents} currentAgentId={requestedAgentId} />}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPICard
          label="Vendedores activos"
          value={totalSellerActive}
          hint="excluye cerrados/descartados"
        />
        <KPICard
          label="Compradores activos"
          value={totalBuyerActive}
          hint="excluye cerrados/perdidos"
        />
        <KPICard label="Vehículos publicados" value={totalPublicados} hint="ahora mismo" />
        <SalesKPI
          current={salesMoM.current}
          previous={salesMoM.previous}
          delta={salesMoM.delta}
          pctChange={salesMoM.pctChange}
        />
      </div>

      {/* KPIs Postventa */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Garantías activas
            </p>
            <p className="mt-1 text-3xl font-bold">{activeWarranties}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">no expiradas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tickets abiertos
            </p>
            <p className={`mt-1 text-3xl font-bold ${openTickets > 0 ? 'text-amber-600' : ''}`}>
              {openTickets}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">abiertos o en progreso</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Follow-ups pendientes
            </p>
            <p className={`mt-1 text-3xl font-bold ${pendingFollowups > 0 ? 'text-blue-600' : ''}`}>
              {pendingFollowups}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">día 7 y día 30 sin enviar</p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas legales — solo ADMIN y AGENTE */}
      {(isAdmin || currentUser.role === 'AGENTE') &&
        (incompleteExpedientes.length > 0 ||
          (vehiclesItvExpiring as typeof vehiclesItvExpiring).length > 0 ||
          (vehiclesChargesPending as typeof vehiclesChargesPending).length > 0) && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Expedientes incompletos */}
            {incompleteExpedientes.length > 0 && (
              <Card className="border-amber-200">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm text-amber-700">
                    <FileWarning className="h-4 w-4" />
                    Expedientes incompletos ({incompleteExpedientes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {incompleteExpedientes.map((v) => (
                    <div key={v.id} className="flex items-center justify-between gap-2">
                      <Link
                        href={v.sellerLeadId ? `/vendedores/${v.sellerLeadId}` : '#'}
                        className="truncate text-sm hover:underline"
                      >
                        {v.brand} {v.model} {v.year ?? ''}
                      </Link>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          v.completionPct >= 60
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {v.completionPct}%
                      </span>
                    </div>
                  ))}
                  <p className="pt-1 text-xs text-muted-foreground">
                    Vehículos TASADOS sin expediente completo
                  </p>
                </CardContent>
              </Card>
            )}

            {/* ITV próxima a vencer */}
            {(vehiclesItvExpiring as typeof vehiclesItvExpiring).length > 0 && (
              <Card className="border-orange-200">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm text-orange-700">
                    <AlertTriangle className="h-4 w-4" />
                    ITV próxima a vencer (
                    {(vehiclesItvExpiring as typeof vehiclesItvExpiring).length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(vehiclesItvExpiring as typeof vehiclesItvExpiring).map((v) => {
                    const daysLeft = v.itvValidUntil
                      ? Math.floor(
                          (v.itvValidUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                        )
                      : null
                    const isCritical = daysLeft !== null && daysLeft < 15
                    return (
                      <div key={v.id} className="flex items-center justify-between gap-2">
                        <Link
                          href={v.sellerLead?.id ? `/vendedores/${v.sellerLead.id}` : '#'}
                          className="truncate text-sm hover:underline"
                        >
                          {v.brand} {v.model} {v.year ?? ''}
                        </Link>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                            isCritical ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                          }`}
                        >
                          {daysLeft !== null ? (daysLeft < 0 ? 'Vencida' : `${daysLeft}d`) : '—'}
                        </span>
                      </div>
                    )
                  })}
                  <p className="pt-1 text-xs text-muted-foreground">
                    Vehículos PUBLICADOS · ITV &lt; 60 días
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Cargas DGT pendientes */}
            {(vehiclesChargesPending as typeof vehiclesChargesPending).length > 0 && (
              <Card className="border-red-200">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm text-red-700">
                    <ShieldAlert className="h-4 w-4" />
                    Cargas DGT pendientes (
                    {(vehiclesChargesPending as typeof vehiclesChargesPending).length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(vehiclesChargesPending as typeof vehiclesChargesPending).map((v) => {
                    const daysSince = Math.floor(
                      (now.getTime() - v.createdAt.getTime()) / (1000 * 60 * 60 * 24)
                    )
                    return (
                      <div key={v.id} className="flex items-center justify-between gap-2">
                        <Link
                          href={v.sellerLead?.id ? `/vendedores/${v.sellerLead.id}` : '#'}
                          className="truncate text-sm hover:underline"
                        >
                          {v.brand} {v.model} {v.year ?? ''}
                        </Link>
                        <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          {daysSince}d
                        </span>
                      </div>
                    )
                  })}
                  <p className="pt-1 text-xs text-muted-foreground">
                    Sin verificar cargas desde hace +72h
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

      {/* KPIs Taller y Margen — solo ADMIN */}
      {isAdmin && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Margen promedio (vehículos con precios)
              </p>
              <p className="mt-1 text-3xl font-bold">
                {avgMargin30 !== null ? `${avgMargin30.toFixed(1)}%` : '—'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {vehiclesWithMargin.length} vehículo{vehiclesWithMargin.length !== 1 ? 's' : ''} con
                precio compra y venta
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Costes taller (últimos 30 días)
              </p>
              <p className="mt-1 text-3xl font-bold">
                {workshopTotal.toLocaleString('es-ES', {
                  style: 'currency',
                  currency: 'EUR',
                  maximumFractionDigits: 0,
                })}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Solo costes generados por órdenes
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Vehículos bajo objetivo de margen
              </p>
              <p
                className={`mt-1 text-3xl font-bold ${belowTarget > 0 ? 'text-red-600' : 'text-green-600'}`}
              >
                {belowTarget}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                de {vehiclesWithMargin.length} con precios configurados
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top 5 rentabilidad — solo ADMIN */}
      {isAdmin && top5Rentabilidad.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 5 vehículos por margen neto</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1.5 font-medium">Vehículo</th>
                  <th className="py-1.5 text-right font-medium">Margen neto</th>
                  <th className="py-1.5 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {top5Rentabilidad.map((v) => (
                  <tr key={v.id} className="border-b last:border-0">
                    <td className="py-1.5">
                      {v.sellerLeadId ? (
                        <a
                          href={`/vendedores/${v.sellerLeadId}`}
                          className="font-medium hover:underline"
                        >
                          {v.brand} {v.model} {v.year ?? ''}
                        </a>
                      ) : (
                        <span className="font-medium">
                          {v.brand} {v.model} {v.year ?? ''}
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-1.5 text-right font-semibold ${v.netMargin < 0 ? 'text-red-600' : 'text-green-600'}`}
                    >
                      {v.netMargin.toLocaleString('es-ES', {
                        style: 'currency',
                        currency: 'EUR',
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td
                      className={`py-1.5 text-right text-xs font-medium ${v.netMarginPct < 0 ? 'text-red-600' : 'text-cn-ink-700'}`}
                    >
                      {v.netMarginPct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Distribución por estado */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DistributionCard
          title="Vendedores por estado"
          counts={sellerCounts}
          labels={SELLER_LEAD_STATUS_LABELS}
          classes={SELLER_LEAD_STATUS_CLASSES}
          order={['NUEVO', 'CONTACTADO', 'CUALIFICADO', 'EN_NEGOCIACION', 'CERRADO', 'DESCARTADO']}
        />
        <DistributionCard
          title="Compradores por estado"
          counts={buyerCounts}
          labels={BUYER_LEAD_STATUS_LABELS}
          classes={BUYER_LEAD_STATUS_CLASSES}
          order={['NUEVO', 'CONTACTADO', 'CUALIFICADO', 'EN_NEGOCIACION', 'CERRADO', 'PERDIDO']}
        />
        <DistributionCard
          title="Vehículos por estado"
          counts={vehicleCounts}
          labels={VEHICLE_STATUS_LABELS}
          classes={VEHICLE_STATUS_CLASSES}
          order={['NUEVO', 'TASADO', 'PUBLICADO', 'RESERVADO', 'VENDIDO', 'DESCARTADO']}
        />
      </div>

      {/* Funnel Pro */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversión canal Pro</CardTitle>
        </CardHeader>
        <CardContent>
          <ProFunnelView
            leadsPro={proFunnel.leadsPro}
            publicados={proFunnel.publicados}
            vendidos={proFunnel.vendidos}
            pubRate={proFunnel.pubRate}
            vendRate={proFunnel.vendRate}
            totalRate={proFunnel.totalRate}
          />
        </CardContent>
      </Card>

      {/* Tiempo medio por estado */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StateMediansCard
          title="Tiempo medio · vendedores"
          rows={sellerStateMedians}
          labels={SELLER_LEAD_STATUS_LABELS}
        />
        <StateMediansCard
          title="Tiempo medio · compradores"
          rows={buyerStateMedians}
          labels={BUYER_LEAD_STATUS_LABELS}
        />
        <StateMediansCard
          title="Tiempo medio · vehículos"
          rows={vehicleStateMedians}
          labels={VEHICLE_STATUS_LABELS}
        />
      </div>
    </div>
  )
}

// ── helpers locales ───────────────────────────────────────────────

function sumWhere<T extends string>(counts: { status: T; count: number }[], statuses: T[]): number {
  const set = new Set(statuses)
  return counts.filter((c) => set.has(c.status)).reduce((a, c) => a + c.count, 0)
}

async function fetchSellerStateMedians(
  filter: DashboardFilter
): Promise<StateMedianRow<SellerLeadStatus>[]> {
  const leads = await db.sellerLead.findMany({
    where: filter.agentId ? { agentId: filter.agentId } : undefined,
    select: {
      createdAt: true,
      activities: {
        where: { type: 'CAMBIO_ESTADO' },
        select: { createdAt: true, content: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  const entities: EntityActivities<SellerLeadStatus>[] = leads.map((l) => ({
    initialStatus: 'NUEVO' as SellerLeadStatus,
    createdAt: l.createdAt,
    activities: l.activities.filter((a) => !a.content?.startsWith('Vehículo:')),
  }))
  return aggregateMediansByState<SellerLeadStatus>(entities, SELLER_LEAD_STATUS_LABELS)
}

async function fetchBuyerStateMedians(
  filter: DashboardFilter
): Promise<StateMedianRow<BuyerLeadStatus>[]> {
  const leads = await db.buyerLead.findMany({
    where: filter.agentId ? { agentId: filter.agentId } : undefined,
    select: {
      createdAt: true,
      activities: {
        where: { type: 'CAMBIO_ESTADO' },
        select: { createdAt: true, content: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  const entities: EntityActivities<BuyerLeadStatus>[] = leads.map((l) => ({
    initialStatus: 'NUEVO' as BuyerLeadStatus,
    createdAt: l.createdAt,
    activities: l.activities,
  }))
  return aggregateMediansByState<BuyerLeadStatus>(entities, BUYER_LEAD_STATUS_LABELS)
}

async function fetchVehicleStateMedians(
  filter: DashboardFilter
): Promise<StateMedianRow<VehicleStatus>[]> {
  // Las activities de vehículo cuelgan del SellerLead. Filtramos las que
  // empiezan por "Vehículo:" en el content (formato establecido en CAM-30).
  const vehicles = await db.vehicle.findMany({
    where: filter.agentId ? { sellerLead: { agentId: filter.agentId } } : undefined,
    select: {
      createdAt: true,
      sellerLead: {
        select: {
          activities: {
            where: { type: 'CAMBIO_ESTADO', content: { startsWith: 'Vehículo:' } },
            select: { createdAt: true, content: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  })
  const entities: EntityActivities<VehicleStatus>[] = vehicles.map((v) => ({
    initialStatus: 'NUEVO' as VehicleStatus,
    createdAt: v.createdAt,
    activities: v.sellerLead.activities,
  }))
  return aggregateMediansByState<VehicleStatus>(entities, VEHICLE_STATUS_LABELS)
}

// ── subcomponentes ────────────────────────────────────────────────

function KPICard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-bold">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

function SalesKPI({
  current,
  previous,
  delta,
  pctChange,
}: {
  current: number
  previous: number
  delta: number
  pctChange: number | null
}) {
  const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const color =
    trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground'

  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Ventas este mes
        </p>
        <p className="mt-1 text-3xl font-bold">{current}</p>
        <div className={`mt-1 flex items-center gap-1 text-xs ${color}`}>
          <Icon className="h-3 w-3" />
          <span>
            {delta > 0 ? '+' : ''}
            {delta} vs mes anterior ({previous})
            {pctChange !== null && ` · ${pctChange > 0 ? '+' : ''}${pctChange.toFixed(0)}%`}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function DistributionCard<T extends string>({
  title,
  counts,
  labels,
  classes,
  order,
}: {
  title: string
  counts: { status: T; count: number }[]
  labels: Record<T, string>
  classes: Record<T, string>
  order: T[]
}) {
  const total = counts.reduce((a, c) => a + c.count, 0)
  const map = new Map(counts.map((c) => [c.status, c.count]))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos.</p>
        ) : (
          <ul className="space-y-2">
            {order.map((status) => {
              const count = map.get(status) ?? 0
              const pct = total === 0 ? 0 : (count / total) * 100
              return (
                <li key={status}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes[status]}`}
                    >
                      {labels[status]}
                    </span>
                    <span className="text-sm font-semibold">{count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="bg-campernova-accent h-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              )
            })}
            <li className="border-t pt-2 text-xs text-muted-foreground">Total: {total}</li>
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function ProFunnelView({
  leadsPro,
  publicados,
  vendidos,
  pubRate,
  vendRate,
  totalRate,
}: {
  leadsPro: number
  publicados: number
  vendidos: number
  pubRate: number | null
  vendRate: number | null
  totalRate: number | null
}) {
  if (leadsPro === 0) {
    return <p className="text-sm text-muted-foreground">Aún no hay leads del canal Pro.</p>
  }

  const max = leadsPro
  const stages = [
    { label: 'Leads recibidos (Pro)', value: leadsPro, pct: 100, rate: null as number | null },
    {
      label: 'Llegaron a publicado',
      value: publicados,
      pct: (publicados / max) * 100,
      rate: pubRate,
    },
    { label: 'Vendidos', value: vendidos, pct: (vendidos / max) * 100, rate: vendRate },
  ]

  return (
    <div className="space-y-3">
      {stages.map((s) => (
        <div key={s.label}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{s.label}</span>
            <span className="text-sm">
              <span className="font-semibold">{s.value}</span>
              {s.rate !== null && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {s.rate.toFixed(0)}% del paso anterior
                </span>
              )}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-md bg-muted">
            <div
              className="bg-campernova-primary h-full transition-all"
              style={{ width: `${Math.max(s.pct, 0)}%` }}
            />
          </div>
        </div>
      ))}
      {totalRate !== null && (
        <p className="border-t pt-3 text-sm text-muted-foreground">
          Conversión total lead Pro → venta:{' '}
          <strong className="text-foreground">{totalRate.toFixed(1)}%</strong>
        </p>
      )}
    </div>
  )
}

function StateMediansCard<T extends string>({
  title,
  rows,
  labels,
}: {
  title: string
  rows: StateMedianRow<T>[]
  labels: Record<T, string>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin transiciones completadas todavía.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-1.5 font-medium">Estado</th>
                <th className="py-1.5 text-right font-medium">Mediana</th>
                <th className="py-1.5 text-right font-medium">n</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.status} className="border-b last:border-0">
                  <td className="py-1.5">{labels[r.status]}</td>
                  <td className="py-1.5 text-right font-medium">{formatDuration(r.medianMs)}</td>
                  <td className="py-1.5 text-right text-xs text-muted-foreground">
                    {r.sampleSize}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}
