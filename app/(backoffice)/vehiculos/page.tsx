import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { db } from '@/lib/db'
import { VEHICLE_STATUS_LABELS, VEHICLE_STATUS_CLASSES } from '@/lib/state-machine'
import { Button } from '@/components/ui/button'
import { VehicleFilters } from './vehicle-filters'
import type { Prisma } from '@prisma/client'

const PAGE_SIZE = 50

const TYPE_LABELS: Record<string, string> = {
  CAMPER: 'Camper',
  AUTOCARAVANA: 'Autocaravana',
}

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
      conditions.push({
        OR: [{ valuationRecommended: { lte: p } }, { desiredPrice: { lte: p } }],
      })
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
      },
    }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  function pageUrl(p: number) {
    const sp = new URLSearchParams()
    if (searchParams.brand) sp.set('brand', searchParams.brand)
    if (searchParams.status) sp.set('status', searchParams.status)
    if (searchParams.type) sp.set('type', searchParams.type)
    if (searchParams.yearMin) sp.set('yearMin', searchParams.yearMin)
    if (searchParams.yearMax) sp.set('yearMax', searchParams.yearMax)
    if (searchParams.kmMax) sp.set('kmMax', searchParams.kmMax)
    if (searchParams.priceMax) sp.set('priceMax', searchParams.priceMax)
    if (searchParams.sort) sp.set('sort', searchParams.sort)
    if (searchParams.dir) sp.set('dir', searchParams.dir)
    if (p > 1) sp.set('page', String(p))
    const qs = sp.toString()
    return `/vehiculos${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div>
        <h1 className="text-2xl font-bold">Stock de vehículos</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {total} vehículo{total !== 1 ? 's' : ''} en total
        </p>
      </div>

      {/* Filtros */}
      <Suspense>
        <VehicleFilters />
      </Suspense>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="w-16 px-4 py-3 text-left font-medium text-muted-foreground" />
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vehículo</th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground sm:table-cell">
                Tipo
              </th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">
                Año / Km
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">
                Precio tasado
              </th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground xl:table-cell">
                Vendedor
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {vehicles.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  No hay vehículos con los filtros aplicados.
                </td>
              </tr>
            )}
            {vehicles.map((v) => {
              const photo = v.photos[0]
              const price = v.valuationRecommended?.toNumber() ?? null

              return (
                <tr key={v.id} className="transition-colors hover:bg-muted/30">
                  {/* Miniatura */}
                  <td className="px-4 py-3">
                    {photo ? (
                      <div className="relative h-10 w-14 overflow-hidden rounded">
                        <Image
                          src={photo.url}
                          alt={photo.altText ?? `${v.brand} ${v.model}`}
                          fill
                          className="object-cover"
                          sizes="56px"
                        />
                      </div>
                    ) : (
                      <div className="flex h-10 w-14 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                        —
                      </div>
                    )}
                  </td>

                  {/* Marca + modelo */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/vendedores/${v.sellerLead.id}`}
                      className="font-medium hover:underline"
                    >
                      {v.brand} {v.model}
                    </Link>
                  </td>

                  {/* Tipo */}
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {TYPE_LABELS[v.type] ?? v.type}
                    </span>
                  </td>

                  {/* Año / km */}
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    <div>{v.year ?? '—'}</div>
                    <div className="text-xs">
                      {v.km != null ? `${v.km.toLocaleString('es-ES')} km` : '—'}
                    </div>
                  </td>

                  {/* Estado */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${VEHICLE_STATUS_CLASSES[v.status]}`}
                    >
                      {VEHICLE_STATUS_LABELS[v.status]}
                    </span>
                  </td>

                  {/* Precio tasado */}
                  <td className="hidden px-4 py-3 lg:table-cell">
                    {price != null ? (
                      <span className="font-medium tabular-nums">
                        {price.toLocaleString('es-ES', {
                          style: 'currency',
                          currency: 'EUR',
                          maximumFractionDigits: 0,
                        })}
                      </span>
                    ) : (
                      <span className="text-xs italic text-muted-foreground">Sin tasar</span>
                    )}
                  </td>

                  {/* Vendedor */}
                  <td className="hidden px-4 py-3 xl:table-cell">
                    <Link
                      href={`/vendedores/${v.sellerLead.id}`}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      {v.sellerLead.name}
                    </Link>
                  </td>
                </tr>
              )
            })}
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
