import Link from 'next/link'
import { Suspense } from 'react'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { LeadsFilters } from './leads-filters'
import { buildWhatsAppUrl } from '@/lib/whatsapp'
import type { Prisma, SellerLeadStatus, LeadCanal, VehicleStatus } from '@prisma/client'

const PAGE_SIZE = 50

// ── Pipeline stages ───────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { key: 'NUEVO', label: 'Nuevo', color: '#3a6fd4' },
  { key: 'CONTACTADO', label: 'Contactado', color: '#7c3aed' },
  { key: 'CUALIFICADO', label: 'Tasado', color: '#0891b2' },
  { key: 'EN_NEGOCIACION', label: 'Negociación', color: '#c9820a' },
  { key: 'CERRADO', label: 'Cerrado', color: '#1a9d5f' },
  { key: 'DESCARTADO', label: 'Descartado', color: '#8b94a3' },
]

const TERMINAL_STATUSES: SellerLeadStatus[] = ['CERRADO', 'DESCARTADO']

// "Stock real" = vehículos que custodiamos y estamos vendiendo (no leads sin cualificar)
const STOCK_STATUSES: VehicleStatus[] = ['TASADO', 'PUBLICADO', 'RESERVADO']

// ── Status pills ──────────────────────────────────────────────────────────────

const STATUS_PILLS: Record<string, { bg: string; text: string; dot: string }> = {
  NUEVO: { bg: '#eff6ff', text: '#3a6fd4', dot: '#3a6fd4' },
  CONTACTADO: { bg: '#f5f3ff', text: '#7c3aed', dot: '#7c3aed' },
  CUALIFICADO: { bg: '#ecfeff', text: '#0891b2', dot: '#0891b2' },
  EN_NEGOCIACION: { bg: '#fffbeb', text: '#c9820a', dot: '#c9820a' },
  CERRADO: { bg: '#f0fdf4', text: '#1a9d5f', dot: '#1a9d5f' },
  DESCARTADO: { bg: '#eef1f5', text: '#586173', dot: '#cbd5e1' },
}

const STATUS_LABELS: Record<string, string> = {
  NUEVO: 'Nuevo',
  CONTACTADO: 'Contactado',
  CUALIFICADO: 'Tasado',
  EN_NEGOCIACION: 'En negociación',
  CERRADO: 'Cerrado',
  DESCARTADO: 'Descartado',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function relativeDays(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / 86400000)
  if (days === 0) return 'hoy'
  if (days === 1) return 'ayer'
  return `hace ${days} d`
}

function formatDate(date: Date): string {
  return date
    .toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })
    .toUpperCase()
}

function formatK(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n))
}

function formatPrice(n: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

function getAvatarGradient(name: string): string {
  const colors: [string, string][] = [
    ['#3a6fd4', '#7c3aed'],
    ['#7c3aed', '#0891b2'],
    ['#1a9d5f', '#0891b2'],
    ['#c9820a', '#d64545'],
    ['#0891b2', '#3a6fd4'],
  ]
  const idx = name.charCodeAt(0) % colors.length
  const pair = colors[idx]
  const a = pair[0]
  const b = pair[1]
  return `linear-gradient(135deg, ${a}, ${b})`
}

function getRowFlag(status: string, lastActivityAt: Date | null, createdAt: Date): string | null {
  if (TERMINAL_STATUSES.includes(status as SellerLeadStatus)) return null
  const ref = lastActivityAt ?? createdAt
  const days = Math.floor((Date.now() - ref.getTime()) / 86400000)
  if (days > 7) return '#d64545'
  if (days > 2) return '#c9820a'
  return null
}

// ── SearchParams ──────────────────────────────────────────────────────────────

type SearchParams = {
  q?: string
  status?: string
  agentId?: string
  canal?: string
  brand?: string
  priceMax?: string
  sort?: string
  dir?: string
  page?: string
  view?: string
}

// ── buildWhere ────────────────────────────────────────────────────────────────

function buildViewConditions(
  view: string | null,
  currentUserId: string,
  twoDaysAgo: Date,
  startOfWeek: Date
): Prisma.SellerLeadWhereInput {
  if (view === 'stock') return { vehicle: { status: { in: STOCK_STATUSES } } }
  if (view === 'leads-web')
    return {
      canal: 'PRO',
      status: { notIn: TERMINAL_STATUSES },
      OR: [{ vehicle: null }, { vehicle: { valuationRecommended: null } }],
    }
  if (view === 'mis-leads') return { agentId: currentUserId, status: { notIn: TERMINAL_STATUSES } }
  if (view === 'sin-asignar') return { agentId: null, status: { notIn: TERMINAL_STATUSES } }
  if (view === 'sin-tasar')
    return {
      status: { notIn: TERMINAL_STATUSES },
      OR: [{ vehicle: null }, { vehicle: { valuationRecommended: null } }],
    }
  if (view === 'necesitan-accion')
    return {
      status: { notIn: TERMINAL_STATUSES },
      activities: { none: { createdAt: { gte: twoDaysAgo } } },
    }
  if (view === 'esta-semana') return { createdAt: { gte: startOfWeek } }
  return {}
}

function buildWhere(
  sp: SearchParams,
  viewConditions: Prisma.SellerLeadWhereInput
): Prisma.SellerLeadWhereInput {
  const conditions: Prisma.SellerLeadWhereInput[] = []

  if (sp.q) {
    const q = sp.q.trim()
    conditions.push({
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { vehicle: { brand: { contains: q, mode: 'insensitive' } } },
        { vehicle: { model: { contains: q, mode: 'insensitive' } } },
      ],
    })
  }

  if (sp.status) {
    const valid: SellerLeadStatus[] = [
      'NUEVO',
      'CONTACTADO',
      'CUALIFICADO',
      'EN_NEGOCIACION',
      'CERRADO',
      'DESCARTADO',
    ]
    if (valid.includes(sp.status as SellerLeadStatus)) {
      conditions.push({ status: sp.status as SellerLeadStatus })
    }
  }

  if (sp.agentId) {
    if (sp.agentId === '__none__') {
      conditions.push({ agentId: null })
    } else {
      conditions.push({ agentId: sp.agentId })
    }
  }

  if (sp.canal) {
    const validCanals: LeadCanal[] = ['CN', 'PRO']
    if (validCanals.includes(sp.canal as LeadCanal)) {
      conditions.push({ canal: sp.canal as LeadCanal })
    }
  }

  if (sp.brand) {
    conditions.push({ vehicle: { brand: { contains: sp.brand, mode: 'insensitive' } } })
  }

  if (sp.priceMax) {
    const n = parseFloat(sp.priceMax)
    if (!isNaN(n)) {
      conditions.push({ vehicle: { desiredPrice: { lte: n } } })
    }
  }

  const all = [...(Object.keys(viewConditions).length > 0 ? [viewConditions] : []), ...conditions]
  return all.length > 0 ? { AND: all } : {}
}

function buildOrderBy(sp: SearchParams): Prisma.SellerLeadOrderByWithRelationInput {
  const dir = sp.dir === 'asc' ? 'asc' : 'desc'
  if (sp.sort === 'updatedAt') return { updatedAt: dir }
  if (sp.sort === 'desiredPrice') return { vehicle: { desiredPrice: dir } }
  return { createdAt: dir }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function VendedoresPage({ searchParams }: { searchParams: SearchParams }) {
  const currentUser = await requireAuth()
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const view = searchParams.view ?? 'todos'

  const now = new Date()
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)
  const startOfWeek = (() => {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - d.getDay())
    return d
  })()

  const viewConditions = buildViewConditions(
    view === 'todos' ? null : view,
    currentUser.id,
    twoDaysAgo,
    startOfWeek
  )
  const where = buildWhere(searchParams, viewConditions)
  const orderBy = buildOrderBy(searchParams)

  const [
    pipelineGroups,
    misLeadsCount,
    sinAsignarCount,
    sinTasarCount,
    necesitanAccionCount,
    estaSemanaCout,
    stockCount,
    leadsWebCount,
    closed30,
    created30,
    total,
    leads,
    agents,
  ] = await Promise.all([
    db.sellerLead.groupBy({ by: ['status'], _count: { _all: true } }),
    db.sellerLead.count({
      where: { agentId: currentUser.id, status: { notIn: TERMINAL_STATUSES } },
    }),
    db.sellerLead.count({
      where: { agentId: null, status: { notIn: TERMINAL_STATUSES } },
    }),
    db.sellerLead.count({
      where: {
        status: { notIn: TERMINAL_STATUSES },
        OR: [{ vehicle: null }, { vehicle: { valuationRecommended: null } }],
      },
    }),
    db.sellerLead.count({
      where: {
        status: { notIn: TERMINAL_STATUSES },
        activities: { none: { createdAt: { gte: twoDaysAgo } } },
      },
    }),
    db.sellerLead.count({ where: { createdAt: { gte: startOfWeek } } }),
    db.sellerLead.count({ where: { vehicle: { status: { in: STOCK_STATUSES } } } }),
    db.sellerLead.count({
      where: {
        canal: 'PRO',
        status: { notIn: TERMINAL_STATUSES },
        OR: [{ vehicle: null }, { vehicle: { valuationRecommended: null } }],
      },
    }),
    db.sellerLead.count({ where: { status: 'CERRADO', updatedAt: { gte: thirtyDaysAgo } } }),
    db.sellerLead.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.sellerLead.count({ where }),
    db.sellerLead.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        agent: { select: { id: true, name: true } },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
        vehicle: {
          select: {
            id: true,
            brand: true,
            model: true,
            year: true,
            km: true,
            seats: true,
            type: true,
            desiredPrice: true,
            valuationMin: true,
            valuationRecommended: true,
            valuationMax: true,
            status: true,
          },
        },
      },
    }),
    db.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  // ── Derived ───────────────────────────────────────────────────────────────

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  const pipelineMap: Record<string, number> = {}
  let pipelineTotal = 0
  for (const g of pipelineGroups) {
    pipelineMap[g.status] = g._count._all
    pipelineTotal += g._count._all
  }
  const pipelineMax = Math.max(...Array.from(Object.values(pipelineMap)), 1)
  const convRate30 = created30 > 0 ? Math.round((closed30 / created30) * 100) : 0

  // Needs action count (flag !== null in the visible page)
  const needsActionCount = leads.filter((lead) => {
    const lastAct = lead.activities[0]?.createdAt ?? null
    return getRowFlag(lead.status, lastAct, lead.createdAt) !== null
  }).length

  // ── URL helpers ───────────────────────────────────────────────────────────

  function pageUrl(p: number) {
    const sp = new URLSearchParams()
    if (searchParams.q) sp.set('q', searchParams.q)
    if (searchParams.status) sp.set('status', searchParams.status)
    if (searchParams.agentId) sp.set('agentId', searchParams.agentId)
    if (searchParams.canal) sp.set('canal', searchParams.canal)
    if (searchParams.brand) sp.set('brand', searchParams.brand)
    if (searchParams.priceMax) sp.set('priceMax', searchParams.priceMax)
    if (searchParams.sort) sp.set('sort', searchParams.sort)
    if (searchParams.dir) sp.set('dir', searchParams.dir)
    if (view && view !== 'todos') sp.set('view', view)
    if (p > 1) sp.set('page', String(p))
    const qs = sp.toString()
    return `/vendedores${qs ? `?${qs}` : ''}`
  }

  function viewUrl(v: string) {
    const sp = new URLSearchParams()
    if (searchParams.q) sp.set('q', searchParams.q)
    if (searchParams.status) sp.set('status', searchParams.status)
    if (searchParams.agentId) sp.set('agentId', searchParams.agentId)
    if (searchParams.canal) sp.set('canal', searchParams.canal)
    if (searchParams.brand) sp.set('brand', searchParams.brand)
    if (searchParams.priceMax) sp.set('priceMax', searchParams.priceMax)
    if (searchParams.sort) sp.set('sort', searchParams.sort)
    if (v !== 'todos') sp.set('view', v)
    const qs = sp.toString()
    return `/vendedores${qs ? `?${qs}` : ''}`
  }

  function stageUrl(stageKey: string) {
    const sp = new URLSearchParams()
    if (searchParams.q) sp.set('q', searchParams.q)
    if (searchParams.agentId) sp.set('agentId', searchParams.agentId)
    if (searchParams.canal) sp.set('canal', searchParams.canal)
    if (searchParams.brand) sp.set('brand', searchParams.brand)
    if (searchParams.priceMax) sp.set('priceMax', searchParams.priceMax)
    if (searchParams.sort) sp.set('sort', searchParams.sort)
    if (view && view !== 'todos') sp.set('view', view)
    // Toggle: clicking active stage removes filter
    if (searchParams.status !== stageKey) sp.set('status', stageKey)
    const qs = sp.toString()
    return `/vendedores${qs ? `?${qs}` : ''}`
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="-mx-6 -mt-6">
      {/* ── Topbar ─────────────────────────────────────────────── */}
      <header className="z-20 flex min-h-[64px] items-center justify-between border-b border-[#e6e9ee] bg-white px-4 py-2 md:px-10 lg:sticky lg:top-0 lg:h-[73px] lg:py-0">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#586173]">
            CRM · Oferta
          </div>
          <h1 className="mt-1 text-[22px] font-bold tracking-tight text-[#141922]">Vendedores</h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="hidden items-center gap-2 rounded-lg border border-[#e6e9ee] bg-white px-4 py-2 text-[13px] font-medium text-[#141922] transition-colors hover:border-primary sm:inline-flex">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Exportar
          </button>
          <Link
            href="/vendedores/nuevo"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-primary/90"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nuevo lead
          </Link>
        </div>
      </header>

      <div className="px-4 pb-16 pt-6 md:px-10">
        {/* ── Pipeline strip ─────────────────────────────────────── */}
        <div className="mb-5 overflow-x-auto rounded-xl border border-[#e6e9ee] bg-white">
          <div
            className="min-w-[820px] items-stretch"
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto repeat(6, 1fr) auto',
            }}
          >
            {/* Total */}
            <div className="flex flex-col justify-center border-r border-[#e6e9ee] px-6 py-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#586173]">
                Total
              </div>
              <div className="mt-1 font-mono text-[26px] font-bold leading-none tracking-tight text-[#141922]">
                {pipelineTotal}
              </div>
            </div>

            {/* Stages */}
            {PIPELINE_STAGES.map((stage) => {
              const count = pipelineMap[stage.key] ?? 0
              const pct = Math.round((count / pipelineMax) * 100)
              return (
                <Link
                  key={stage.key}
                  href={stageUrl(stage.key)}
                  className="group cursor-pointer rounded-lg px-4 py-3 transition-colors hover:bg-[#f8fafc]"
                >
                  <div className="text-[11.5px] font-medium text-[#586173]">{stage.label}</div>
                  <div
                    className="mt-0.5 text-[22px] font-bold leading-none tracking-tight"
                    style={{ color: count > 0 ? stage.color : '#cbd5e1' }}
                  >
                    {count}
                  </div>
                  <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-[#eef1f5]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: stage.color }}
                    />
                  </div>
                </Link>
              )
            })}

            {/* Conv. 30d */}
            <div className="flex flex-col justify-center border-l border-[#e6e9ee] px-5 py-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#586173]">
                Conv. 30d
              </div>
              <div
                className="mt-1 font-mono text-[22px] font-bold leading-none tracking-tight"
                style={{ color: '#1a9d5f' }}
              >
                {convRate30}%
              </div>
            </div>
          </div>
        </div>

        {/* ── Views tabs ─────────────────────────────────────────── */}
        <div className="-mx-4 mb-4 flex items-center justify-between border-b border-[#e6e9ee] px-4 md:-mx-10 md:px-10">
          <div className="flex items-center overflow-x-auto whitespace-nowrap">
            {[
              { key: 'todos', label: 'Todos', count: pipelineTotal },
              { key: 'stock', label: 'Stock', count: stockCount },
              { key: 'leads-web', label: 'Leads web', count: leadsWebCount },
              { key: 'mis-leads', label: 'Mis leads', count: misLeadsCount },
              { key: 'sin-asignar', label: 'Sin asignar', count: sinAsignarCount },
              { key: 'sin-tasar', label: 'Sin tasar', count: sinTasarCount },
              { key: 'necesitan-accion', label: 'Necesitan acción', count: necesitanAccionCount },
              { key: 'esta-semana', label: 'Esta semana', count: estaSemanaCout },
            ].map(({ key, label, count }) => {
              const isActive = view === key
              return (
                <Link
                  key={key}
                  href={viewUrl(key)}
                  className={`flex items-center gap-2 border-b-2 px-4 py-3 text-[13px] font-medium transition-colors ${
                    isActive
                      ? 'border-primary text-[#141922]'
                      : 'border-transparent text-[#586173] hover:text-[#141922]'
                  }`}
                  style={{ marginBottom: '-1px' }}
                >
                  {label}
                  <span
                    className="rounded-full px-1.5 py-0.5 font-mono text-[11px] font-medium"
                    style={
                      isActive
                        ? { background: '#141922', color: '#fff' }
                        : { background: '#eef1f5', color: '#586173' }
                    }
                  >
                    {count}
                  </span>
                </Link>
              )
            })}
          </div>
          {/* Decorative "Guardar vista" */}
          <div className="hidden shrink-0 items-center gap-1.5 pb-2 text-[11px] font-medium text-[#586173] md:flex">
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            Guardar vista actual
          </div>
        </div>

        {/* ── Filter bar ─────────────────────────────────────────── */}
        <Suspense>
          <LeadsFilters agents={agents} />
        </Suspense>

        {/* ── Table ──────────────────────────────────────────────── */}
        <div className="overflow-x-auto rounded-xl border border-[#e6e9ee] bg-white">
          <div className="min-w-[980px]">
            {/* Header */}
            <div
              className="border-b border-[#e6e9ee] bg-[#f8fafc] font-mono text-[10px] uppercase tracking-[0.12em] text-[#586173]"
              style={{
                display: 'grid',
                gridTemplateColumns: '32px 2fr 1.6fr 2.2fr 1.5fr 1fr 1fr 1.1fr 60px',
                gap: '14px',
                padding: '14px 20px',
                alignItems: 'center',
              }}
            >
              <div />
              <div>Vendedor</div>
              <div>Contacto</div>
              <div>Vehículo</div>
              <div>Tasación</div>
              <div>Estado</div>
              <div>Agente</div>
              <div>Entrada</div>
              <div />
            </div>

            {/* Empty state */}
            {leads.length === 0 && (
              <div className="px-6 py-14 text-center text-sm text-[#586173]">
                No hay vendedores con los filtros aplicados.
              </div>
            )}

            {/* Rows */}
            {leads.map((lead) => {
              const inits = initials(lead.name)
              const avatarGrad = getAvatarGradient(lead.name)
              const pill = STATUS_PILLS[lead.status] ?? STATUS_PILLS.NUEVO
              const lastAct = lead.activities[0]?.createdAt ?? null
              const flag = getRowFlag(lead.status, lastAct, lead.createdAt)

              // Days since last activity (for flag label)
              const refDate = lastAct ?? lead.createdAt
              const daysSince = Math.floor((Date.now() - refDate.getTime()) / 86400000)

              const vehicle = lead.vehicle
              const desiredPrice = vehicle?.desiredPrice ? Number(vehicle.desiredPrice) : null
              const valuationMin = vehicle?.valuationMin ? Number(vehicle.valuationMin) : null
              const valuationMax = vehicle?.valuationMax ? Number(vehicle.valuationMax) : null
              const valuationRecommended = vehicle?.valuationRecommended
                ? Number(vehicle.valuationRecommended)
                : null

              const hasValuation = valuationRecommended !== null
              const isOverpriced =
                desiredPrice !== null && valuationMax !== null && desiredPrice > valuationMax * 1.15

              // Canal labels
              const canalLabel = lead.canal === 'PRO' ? 'FORMULARIO WEB' : 'BACKOFFICE'
              const canalColor = lead.canal === 'PRO' ? '#c9820a' : '#586173'

              const waUrl = lead.phone
                ? buildWhatsAppUrl(
                    lead.phone,
                    `Hola ${lead.name.split(' ')[0]}, soy de CampersNova.`
                  )
                : null

              // Vehicle type colors
              const typeColors: Record<string, { bg: string; text: string; border: string }> = {
                CAMPER: { bg: '#eff6ff', text: '#3a6fd4', border: 'rgba(37,99,235,0.25)' },
                AUTOCARAVANA: { bg: '#f5f3ff', text: '#7c3aed', border: 'rgba(124,58,237,0.25)' },
              }
              const typeStyle = vehicle?.type
                ? (typeColors[vehicle.type] ?? {
                    bg: '#eef1f5',
                    text: '#475569',
                    border: '#e6e9ee',
                  })
                : null

              return (
                <div
                  key={lead.id}
                  className="group relative border-b border-[#eef1f5] text-[13.5px] transition-colors last:border-0 hover:bg-[#f8fafc]"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '32px 2fr 1.6fr 2.2fr 1.5fr 1fr 1fr 1.1fr 60px',
                    gap: '14px',
                    padding: '14px 20px',
                    alignItems: 'center',
                  }}
                >
                  {/* Row flag bar */}
                  {flag && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-sm"
                      style={{ width: '3px', height: '60%', background: flag }}
                    />
                  )}

                  {/* Checkbox */}
                  <div className="h-4 w-4 rounded border border-[#cbd5e1] bg-white" />

                  {/* VENDEDOR */}
                  <Link href={`/vendedores/${lead.id}`} className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                        style={{ background: avatarGrad }}
                      >
                        {inits}
                      </div>
                      <div className="min-w-0 leading-snug">
                        <div className="truncate text-[14px] font-semibold text-[#141922]">
                          {lead.name}
                        </div>
                        <div className="mt-0.5 font-mono text-[10.5px] text-[#586173]">
                          #{lead.id.slice(-8)}{' '}
                          <span className="font-semibold" style={{ color: canalColor }}>
                            {canalLabel}
                          </span>
                          {flag && (
                            <span className="ml-2 font-semibold" style={{ color: flag }}>
                              Sin contacto {daysSince}d
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>

                  {/* CONTACTO */}
                  <div className="min-w-0 leading-snug">
                    <div className="flex items-center gap-1.5 overflow-hidden text-[13px] text-[#141922]">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3 w-3 shrink-0 text-[#586173]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                      <span className="truncate">{lead.email}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[12px] text-[#586173]">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3 w-3 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
                      </svg>
                      {lead.phone ?? '—'}
                    </div>
                  </div>

                  {/* VEHÍCULO */}
                  <div className="min-w-0">
                    {vehicle ? (
                      <>
                        <div className="flex flex-wrap items-center gap-1">
                          {/* Brand+model pill */}
                          {(vehicle.brand || vehicle.model) && typeStyle && (
                            <span
                              className="truncate border font-bold"
                              style={{
                                background: typeStyle.bg,
                                color: typeStyle.text,
                                borderColor: typeStyle.border,
                                borderRadius: '4px',
                                padding: '2px 6px',
                                fontSize: '11px',
                                maxWidth: '120px',
                                display: 'inline-block',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {`${vehicle.brand ?? ''} ${vehicle.model ?? ''}`.trim().toUpperCase()}
                            </span>
                          )}
                          {/* Year badge */}
                          {vehicle.year && (
                            <span
                              className="border font-medium"
                              style={{
                                background: '#eef1f5',
                                color: '#475569',
                                borderColor: '#e6e9ee',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                fontSize: '11px',
                              }}
                            >
                              {vehicle.year}
                            </span>
                          )}
                          {/* KM badge */}
                          {vehicle.km != null && (
                            <span
                              className="border font-medium"
                              style={{
                                background: Number(vehicle.km) > 150000 ? '#fffbeb' : '#eef1f5',
                                color: Number(vehicle.km) > 150000 ? '#c9820a' : '#475569',
                                borderColor:
                                  Number(vehicle.km) > 150000 ? 'rgba(217,119,6,0.25)' : '#e6e9ee',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                fontSize: '11px',
                              }}
                            >
                              {Number(vehicle.km).toLocaleString('es-ES')} km
                            </span>
                          )}
                        </div>
                        {desiredPrice && (
                          <div className="mt-1 font-mono text-[12px] font-bold text-[#1a9d5f]">
                            Pide {formatPrice(desiredPrice)}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-[13px] italic text-[#8b94a3]">Sin vehículo</span>
                    )}
                  </div>

                  {/* TASACIÓN */}
                  <div className="flex flex-col items-start gap-0.5">
                    {hasValuation && valuationMin !== null && valuationMax !== null ? (
                      <>
                        <span
                          className="inline-flex items-center rounded-md border font-mono text-[12px] font-bold"
                          style={{
                            background: isOverpriced ? '#fffbeb' : '#f0fdf4',
                            color: isOverpriced ? '#c9820a' : '#1a9d5f',
                            borderColor: isOverpriced
                              ? 'rgba(217,119,6,0.25)'
                              : 'rgba(31,138,91,0.25)',
                            padding: '4px 8px',
                          }}
                        >
                          {formatK(valuationMin)}k – {formatK(valuationMax)}k
                        </span>
                        {isOverpriced && (
                          <span className="font-mono text-[11px]" style={{ color: '#c9820a' }}>
                            ⚠ sobreprecio
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span
                          className="inline-flex items-center rounded-md border border-dashed font-mono text-[12px] font-bold"
                          style={{
                            background: '#f8fafc',
                            color: '#8b94a3',
                            borderColor: '#e6e9ee',
                            padding: '4px 8px',
                          }}
                        >
                          — Sin tasar
                        </span>
                        {vehicle && (
                          <span className="font-mono text-[11px] text-[#8b94a3]">
                            Solicitar tasación
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* ESTADO */}
                  <div>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
                      style={{ background: pill.bg, color: pill.text }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: pill.dot }} />
                      {STATUS_LABELS[lead.status] ?? lead.status}
                    </span>
                  </div>

                  {/* AGENTE */}
                  <div className="flex items-center gap-2">
                    {lead.agent ? (
                      <>
                        <div
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                          style={{ background: 'linear-gradient(135deg, #3a6fd4, #7c3aed)' }}
                        >
                          {initials(lead.agent.name)}
                        </div>
                        <span className="text-[12.5px] text-[#141922]">{lead.agent.name}</span>
                      </>
                    ) : (
                      <>
                        <div
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed text-[14px] text-[#586173]"
                          style={{ borderColor: '#cbd5e1', background: '#eef1f5' }}
                        >
                          +
                        </div>
                        <span className="text-[12.5px] italic text-[#586173]">Sin asignar</span>
                      </>
                    )}
                  </div>

                  {/* ENTRADA */}
                  <div>
                    <div className="font-mono text-[12px] text-[#141922]">
                      {formatDate(lead.createdAt)}
                    </div>
                    <div className="mt-0.5 font-mono text-[10.5px] text-[#586173]">
                      {relativeDays(lead.createdAt)}
                    </div>
                  </div>

                  {/* ACTIONS */}
                  <div className="flex items-center justify-end gap-1 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-[#586173] hover:border-[#e6e9ee] hover:bg-white hover:text-[#25D366]"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.6}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" />
                        </svg>
                      </a>
                    )}
                    <Link
                      href={`/vendedores/${lead.id}`}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-[#586173] hover:border-[#e6e9ee] hover:bg-white hover:text-[#141922]"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="19" cy="12" r="1" />
                        <circle cx="5" cy="12" r="1" />
                      </svg>
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Table footer ─────────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6e9ee] px-4 py-4 md:px-6">
            <div className="text-[12.5px] text-[#586173]">
              Mostrando{' '}
              <strong className="text-[#141922]">
                {from}–{to}
              </strong>{' '}
              de <strong className="text-[#141922]">{total}</strong> vendedores
              {needsActionCount > 0 && (
                <>
                  {' '}
                  ·{' '}
                  <span className="font-semibold text-[#d64545]">
                    {needsActionCount} requieren acción
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {page > 1 ? (
                <Link
                  href={pageUrl(page - 1)}
                  className="rounded-md border border-[#e6e9ee] px-3 py-1.5 text-[12.5px] font-medium text-[#141922] hover:border-[#3a6fd4]"
                >
                  ← Anterior
                </Link>
              ) : (
                <button
                  disabled
                  className="rounded-md border border-[#e6e9ee] px-3 py-1.5 text-[12.5px] font-medium text-[#141922] opacity-40"
                >
                  ← Anterior
                </button>
              )}
              <span className="rounded-md bg-[#141922] px-2.5 py-1.5 font-mono text-[12px] text-white">
                {page}
              </span>
              {page < totalPages ? (
                <Link
                  href={pageUrl(page + 1)}
                  className="rounded-md border border-[#e6e9ee] px-3 py-1.5 text-[12.5px] font-medium text-[#141922] hover:border-[#3a6fd4]"
                >
                  Siguiente →
                </Link>
              ) : (
                <button
                  disabled
                  className="rounded-md border border-[#e6e9ee] px-3 py-1.5 text-[12.5px] font-medium text-[#141922] opacity-40"
                >
                  Siguiente →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
