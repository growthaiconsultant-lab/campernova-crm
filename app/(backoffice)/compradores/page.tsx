import Link from 'next/link'
import { Plus, Clock } from 'lucide-react'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { BuyerListFilters } from './buyer-list-filters'
import { TEMPERATURE_LABELS } from '@/lib/lead-temperature'
import { NEXT_ACTION_LABELS, isNextActionOverdue, formatNextActionDue } from '@/lib/next-action'
import {
  Eyebrow,
  Card,
  ActionableTable,
  Pill,
  ButtonLink,
  EmptyState,
  type Column,
  type PillTone,
} from '@/components/redesign'
import { cn } from '@/lib/utils'
import type { Prisma, LeadTemperature } from '@prisma/client'

const PAGE_SIZE = 50

const STATUS_LABELS: Record<string, string> = {
  NUEVO: 'Nuevo',
  CONTACTADO: 'Contactado',
  CUALIFICADO: 'Cualificado',
  EN_NEGOCIACION: 'En negociación',
  CERRADO: 'Cerrado',
  PERDIDO: 'Perdido',
}

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  CAMPER: 'Camper',
  AUTOCARAVANA: 'Autocaravana',
}

const TEMP_TONE: Record<LeadTemperature, PillTone> = {
  HOT: 'bad',
  WARM: 'warn',
  COLD: 'neutral',
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
    if (sp.agentId === '__none__') conditions.push({ agentId: null })
    else conditions.push({ agentId: sp.agentId })
  }

  if (sp.vehicleType) {
    if (sp.vehicleType === 'CAMPER' || sp.vehicleType === 'AUTOCARAVANA') {
      conditions.push({ vehicleType: sp.vehicleType })
    }
  }

  if (sp.source) {
    if (sp.source === '__none__') conditions.push({ source: null })
    else if (sp.source === 'CHAT') conditions.push({ source: { in: ['CHAT', 'CHAT_WEB'] } })
    else conditions.push({ source: sp.source })
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
  { key: 'todos', label: 'Todos' },
  { key: 'sin_asignar', label: 'Sin asignar' },
  { key: 'con_matches', label: 'Con matches' },
  { key: 'esta_semana', label: 'Esta semana' },
]

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

  const [total, leads, agents, sinAsignarCount, conMatchesCount, estaSemanaCount] =
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
        },
      }),
      db.user.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      db.buyerLead.count({ where: { agentId: null } }),
      db.buyerLead.count({ where: { matches: { some: {} } } }),
      db.buyerLead.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    ])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  const viewCounts: Record<string, number | undefined> = {
    todos: total,
    sin_asignar: sinAsignarCount,
    con_matches: conMatchesCount,
    esta_semana: estaSemanaCount,
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

  function pageUrl(p: number) {
    const sp = new URLSearchParams(searchParams as Record<string, string>)
    if (p > 1) sp.set('page', String(p))
    else sp.delete('page')
    const qs = sp.toString()
    return `/compradores${qs ? `?${qs}` : ''}`
  }

  type Lead = (typeof leads)[number]

  const prefs = (l: Lead) => {
    const parts: string[] = []
    parts.push(
      l.vehicleType ? (VEHICLE_TYPE_LABELS[l.vehicleType] ?? l.vehicleType) : 'Cualquier tipo'
    )
    if (l.minSeats) parts.push(`${l.minSeats} plazas`)
    return parts.join(' · ')
  }

  const columns: Column<Lead>[] = [
    {
      key: 'buyer',
      header: 'Comprador',
      cell: (l) => (
        <div>
          <div className="text-ink">{l.name}</div>
          <div className="mt-0.5 text-[11px] font-medium text-ink3">{prefs(l)}</div>
        </div>
      ),
    },
    {
      key: 'temp',
      header: 'Temp.',
      cell: (l) =>
        l.temperature ? (
          <Pill tone={TEMP_TONE[l.temperature]} dot>
            {TEMPERATURE_LABELS[l.temperature]}
          </Pill>
        ) : (
          <span className="text-ink3">—</span>
        ),
    },
    {
      key: 'stage',
      header: 'Etapa',
      cell: (l) => <span className="font-medium text-ink2">{STATUS_LABELS[l.status]}</span>,
    },
    {
      key: 'next',
      header: 'Próxima acción',
      cell: (l) => {
        if (!l.nextActionType || !l.nextActionDueAt) return <span className="text-ink3">—</span>
        const overdue = isNextActionOverdue(l.nextActionDueAt)
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 font-medium',
              overdue ? 'text-bad' : 'text-ink2'
            )}
          >
            <Clock size={13} strokeWidth={2} className="shrink-0" />
            {NEXT_ACTION_LABELS[l.nextActionType]} · {formatNextActionDue(l.nextActionDueAt)}
          </span>
        )
      },
    },
    {
      key: 'budget',
      header: 'Presup.',
      mono: true,
      align: 'right',
      cell: (l) => (l.maxBudget ? EUR(Number(l.maxBudget)) : <span className="text-ink3">—</span>),
    },
    {
      key: 'match',
      header: 'Match',
      mono: true,
      align: 'center',
      cell: (l) =>
        l._count.matches > 0 ? (
          <span className="text-brand">{l._count.matches}</span>
        ) : (
          <span className="text-ink3">—</span>
        ),
    },
    {
      key: 'agent',
      header: 'Resp.',
      cell: (l) => <span className="font-medium text-ink2">{l.agent?.name ?? 'Sin asignar'}</span>,
    },
  ]

  return (
    <div>
      {/* Título de módulo + acción */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>CRM · Demanda</Eyebrow>
          <h1 className="mt-1 font-hanken text-[23px] font-bold tracking-[-0.02em] text-ink">
            Compradores
          </h1>
          <p className="mt-1 font-hanken text-[13.5px] text-ink2">
            <b className="text-ink">{total}</b> comprador{total === 1 ? '' : 'es'}
          </p>
        </div>
        <ButtonLink href="/compradores/nuevo" variant="primary">
          <Plus size={15} strokeWidth={2.2} className="mr-1.5" />
          Nuevo comprador
        </ButtonLink>
      </div>

      {/* Vistas guardadas */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {VIEWS.map((v) => {
          const active = view === v.key
          const count = viewCounts[v.key]
          return (
            <Link
              key={v.key}
              href={viewUrl(v.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-[9px] border px-3 py-1.5 font-hanken text-[12.5px] font-semibold transition-colors',
                active
                  ? 'border-brand bg-brand-tint text-brand'
                  : 'border-line bg-card text-ink2 hover:bg-canvas'
              )}
            >
              {v.label}
              {count !== undefined && (
                <span className={cn('font-mono text-[11px]', active ? 'text-brand' : 'text-ink3')}>
                  {count}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {/* Filtros */}
      <div className="mb-4">
        <BuyerListFilters agents={agents} />
      </div>

      {/* Tabla / bandeja */}
      <Card pad={false}>
        <ActionableTable
          columns={columns}
          rows={leads}
          rowKey={(l) => l.id}
          rowHref={(l) => `/compradores/${l.id}`}
          empty={
            <EmptyState
              title="Sin compradores que mostrar"
              description="Cuando entren leads de comprador (chat, formulario o alta manual) aparecerán aquí, ordenados por temperatura y próxima acción."
              cta={{ label: 'Nuevo comprador', href: '/compradores/nuevo' }}
            />
          }
        />
      </Card>

      {/* Paginación */}
      {total > PAGE_SIZE && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
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
    </div>
  )
}
