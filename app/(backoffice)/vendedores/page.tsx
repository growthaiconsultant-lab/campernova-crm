import Link from 'next/link'
import { Suspense } from 'react'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { LeadsFilters } from './leads-filters'
import { SellerLeadsTable } from './seller-leads-table'
import type { LeadRow } from './seller-leads-table'
import type { Prisma, SellerLeadStatus, LeadCanal } from '@prisma/client'

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

const PIPELINE_STAGES = [
  { key: 'NUEVO', label: 'Nuevo', color: '#0a0a0a' },
  { key: 'CONTACTADO', label: 'Contactado', color: '#584738' },
  { key: 'CUALIFICADO', label: 'Cualificado', color: '#7a6450' },
  { key: 'EN_NEGOCIACION', label: 'Negociación', color: '#b59e7d' },
  { key: 'CERRADO', label: 'Cerrado', color: '#6b7a4e' },
  { key: 'DESCARTADO', label: 'Desc.', color: '#b3aca0' },
] as const

const TERMINAL_STATUSES: SellerLeadStatus[] = ['CERRADO', 'DESCARTADO']

const MONO = {
  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
}

// ─── Types ───────────────────────────────────────────────────────────────────

type SearchParams = {
  q?: string
  status?: string
  agentId?: string
  canal?: string
  view?: string
  sort?: string
  dir?: string
  page?: string
  dateFrom?: string
  dateTo?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStartOfWeek(now: Date): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d
}

function buildViewWhere(
  view: string | undefined,
  currentUserId: string,
  now: Date
): Prisma.SellerLeadWhereInput {
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
  switch (view) {
    case 'mis-leads':
      return { agentId: currentUserId, status: { notIn: TERMINAL_STATUSES } }
    case 'sin-asignar':
      return { agentId: null, status: { notIn: TERMINAL_STATUSES } }
    case 'necesitan-accion':
      return {
        status: { notIn: TERMINAL_STATUSES },
        activities: { none: { createdAt: { gte: twoDaysAgo } } },
      }
    case 'esta-semana':
      return { createdAt: { gte: getStartOfWeek(now) } }
    default:
      return {}
  }
}

function buildFilterWhere(sp: SearchParams): Prisma.SellerLeadWhereInput {
  const c: Prisma.SellerLeadWhereInput[] = []

  if (sp.q) {
    const q = sp.q.trim()
    c.push({
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        {
          vehicle: {
            OR: [
              { brand: { contains: q, mode: 'insensitive' } },
              { model: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
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
      c.push({ status: sp.status as SellerLeadStatus })
    }
  }

  if (sp.agentId) {
    c.push(sp.agentId === '__none__' ? { agentId: null } : { agentId: sp.agentId })
  }

  if (sp.canal) {
    const validCanals: LeadCanal[] = ['CN', 'PRO']
    if (validCanals.includes(sp.canal as LeadCanal)) {
      c.push({ canal: sp.canal as LeadCanal })
    }
  }

  if (sp.dateFrom) {
    const d = new Date(sp.dateFrom)
    if (!isNaN(d.getTime())) c.push({ createdAt: { gte: d } })
  }
  if (sp.dateTo) {
    const d = new Date(sp.dateTo)
    if (!isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999)
      c.push({ createdAt: { lte: d } })
    }
  }

  return c.length > 0 ? { AND: c } : {}
}

function buildOrderBy(sp: SearchParams): Prisma.SellerLeadOrderByWithRelationInput {
  const dir = sp.dir === 'asc' ? 'asc' : 'desc'
  if (sp.sort === 'updatedAt') return { updatedAt: dir }
  if (sp.sort === 'desiredPrice') return { vehicle: { desiredPrice: dir } }
  return { createdAt: dir }
}

function mergeWhere(
  a: Prisma.SellerLeadWhereInput,
  b: Prisma.SellerLeadWhereInput
): Prisma.SellerLeadWhereInput {
  const hasA = Object.keys(a).length > 0
  const hasB = Object.keys(b).length > 0
  if (!hasA && !hasB) return {}
  if (!hasA) return b
  if (!hasB) return a
  return { AND: [a, b] }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function VendedoresPage({ searchParams }: { searchParams: SearchParams }) {
  const currentUser = await requireAuth()
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const now = new Date()
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const viewWhere = buildViewWhere(searchParams.view, currentUser.id, now)
  const filterWhere = buildFilterWhere(searchParams)
  const where = mergeWhere(viewWhere, filterWhere)
  const orderBy = buildOrderBy(searchParams)

  const [
    pipelineCounts,
    misLeadsCount,
    sinAsignarCount,
    necesitanAccionCount,
    estaSemanaCount,
    closedLast30,
    createdLast30,
    total,
    leads,
    agents,
  ] = await Promise.all([
    db.sellerLead.groupBy({ by: ['status'], _count: { id: true } }),
    db.sellerLead.count({
      where: { agentId: currentUser.id, status: { notIn: TERMINAL_STATUSES } },
    }),
    db.sellerLead.count({
      where: { agentId: null, status: { notIn: TERMINAL_STATUSES } },
    }),
    db.sellerLead.count({
      where: {
        status: { notIn: TERMINAL_STATUSES },
        activities: { none: { createdAt: { gte: twoDaysAgo } } },
      },
    }),
    db.sellerLead.count({ where: { createdAt: { gte: getStartOfWeek(now) } } }),
    db.sellerLead.count({ where: { status: 'CERRADO', updatedAt: { gte: thirtyDaysAgo } } }),
    db.sellerLead.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.sellerLead.count({ where }),
    db.sellerLead.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        vehicle: {
          select: {
            brand: true,
            model: true,
            year: true,
            km: true,
            seats: true,
            type: true,
            desiredPrice: true,
            valuationRecommended: true,
          },
        },
        agent: { select: { id: true, name: true } },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    }),
    db.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  // ── Derived data ──────────────────────────────────────────────────────────

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  const countByStatus = Object.fromEntries(pipelineCounts.map((c) => [c.status, c._count.id]))
  const pipelineTotal = pipelineCounts.reduce((s, c) => s + c._count.id, 0)
  const convRate30 = createdLast30 > 0 ? Math.round((closedLast30 / createdLast30) * 100) : 0

  const todosCount = pipelineTotal

  // ── Serialize for client ──────────────────────────────────────────────────

  const serializedLeads: LeadRow[] = leads.map((lead) => {
    const lastActivityAt = lead.activities[0]?.createdAt ?? lead.createdAt
    const daysSince = Math.floor((now.getTime() - lastActivityAt.getTime()) / (1000 * 60 * 60 * 24))
    const isTerminal = TERMINAL_STATUSES.includes(lead.status as SellerLeadStatus)
    const flag: 'hot' | 'warn' | null = isTerminal
      ? null
      : daysSince > 7
        ? 'hot'
        : daysSince > 2
          ? 'warn'
          : null

    return {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      status: lead.status,
      canal: lead.canal as string,
      createdAt: lead.createdAt.toISOString(),
      lastActivityAt: lastActivityAt.toISOString(),
      daysSince,
      flag,
      vehicle: lead.vehicle
        ? {
            brand: lead.vehicle.brand,
            model: lead.vehicle.model,
            year: lead.vehicle.year,
            km: lead.vehicle.km != null ? Number(lead.vehicle.km) : null,
            seats: lead.vehicle.seats,
            type: lead.vehicle.type as string | null,
            price: lead.vehicle.desiredPrice
              ? Number(lead.vehicle.desiredPrice)
              : lead.vehicle.valuationRecommended
                ? Number(lead.vehicle.valuationRecommended)
                : null,
          }
        : null,
      agent: lead.agent ? { id: lead.agent.id, name: lead.agent.name } : null,
    }
  })

  // ── URL helpers ───────────────────────────────────────────────────────────

  function buildUrl(overrides: Record<string, string | undefined>): string {
    const sp = new URLSearchParams()
    const merged = {
      view: searchParams.view,
      q: searchParams.q,
      status: searchParams.status,
      agentId: searchParams.agentId,
      canal: searchParams.canal,
      sort: searchParams.sort,
      dir: searchParams.dir,
      ...overrides,
    }
    Object.entries(merged).forEach(([k, v]) => {
      if (v && !(k === 'view' && v === 'todos') && !(k === 'sort' && v === 'createdAt')) {
        sp.set(k, v)
      }
    })
    const qs = sp.toString()
    return `/vendedores${qs ? `?${qs}` : ''}`
  }

  function stageUrl(stageKey: string): string {
    // Toggle: clicking the active stage removes the filter
    return searchParams.status === stageKey
      ? buildUrl({ status: undefined, page: undefined })
      : buildUrl({ status: stageKey, page: undefined })
  }

  function pageUrl(p: number): string {
    return buildUrl({ page: p > 1 ? String(p) : undefined })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="-mx-6 -mt-6 flex min-h-full flex-col">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between border-b border-border px-6 py-5">
        <div>
          <h1
            className="text-[26px] font-semibold leading-tight"
            style={{ fontFamily: 'var(--font-cormorant, serif)', color: '#0a0a0a' }}
          >
            Vendedores
          </h1>
          <p
            style={{
              ...MONO,
              fontSize: '10.5px',
              letterSpacing: '0.08em',
              color: '#6b645c',
              marginTop: '2px',
            }}
          >
            {pipelineTotal} leads activos
            {total !== pipelineTotal && (
              <>
                {' '}
                · <span style={{ color: '#584738' }}>{total} resultados</span>
              </>
            )}
          </p>
        </div>
        <Link
          href="/vendedores/nuevo"
          className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80"
          style={{ background: '#0a0a0a' }}
        >
          + Nuevo lead
        </Link>
      </div>

      {/* ── Pipeline strip ── */}
      <div className="border-b border-border px-6 py-4" style={{ background: '#faf6ed' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto repeat(6, 1fr) auto',
            alignItems: 'end',
            gap: 0,
          }}
        >
          {/* Total */}
          <div className="mr-5 flex flex-col border-r border-border pb-1 pr-5">
            <span
              style={{
                ...MONO,
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: '#6b645c',
              }}
            >
              Total
            </span>
            <span
              style={{
                fontFamily: 'var(--font-cormorant, serif)',
                fontSize: '32px',
                fontWeight: 600,
                color: '#0a0a0a',
                lineHeight: 1,
              }}
            >
              {pipelineTotal}
            </span>
          </div>

          {/* Stages */}
          {PIPELINE_STAGES.map((stage) => {
            const count = countByStatus[stage.key] ?? 0
            const pct = pipelineTotal > 0 ? Math.round((count / pipelineTotal) * 100) : 0
            const isActive = searchParams.status === stage.key

            return (
              <Link
                key={stage.key}
                href={stageUrl(stage.key)}
                className="group flex flex-col px-3 transition-opacity hover:opacity-80"
              >
                <span
                  style={{
                    ...MONO,
                    fontSize: '10.5px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: isActive ? stage.color : '#6b645c',
                    display: 'block',
                    fontWeight: isActive ? 700 : 400,
                  }}
                >
                  {stage.label}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-cormorant, serif)',
                    fontSize: '22px',
                    fontWeight: 600,
                    color: isActive ? stage.color : '#0a0a0a',
                    lineHeight: 1.1,
                    display: 'block',
                  }}
                >
                  {count}
                </span>
                {/* Progress bar */}
                <div
                  style={{
                    height: '3px',
                    background: '#e6dfd0',
                    borderRadius: '2px',
                    marginTop: '6px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: stage.color,
                      opacity: isActive ? 1 : 0.55,
                      borderRadius: '2px',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </Link>
            )
          })}

          {/* Conv. 30d */}
          <div className="ml-3 flex flex-col border-l border-border pb-1 pl-5">
            <span
              style={{
                ...MONO,
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: '#6b645c',
              }}
            >
              Conv. 30d
            </span>
            <span
              style={{
                fontFamily: 'var(--font-cormorant, serif)',
                fontSize: '22px',
                fontWeight: 600,
                color: '#6b7a4e',
                lineHeight: 1.1,
              }}
            >
              {convRate30}%
            </span>
            <div style={{ height: '3px', marginTop: '6px' }} />
          </div>
        </div>
      </div>

      {/* ── Saved views + chip filters ── */}
      <Suspense>
        <LeadsFilters
          agents={agents}
          currentView={searchParams.view ?? 'todos'}
          viewCounts={{
            todos: todosCount,
            misLeads: misLeadsCount,
            sinAsignar: sinAsignarCount,
            necesitanAccion: necesitanAccionCount,
            estaSemana: estaSemanaCount,
          }}
        />
      </Suspense>

      {/* ── Table ── */}
      <div className="flex-1 px-6 pb-8 pt-5">
        <SellerLeadsTable leads={serializedLeads} />

        {/* Pagination */}
        {total > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <span style={{ ...MONO, fontSize: '11px', color: '#6b645c' }}>
              Mostrando {from}–{to} de {total} lead{total !== 1 ? 's' : ''}
              {searchParams.status ? (
                <>
                  {' '}
                  · Filtro: <span style={{ color: '#0a0a0a' }}>{searchParams.status}</span>
                </>
              ) : null}
            </span>
            <div className="flex items-center gap-1.5">
              {page > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageUrl(page - 1)}>← Anterior</Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  ← Anterior
                </Button>
              )}
              <span className="px-2" style={{ ...MONO, fontSize: '11px', color: '#6b645c' }}>
                {page} / {totalPages || 1}
              </span>
              {page < totalPages ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageUrl(page + 1)}>Siguiente →</Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Siguiente →
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
