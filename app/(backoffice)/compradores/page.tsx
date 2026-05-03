import Link from 'next/link'
import { Suspense } from 'react'
import { db } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { BuyerLeadsFilters } from './buyer-leads-filters'
import type { Prisma } from '@prisma/client'

const PAGE_SIZE = 50

const STATUS_LABELS: Record<string, string> = {
  NUEVO: 'Nuevo',
  CONTACTADO: 'Contactado',
  CUALIFICADO: 'Cualificado',
  EN_NEGOCIACION: 'En negociación',
  CERRADO: 'Cerrado',
  PERDIDO: 'Perdido',
}

const STATUS_COLORS: Record<string, string> = {
  NUEVO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  CONTACTADO: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  CUALIFICADO: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  EN_NEGOCIACION: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  CERRADO: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  PERDIDO: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  CAMPER: 'Camper',
  AUTOCARAVANA: 'Autocaravana',
}

type SearchParams = {
  q?: string
  status?: string
  agentId?: string
  dateFrom?: string
  dateTo?: string
  budgetMin?: string
  seatsMin?: string
  sort?: string
  dir?: string
  page?: string
}

function buildWhere(sp: SearchParams): Prisma.BuyerLeadWhereInput {
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
    const validStatuses = [
      'NUEVO',
      'CONTACTADO',
      'CUALIFICADO',
      'EN_NEGOCIACION',
      'CERRADO',
      'PERDIDO',
    ]
    if (validStatuses.includes(sp.status)) {
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

  if (sp.budgetMin) {
    const n = parseFloat(sp.budgetMin)
    if (!isNaN(n)) {
      conditions.push({ maxBudget: { gte: n } })
    }
  }

  if (sp.seatsMin) {
    const n = parseInt(sp.seatsMin, 10)
    if (!isNaN(n)) {
      conditions.push({ minSeats: { gte: n } })
    }
  }

  if (sp.dateFrom) {
    const d = new Date(sp.dateFrom)
    if (!isNaN(d.getTime())) {
      conditions.push({ createdAt: { gte: d } })
    }
  }

  if (sp.dateTo) {
    const d = new Date(sp.dateTo)
    if (!isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999)
      conditions.push({ createdAt: { lte: d } })
    }
  }

  return conditions.length > 0 ? { AND: conditions } : {}
}

function buildOrderBy(sp: SearchParams): Prisma.BuyerLeadOrderByWithRelationInput {
  const dir = sp.dir === 'asc' ? 'asc' : 'desc'
  if (sp.sort === 'updatedAt') return { updatedAt: dir }
  if (sp.sort === 'maxBudget') return { maxBudget: dir }
  return { createdAt: dir }
}

export default async function CompradoresPage({ searchParams }: { searchParams: SearchParams }) {
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const where = buildWhere(searchParams)
  const orderBy = buildOrderBy(searchParams)

  const [total, leads, agents] = await Promise.all([
    db.buyerLead.count({ where }),
    db.buyerLead.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        agent: { select: { id: true, name: true } },
      },
    }),
    db.user.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  function pageUrl(p: number) {
    const sp = new URLSearchParams()
    if (searchParams.q) sp.set('q', searchParams.q)
    if (searchParams.status) sp.set('status', searchParams.status)
    if (searchParams.agentId) sp.set('agentId', searchParams.agentId)
    if (searchParams.budgetMin) sp.set('budgetMin', searchParams.budgetMin)
    if (searchParams.seatsMin) sp.set('seatsMin', searchParams.seatsMin)
    if (searchParams.dateFrom) sp.set('dateFrom', searchParams.dateFrom)
    if (searchParams.dateTo) sp.set('dateTo', searchParams.dateTo)
    if (searchParams.sort) sp.set('sort', searchParams.sort)
    if (searchParams.dir) sp.set('dir', searchParams.dir)
    if (p > 1) sp.set('page', String(p))
    const qs = sp.toString()
    return `/compradores${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Compradores</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {total} lead{total !== 1 ? 's' : ''} en total
          </p>
        </div>
        <Button asChild>
          <Link href="/compradores/nuevo">+ Nuevo comprador</Link>
        </Button>
      </div>

      {/* Filtros */}
      <Suspense>
        <BuyerLeadsFilters agents={agents} />
      </Suspense>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nombre</th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground sm:table-cell">
                Contacto
              </th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">
                Búsqueda
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">
                Agente
              </th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground xl:table-cell">
                Entrada
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {leads.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No hay leads con los filtros aplicados.
                </td>
              </tr>
            )}
            {leads.map((lead) => (
              <tr key={lead.id} className="transition-colors hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link href={`/compradores/${lead.id}`} className="font-medium hover:underline">
                    {lead.name}
                  </Link>
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                  <div>{lead.email}</div>
                  <div className="text-xs">{lead.phone}</div>
                </td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  <div className="text-muted-foreground">
                    {lead.vehicleType ? VEHICLE_TYPE_LABELS[lead.vehicleType] : 'Cualquier tipo'}
                    {lead.minSeats ? ` · ${lead.minSeats}+ plazas` : ''}
                  </div>
                  {lead.maxBudget && (
                    <div className="text-xs text-muted-foreground">
                      hasta{' '}
                      {Number(lead.maxBudget).toLocaleString('es-ES', {
                        style: 'currency',
                        currency: 'EUR',
                        maximumFractionDigits: 0,
                      })}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[lead.status] ?? ''}`}
                  >
                    {STATUS_LABELS[lead.status] ?? lead.status}
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                  {lead.agent?.name ?? <span className="text-xs italic">Sin asignar</span>}
                </td>
                <td className="hidden px-4 py-3 text-xs text-muted-foreground xl:table-cell">
                  {new Date(lead.createdAt).toLocaleDateString('es-ES')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {from}–{to} de {total}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageUrl(page - 1)}>← Anterior</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                ← Anterior
              </Button>
            )}
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
  )
}
