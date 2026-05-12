import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import {
  SELLER_LEAD_STATUS_LABELS,
  BUYER_LEAD_STATUS_LABELS,
  VEHICLE_STATUS_LABELS,
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
import {
  getStockValue,
  getAverageDaysInStock,
  getStagnantVehicles,
  getMonthlyNetMargin,
  getPublishedToSoldRate,
  getLeadAcceptanceRate,
  getAveragePostventaCostPerVehicle,
  getVehiclesPerCommercial,
  getAverageWorkshopHoursPerVehicle,
  getStockHistorySnapshot,
} from '@/lib/dashboard/metrics'
import { DashboardFilters } from './dashboard-filters'
import { ForbiddenToast } from '@/components/forbidden-toast'
import { AlertTriangle, FileWarning, ShieldAlert } from 'lucide-react'
import type { SellerLeadStatus, BuyerLeadStatus, VehicleStatus } from '@prisma/client'
import { calculateCompletionPercent } from '@/lib/vehicle-legal'
import type { VehicleLegalInput, DocumentSummary } from '@/lib/vehicle-legal'
import type { VehicleDocumentCategory } from '@prisma/client'
import Link from 'next/link'
import { StockEvolutionChart } from '@/components/dashboard/stock-evolution-chart'

// ── Constants ─────────────────────────────────────────────────────────────────

const EUR = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

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

// Dot colors per status (CSS color strings)
const STATUS_DOTS: Record<string, string> = {
  NUEVO: '#2563eb',
  CONTACTADO: '#7c3aed',
  CUALIFICADO: '#0891b2',
  EN_NEGOCIACION: '#d97706',
  CERRADO: '#1f8a5b',
  DESCARTADO: '#b3aca0',
  TASADO: '#7c3aed',
  PUBLICADO: '#0891b2',
  RESERVADO: '#d97706',
  VENDIDO: '#1f8a5b',
  PERDIDO: '#b3aca0',
}

const TIME_DOTS = ['#2563eb', '#7c3aed', '#0891b2', '#d97706', '#1f8a5b', '#b3aca0']

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { agent?: string }
}) {
  const currentUser = await requireAuth()

  const isAdmin = currentUser.role === 'ADMIN'
  const isAgente = currentUser.role === 'AGENTE'
  const isTaller = currentUser.role === 'TALLER'
  const isEntregas = currentUser.role === 'ENTREGAS'
  const isMarketing = currentUser.role === 'MARKETING'

  const requestedAgentId = searchParams.agent ?? null
  const effectiveAgentId = isAdmin ? requestedAgentId : currentUser.id
  const filter: DashboardFilter = { agentId: effectiveAgentId }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  // ── Base queries ─────────────────────────────────────────────────────────
  const [sellerCounts, buyerCounts, vehicleCounts, salesMoM, proFunnel, agents] = await Promise.all(
    [
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
    ]
  )

  const totalSellerActive = sumWhere(sellerCounts, ACTIVE_SELLER_STATUSES)
  const totalBuyerActive = sumWhere(buyerCounts, ACTIVE_BUYER_STATUSES)
  const totalPublicados = sumWhere(vehicleCounts, ['PUBLICADO'])

  // ── Postventa ────────────────────────────────────────────────────────────
  const [activeWarranties, openTickets, pendingFollowups] = await Promise.all([
    db.warranty.count({ where: { endDate: { gt: new Date() } } }),
    db.postventaTicket.count({ where: { status: { in: ['ABIERTO', 'EN_PROGRESO'] } } }),
    db.postventaFollowup.count({ where: { status: 'PENDIENTE' } }),
  ])

  // ── State medians ────────────────────────────────────────────────────────
  const [sellerStateMedians, buyerStateMedians, vehicleStateMedians] = await Promise.all([
    fetchSellerStateMedians(filter),
    fetchBuyerStateMedians(filter),
    fetchVehicleStateMedians(filter),
  ])

  // ── Legal alerts (ADMIN + AGENTE) ────────────────────────────────────────
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

  const [vehiclesTasadosRaw, vehiclesItvExpiring, vehiclesChargesPending] = await Promise.all([
    isAdmin || isAgente
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
    isAdmin || isAgente
      ? db.vehicle.findMany({
          where: {
            status: 'PUBLICADO',
            itvValidUntil: { lt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) },
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
    isAdmin || isAgente
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

  // ── Financial metrics (ADMIN + MARKETING) ────────────────────────────────
  const showFinancials = isAdmin || isMarketing
  const [stockValue, avgDaysInStock, monthlyMargin, pubToSoldRate, funnelComparison, stockHistory] =
    await Promise.all([
      showFinancials ? getStockValue(db, filter) : Promise.resolve(null),
      showFinancials || isEntregas ? getAverageDaysInStock(db, filter) : Promise.resolve(null),
      isAdmin ? getMonthlyNetMargin(db, filter) : Promise.resolve(null),
      isAdmin ? getPublishedToSoldRate(db, filter) : Promise.resolve(null),
      isAdmin ? getLeadAcceptanceRate(db, filter) : Promise.resolve(null),
      showFinancials ? getStockHistorySnapshot() : Promise.resolve([]),
    ])

  // ── Operational metrics ───────────────────────────────────────────────────
  const showOperational = isAdmin || isAgente || isMarketing
  const [stagnantVehicles] = await Promise.all([
    showOperational || isEntregas ? getStagnantVehicles(db, filter) : Promise.resolve([]),
  ])

  // ── Workshop metrics ──────────────────────────────────────────────────────
  const showWorkshop = isAdmin || isTaller
  const [avgWorkshopHours, workshopCostsLast30, vehiclesPerCommercial] = await Promise.all([
    showWorkshop ? getAverageWorkshopHoursPerVehicle(db, filter) : Promise.resolve(null),
    isAdmin
      ? db.vehicleCost.aggregate({
          where: {
            createdAt: { gte: thirtyDaysAgo },
            workOrderId: { not: null },
            ...(filter.agentId ? { vehicle: { sellerLead: { agentId: filter.agentId } } } : {}),
          },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: null } }),
    isAdmin ? getVehiclesPerCommercial(db) : Promise.resolve([]),
  ])

  const avgPostventaCost = isAdmin ? await getAveragePostventaCostPerVehicle(db, filter) : null

  // ── Margin table ──────────────────────────────────────────────────────────
  const vehiclesWithMargin = isAdmin
    ? await db.vehicle.findMany({
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
      })
    : []

  type VehicleMarginRow = {
    id: string
    brand: string
    model: string
    year: number | null
    netMargin: number
    netMarginPct: number
    sellerLeadId: string | null
  }

  function computeMargins(vehicles: typeof vehiclesWithMargin) {
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

  const { rows: marginRows } = computeMargins(vehiclesWithMargin)
  const top5Rentabilidad = isAdmin
    ? marginRows.sort((a, b) => b.netMarginPct - a.netMarginPct).slice(0, 5)
    : []
  const workshopTotal = Number(workshopCostsLast30._sum.amount ?? 0)
  const avgMargin =
    marginRows.length === 0
      ? null
      : marginRows.reduce((s, r) => s + r.netMarginPct, 0) / marginRows.length

  const now = new Date()

  // ── Derived / computed values ─────────────────────────────────────────────

  // Funnel values
  const totalLeads = sellerCounts.reduce((a, c) => a + c.count, 0)
  const cualificadosPlus = sumWhere(sellerCounts, ['CUALIFICADO', 'EN_NEGOCIACION', 'CERRADO'])
  const vehiclesTotal = vehicleCounts.reduce((a, c) => a + c.count, 0)
  const pubPlus = sumWhere(vehicleCounts, ['PUBLICADO', 'RESERVADO', 'VENDIDO'])
  const resvPlus = sumWhere(vehicleCounts, ['RESERVADO', 'VENDIDO'])
  const soldCount = sumWhere(vehicleCounts, ['VENDIDO'])
  const funnelMax = Math.max(totalLeads, 1)

  const funnelStages = [
    {
      label: 'Leads',
      value: totalLeads,
      pct: 100,
      grad: 'linear-gradient(180deg, #6366f1, #4f46e5)',
    },
    {
      label: 'Cualificados',
      value: cualificadosPlus,
      pct: (cualificadosPlus / funnelMax) * 100,
      grad: 'linear-gradient(180deg, #06b6d4, #0891b2)',
    },
    {
      label: 'Publicados',
      value: pubPlus,
      pct: (pubPlus / funnelMax) * 100,
      grad: 'linear-gradient(180deg, #14b8a6, #0d9488)',
    },
    {
      label: 'Reservados',
      value: resvPlus,
      pct: (resvPlus / funnelMax) * 100,
      grad: 'linear-gradient(180deg, #f59e0b, #d97706)',
    },
    {
      label: 'Vendidos',
      value: soldCount,
      pct: (soldCount / funnelMax) * 100,
      grad: 'linear-gradient(180deg, #22c55e, #16a34a)',
    },
  ]

  // Requires-action count
  const requiresAction =
    incompleteExpedientes.length +
    stagnantVehicles.length +
    (vehiclesItvExpiring as typeof vehiclesItvExpiring).length +
    (vehiclesChargesPending as typeof vehiclesChargesPending).length

  // Agenda items
  type AgendaItem = {
    dot: 'bad' | 'warn' | 'info' | 'ok'
    title: string
    meta: string
    cta: string
    href: string
  }
  const agendaItems: AgendaItem[] = []

  for (const v of incompleteExpedientes.slice(0, 2)) {
    agendaItems.push({
      dot: 'bad',
      title: `${v.brand} ${v.model} ${v.year ?? ''} · expediente al ${v.completionPct}%`,
      meta: 'TASADO · SIN DOCUMENTACIÓN COMPLETA',
      cta: 'Completar',
      href: v.sellerLeadId ? `/vendedores/${v.sellerLeadId}` : '/vendedores',
    })
  }
  for (const v of stagnantVehicles.slice(0, 2)) {
    agendaItems.push({
      dot: v.daysInStatus > 180 ? 'bad' : 'warn',
      title: `${v.brand} ${v.model} en nave hace ${v.daysInStatus} días`,
      meta: 'SUGERENCIA: BAJAR PRECIO O REUBICAR',
      cta: 'Decidir',
      href: v.sellerLeadId ? `/vendedores/${v.sellerLeadId}` : '/vendedores',
    })
  }
  for (const v of (vehiclesItvExpiring as typeof vehiclesItvExpiring).slice(0, 1)) {
    const daysLeft = v.itvValidUntil
      ? Math.floor((v.itvValidUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null
    agendaItems.push({
      dot: 'warn',
      title: `ITV de ${v.brand} ${v.model} vence en ${daysLeft ?? '?'}d`,
      meta: 'VEHÍCULO PUBLICADO · REQUIERE RENOVACIÓN',
      cta: 'Gestionar',
      href: v.sellerLead?.id ? `/vendedores/${v.sellerLead.id}` : '/vendedores',
    })
  }
  if (openTickets > 0) {
    agendaItems.push({
      dot: 'info',
      title: `${openTickets} ticket${openTickets !== 1 ? 's' : ''} abierto${openTickets !== 1 ? 's' : ''} en postventa`,
      meta: 'INCIDENCIAS SIN RESOLVER',
      cta: 'Abrir',
      href: '/postventa',
    })
  }
  if (pendingFollowups > 0) {
    agendaItems.push({
      dot: 'info',
      title: `${pendingFollowups} follow-up${pendingFollowups !== 1 ? 's' : ''} pendiente${pendingFollowups !== 1 ? 's' : ''}`,
      meta: 'SEGUIMIENTO POST-ENTREGA DÍA 7 Y DÍA 30',
      cta: 'Revisar',
      href: '/postventa',
    })
  }
  const agendaSlice = agendaItems.slice(0, 6)

  const dotClass = {
    bad: { bg: '#dc2626', shadow: '0 0 0 4px #fde8e8' },
    warn: { bg: '#d97706', shadow: '0 0 0 4px #fef3e2' },
    info: { bg: '#2563eb', shadow: '0 0 0 4px #e6efff' },
    ok: { bg: '#1f8a5b', shadow: '0 0 0 4px #e3f5ec' },
  } as const

  // Seller counts map
  const sellerMap = new Map(sellerCounts.map((c) => [c.status, c.count]))
  const buyerMap = new Map(buyerCounts.map((c) => [c.status, c.count]))
  const vehicleMap = new Map(vehicleCounts.map((c) => [c.status, c.count]))

  const sellerTotal = sellerCounts.reduce((a, c) => a + c.count, 0)
  const buyerTotal = buyerCounts.reduce((a, c) => a + c.count, 0)

  // Stocks active
  const stockActiveCount = showFinancials
    ? (stockValue?.vehicleCount ??
      sumWhere(vehicleCounts, ['NUEVO', 'TASADO', 'PUBLICADO', 'RESERVADO']))
    : sumWhere(vehicleCounts, ['NUEVO', 'TASADO', 'PUBLICADO', 'RESERVADO'])

  // Bar chart max (vehicles per commercial)
  const barMax =
    vehiclesPerCommercial.length > 0
      ? Math.max(...vehiclesPerCommercial.map((r) => r.active), 1)
      : 1

  const barGrads = [
    'linear-gradient(90deg,#2563eb,#7c3aed)',
    'linear-gradient(90deg,#0891b2,#14b8a6)',
    'linear-gradient(90deg,#d97706,#f59e0b)',
    'linear-gradient(90deg,#db2777,#ec4899)',
    'linear-gradient(90deg,#1f8a5b,#22c55e)',
  ]

  // Sales delta
  const salesDelta = salesMoM.delta
  const salesTrend = salesDelta > 0 ? 'up' : salesDelta < 0 ? 'down' : 'flat'

  return (
    <div>
      <ForbiddenToast />

      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between pb-0 pt-1">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#6b645c]">
            Vista general ·{' '}
            {now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h1 className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.015em]">
            Buenos días, {currentUser.name?.split(' ')[0] ?? 'Joel'}.
          </h1>
        </div>
        {isAdmin && (
          <div className="mt-1">
            <DashboardFilters agents={agents} currentAgentId={requestedAgentId} />
          </div>
        )}
      </div>

      {/* ── Hero KPIs ──────────────────────────────────────────────────────── */}
      <SectionEyebrow label="Lo que importa hoy" color="info" />
      <div className="grid grid-cols-2 gap-[14px] lg:grid-cols-4">
        {/* 1 — Margen neto (dark gradient) — ADMIN/MARKETING only */}
        {showFinancials ? (
          <div
            className="flex flex-col gap-3.5 rounded-[14px] p-6"
            style={{ background: 'linear-gradient(135deg, #1f8a5b, #0f5132)', color: '#fff' }}
          >
            <div className="flex items-start justify-between">
              <span
                className="font-mono text-[10px] font-medium uppercase tracking-[0.14em]"
                style={{ color: 'rgba(255,255,255,0.8)' }}
              >
                Margen neto · mes
              </span>
              <div
                className="grid h-8 w-8 place-items-center rounded-lg"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  style={{ opacity: 0.9 }}
                >
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
            </div>
            <div className="text-[32px] font-bold tabular-nums leading-none tracking-[-0.025em]">
              {monthlyMargin ? EUR.format(monthlyMargin.netMargin) : '—'}
            </div>
            {/* Spark */}
            <svg
              viewBox="0 0 200 40"
              preserveAspectRatio="none"
              className="-mx-1 mb-[-4px] mt-1 h-9"
            >
              <path
                d="M0,30 L25,28 L50,22 L75,24 L100,18 L125,14 L150,16 L175,10 L200,6"
                fill="none"
                stroke="rgba(255,255,255,0.8)"
                strokeWidth="2"
              />
              <path
                d="M0,30 L25,28 L50,22 L75,24 L100,18 L125,14 L150,16 L175,10 L200,6 L200,40 L0,40 Z"
                fill="rgba(255,255,255,0.12)"
              />
            </svg>
            <div className="mt-auto flex items-center justify-between">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold"
                style={{ background: 'rgba(255,255,255,0.18)' }}
              >
                {salesTrend === 'up' ? '↑' : salesTrend === 'down' ? '↓' : '→'}{' '}
                {salesMoM.pctChange !== null
                  ? `${salesMoM.pctChange > 0 ? '+' : ''}${salesMoM.pctChange.toFixed(0)}% vs anterior`
                  : 'sin cambio'}
              </span>
              <span className="text-[11.5px]" style={{ color: 'rgba(255,255,255,0.75)' }}>
                {monthlyMargin?.vehiclesSold ?? 0} venta
                {monthlyMargin?.vehiclesSold !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        ) : (
          /* Non-financial roles: show stock value placeholder */
          <div className="flex flex-col gap-3.5 rounded-[14px] border border-[#e6dfd0] bg-white p-6">
            <div className="flex items-start justify-between">
              <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#6b645c]">
                Stock activo
              </span>
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-50 text-cyan-600">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M3 17h11l3-7H6" />
                  <circle cx="7" cy="20" r="2" />
                  <circle cx="17" cy="20" r="2" />
                </svg>
              </div>
            </div>
            <div className="text-[32px] font-bold tabular-nums leading-none tracking-[-0.025em]">
              {stockActiveCount}
              <span className="ml-1 text-[18px] font-medium text-[#6b645c]">veh.</span>
            </div>
            <div className="mt-auto flex items-center justify-between">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#e3f5ec] px-2 py-0.5 text-[11.5px] font-semibold text-[#1f8a5b]">
                ↑ en nave
              </span>
              <span className="text-[11.5px] text-[#6b645c]">
                {avgDaysInStock?.averageDays != null
                  ? `${avgDaysInStock.averageDays}d medios`
                  : '—'}
              </span>
            </div>
          </div>
        )}

        {/* 2 — Stock activo */}
        <div className="flex flex-col gap-3.5 rounded-[14px] border border-[#e6dfd0] bg-white p-6">
          <div className="flex items-start justify-between">
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#6b645c]">
              Stock activo
            </span>
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-50 text-cyan-600">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M3 17h11l3-7H6" />
                <circle cx="7" cy="20" r="2" />
                <circle cx="17" cy="20" r="2" />
              </svg>
            </div>
          </div>
          <div className="text-[32px] font-bold tabular-nums leading-none tracking-[-0.025em]">
            {stockActiveCount}
            <span className="ml-1 text-[18px] font-medium text-[#6b645c]">veh.</span>
          </div>
          <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="-mx-1 mb-[-4px] mt-1 h-9">
            <path
              d="M0,20 L25,18 L50,22 L75,16 L100,20 L125,14 L150,18 L175,12 L200,16"
              fill="none"
              stroke="#0891b2"
              strokeWidth="2"
            />
          </svg>
          <div className="mt-auto flex items-center justify-between">
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2 py-0.5 text-[11.5px] font-semibold text-cyan-600">
              ↑{' '}
              {avgDaysInStock?.averageDays != null
                ? `${avgDaysInStock.averageDays}d medios`
                : 'en nave'}
            </span>
            <span className="text-[11.5px] text-[#6b645c]">
              {showFinancials && stockValue
                ? EUR.format(stockValue.totalStockValue) + ' valor'
                : `${totalPublicados} publicados`}
            </span>
          </div>
        </div>

        {/* 3 — Pipeline activo */}
        <div className="flex flex-col gap-3.5 rounded-[14px] border border-[#e6dfd0] bg-white p-6">
          <div className="flex items-start justify-between">
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#6b645c]">
              Pipeline activo
            </span>
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-violet-100 text-violet-700">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div className="text-[32px] font-bold tabular-nums leading-none tracking-[-0.025em]">
            {totalSellerActive + totalBuyerActive}
            <span className="ml-1 text-[18px] font-medium text-[#6b645c]">leads</span>
          </div>
          <div className="mt-auto flex gap-[14px] text-[12px]">
            <div>
              <div className="font-mono text-[10px] tracking-[0.06em] text-[#6b645c]">
                VENDEDORES
              </div>
              <div className="mt-0.5 font-semibold">{totalSellerActive} activos</div>
            </div>
            <div>
              <div className="font-mono text-[10px] tracking-[0.06em] text-[#6b645c]">
                COMPRADORES
              </div>
              <div className="mt-0.5 font-semibold">{totalBuyerActive} activos</div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11.5px] font-semibold text-violet-700">
              {salesMoM.current} vendidos este mes
            </span>
          </div>
        </div>

        {/* 4 — Requieren acción */}
        <div
          className="flex flex-col gap-3.5 rounded-[14px] p-6"
          style={{
            border: requiresAction > 0 ? '1px solid #dc2626' : '1px solid #e6dfd0',
            background: requiresAction > 0 ? 'linear-gradient(180deg, #fff, #fef5f5)' : '#fff',
          }}
        >
          <div className="flex items-start justify-between">
            <span
              className="font-mono text-[10px] font-medium uppercase tracking-[0.14em]"
              style={{ color: requiresAction > 0 ? '#dc2626' : '#6b645c' }}
            >
              Requieren acción
            </span>
            <div
              className="grid h-8 w-8 place-items-center rounded-lg"
              style={{
                background: requiresAction > 0 ? '#fde8e8' : '#f5f0e6',
                color: requiresAction > 0 ? '#dc2626' : '#6b645c',
              }}
            >
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div
            className="text-[32px] font-bold tabular-nums leading-none tracking-[-0.025em]"
            style={{ color: requiresAction > 0 ? '#dc2626' : '#0a0a0a' }}
          >
            {requiresAction}
          </div>
          <div className="mt-auto text-[12px] leading-relaxed text-[#2a2622]">
            {incompleteExpedientes.length > 0 && (
              <span>
                {incompleteExpedientes.length} expediente
                {incompleteExpedientes.length !== 1 ? 's' : ''}
              </span>
            )}
            {stagnantVehicles.length > 0 && (
              <>
                {incompleteExpedientes.length > 0 ? ' · ' : ''}
                {stagnantVehicles.length} estancado{stagnantVehicles.length !== 1 ? 's' : ''}
              </>
            )}
            {openTickets > 0 && (
              <>
                {incompleteExpedientes.length > 0 || stagnantVehicles.length > 0 ? '\n' : ''}
                {openTickets} ticket{openTickets !== 1 ? 's' : ''} abierto
                {openTickets !== 1 ? 's' : ''}
              </>
            )}
            {requiresAction === 0 && <span className="text-[#6b645c]">Todo en orden 🎉</span>}
          </div>
          {requiresAction > 0 && (
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11.5px] font-semibold text-red-600">
                ↓ {Math.max(incompleteExpedientes.length, 1)} críticos
              </span>
              <Link href="/vendedores" className="text-[12px] font-semibold text-red-600">
                Ver todo →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Resumen Operativo ──────────────────────────────────────────────── */}
      <SectionEyebrow label="Resumen operativo" color="info" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MiniKPI
          label="Vehículos publicados"
          value={totalPublicados}
          unit={`/ ${stockActiveCount} stock`}
          sub={totalPublicados === 0 ? '↓ ninguno publicado' : `${totalPublicados} en portales`}
          subColor={totalPublicados === 0 ? 'down' : 'default'}
        />
        <MiniKPI
          label="Ventas este mes"
          value={salesMoM.current}
          unit="veh."
          valueColor="ok"
          sub={`${salesTrend === 'up' ? '↑' : salesTrend === 'down' ? '↓' : '→'} vs ${salesMoM.previous} mes anterior`}
          subColor={salesTrend === 'up' ? 'up' : salesTrend === 'down' ? 'down' : 'default'}
        />
        <MiniKPI label="Garantías activas" value={activeWarranties} sub="no expiradas" />
        <MiniKPI
          label="+90 días en nave"
          value={avgDaysInStock?.over90Count ?? 0}
          unit="veh."
          valueColor={avgDaysInStock && avgDaysInStock.over90Count > 0 ? 'warn' : 'default'}
          sub="acción comercial"
          variant={avgDaysInStock && avgDaysInStock.over90Count > 0 ? 'alert' : 'default'}
        />
        {isAdmin && (
          <MiniKPI
            label="Costes taller 30d"
            value={workshopTotal > 0 ? EUR.format(workshopTotal) : '0 €'}
            sub="órdenes cerradas"
          />
        )}
        {!isAdmin && (
          <MiniKPI
            label="Follow-ups"
            value={pendingFollowups}
            valueColor={pendingFollowups > 0 ? 'info' : 'default'}
            sub="día 7 y día 30 sin enviar"
          />
        )}
      </div>

      {/* ── Resumen Financiero (ADMIN + MARKETING) ──────────────────────────── */}
      {showFinancials && stockValue && (
        <>
          <SectionEyebrow label="Resumen financiero" color="ok" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniKPI
              label="Capital comprometido"
              value={EUR.format(stockValue.committedInvestment)}
              sub={`precio compra · ${stockValue.vehicleCount} veh.`}
            />
            <MiniKPI
              label="Margen potencial stock"
              value={EUR.format(stockValue.potentialMargin)}
              valueColor={stockValue.potentialMargin >= 0 ? 'ok' : 'bad'}
              sub="venta − compra − costes"
            />
            {isAdmin && pubToSoldRate && (
              <MiniKPI
                label="Tasa publicado → vendido"
                value={pubToSoldRate.rate !== null ? `${pubToSoldRate.rate.toFixed(1)}%` : '—'}
                valueColor="ok"
                sub={`${pubToSoldRate.sold} vendidos / ${pubToSoldRate.published} pub.`}
              />
            )}
            {isAdmin && (
              <MiniKPI
                label="Margen promedio"
                value={avgMargin !== null ? `${avgMargin.toFixed(1)}%` : '—'}
                valueColor={avgMargin !== null && avgMargin >= 4 ? 'ok' : 'default'}
                sub={`${vehiclesWithMargin.length} vehículos`}
              />
            )}
          </div>
        </>
      )}

      {/* ── Hoy: Agenda + Pipeline ─────────────────────────────────────────── */}
      {(isAdmin || isAgente) && (
        <>
          <SectionEyebrow label="Hoy" color="info" />
          <div className="grid gap-[14px] lg:grid-cols-[1.15fr_1fr]">
            {/* Action stack */}
            <div className="overflow-hidden rounded-[14px] border border-[#e6dfd0] bg-white">
              <div className="flex items-center justify-between border-b border-[#e6dfd0] px-6 py-[18px]">
                <h3 className="text-[16px] font-semibold tracking-[-0.01em]">Tu agenda</h3>
                {agendaSlice.length > 0 && (
                  <span className="rounded-full bg-red-600 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                    {agendaSlice.length} pendientes
                  </span>
                )}
              </div>
              {agendaSlice.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-[#6b645c]">
                  Todo en orden. No hay tareas pendientes 🎉
                </div>
              ) : (
                agendaSlice.map((item, i) => (
                  <Link
                    key={i}
                    href={item.href}
                    className="grid items-center gap-[14px] border-b border-[#e6dfd0] px-6 py-4 transition-colors last:border-b-0 hover:bg-[#faf6ed]"
                    style={{ gridTemplateColumns: '32px 1fr auto' }}
                  >
                    <div className="flex justify-center">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          background: dotClass[item.dot].bg,
                          boxShadow: dotClass[item.dot].shadow,
                        }}
                      />
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold leading-tight">{item.title}</div>
                      <div className="mt-0.5 font-mono text-[12px] tracking-[0.02em] text-[#6b645c]">
                        {item.meta}
                      </div>
                    </div>
                    <span className="whitespace-nowrap text-[12px] font-semibold text-blue-600">
                      {item.cta} →
                    </span>
                  </Link>
                ))
              )}
            </div>

            {/* Pipeline funnel */}
            <div className="rounded-[14px] border border-[#e6dfd0] bg-white p-6">
              <div className="mb-[22px] flex items-center justify-between">
                <h3 className="text-[16px] font-semibold tracking-[-0.01em]">
                  Funnel de conversión
                </h3>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6b645c]">
                  Acumulado
                </span>
              </div>
              {/* Bars */}
              <div
                className="h-[220px]"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: '8px',
                  alignItems: 'end',
                }}
              >
                {funnelStages.map((stage) => (
                  <div
                    key={stage.label}
                    className="flex flex-col items-center gap-2.5"
                    style={{ height: '100%', justifyContent: 'flex-end' }}
                  >
                    <div
                      className="relative w-full rounded-t-lg"
                      style={{
                        background: stage.grad,
                        height: `${Math.max(stage.pct, 5)}%`,
                        minHeight: '16px',
                      }}
                    >
                      <span
                        className="absolute text-[20px] font-bold leading-none tracking-[-0.02em] text-[#0a0a0a]"
                        style={{
                          top: '-28px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                        }}
                      >
                        {stage.value}
                      </span>
                    </div>
                    <div className="text-center">
                      <div className="text-[12px] font-semibold">{stage.label}</div>
                      <div className="mt-0.5 font-mono text-[10px] tracking-[0.06em] text-[#6b645c]">
                        {stage.pct > 0 ? `${Math.round(stage.pct)}%` : '0%'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Canal PRO / CN */}
              {isAdmin && (
                <div
                  className="mt-6 border-t border-[#e6dfd0] pt-5"
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}
                >
                  <div>
                    <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-600">
                      Canal PRO
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="text-[20px] font-bold tracking-[-0.02em]">
                        {funnelComparison?.pro.total ?? proFunnel.leadsPro}
                      </span>
                      <span className="text-[12px] text-[#6b645c]">
                        leads ·{' '}
                        <span className="font-semibold text-[#1f8a5b]">
                          {funnelComparison?.pro.soldRate != null
                            ? `${funnelComparison.pro.soldRate.toFixed(0)}% conv`
                            : proFunnel.totalRate != null
                              ? `${proFunnel.totalRate.toFixed(0)}% conv`
                              : '—'}
                        </span>
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-blue-50">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{
                          width: `${Math.min(
                            ((funnelComparison?.pro.soldRate ?? proFunnel.totalRate ?? 0) / 100) *
                              100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-700">
                      Canal CN
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="text-[20px] font-bold tracking-[-0.02em]">
                        {funnelComparison?.cn.total ?? totalLeads - proFunnel.leadsPro}
                      </span>
                      <span className="text-[12px] text-[#6b645c]">
                        leads ·{' '}
                        <span
                          className="font-semibold"
                          style={{
                            color: (funnelComparison?.cn.soldRate ?? 0) > 0 ? '#1f8a5b' : '#dc2626',
                          }}
                        >
                          {funnelComparison?.cn.soldRate != null
                            ? `${funnelComparison.cn.soldRate.toFixed(0)}% conv`
                            : '—'}
                        </span>
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-violet-100">
                      <div
                        className="h-full rounded-full bg-violet-600"
                        style={{
                          width: `${Math.min(
                            ((funnelComparison?.cn.soldRate ?? 0) / 100) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Tendencias (ADMIN + MARKETING) ────────────────────────────────── */}
      {showFinancials && stockHistory.length > 0 && (
        <>
          <SectionEyebrow label="Tendencias" color="info" />
          <div className="rounded-[14px] border border-[#e6dfd0] bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-semibold tracking-[-0.01em]">
                  Evolución del stock
                </h3>
                <p className="mt-1 text-[12px] text-[#6b645c]">
                  Valor inmovilizado · últimos 12 meses
                </p>
              </div>
            </div>
            <div className="h-[220px]">
              <StockEvolutionChart data={stockHistory} />
            </div>
            {stockValue && (
              <div className="mt-4 flex gap-6 border-t border-[#e6dfd0] pt-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6b645c]">
                    Valor actual
                  </div>
                  <div className="mt-1 text-[20px] font-bold tracking-[-0.02em]">
                    {EUR.format(stockValue.totalStockValue)}
                    <span className="ml-1.5 rounded bg-[#e3f5ec] px-1 py-0.5 text-[11px] font-semibold text-[#1f8a5b]">
                      ↑ activo
                    </span>
                  </div>
                </div>
                {avgDaysInStock && (
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6b645c]">
                      Días medios stock
                    </div>
                    <div className="mt-1 text-[20px] font-bold tracking-[-0.02em]">
                      {avgDaysInStock.averageDays ?? '—'}d
                    </div>
                  </div>
                )}
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6b645c]">
                    Vehículos en nave
                  </div>
                  <div className="mt-1 text-[20px] font-bold tracking-[-0.02em]">
                    {stockValue.vehicleCount}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Alertas legales (ADMIN + AGENTE) ──────────────────────────────── */}
      {(isAdmin || isAgente) &&
        (incompleteExpedientes.length > 0 ||
          (vehiclesItvExpiring as typeof vehiclesItvExpiring).length > 0 ||
          (vehiclesChargesPending as typeof vehiclesChargesPending).length > 0) && (
          <>
            <SectionEyebrow label="Alertas legales" color="bad" />
            <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-3">
              {incompleteExpedientes.length > 0 && (
                <div
                  className="rounded-[14px] p-[22px]"
                  style={{
                    border: '1px solid #d97706',
                    background: 'linear-gradient(180deg, #fff, #fffbf2)',
                  }}
                >
                  <div className="mb-4 flex items-center gap-2 text-[14px] font-semibold text-amber-700">
                    <FileWarning className="h-4 w-4" />
                    Expedientes incompletos ({incompleteExpedientes.length})
                  </div>
                  <div className="space-y-2">
                    {incompleteExpedientes.map((v) => (
                      <div key={v.id} className="flex items-center justify-between gap-2">
                        <Link
                          href={v.sellerLeadId ? `/vendedores/${v.sellerLeadId}` : '#'}
                          className="truncate text-[13px] text-[#2a2622] hover:underline"
                        >
                          {v.brand} {v.model} {v.year ?? ''}
                        </Link>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${v.completionPct >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}
                        >
                          {v.completionPct}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(vehiclesItvExpiring as typeof vehiclesItvExpiring).length > 0 && (
                <div
                  className="rounded-[14px] p-[22px]"
                  style={{
                    border: '1px solid #f97316',
                    background: 'linear-gradient(180deg, #fff, #fff7f2)',
                  }}
                >
                  <div className="mb-4 flex items-center gap-2 text-[14px] font-semibold text-orange-700">
                    <AlertTriangle className="h-4 w-4" />
                    ITV próxima a vencer (
                    {(vehiclesItvExpiring as typeof vehiclesItvExpiring).length})
                  </div>
                  <div className="space-y-2">
                    {(vehiclesItvExpiring as typeof vehiclesItvExpiring).map((v) => {
                      const daysLeft = v.itvValidUntil
                        ? Math.floor(
                            (v.itvValidUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                          )
                        : null
                      return (
                        <div key={v.id} className="flex items-center justify-between gap-2">
                          <Link
                            href={v.sellerLead?.id ? `/vendedores/${v.sellerLead.id}` : '#'}
                            className="truncate text-[13px] text-[#2a2622] hover:underline"
                          >
                            {v.brand} {v.model} {v.year ?? ''}
                          </Link>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${daysLeft !== null && daysLeft < 15 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}
                          >
                            {daysLeft !== null ? (daysLeft < 0 ? 'Vencida' : `${daysLeft}d`) : '—'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {(vehiclesChargesPending as typeof vehiclesChargesPending).length > 0 && (
                <div
                  className="rounded-[14px] p-[22px]"
                  style={{
                    border: '1px solid #dc2626',
                    background: 'linear-gradient(180deg, #fff, #fef5f5)',
                  }}
                >
                  <div className="mb-4 flex items-center gap-2 text-[14px] font-semibold text-red-700">
                    <ShieldAlert className="h-4 w-4" />
                    Cargas DGT pendientes (
                    {(vehiclesChargesPending as typeof vehiclesChargesPending).length})
                  </div>
                  <div className="space-y-2">
                    {(vehiclesChargesPending as typeof vehiclesChargesPending).map((v) => {
                      const daysSince = Math.floor(
                        (now.getTime() - v.createdAt.getTime()) / (1000 * 60 * 60 * 24)
                      )
                      return (
                        <div key={v.id} className="flex items-center justify-between gap-2">
                          <Link
                            href={v.sellerLead?.id ? `/vendedores/${v.sellerLead.id}` : '#'}
                            className="truncate text-[13px] text-[#2a2622] hover:underline"
                          >
                            {v.brand} {v.model} {v.year ?? ''}
                          </Link>
                          <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                            {daysSince}d
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

      {/* ── Detalle por estado ─────────────────────────────────────────────── */}
      <SectionEyebrow label="Detalle por estado" color="info" />
      <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-3">
        {/* Vendedores */}
        <div className="rounded-[14px] border border-[#e6dfd0] bg-white p-[22px]">
          <div className="mb-4 flex items-baseline justify-between">
            <h4 className="text-[14px] font-semibold tracking-[-0.005em]">Vendedores</h4>
            <span className="font-mono text-[10px] tracking-[0.1em] text-[#6b645c]">
              TOTAL {sellerTotal}
            </span>
          </div>
          {(
            [
              'NUEVO',
              'CONTACTADO',
              'CUALIFICADO',
              'EN_NEGOCIACION',
              'CERRADO',
              'DESCARTADO',
            ] as SellerLeadStatus[]
          ).map((status, i) => (
            <div
              key={status}
              className="flex items-center gap-3 py-2 text-[13px]"
              style={{ borderTop: i > 0 ? '1px solid #e6dfd0' : 'none' }}
            >
              <span
                className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ background: STATUS_DOTS[status] }}
              />
              <span className="flex-1 text-[#2a2622]">{SELLER_LEAD_STATUS_LABELS[status]}</span>
              <span className="font-mono font-semibold text-[#0a0a0a]">
                {sellerMap.get(status) ?? 0}
              </span>
            </div>
          ))}
        </div>

        {/* Compradores */}
        <div className="rounded-[14px] border border-[#e6dfd0] bg-white p-[22px]">
          <div className="mb-4 flex items-baseline justify-between">
            <h4 className="text-[14px] font-semibold tracking-[-0.005em]">Compradores</h4>
            <span className="font-mono text-[10px] tracking-[0.1em] text-[#6b645c]">
              TOTAL {buyerTotal}
            </span>
          </div>
          {(
            [
              'NUEVO',
              'CONTACTADO',
              'CUALIFICADO',
              'EN_NEGOCIACION',
              'CERRADO',
              'PERDIDO',
            ] as BuyerLeadStatus[]
          ).map((status, i) => (
            <div
              key={status}
              className="flex items-center gap-3 py-2 text-[13px]"
              style={{ borderTop: i > 0 ? '1px solid #e6dfd0' : 'none' }}
            >
              <span
                className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ background: STATUS_DOTS[status] }}
              />
              <span className="flex-1 text-[#2a2622]">{BUYER_LEAD_STATUS_LABELS[status]}</span>
              <span className="font-mono font-semibold text-[#0a0a0a]">
                {buyerMap.get(status) ?? 0}
              </span>
            </div>
          ))}
        </div>

        {/* Vehículos */}
        <div className="rounded-[14px] border border-[#e6dfd0] bg-white p-[22px]">
          <div className="mb-4 flex items-baseline justify-between">
            <h4 className="text-[14px] font-semibold tracking-[-0.005em]">Vehículos</h4>
            <span className="font-mono text-[10px] tracking-[0.1em] text-[#6b645c]">
              TOTAL {vehiclesTotal}
            </span>
          </div>
          {(
            [
              'NUEVO',
              'TASADO',
              'PUBLICADO',
              'RESERVADO',
              'VENDIDO',
              'DESCARTADO',
            ] as VehicleStatus[]
          ).map((status, i) => (
            <div
              key={status}
              className="flex items-center gap-3 py-2 text-[13px]"
              style={{ borderTop: i > 0 ? '1px solid #e6dfd0' : 'none' }}
            >
              <span
                className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ background: STATUS_DOTS[status] }}
              />
              <span className="flex-1 text-[#2a2622]">{VEHICLE_STATUS_LABELS[status]}</span>
              <span className="font-mono font-semibold text-[#0a0a0a]">
                {vehicleMap.get(status) ?? 0}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Análisis avanzado (ADMIN) ──────────────────────────────────────── */}
      {isAdmin && (
        <>
          <SectionEyebrow label="Análisis avanzado" color="purple" />
          <div className="grid gap-[14px] lg:grid-cols-[1.4fr_1fr]">
            {/* Horizontal bar chart — vehículos por comercial */}
            <div className="rounded-[14px] border border-[#e6dfd0] bg-white p-[22px]">
              <h3 className="mb-[18px] text-[16px] font-semibold tracking-[-0.01em]">
                Vehículos por comercial
              </h3>
              {vehiclesPerCommercial.length === 0 ? (
                <p className="text-[13px] text-[#6b645c]">Sin datos.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {vehiclesPerCommercial.map((row, i) => (
                    <div
                      key={row.agentId}
                      className="grid items-center gap-3"
                      style={{ gridTemplateColumns: '100px 1fr 36px' }}
                    >
                      <span className="truncate text-[13px] font-medium">
                        {row.agentName.split(' ')[0]} {row.agentName.split(' ')[1]?.[0]}.
                      </span>
                      <div className="h-3.5 overflow-hidden rounded bg-[#f5f0e6]">
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${(row.active / barMax) * 100}%`,
                            background: barGrads[i % barGrads.length],
                          }}
                        />
                      </div>
                      <span className="text-right text-[14px] font-bold tabular-nums">
                        {row.active}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Mini stat cards */}
            <div className="flex flex-col gap-[14px]">
              <div className="rounded-[14px] border border-[#e6dfd0] bg-white px-[22px] py-[18px]">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b645c]">
                  Horas taller promedio / vehículo
                </div>
                <div className="mt-1.5 text-[26px] font-bold tabular-nums tracking-[-0.025em]">
                  {avgWorkshopHours?.averageHours != null
                    ? `${avgWorkshopHours.averageHours.toFixed(1)} h`
                    : '—'}
                </div>
                <div className="mt-0.5 text-[11.5px] text-[#6b645c]">
                  {avgWorkshopHours?.vehicleCount ?? 0} vehículos con órdenes completadas
                </div>
              </div>
              <div className="rounded-[14px] border border-[#e6dfd0] bg-white px-[22px] py-[18px]">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b645c]">
                  Coste postventa promedio / vehículo
                </div>
                <div
                  className="mt-1.5 text-[26px] font-bold tabular-nums tracking-[-0.025em]"
                  style={{
                    color:
                      avgPostventaCost?.averageCost != null && avgPostventaCost.averageCost > 200
                        ? '#dc2626'
                        : '#0a0a0a',
                  }}
                >
                  {avgPostventaCost?.averageCost != null
                    ? EUR.format(avgPostventaCost.averageCost)
                    : '—'}
                </div>
                <div className="mt-0.5 text-[11.5px] text-[#6b645c]">
                  {avgPostventaCost?.vehicleCount ?? 0} vehículos con incidencias en garantía
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Tiempo medio por estado ────────────────────────────────────────── */}
      <SectionEyebrow label="Tiempo medio por estado" color="teal" />
      <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-3">
        <TimeCard title="Vendedores" rows={sellerStateMedians} labels={SELLER_LEAD_STATUS_LABELS} />
        <TimeCard title="Compradores" rows={buyerStateMedians} labels={BUYER_LEAD_STATUS_LABELS} />
        <TimeCard title="Vehículos" rows={vehicleStateMedians} labels={VEHICLE_STATUS_LABELS} />
      </div>

      {/* ── Top vehículos por margen (ADMIN) ──────────────────────────────── */}
      {isAdmin && top5Rentabilidad.length > 0 && (
        <>
          <div className="mb-0 mt-9" />
          <div className="rounded-[14px] border border-[#e6dfd0] bg-white p-6">
            <h3 className="text-[16px] font-semibold tracking-[-0.01em]">
              Top vehículos por margen neto
            </h3>
            <p className="mb-[18px] mt-1 text-[12px] text-[#6b645c]">
              Ordenado por margen neto porcentual
            </p>
            {top5Rentabilidad.map((v, i) => {
              const maxMargin = top5Rentabilidad[0]?.netMarginPct ?? 1
              const barPct = maxMargin > 0 ? (v.netMarginPct / maxMargin) * 100 : 0
              return (
                <div
                  key={v.id}
                  className="grid items-center gap-[18px] py-3.5"
                  style={{
                    gridTemplateColumns: '24px 1fr 140px auto auto',
                    borderBottom: i < top5Rentabilidad.length - 1 ? '1px solid #e6dfd0' : 'none',
                  }}
                >
                  <span className="font-mono text-[11px] font-medium text-[#6b645c]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    {v.sellerLeadId ? (
                      <Link
                        href={`/vendedores/${v.sellerLeadId}`}
                        className="text-[14px] font-semibold hover:underline"
                      >
                        {v.brand} {v.model} {v.year ?? ''}
                      </Link>
                    ) : (
                      <span className="text-[14px] font-semibold">
                        {v.brand} {v.model} {v.year ?? ''}
                      </span>
                    )}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#f5f0e6]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(barPct, 2)}%`,
                        background: 'linear-gradient(90deg, #1f8a5b, #16a34a)',
                      }}
                    />
                  </div>
                  <span
                    className="text-[16px] font-bold tracking-[-0.02em]"
                    style={{ color: v.netMargin < 0 ? '#dc2626' : '#1f8a5b' }}
                  >
                    {v.netMargin >= 0 ? '+' : ''}
                    {v.netMargin.toLocaleString('es-ES', {
                      style: 'currency',
                      currency: 'EUR',
                      maximumFractionDigits: 0,
                    })}
                  </span>
                  <span className="w-[44px] text-right font-mono text-[12px] text-[#6b645c]">
                    {v.netMarginPct.toFixed(1)}%
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* bottom spacer */}
      <div className="h-16" />
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionEyebrow({
  label,
  color = 'info',
}: {
  label: string
  color?: 'info' | 'ok' | 'purple' | 'teal' | 'bad'
}) {
  const colorMap = {
    info: '#2563eb',
    ok: '#1f8a5b',
    purple: '#7c3aed',
    teal: '#0891b2',
    bad: '#dc2626',
  }
  const c = colorMap[color]
  return (
    <div
      className="mb-4 mt-9 flex items-center gap-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em]"
      style={{ color: c }}
    >
      <span className="inline-block h-[2px] w-3.5 rounded-sm" style={{ background: c }} />
      {label}
    </div>
  )
}

function MiniKPI({
  label,
  value,
  unit,
  sub,
  valueColor = 'default',
  subColor = 'default',
  variant = 'default',
}: {
  label: string
  value: string | number
  unit?: string
  sub?: string
  valueColor?: 'default' | 'ok' | 'bad' | 'warn' | 'info'
  subColor?: 'default' | 'up' | 'down'
  variant?: 'default' | 'alert' | 'danger'
}) {
  const borderStyle =
    variant === 'alert'
      ? { border: '1px solid #d97706', background: 'linear-gradient(180deg, #fff, #fffbf2)' }
      : variant === 'danger'
        ? { border: '1px solid #dc2626', background: 'linear-gradient(180deg, #fff, #fef5f5)' }
        : {}

  const valueColorMap = {
    default: '#0a0a0a',
    ok: '#1f8a5b',
    bad: '#dc2626',
    warn: '#d97706',
    info: '#2563eb',
  }

  const subColorMap = {
    default: '#6b645c',
    up: '#1f8a5b',
    down: '#dc2626',
  }

  return (
    <div
      className="flex flex-col gap-1 rounded-[12px] px-[18px] py-4"
      style={
        variant !== 'default' ? borderStyle : { border: '1px solid #e6dfd0', background: '#fff' }
      }
    >
      <span
        className={`font-mono text-[10px] font-semibold uppercase tracking-[0.12em]`}
        style={{ color: variant === 'alert' ? '#d97706' : '#6b645c' }}
      >
        {label}
      </span>
      <span
        className="mt-1 text-[22px] font-bold tabular-nums leading-[1.05] tracking-[-0.025em]"
        style={{ color: valueColorMap[valueColor] }}
      >
        {value}
        {unit && <span className="ml-0.5 text-[14px] font-medium text-[#6b645c]"> {unit}</span>}
      </span>
      {sub && (
        <span className="mt-0.5 text-[11.5px]" style={{ color: subColorMap[subColor] }}>
          <span className="font-semibold">{sub}</span>
        </span>
      )}
    </div>
  )
}

function TimeCard<T extends string>({
  title,
  rows,
  labels,
}: {
  title: string
  rows: StateMedianRow<T>[]
  labels: Record<T, string>
}) {
  return (
    <div className="rounded-[14px] border border-[#e6dfd0] bg-white p-[22px]">
      <h4 className="mb-3.5 text-[14px] font-semibold tracking-[-0.005em]">{title}</h4>
      {/* Column header */}
      <div
        className="grid items-center gap-3 pb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[#b3aca0]"
        style={{ gridTemplateColumns: '12px 1fr 60px 30px' }}
      >
        <span />
        <span>Estado</span>
        <span className="text-right">Mediana</span>
        <span className="text-right">n</span>
      </div>
      {rows.length === 0 ? (
        <p className="py-3 text-[13px] text-[#6b645c]">Sin transiciones completadas.</p>
      ) : (
        rows.map((r, i) => (
          <div
            key={r.status}
            className="grid items-center gap-3 py-[9px] text-[13px]"
            style={{
              gridTemplateColumns: '12px 1fr 60px 30px',
              borderTop: '1px solid #e6dfd0',
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: TIME_DOTS[i % TIME_DOTS.length] }}
            />
            <span className="text-[#2a2622]">{labels[r.status]}</span>
            <span className="text-right font-bold tabular-nums">{formatDuration(r.medianMs)}</span>
            <span className="text-right font-mono text-[11px] text-[#6b645c]">{r.sampleSize}</span>
          </div>
        ))
      )}
    </div>
  )
}
