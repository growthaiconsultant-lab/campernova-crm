import Link from 'next/link'
import { Plus, Clock } from 'lucide-react'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { LeadsFilters } from './leads-filters'
import { SELLER_DEAL_TYPE_LABELS } from '@/lib/deal-terms'
import { NEXT_ACTION_LABELS, isNextActionOverdue } from '@/lib/next-action'
import {
  Eyebrow,
  Card,
  ActionableTable,
  HexPill,
  ButtonLink,
  EmptyState,
  type Column,
} from '@/components/redesign'
import { cn } from '@/lib/utils'
import type { Prisma, SellerLeadStatus, LeadCanal, VehicleStatus } from '@prisma/client'

const PAGE_SIZE = 50
const TERMINAL_STATUSES: SellerLeadStatus[] = ['CERRADO', 'DESCARTADO']
const STOCK_STATUSES: VehicleStatus[] = ['TASADO', 'PUBLICADO', 'RESERVADO']

const STATUS_LABELS: Record<string, string> = {
  NUEVO: 'Nuevo',
  CONTACTADO: 'Contactado',
  CUALIFICADO: 'Tasado',
  EN_NEGOCIACION: 'En negociación',
  CERRADO: 'Cerrado',
  DESCARTADO: 'Descartado',
}

// Color de estado (semáforo del handoff)
const STATUS_HEX: Record<string, string> = {
  NUEVO: '#3a6fd4',
  CONTACTADO: '#7c3aed',
  CUALIFICADO: '#0891b2',
  EN_NEGOCIACION: '#c9820a',
  CERRADO: '#1a9d5f',
  DESCARTADO: '#8b94a3',
}

const CANAL_LABELS: Record<LeadCanal, string> = {
  CN: 'Backoffice',
  PRO: 'Formulario web',
}

const EUR = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

function relativeDays(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / 86400000)
  if (days === 0) return 'hoy'
  if (days === 1) return 'ayer'
  return `hace ${days}d`
}

// ── SearchParams / where ──────────────────────────────────────────────────────

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
    if (sp.agentId === '__none__') conditions.push({ agentId: null })
    else conditions.push({ agentId: sp.agentId })
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
    if (!isNaN(n)) conditions.push({ vehicle: { desiredPrice: { lte: n } } })
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

const VIEWS = [
  { key: 'todos', label: 'Todos' },
  { key: 'stock', label: 'Stock' },
  { key: 'leads-web', label: 'Leads web' },
  { key: 'sin-tasar', label: 'Sin tasar' },
  { key: 'sin-asignar', label: 'Sin asignar' },
  { key: 'necesitan-accion', label: 'Necesitan acción' },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function VendedoresPage({ searchParams }: { searchParams: SearchParams }) {
  const currentUser = await requireAuth()
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const view = searchParams.view ?? 'todos'

  const twoDaysAgo = new Date()
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
  const startOfWeek = new Date()
  startOfWeek.setDate(startOfWeek.getDate() - 7)

  const viewConditions = buildViewConditions(
    view === 'todos' ? null : view,
    currentUser.id,
    twoDaysAgo,
    startOfWeek
  )
  const where = buildWhere(searchParams, viewConditions)
  const orderBy = buildOrderBy(searchParams)

  const [total, leads, agents] = await Promise.all([
    db.sellerLead.count({ where }),
    db.sellerLead.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        agent: { select: { id: true, name: true } },
        vehicle: {
          select: {
            brand: true,
            model: true,
            year: true,
            type: true,
            desiredPrice: true,
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

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  function viewUrl(v: string) {
    const sp = new URLSearchParams()
    if (searchParams.q) sp.set('q', searchParams.q)
    if (searchParams.status) sp.set('status', searchParams.status)
    if (searchParams.agentId) sp.set('agentId', searchParams.agentId)
    if (v !== 'todos') sp.set('view', v)
    const qs = sp.toString()
    return `/vendedores${qs ? `?${qs}` : ''}`
  }

  function pageUrl(p: number) {
    const sp = new URLSearchParams(searchParams as Record<string, string>)
    if (p > 1) sp.set('page', String(p))
    else sp.delete('page')
    const qs = sp.toString()
    return `/vendedores${qs ? `?${qs}` : ''}`
  }

  type Lead = (typeof leads)[number]

  const columns: Column<Lead>[] = [
    {
      key: 'seller',
      header: 'Vendedor',
      cell: (l) => (
        <div>
          <div className="text-ink">{l.name}</div>
          <div className="mt-0.5 text-[11px] font-medium text-ink3">
            {CANAL_LABELS[l.canal]} · {relativeDays(l.createdAt)}
          </div>
        </div>
      ),
    },
    {
      key: 'vehicle',
      header: 'Vehículo',
      cell: (l) =>
        l.vehicle ? (
          <div>
            <div className="text-[12.5px] text-ink">
              {l.vehicle.brand} {l.vehicle.model}
            </div>
            <div className="mt-0.5 text-[11px] font-medium text-ink3">
              {l.vehicle.year} · {l.vehicle.type === 'CAMPER' ? 'Camper' : 'Autocaravana'}
            </div>
          </div>
        ) : (
          <span className="text-ink3">Sin vehículo</span>
        ),
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (l) => <HexPill hex={STATUS_HEX[l.status]}>{STATUS_LABELS[l.status]}</HexPill>,
    },
    {
      key: 'valuation',
      header: 'Tasación',
      align: 'right',
      cell: (l) => {
        const rec = l.vehicle?.valuationRecommended
        if (!rec) return <span className="font-mono text-ink3">Sin tasar</span>
        const recN = Number(rec)
        const desired = l.vehicle?.desiredPrice ? Number(l.vehicle.desiredPrice) : null
        const max = l.vehicle?.valuationMax ? Number(l.vehicle.valuationMax) : null
        const over = desired && max && desired > max * 1.15
        return (
          <div>
            <div className="font-mono text-[12px] font-semibold text-ink">{EUR(recN)}</div>
            {over && <div className="text-[9.5px] font-medium text-warn">⚠ sobreprecio</div>}
          </div>
        )
      },
    },
    {
      key: 'deal',
      header: 'Acuerdo',
      cell: (l) =>
        l.dealType ? (
          <span className="font-medium text-ink2">{SELLER_DEAL_TYPE_LABELS[l.dealType]}</span>
        ) : (
          <span className="text-ink3">—</span>
        ),
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
            {NEXT_ACTION_LABELS[l.nextActionType]}
          </span>
        )
      },
    },
    {
      key: 'agent',
      header: 'Resp.',
      cell: (l) => <span className="font-medium text-ink2">{l.agent?.name ?? 'Sin asignar'}</span>,
    },
  ]

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>CRM · Oferta</Eyebrow>
          <h1 className="mt-1 font-hanken text-[23px] font-bold tracking-[-0.02em] text-ink">
            Vendedores
          </h1>
          <p className="mt-1 font-hanken text-[13.5px] text-ink2">
            <b className="text-ink">{total}</b> vendedor{total === 1 ? '' : 'es'}
          </p>
        </div>
        <ButtonLink href="/vendedores/nuevo" variant="primary">
          <Plus size={15} strokeWidth={2.2} className="mr-1.5" />
          Nuevo vendedor
        </ButtonLink>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {VIEWS.map((v) => {
          const active = view === v.key
          return (
            <Link
              key={v.key}
              href={viewUrl(v.key)}
              className={cn(
                'inline-flex items-center rounded-[9px] border px-3 py-1.5 font-hanken text-[12.5px] font-semibold transition-colors',
                active
                  ? 'border-brand bg-brand-tint text-brand'
                  : 'border-line bg-card text-ink2 hover:bg-canvas'
              )}
            >
              {v.label}
            </Link>
          )
        })}
      </div>

      <div className="mb-4">
        <LeadsFilters agents={agents} />
      </div>

      <Card pad={false}>
        <ActionableTable
          columns={columns}
          rows={leads}
          rowKey={(l) => l.id}
          rowHref={(l) => `/vendedores/${l.id}`}
          mobileCard={(l) => (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-hanken text-[13.5px] font-semibold text-ink">
                  {l.name}
                </span>
                <HexPill hex={STATUS_HEX[l.status]} className="shrink-0">
                  {STATUS_LABELS[l.status]}
                </HexPill>
              </div>
              <div className="mt-0.5 font-hanken text-[11.5px] font-medium text-ink3">
                {l.vehicle
                  ? `${l.vehicle.brand} ${l.vehicle.model} · ${l.vehicle.year}`
                  : 'Sin vehículo'}{' '}
                · {CANAL_LABELS[l.canal]}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                {l.nextActionType && l.nextActionDueAt ? (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 font-hanken text-[12px] font-medium',
                      isNextActionOverdue(l.nextActionDueAt) ? 'text-bad' : 'text-ink2'
                    )}
                  >
                    <Clock size={12} strokeWidth={2} className="shrink-0" />
                    {NEXT_ACTION_LABELS[l.nextActionType]}
                  </span>
                ) : (
                  <span className="font-hanken text-[12px] text-ink3">Sin próxima acción</span>
                )}
                <span className="shrink-0 font-mono text-[12px] font-semibold text-ink">
                  {l.vehicle?.valuationRecommended
                    ? EUR(Number(l.vehicle.valuationRecommended))
                    : 'Sin tasar'}
                </span>
              </div>
            </>
          )}
          empty={
            <EmptyState
              title="Sin vendedores que mostrar"
              description="Aquí verás los vehículos a captar y en stock: origen, estado, tasación y tipo de acuerdo. Da de alta un vendedor o convierte una captación."
              cta={{ label: 'Nuevo vendedor', href: '/vendedores/nuevo' }}
            />
          }
        />
      </Card>

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
