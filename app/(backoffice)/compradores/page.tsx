import Link from 'next/link'
import { Columns3, List, Plus } from 'lucide-react'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { leadListView } from '@/lib/lead-list-view'
import { buyerSearchWhere } from '@/lib/buyer-search'
import { BuyerPreview } from './buyer-preview'
import { BuyerListFilters } from './buyer-list-filters'
import { BuyerStatusSelect } from './buyer-status-select'
import { BuyerNextActionControl, BuyerQuickSelect } from './buyer-quick-controls'
import { buyerSourceFilter } from '@/lib/buyer-source'
import { BUYER_LEAD_STATUS_LABELS } from '@/lib/state-machine'
import { landingCaptureSelection } from '@/lib/landing/attribution'
import { LandingAttribution } from '@/components/landing-attribution'
import { SearchRequestBadge } from '@/components/search-request-badge'
import { Card, ActionableTable, ButtonLink, EmptyState, type Column } from '@/components/redesign'
import { cn } from '@/lib/utils'
import type { Prisma } from '@prisma/client'

const PAGE_SIZE = 50

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  CAMPER: 'Camper',
  AUTOCARAVANA: 'Autocaravana',
}

const EUR = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

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
  temp?: string
  sort?: string
  dir?: string
  page?: string
  view?: string
}

function buildWhere(
  sp: SearchParams,
  viewConditions: Prisma.BuyerLeadWhereInput
): Prisma.BuyerLeadWhereInput {
  const conditions: Prisma.BuyerLeadWhereInput[] = [{ mergedIntoId: null }]

  if (sp.q) {
    const q = sp.q.trim()
    conditions.push(buyerSearchWhere(q))
  }

  if (sp.status) {
    if (Object.hasOwn(BUYER_LEAD_STATUS_LABELS, sp.status)) {
      conditions.push({ status: sp.status as Prisma.EnumBuyerLeadStatusFilter['equals'] })
    }
  }

  if (sp.agentId) {
    if (sp.agentId === '__none__') conditions.push({ agentId: null })
    else conditions.push({ agentId: sp.agentId })
  }

  if (sp.vehicleType) {
    if (sp.vehicleType === 'CAMPER' || sp.vehicleType === 'AUTOCARAVANA') {
      conditions.push({ vehicleType: sp.vehicleType })
    }
  }

  if (sp.source) {
    conditions.push(buyerSourceFilter(sp.source))
  }

  if (sp.temp && (sp.temp === 'HOT' || sp.temp === 'WARM' || sp.temp === 'COLD')) {
    conditions.push({ temperature: sp.temp })
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

const VIEWS = [
  { key: 'mis_leads', label: 'Mis leads' },
  { key: 'todos', label: 'Todos' },
  { key: 'sin_asignar', label: 'Sin asignar' },
  { key: 'con_matches', label: 'Con matches' },
  { key: 'esta_semana', label: 'Esta semana' },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CompradoresPage({ searchParams }: { searchParams: SearchParams }) {
  const currentUser = await requireAgente()
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const view = leadListView(searchParams.view, 'mis_leads', searchParams.agentId)

  const viewConditions = buildViewConditions(view === 'todos' ? null : view, currentUser.id)
  const where = buildWhere(searchParams, viewConditions)
  const orderBy = buildOrderBy(searchParams)

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const [
    total,
    leads,
    agents,
    sinAsignarCount,
    conMatchesCount,
    estaSemanaCount,
    assignableAgents,
    misLeadsCount,
    todosCount,
  ] = await Promise.all([
    db.buyerLead.count({ where }),
    db.buyerLead.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        activities: landingCaptureSelection,
        agent: { select: { id: true, name: true } },
        _count: { select: { matches: true } },
      },
    }),
    db.user.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.buyerLead.count({ where: { mergedIntoId: null, agentId: null } }),
    db.buyerLead.count({ where: { mergedIntoId: null, matches: { some: {} } } }),
    db.buyerLead.count({ where: { mergedIntoId: null, createdAt: { gte: sevenDaysAgo } } }),
    db.user.findMany({
      where: { active: true, role: { in: ['ADMIN', 'AGENTE'] } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    db.buyerLead.count({ where: { mergedIntoId: null, agentId: currentUser.id } }),
    db.buyerLead.count({ where: { mergedIntoId: null } }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  const viewCounts: Record<string, number | undefined> = {
    mis_leads: misLeadsCount,
    todos: todosCount,
    sin_asignar: sinAsignarCount,
    con_matches: conMatchesCount,
    esta_semana: estaSemanaCount,
  }

  function viewUrl(v: string) {
    const sp = new URLSearchParams(searchParams as Record<string, string>)
    sp.delete('page')
    if (v === 'mis_leads') sp.delete('agentId')
    sp.set('view', v)
    const qs = sp.toString()
    return `/compradores${qs ? `?${qs}` : ''}`
  }

  function pageUrl(p: number) {
    const sp = new URLSearchParams(searchParams as Record<string, string>)
    if (p > 1) sp.set('page', String(p))
    else sp.delete('page')
    const qs = sp.toString()
    return `/compradores${qs ? `?${qs}` : ''}`
  }

  type Lead = (typeof leads)[number]

  const leadRef = (lead: Lead) => ({
    leadId: lead.id,
    buyerName: lead.name,
    updatedAt: lead.updatedAt.toISOString(),
  })

  const prefs = (l: Lead) => {
    const parts: string[] = []
    parts.push(
      l.vehicleType ? (VEHICLE_TYPE_LABELS[l.vehicleType] ?? l.vehicleType) : 'Cualquier tipo'
    )
    if (l.minSeats) parts.push(`${l.minSeats} plazas`)
    return parts.join(' · ')
  }

  function identity(l: Lead) {
    const initials = l.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toLocaleUpperCase('es')
    return (
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-tint text-xs font-bold text-brand"
        >
          {initials}
        </span>
        <div className="min-w-0">
          <div className="break-words text-sm font-bold leading-tight text-ink">{l.name}</div>
          <div className="mt-1 text-xs font-medium text-ink2">{prefs(l)}</div>
          <SearchRequestBadge leadId={l.id} className="mt-1" />
        </div>
      </div>
    )
  }
  function demand(l: Lead) {
    return (
      <div className="space-y-1">
        <div className="text-[13px] font-semibold tabular-nums text-ink">
          {l.maxBudget != null ? EUR(Number(l.maxBudget)) : 'Sin presupuesto'}
        </div>
        <div className="text-xs font-medium text-ink2">
          {l._count.matches} {l._count.matches === 1 ? 'coincidencia' : 'coincidencias'}
        </div>
      </div>
    )
  }
  function status(l: Lead) {
    return <BuyerStatusSelect leadId={l.id} status={l.status} buyerName={l.name} />
  }
  function nextAction(l: Lead) {
    return (
      <BuyerNextActionControl
        {...leadRef(l)}
        nextActionType={l.nextActionType}
        nextActionDueAt={l.nextActionDueAt?.toISOString() ?? null}
      />
    )
  }
  function owner(l: Lead) {
    return (
      <BuyerQuickSelect
        {...leadRef(l)}
        field="agentId"
        value={l.agentId}
        agentName={l.agent?.name ?? null}
        agents={assignableAgents}
      />
    )
  }
  function source(l: Lead) {
    return (
      <div>
        <BuyerQuickSelect {...leadRef(l)} field="source" value={l.source} />
        <LandingAttribution activities={l.activities} compact />
      </div>
    )
  }
  function temperature(l: Lead) {
    return <BuyerQuickSelect {...leadRef(l)} field="temperature" value={l.temperature} />
  }
  function preview(l: Lead) {
    return (
      <BuyerPreview name={l.name} href={`/compradores/${l.id}`}>
        <div className="rounded-xl bg-canvas p-4">
          <p className="mb-1 text-sm font-semibold">{prefs(l)}</p>
          {demand(l)}
          <SearchRequestBadge leadId={l.id} className="mt-2" />
        </div>
        <dl className="mt-4 divide-y divide-line2">
          {[
            { label: 'Estado', control: status(l) },
            { label: 'Próxima acción', control: nextAction(l) },
            { label: 'Temperatura', control: temperature(l) },
            { label: 'Responsable', control: owner(l) },
            { label: 'Origen', control: source(l) },
          ].map(({ label, control }) => (
            <div
              key={label}
              className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2 py-3"
            >
              <dt className="text-sm font-medium text-ink2">{label}</dt>
              <dd>{control}</dd>
            </div>
          ))}
        </dl>
      </BuyerPreview>
    )
  }
  const columns: Column<Lead>[] = [
    { key: 'buyer', header: 'Comprador', cell: identity },
    {
      key: 'followup',
      header: 'Seguimiento',
      rowLink: false,
      cell: (l) => (
        <div className="grid justify-items-start gap-1">
          {status(l)}
          {nextAction(l)}
        </div>
      ),
    },
    { key: 'demand', header: 'Presupuesto', cell: demand },
    {
      key: 'contact',
      header: 'Origen y temperatura',
      rowLink: false,
      cell: (l) => (
        <div className="grid justify-items-start gap-1.5">
          {source(l)}
          {temperature(l)}
        </div>
      ),
    },
    { key: 'owner', header: 'Responsable', rowLink: false, cell: owner },
    {
      key: 'preview',
      header: <span className="sr-only">Vista rápida</span>,
      rowLink: false,
      cell: preview,
    },
  ]
  const filtered = [
    'q',
    'status',
    'agentId',
    'vehicleType',
    'source',
    'dateFrom',
    'dateTo',
    'budgetMin',
    'seatsMin',
    'temp',
  ].some((key) => searchParams[key as keyof SearchParams])
  return (
    <div className="min-w-0 font-hanken">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-3xl font-bold tracking-tight text-ink">Compradores</h1>
          <span
            aria-label={`${total} resultados`}
            className="rounded-full border border-line bg-card px-2.5 py-0.5 text-sm font-semibold tabular-nums text-ink2"
          >
            {total}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {currentUser.role === 'ADMIN' && (
            <ButtonLink href="/compradores/duplicados" variant="secondary">
              Revisar duplicados
            </ButtonLink>
          )}
          <ButtonLink href="/compradores/nuevo" variant="primary">
            <Plus size={15} className="mr-1.5" />
            Nuevo comprador
          </ButtonLink>
        </div>
      </header>
      <Card pad={false} className="min-w-0 shadow-sm">
        <div className="flex flex-wrap-reverse items-center justify-between gap-x-3 gap-y-1 px-3 pt-2 sm:px-4">
          <nav aria-label="Vistas de compradores" className="flex min-w-0 flex-wrap gap-x-3">
            {VIEWS.map((v) => (
              <Link
                key={v.key}
                href={viewUrl(v.key)}
                aria-current={view === v.key ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-1.5 border-b-2 px-1 py-2.5 text-[13px] font-semibold focus-visible:ring-2 focus-visible:ring-ring',
                  view === v.key
                    ? 'border-brand text-brand'
                    : 'border-transparent text-ink2 hover:text-ink'
                )}
              >
                {v.label}
                <span
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-[10px] tabular-nums',
                    view === v.key ? 'bg-brand-tint' : 'bg-canvas'
                  )}
                >
                  {viewCounts[v.key]}
                </span>
              </Link>
            ))}
          </nav>
          <nav
            aria-label="Presentación"
            className="my-1 inline-flex gap-1 rounded-lg bg-canvas p-1 text-xs font-semibold"
          >
            <span
              aria-current="page"
              className="inline-flex items-center gap-1.5 rounded-md bg-card px-2 py-1 text-ink shadow-sm"
            >
              <List size={14} />
              Lista
            </span>
            <Link
              href="/compradores/pipeline"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-ink2 hover:text-brand"
            >
              <Columns3 size={14} />
              Pipeline
            </Link>
          </nav>
        </div>
        <BuyerListFilters agents={agents} />
        <ActionableTable
          columns={columns}
          rows={leads}
          rowKey={(l) => l.id}
          rowHref={(l) => `/compradores/${l.id}`}
          className="[&_td]:px-3 [&_th]:px-3 [&_thead]:bg-canvas"
          mobileCard={(l) => (
            <div className="flex flex-wrap items-start justify-between gap-3">
              {identity(l)}
              {demand(l)}
            </div>
          )}
          mobileCardActions={(l) => (
            <div className="grid gap-2 border-t border-line2 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                {status(l)}
                {nextAction(l)}
              </div>
              <div className="flex flex-wrap items-start gap-2">
                {temperature(l)}
                {owner(l)}
                {source(l)}
              </div>
              <div>{preview(l)}</div>
            </div>
          )}
          empty={
            <EmptyState
              title={
                filtered
                  ? 'Ningún comprador coincide con los filtros'
                  : 'Sin compradores en esta vista'
              }
              description={
                filtered
                  ? 'Prueba otra búsqueda o ajusta los filtros.'
                  : 'Puedes consultar todos los compradores o dar de alta uno nuevo.'
              }
              cta={
                filtered
                  ? {
                      label: 'Limpiar filtros',
                      href: `/compradores?view=${encodeURIComponent(view)}`,
                    }
                  : { label: 'Nuevo comprador', href: '/compradores/nuevo' }
              }
            />
          }
        />
        {/* Paginación */}
        {total > PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
            <p className="font-hanken text-[12.5px] text-ink2">
              {from}–{to} de {total}
            </p>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <Link
                  href={pageUrl(page - 1)}
                  className="rounded-[9px] border border-line bg-card px-3 py-1.5 font-hanken text-[12.5px] font-semibold text-ink2 hover:bg-canvas"
                >
                  Anterior
                </Link>
              )}
              <span className="font-mono text-[12px] text-ink3">
                {page} / {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={pageUrl(page + 1)}
                  className="rounded-[9px] border border-line bg-card px-3 py-1.5 font-hanken text-[12.5px] font-semibold text-ink2 hover:bg-canvas"
                >
                  Siguiente
                </Link>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
