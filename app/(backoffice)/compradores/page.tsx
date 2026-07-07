import Link from 'next/link'
import { Suspense } from 'react'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { BuyerListFilters } from './buyer-list-filters'
import { buildWhatsAppUrl } from '@/lib/whatsapp'
import type { Prisma } from '@prisma/client'

const PAGE_SIZE = 50

// ── Labels & helpers ──────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  NUEVO: 'Nuevo',
  CONTACTADO: 'Contactado',
  CUALIFICADO: 'Cualificado',
  EN_NEGOCIACION: 'En negociación',
  CERRADO: 'Cerrado',
  PERDIDO: 'Perdido',
}

const TIMELINE_LABELS: Record<string, string> = {
  menos_1_mes: '<1 mes',
  '1_3_meses': '1–3 meses',
  '3_6_meses': '3–6 meses',
  mas_6_meses: '+6 meses',
  sin_prisa: 'Sin prisa',
}

const SOURCE_LABELS: Record<string, string> = {
  CN: 'BACKOFFICE',
  PRO: 'FORMULARIO WEB',
  CHAT: 'CHAT WEB',
  CHAT_WEB: 'CHAT WEB',
  LLAMADA: 'LLAMADA',
}

const EQUIP_LABELS: Record<string, string> = {
  bathroom: 'baño',
  shower: 'ducha',
  heating: 'calefacción',
  solar: 'solar',
  kitchen: 'cocina',
}

// Pipeline stages config
const PIPELINE_STAGES = [
  { key: 'NUEVO', label: 'Nuevo', color: '#2563eb' },
  { key: 'CONTACTADO', label: 'Contactado', color: '#7c3aed' },
  { key: 'CUALIFICADO', label: 'Cualificado', color: '#0891b2' },
  { key: 'EN_NEGOCIACION', label: 'Negociación', color: '#d97706' },
  { key: 'CERRADO', label: 'Cerrado', color: '#1f8a5b' },
  { key: 'PERDIDO', label: 'Perdido', color: '#94a3b8' },
]

// Status pill styles (bg, text, dot)
const STATUS_PILLS: Record<string, { bg: string; text: string; dot: string }> = {
  NUEVO: { bg: '#eff6ff', text: '#2563eb', dot: '#2563eb' },
  CONTACTADO: { bg: '#f5f3ff', text: '#7c3aed', dot: '#7c3aed' },
  CUALIFICADO: { bg: '#ecfeff', text: '#0891b2', dot: '#0891b2' },
  EN_NEGOCIACION: { bg: '#fffbeb', text: '#d97706', dot: '#d97706' },
  CERRADO: { bg: '#f0fdf4', text: '#1f8a5b', dot: '#1f8a5b' },
  PERDIDO: { bg: '#f1f5f9', text: '#64748b', dot: '#cbd5e1' },
}

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

function getEquipmentLabels(equipment: unknown): string[] {
  if (!equipment || typeof equipment !== 'object') return []
  const eq = equipment as Record<string, boolean>
  return Object.entries(eq)
    .filter(([, v]) => v === true)
    .map(([k]) => EQUIP_LABELS[k] ?? k)
    .slice(0, 4)
}

function getAvatarGradient(name: string): string {
  const colors = [
    ['#2563eb', '#7c3aed'],
    ['#7c3aed', '#0891b2'],
    ['#1f8a5b', '#0891b2'],
    ['#d97706', '#dc2626'],
    ['#0891b2', '#2563eb'],
  ]
  const idx = name.charCodeAt(0) % colors.length
  const [a, b] = colors[idx]
  return `linear-gradient(135deg, ${a}, ${b})`
}

function getMatchPillStyle(score: number): { bg: string; text: string; border: string } {
  if (score >= 80) return { bg: '#f0fdf4', text: '#1f8a5b', border: 'rgba(31,138,91,0.2)' }
  if (score >= 60) return { bg: '#fffbeb', text: '#d97706', border: 'rgba(217,119,6,0.2)' }
  return { bg: '#eff6ff', text: '#2563eb', border: 'rgba(37,99,235,0.2)' }
}

function getRowFlag(status: string, updatedAt: Date): { color: string } | null {
  const daysSinceUpdate = Math.floor((Date.now() - updatedAt.getTime()) / 86400000)
  if (status === 'CERRADO') return { color: '#1f8a5b' }
  if ((status === 'NUEVO' || status === 'CONTACTADO') && daysSinceUpdate >= 8)
    return { color: '#dc2626' }
  if ((status === 'CUALIFICADO' || status === 'EN_NEGOCIACION') && daysSinceUpdate >= 5)
    return { color: '#d97706' }
  return null
}

// ── Search params → Prisma where ──────────────────────────────────────────────

type SearchParams = {
  q?: string
  status?: string
  agentId?: string
  vehicleType?: string
  source?: string
  dateFrom?: string
  dateTo?: string
  budgetMin?: string
  seatsMin?: string
  sort?: string
  dir?: string
  page?: string
  view?: string
}

function buildWhere(
  sp: SearchParams,
  viewConditions: Prisma.BuyerLeadWhereInput
): Prisma.BuyerLeadWhereInput {
  const conditions: Prisma.BuyerLeadWhereInput[] = []

  if (sp.q) {
    const q = sp.q.trim()
    conditions.push({
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ],
    })
  }

  if (sp.status) {
    const valid = ['NUEVO', 'CONTACTADO', 'CUALIFICADO', 'EN_NEGOCIACION', 'CERRADO', 'PERDIDO']
    if (valid.includes(sp.status)) {
      conditions.push({ status: sp.status as Prisma.EnumBuyerLeadStatusFilter['equals'] })
    }
  }

  if (sp.agentId) {
    if (sp.agentId === '__none__') {
      conditions.push({ agentId: null })
    } else {
      conditions.push({ agentId: sp.agentId })
    }
  }

  if (sp.vehicleType) {
    if (sp.vehicleType === 'CAMPER' || sp.vehicleType === 'AUTOCARAVANA') {
      conditions.push({ vehicleType: sp.vehicleType })
    }
  }

  if (sp.source) {
    if (sp.source === '__none__') {
      // "Backoffice" = leads creados a mano (sin source)
      conditions.push({ source: null })
    } else if (sp.source === 'CHAT') {
      // Chat web cubre ambas variantes históricas
      conditions.push({ source: { in: ['CHAT', 'CHAT_WEB'] } })
    } else {
      conditions.push({ source: sp.source })
    }
  }

  if (sp.budgetMin) {
    const n = parseFloat(sp.budgetMin)
    if (!isNaN(n)) conditions.push({ maxBudget: { gte: n } })
  }

  if (sp.seatsMin) {
    const n = parseInt(sp.seatsMin, 10)
    if (!isNaN(n)) conditions.push({ minSeats: { gte: n } })
  }

  if (sp.dateFrom) {
    const d = new Date(sp.dateFrom)
    if (!isNaN(d.getTime())) conditions.push({ createdAt: { gte: d } })
  }

  if (sp.dateTo) {
    const d = new Date(sp.dateTo)
    if (!isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999)
      conditions.push({ createdAt: { lte: d } })
    }
  }

  const all = [...(Object.keys(viewConditions).length ? [viewConditions] : []), ...conditions]
  return all.length > 0 ? { AND: all } : {}
}

function buildOrderBy(sp: SearchParams): Prisma.BuyerLeadOrderByWithRelationInput {
  const dir = sp.dir === 'asc' ? 'asc' : 'desc'
  if (sp.sort === 'updatedAt') return { updatedAt: dir }
  if (sp.sort === 'maxBudget') return { maxBudget: dir }
  return { createdAt: dir }
}

function buildViewConditions(
  view: string | null,
  currentUserId: string
): Prisma.BuyerLeadWhereInput {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  if (view === 'mis_leads') return { agentId: currentUserId }
  if (view === 'sin_asignar') return { agentId: null }
  if (view === 'con_matches') return { matches: { some: {} } }
  if (view === 'esta_semana') return { createdAt: { gte: sevenDaysAgo } }
  return {}
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CompradoresPage({ searchParams }: { searchParams: SearchParams }) {
  const currentUser = await requireAuth()
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const view = searchParams.view ?? 'todos'

  const viewConditions = buildViewConditions(view === 'todos' ? null : view, currentUser.id)
  const where = buildWhere(searchParams, viewConditions)
  const orderBy = buildOrderBy(searchParams)

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  // All queries in parallel
  const [total, leads, agents, pipelineGroups, sinAsignarCount, conMatchesCount, estaSemanaCout] =
    await Promise.all([
      db.buyerLead.count({ where }),
      db.buyerLead.findMany({
        where,
        orderBy,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          agent: { select: { id: true, name: true } },
          _count: { select: { matches: true } },
          matches: {
            orderBy: { score: 'desc' },
            take: 1,
            include: {
              vehicle: { select: { brand: true, model: true } },
            },
          },
        },
      }),
      db.user.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      db.buyerLead.groupBy({ by: ['status'], _count: { _all: true } }),
      db.buyerLead.count({ where: { agentId: null } }),
      db.buyerLead.count({ where: { matches: { some: {} } } }),
      db.buyerLead.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    ])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  // Pipeline totals
  const pipelineMap: Record<string, number> = {}
  let pipelineTotal = 0
  for (const g of pipelineGroups) {
    pipelineMap[g.status] = g._count._all
    pipelineTotal += g._count._all
  }
  const pipelineMax = Math.max(...Object.values(pipelineMap), 1)

  // Conversion rate (closed / total)
  const closedCount = pipelineMap['CERRADO'] ?? 0
  const convRate = pipelineTotal > 0 ? ((closedCount / pipelineTotal) * 100).toFixed(1) : '0.0'

  // Needs action count (for footer)
  const needsActionCount = leads.filter((l) => {
    const flag = getRowFlag(l.status, l.updatedAt)
    return flag !== null && flag.color !== '#1f8a5b'
  }).length

  // Page URL builder
  function pageUrl(p: number, extraParams?: Record<string, string>) {
    const sp = new URLSearchParams()
    if (searchParams.q) sp.set('q', searchParams.q)
    if (searchParams.status) sp.set('status', searchParams.status)
    if (searchParams.agentId) sp.set('agentId', searchParams.agentId)
    if (searchParams.vehicleType) sp.set('vehicleType', searchParams.vehicleType)
    if (searchParams.budgetMin) sp.set('budgetMin', searchParams.budgetMin)
    if (searchParams.seatsMin) sp.set('seatsMin', searchParams.seatsMin)
    if (searchParams.dateFrom) sp.set('dateFrom', searchParams.dateFrom)
    if (searchParams.dateTo) sp.set('dateTo', searchParams.dateTo)
    if (searchParams.sort) sp.set('sort', searchParams.sort)
    if (searchParams.dir) sp.set('dir', searchParams.dir)
    if (view && view !== 'todos') sp.set('view', view)
    for (const [k, v] of Object.entries(extraParams ?? {})) {
      if (v) sp.set(k, v)
      else sp.delete(k)
    }
    if (p > 1) sp.set('page', String(p))
    const qs = sp.toString()
    return `/compradores${qs ? `?${qs}` : ''}`
  }

  function viewUrl(v: string) {
    const sp = new URLSearchParams()
    if (searchParams.q) sp.set('q', searchParams.q)
    if (searchParams.status) sp.set('status', searchParams.status)
    if (searchParams.agentId) sp.set('agentId', searchParams.agentId)
    if (v !== 'todos') sp.set('view', v)
    const qs = sp.toString()
    return `/compradores${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="-mx-6 -mt-6">
      {/* ── Topbar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex h-[73px] items-center justify-between border-b border-[#e2e8f0] bg-white px-4 md:px-10">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748b]">
            CRM · Demanda
          </div>
          <h1 className="mt-1 text-[22px] font-bold tracking-tight text-[#0a0a0a]">Compradores</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/compradores/nuevo"
            className="inline-flex items-center gap-2 rounded-lg bg-[#0a0a0a] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#2563eb]"
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
            Nuevo comprador
          </Link>
        </div>
      </header>

      <div className="px-4 pb-16 pt-6 md:px-10">
        {/* ── Pipeline strip ─────────────────────────────────────── */}
        <div className="mb-5 overflow-x-auto rounded-xl border border-[#e2e8f0] bg-white">
          <div
            className="min-w-[820px] items-stretch"
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto repeat(6, 1fr) auto',
            }}
          >
            {/* Total */}
            <div className="flex flex-col justify-center border-r border-[#e2e8f0] px-6 py-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#64748b]">
                Total
              </div>
              <div className="mt-1 font-mono text-[26px] font-bold leading-none tracking-tight text-[#0a0a0a]">
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
                  href={`/compradores?status=${stage.key}`}
                  className="group cursor-pointer rounded-lg px-4 py-3 transition-colors hover:bg-[#f8fafc]"
                >
                  <div className="text-[11.5px] font-medium text-[#64748b]">{stage.label}</div>
                  <div
                    className="mt-0.5 text-[22px] font-bold leading-none tracking-tight"
                    style={{ color: count > 0 ? stage.color : '#cbd5e1' }}
                  >
                    {count}
                  </div>
                  <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-[#f1f5f9]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: stage.color }}
                    />
                  </div>
                </Link>
              )
            })}

            {/* Conversion */}
            <div className="flex flex-col justify-center border-l border-[#e2e8f0] px-5 py-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#64748b]">
                Conv. total
              </div>
              <div
                className="mt-1 font-mono text-[22px] font-bold leading-none tracking-tight"
                style={{ color: '#1f8a5b' }}
              >
                {convRate}%
              </div>
            </div>
          </div>
        </div>

        {/* ── Views tabs ─────────────────────────────────────────── */}
        <div className="-mx-4 mb-4 flex items-center overflow-x-auto whitespace-nowrap border-b border-[#e2e8f0] px-4 md:-mx-10 md:px-10">
          {[
            { key: 'todos', label: 'Todos', count: pipelineTotal },
            { key: 'sin_asignar', label: 'Sin asignar', count: sinAsignarCount },
            { key: 'con_matches', label: 'Con matches', count: conMatchesCount },
            { key: 'esta_semana', label: 'Esta semana', count: estaSemanaCout },
          ].map(({ key, label, count }) => {
            const isActive = view === key
            return (
              <Link
                key={key}
                href={viewUrl(key)}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-[13px] font-medium transition-colors ${
                  isActive
                    ? 'border-[#0a0a0a] text-[#0a0a0a]'
                    : 'border-transparent text-[#64748b] hover:text-[#0a0a0a]'
                }`}
                style={{ marginBottom: '-1px' }}
              >
                {label}
                <span
                  className="rounded-full px-1.5 py-0.5 font-mono text-[11px] font-medium"
                  style={
                    isActive
                      ? { background: '#0a0a0a', color: '#fff' }
                      : { background: '#f1f5f9', color: '#64748b' }
                  }
                >
                  {count}
                </span>
              </Link>
            )
          })}
        </div>

        {/* ── Filter bar ─────────────────────────────────────────── */}
        <Suspense>
          <BuyerListFilters agents={agents} />
        </Suspense>

        {/* ── Table ──────────────────────────────────────────────── */}
        <div className="overflow-x-auto rounded-xl border border-[#e2e8f0] bg-white">
          <div className="min-w-[980px]">
            {/* Table header */}
            <div
              className="border-b border-[#e2e8f0] bg-[#f8fafc] font-mono text-[10px] uppercase tracking-[0.12em] text-[#64748b]"
              style={{
                display: 'grid',
                gridTemplateColumns: '32px 2.2fr 2fr 2.6fr 1fr 1fr 1fr 1.1fr 80px',
                gap: '14px',
                padding: '14px 20px',
                alignItems: 'center',
              }}
            >
              <div />
              <div>Lead</div>
              <div>Contacto</div>
              <div>Búsqueda</div>
              <div>Match</div>
              <div>Estado</div>
              <div>Agente</div>
              <div>Entrada</div>
              <div />
            </div>

            {/* Empty state */}
            {leads.length === 0 && (
              <div className="px-6 py-14 text-center text-sm text-[#64748b]">
                No hay compradores con los filtros aplicados.
              </div>
            )}

            {/* Rows */}
            {leads.map((lead) => {
              const inits = initials(lead.name)
              const avatarGrad = getAvatarGradient(lead.name)
              const pill = STATUS_PILLS[lead.status] ?? STATUS_PILLS.NUEVO
              const flag = getRowFlag(lead.status, lead.updatedAt)
              const equipList = getEquipmentLabels(lead.criticalEquipment)
              const matchCount = lead._count.matches
              const bestMatch = lead.matches[0]
              const bestScore = bestMatch ? Math.round(Number(bestMatch.score)) : null
              const bestVehicle = bestMatch?.vehicle
                ? `${bestMatch.vehicle.brand} ${bestMatch.vehicle.model}`
                : null
              const sourceLabel = lead.source
                ? (SOURCE_LABELS[lead.source] ?? lead.source)
                : 'BACKOFFICE'
              const waUrl = lead.phone
                ? buildWhatsAppUrl(
                    lead.phone,
                    `Hola ${lead.name.split(' ')[0]}, soy de CampersNova.`
                  )
                : null

              return (
                <div
                  key={lead.id}
                  className="group relative border-b border-[#f1f5f9] text-[13.5px] transition-colors last:border-0 hover:bg-[#f8fafc]"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '32px 2.2fr 2fr 2.6fr 1fr 1fr 1fr 1.1fr 80px',
                    gap: '14px',
                    padding: '14px 20px',
                    alignItems: 'center',
                  }}
                >
                  {/* Row flag */}
                  {flag && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-sm"
                      style={{ width: '3px', height: '60%', background: flag.color }}
                    />
                  )}

                  {/* Checkbox */}
                  <div className="h-4 w-4 rounded border border-[#cbd5e1] bg-white" />

                  {/* Lead name + meta */}
                  <Link href={`/compradores/${lead.id}`} className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                        style={{ background: avatarGrad }}
                      >
                        {inits}
                      </div>
                      <div className="min-w-0 leading-snug">
                        <div className="truncate text-[14px] font-semibold text-[#0a0a0a]">
                          {lead.name}
                        </div>
                        <div className="mt-0.5 font-mono text-[10.5px] text-[#64748b]">
                          #{lead.id.slice(-8)}{' '}
                          <span className="font-semibold text-[#7c3aed]">{sourceLabel}</span>
                        </div>
                      </div>
                    </div>
                  </Link>

                  {/* Contact */}
                  <div className="min-w-0 leading-snug">
                    <div className="flex items-center gap-1.5 overflow-hidden text-[13px] text-[#0a0a0a]">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3 w-3 shrink-0 text-[#64748b]"
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
                    <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[12px] text-[#64748b]">
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
                      {lead.phone}
                    </div>
                  </div>

                  {/* Búsqueda */}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1">
                      {/* Type */}
                      {lead.vehicleType ? (
                        <span
                          className="rounded-full border px-2 py-0.5 text-[11.5px] font-bold"
                          style={{
                            background: '#eff6ff',
                            color: '#2563eb',
                            borderColor: 'rgba(37,99,235,0.2)',
                            letterSpacing: '0.02em',
                          }}
                        >
                          {lead.vehicleType}
                        </span>
                      ) : (
                        <span
                          className="rounded-full border px-2 py-0.5 text-[11.5px] italic"
                          style={{
                            background: '#f1f5f9',
                            color: '#64748b',
                            borderColor: '#e2e8f0',
                          }}
                        >
                          Cualquier tipo
                        </span>
                      )}

                      {/* Seats */}
                      {lead.minSeats && (
                        <span
                          className="rounded-full border px-2 py-0.5 text-[11.5px] font-medium"
                          style={{
                            background: '#f1f5f9',
                            color: '#1e293b',
                            borderColor: '#e2e8f0',
                          }}
                        >
                          {lead.minSeats}+ plazas
                        </span>
                      )}

                      {/* Zone */}
                      {lead.useZone && (
                        <span
                          className="rounded-full border px-2 py-0.5 text-[11.5px] font-medium"
                          style={{
                            background: '#ecfeff',
                            color: '#0891b2',
                            borderColor: 'rgba(8,145,178,0.2)',
                          }}
                        >
                          {lead.useZone}
                        </span>
                      )}

                      {/* Timeline */}
                      {lead.purchaseTimeline && (
                        <span
                          className="rounded-full border px-2 py-0.5 text-[11.5px] font-medium"
                          style={{
                            background: '#fffbeb',
                            color: '#d97706',
                            borderColor: 'rgba(217,119,6,0.2)',
                          }}
                        >
                          {TIMELINE_LABELS[lead.purchaseTimeline] ?? lead.purchaseTimeline}
                        </span>
                      )}
                    </div>

                    {/* Budget + equipment */}
                    <div className="mt-1.5 font-mono text-[12px]">
                      {lead.maxBudget ? (
                        <span style={{ color: '#1f8a5b', fontWeight: 700 }}>
                          hasta{' '}
                          {Number(lead.maxBudget).toLocaleString('es-ES', {
                            style: 'currency',
                            currency: 'EUR',
                            maximumFractionDigits: 0,
                          })}
                        </span>
                      ) : (
                        <span style={{ color: '#64748b' }}>Sin presupuesto definido</span>
                      )}
                      {equipList.length > 0 && (
                        <span style={{ color: '#94a3b8', margin: '0 4px' }}>·</span>
                      )}
                      <span style={{ color: '#64748b' }}>{equipList.join(', ')}</span>
                    </div>
                  </div>

                  {/* Match */}
                  <div className="flex flex-col items-start gap-1">
                    {matchCount === 0 ? (
                      <>
                        <span
                          className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-1 font-mono text-[11.5px] font-bold"
                          style={{
                            background: '#f1f5f9',
                            color: '#64748b',
                            borderColor: '#e2e8f0',
                          }}
                        >
                          — Sin matches
                        </span>
                        <span className="text-[11px]" style={{ color: '#cbd5e1' }}>
                          Cualificar lead
                        </span>
                      </>
                    ) : (
                      <>
                        {(() => {
                          const s = getMatchPillStyle(bestScore ?? 0)
                          return (
                            <span
                              className="inline-flex items-center gap-1 rounded-full border px-2 py-1 font-mono text-[11.5px] font-bold"
                              style={{ background: s.bg, color: s.text, borderColor: s.border }}
                            >
                              <span className="text-[13px]">{matchCount}</span> match
                              {matchCount !== 1 ? 'es' : ''}
                            </span>
                          )
                        })()}
                        {bestScore !== null && bestVehicle && (
                          <span className="text-[11px]" style={{ color: '#64748b' }}>
                            Mejor{' '}
                            <b style={{ color: '#1f8a5b', fontFamily: 'var(--font-mono)' }}>
                              {bestScore}%
                            </b>{' '}
                            · {bestVehicle}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Status pill */}
                  <div>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
                      style={{ background: pill.bg, color: pill.text }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: pill.dot }} />
                      {STATUS_LABELS[lead.status] ?? lead.status}
                    </span>
                  </div>

                  {/* Agent */}
                  <div className="flex items-center gap-2">
                    {lead.agent ? (
                      <>
                        <div
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                          style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}
                        >
                          {initials(lead.agent.name)}
                        </div>
                        <span className="text-[12.5px] text-[#1e293b]">{lead.agent.name}</span>
                      </>
                    ) : (
                      <>
                        <div
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed text-[14px] text-[#64748b]"
                          style={{ borderColor: '#cbd5e1', background: '#f1f5f9' }}
                        >
                          +
                        </div>
                        <span className="text-[12.5px] italic text-[#64748b]">Sin asignar</span>
                      </>
                    )}
                  </div>

                  {/* Date */}
                  <div>
                    <div className="font-mono text-[12px] text-[#1e293b]">
                      {formatDate(lead.createdAt)}
                    </div>
                    <div className="mt-0.5 font-mono text-[10.5px] text-[#64748b]">
                      {relativeDays(lead.createdAt)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-[#64748b] hover:border-[#e2e8f0] hover:bg-white hover:text-[#25D366]"
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
                      href={`/compradores/${lead.id}`}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-[#64748b] hover:border-[#e2e8f0] hover:bg-white hover:text-[#0a0a0a]"
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

          {/* ── Table footer ────────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e2e8f0] px-4 py-4 md:px-6">
            <div className="text-[12.5px] text-[#64748b]">
              Mostrando{' '}
              <strong className="text-[#0a0a0a]">
                {from}–{to}
              </strong>{' '}
              de <strong className="text-[#0a0a0a]">{total}</strong> compradores
              {needsActionCount > 0 && (
                <>
                  {' '}
                  ·{' '}
                  <span className="font-semibold text-[#dc2626]">
                    {needsActionCount} requieren acción
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {page > 1 ? (
                <Link
                  href={pageUrl(page - 1)}
                  className="rounded-md border border-[#e2e8f0] px-3 py-1.5 text-[12.5px] font-medium text-[#1e293b] hover:border-[#2563eb]"
                >
                  ← Anterior
                </Link>
              ) : (
                <button
                  disabled
                  className="rounded-md border border-[#e2e8f0] px-3 py-1.5 text-[12.5px] font-medium text-[#1e293b] opacity-40"
                >
                  ← Anterior
                </button>
              )}
              <span className="rounded-md bg-[#0a0a0a] px-2.5 py-1.5 font-mono text-[12px] text-white">
                {page}
              </span>
              {page < totalPages ? (
                <Link
                  href={pageUrl(page + 1)}
                  className="rounded-md border border-[#e2e8f0] px-3 py-1.5 text-[12.5px] font-medium text-[#1e293b] hover:border-[#2563eb]"
                >
                  Siguiente →
                </Link>
              ) : (
                <button
                  disabled
                  className="rounded-md border border-[#e2e8f0] px-3 py-1.5 text-[12.5px] font-medium text-[#1e293b] opacity-40"
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
