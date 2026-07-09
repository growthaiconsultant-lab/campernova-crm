import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { Package } from 'lucide-react'
import { db } from '@/lib/db'
import { VEHICLE_STATUS_LABELS } from '@/lib/state-machine'
import { VehicleFilters } from './vehicle-filters'
import { Eyebrow, EmptyState } from '@/components/redesign'
import type { Prisma, VehicleStatus } from '@prisma/client'

const PAGE_SIZE = 48

const TYPE_LABELS: Record<string, string> = {
  CAMPER: 'Camper',
  AUTOCARAVANA: 'Autocaravana',
}

// Color de estado del vehículo (semáforo del handoff)
const STATUS_HEX: Record<VehicleStatus, string> = {
  NUEVO: '#8b94a3',
  TASADO: '#3a6fd4',
  PUBLICADO: '#1a9d5f',
  RESERVADO: '#c9820a',
  VENDIDO: '#141922',
  DESCARTADO: '#8b94a3',
}

const EUR = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

type SearchParams = {
  brand?: string
  status?: string
  type?: string
  yearMin?: string
  yearMax?: string
  kmMax?: string
  priceMax?: string
  sort?: string
  dir?: string
  page?: string
}

function buildWhere(sp: SearchParams): Prisma.VehicleWhereInput {
  const conditions: Prisma.VehicleWhereInput[] = []

  if (sp.brand) {
    const q = sp.brand.trim()
    conditions.push({
      OR: [
        { brand: { contains: q, mode: 'insensitive' } },
        { model: { contains: q, mode: 'insensitive' } },
      ],
    })
  }

  if (sp.status) {
    const valid = ['NUEVO', 'TASADO', 'PUBLICADO', 'RESERVADO', 'VENDIDO', 'DESCARTADO']
    if (valid.includes(sp.status)) {
      conditions.push({ status: sp.status as Prisma.EnumVehicleStatusFilter['equals'] })
    }
  }

  if (sp.type) {
    const valid = ['CAMPER', 'AUTOCARAVANA']
    if (valid.includes(sp.type)) {
      conditions.push({ type: sp.type as Prisma.EnumVehicleTypeFilter['equals'] })
    }
  }

  if (sp.yearMin) {
    const y = parseInt(sp.yearMin, 10)
    if (!isNaN(y)) conditions.push({ year: { gte: y } })
  }
  if (sp.yearMax) {
    const y = parseInt(sp.yearMax, 10)
    if (!isNaN(y)) conditions.push({ year: { lte: y } })
  }
  if (sp.kmMax) {
    const k = parseInt(sp.kmMax, 10)
    if (!isNaN(k)) conditions.push({ km: { lte: k } })
  }
  if (sp.priceMax) {
    const p = parseFloat(sp.priceMax)
    if (!isNaN(p)) {
      conditions.push({ OR: [{ valuationRecommended: { lte: p } }, { desiredPrice: { lte: p } }] })
    }
  }

  return conditions.length > 0 ? { AND: conditions } : {}
}

function buildOrderBy(sp: SearchParams): Prisma.VehicleOrderByWithRelationInput {
  const dir = sp.dir === 'asc' ? 'asc' : 'desc'
  if (sp.sort === 'year') return { year: dir }
  if (sp.sort === 'km') return { km: dir }
  if (sp.sort === 'valuationRecommended') return { valuationRecommended: dir }
  return { createdAt: dir }
}

export default async function VehiculosPage({ searchParams }: { searchParams: SearchParams }) {
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const where = buildWhere(searchParams)
  const orderBy = buildOrderBy(searchParams)

  const [total, vehicles] = await Promise.all([
    db.vehicle.count({ where }),
    db.vehicle.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        sellerLead: { select: { id: true, name: true } },
        photos: { take: 1, orderBy: { order: 'asc' } },
        _count: { select: { matches: true } },
      },
    }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function pageUrl(p: number) {
    const sp = new URLSearchParams(searchParams as Record<string, string>)
    if (p > 1) sp.set('page', String(p))
    else sp.delete('page')
    const qs = sp.toString()
    return `/vehiculos${qs ? `?${qs}` : ''}`
  }

  return (
    <div>
      <div className="mb-4">
        <Eyebrow>CRM · Inventario</Eyebrow>
        <h1 className="mt-1 font-hanken text-[23px] font-bold tracking-[-0.02em] text-ink">
          Inventario
        </h1>
        <p className="mt-1 font-hanken text-[13.5px] text-ink2">
          <b className="text-ink">{total}</b> vehículo{total === 1 ? '' : 's'} en stock
        </p>
      </div>

      <div className="mb-4">
        <Suspense>
          <VehicleFilters />
        </Suspense>
      </div>

      {vehicles.length === 0 ? (
        <EmptyState
          icon={<Package size={20} strokeWidth={1.9} />}
          title="Sin vehículos en el inventario"
          description="Los vehículos que custodiamos aparecerán aquí con su estado operativo, motivo de bloqueo para publicar y la demanda compatible."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {vehicles.map((v) => {
            const photo = v.photos[0]
            const priceN =
              (v.salePrice ? Number(v.salePrice) : null) ??
              (v.valuationRecommended ? Number(v.valuationRecommended) : null) ??
              (v.desiredPrice ? Number(v.desiredPrice) : null)
            return (
              <Link
                key={v.id}
                href={`/vendedores/${v.sellerLead.id}`}
                className="hover:border-ink3/40 group overflow-hidden rounded-[14px] border border-line bg-card transition-colors"
              >
                {/* Foto */}
                <div className="relative h-[140px] w-full overflow-hidden bg-track">
                  {photo ? (
                    <Image
                      src={photo.url}
                      alt={photo.altText ?? `${v.brand} ${v.model}`}
                      fill
                      className="object-cover"
                      sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-ink3">
                      <Package size={28} strokeWidth={1.5} />
                    </div>
                  )}
                  <span
                    className="absolute left-2.5 top-2.5 rounded-[6px] px-2 py-[3px] font-hanken text-[10.5px] font-semibold text-white"
                    style={{ backgroundColor: STATUS_HEX[v.status] }}
                  >
                    {VEHICLE_STATUS_LABELS[v.status]}
                  </span>
                  {v.plate && (
                    <span className="absolute right-2.5 top-2.5 rounded-[6px] bg-white/90 px-2 py-[3px] font-mono text-[10px] font-semibold text-ink2">
                      {v.plate}
                    </span>
                  )}
                </div>

                {/* Cuerpo */}
                <div className="p-3">
                  <div className="truncate font-hanken text-[13.5px] font-semibold text-ink">
                    {v.brand} {v.model} {v.year}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-ink3">
                    {TYPE_LABELS[v.type] ?? v.type}
                    {v.km != null ? ` · ${v.km.toLocaleString('es-ES')} km` : ''}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="font-hanken text-[15px] font-bold text-ink">
                      {priceN != null ? EUR(priceN) : <span className="text-ink3">Sin tasar</span>}
                    </span>
                    {v._count.matches > 0 && (
                      <span className="rounded-[6px] bg-brand-tint px-2 py-[3px] font-hanken text-[11px] font-semibold text-brand">
                        {v._count.matches} compatible{v._count.matches === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="mt-5 flex items-center justify-between">
          <span className="font-hanken text-[12.5px] text-ink2">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={pageUrl(page - 1)}
                className="rounded-[9px] border border-line bg-card px-3 py-1.5 font-hanken text-[12.5px] font-semibold text-ink2 hover:bg-canvas"
              >
                Anterior
              </Link>
            )}
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
