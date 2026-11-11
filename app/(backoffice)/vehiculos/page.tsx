import Link from 'next/link'
import Image from 'next/image'
import { Package } from 'lucide-react'
import { db } from '@/lib/db'
import { requireCanViewVehiculos } from '@/lib/auth'
import { VEHICLE_ORIGIN_LABELS } from '@/lib/seller-intake'
import { vehicleLabel } from '@/lib/display'
import { isVehicleEligible } from '@/lib/matching'
import { VEHICLE_STATUS_LABELS } from '@/lib/state-machine'
import { setMissingSalePrice } from '../vendedores/[id]/cost-actions'
import { InventorySaleActions } from './inventory-sale-actions'
import { InventoryPublication } from './inventory-publication'
import { publishVehicle, forcePublishVehicle } from '../vendedores/[id]/actions'
import { UnpublishButton } from '../vendedores/[id]/unpublish-button'
import { webAvailability } from '@/lib/web-listing'
import { vehicleSlug } from '@/lib/public-catalog'
import { isValidOfferTransition } from '@/lib/offers'
import { InventoryPriceEditor } from './inventory-price-editor'
import { VehicleFilters } from './vehicle-filters'
import { Eyebrow, EmptyState } from '@/components/redesign'
import type { VehicleStatus } from '@prisma/client'

import { readVehicleInventory } from '@/lib/vehicle-inventory'
import {
  readInventoryParams,
  inventoryTypes,
  inventoryUrl,
  type InventoryParams,
} from '@/lib/vehicle-inventory-filters'
import { formatEur } from '@/lib/format/currency'

// Color de estado del vehículo (semáforo del handoff)
const STATUS_HEX: Record<VehicleStatus, string> = {
  NUEVO: '#8b94a3',
  TASADO: '#3a6fd4',
  PUBLICADO: '#1a9d5f',
  RESERVADO: '#c9820a',
  VENDIDO: '#141922',
  DESCARTADO: '#8b94a3',
}

export default async function VehiculosPage({ searchParams }: { searchParams: InventoryParams }) {
  const viewer = await requireCanViewVehiculos()
  const { criteria, order, page: requestedPage } = readInventoryParams(searchParams)
  const {
    vehicles,
    total,
    inventoryTotal,
    page,
    pages: totalPages,
    filtered,
    error,
  } = await readVehicleInventory(db, criteria, order, requestedPage)
  return (
    <div>
      <div className="mb-4">
        <Eyebrow>CRM · Inventario</Eyebrow>
        <h1 className="mt-1 font-hanken text-[23px] font-bold tracking-[-0.02em] text-ink">
          Vehículos
        </h1>
        <p className="mt-1 font-hanken text-[13.5px] text-ink2">
          <b className="text-ink">{total}</b> {total === 1 ? 'vehículo' : 'vehículos'}
          {filtered && ` de ${inventoryTotal} en el inventario`}
        </p>
      </div>

      <div className="mb-4">
        <VehicleFilters
          key={inventoryUrl(criteria, 'createdAt:desc')}
          applied={criteria}
          order={order}
        />
      </div>

      {vehicles.length === 0 ? (
        <EmptyState
          icon={<Package size={20} strokeWidth={1.9} />}
          title={
            error
              ? 'Revisa los filtros'
              : filtered
                ? 'Ningún vehículo cumple estos filtros'
                : 'Sin vehículos en el inventario'
          }
          description={
            error ??
            (filtered
              ? 'Quita un filtro o amplía los límites para buscar de nuevo.'
              : 'Aquí aparecerán los vehículos de los vendedores admitidos.')
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {vehicles.map((v) => {
            const photo = v.photos[0]
            // M1: un vehículo NO elegible (p.ej. NUEVO o de vendedor archivado) no
            // muestra demanda compatible aunque conserve matches persistidos.
            const compatibleCount = isVehicleEligible({
              status: v.status,
              sellerArchivedAt: v.sellerLead.archivedAt,
              entryValidatedAt: v.entryValidatedAt,
              entryAnnulledAt: v.entryAnnulledAt,
            })
              ? v._count.matches
              : 0
            const saleHref = `/vendedores/${v.sellerLeadId}?tab=compradores#venta-ofertas`
            const status = v.status
            const preparing = status === 'NUEVO' || status === 'TASADO'
            const published = status === 'PUBLICADO'
            const holds = v.offers.length > 0 || v.deliveries.length > 0
            const active = !v.sellerLead.archivedAt
            const availability = webAvailability(v.status, v.publishedAt)
            const reference = v.valuationRecommended ?? v.desiredPrice
            return (
              <article
                key={v.id}
                className="hover:border-ink3/40 group overflow-hidden rounded-[14px] border border-line bg-card transition-colors"
              >
                <Link
                  href={`/vendedores/${v.sellerLead.id}`}
                  className="block focus-visible:outline-offset-[-3px]"
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
                      {vehicleLabel(v)}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-ink3">
                      {v.type ? (inventoryTypes[v.type] ?? v.type) : 'Sin tipo'}
                      {v.km != null ? ` · ${v.km.toLocaleString('es-ES')} km` : ''}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex rounded-[6px] px-2 py-[3px] font-hanken text-[10.5px] font-semibold ${
                          v.sellerLead.canal === 'PRO'
                            ? 'bg-brand-tint text-brand'
                            : 'bg-track text-ink2'
                        }`}
                      >
                        {VEHICLE_ORIGIN_LABELS[v.sellerLead.canal]}
                      </span>
                      {v.sellerLead.status === 'DESCARTADO' && (
                        <span className="rounded-[6px] bg-muted px-2 py-[3px] text-xs font-medium text-muted-foreground">
                          Vendedor descartado
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="font-hanken text-[15px] font-bold text-ink">
                        <span className="block">
                          {v.salePrice != null
                            ? formatEur(Number(v.salePrice), 'cents')
                            : 'Sin precio de venta'}
                        </span>
                        {v.salePrice == null && reference != null && (
                          <span className="block text-xs font-normal text-ink2">
                            {v.valuationRecommended != null ? 'Tasación' : 'Precio deseado'} ·{' '}
                            {formatEur(Number(reference), 'cents')}
                          </span>
                        )}
                      </span>
                      {compatibleCount > 0 && (
                        <span className="rounded-[6px] bg-brand-tint px-2 py-[3px] font-hanken text-[11px] font-semibold text-brand">
                          {compatibleCount} compatible{compatibleCount === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
                {!(active && preparing) && viewer.role === 'ADMIN' && v.salePrice == null && (
                  <InventoryPriceEditor
                    label={vehicleLabel(v)}
                    savePrice={setMissingSalePrice.bind(null, v.id)}
                  />
                )}
                <div className="flex flex-col items-start gap-2 border-t border-line p-3">
                  {availability && (
                    <Link
                      href={'/comprar/' + vehicleSlug(v)}
                      className="text-sm text-brand underline"
                    >
                      Ver anuncio en la web
                    </Link>
                  )}
                  {active && preparing && (
                    <InventoryPublication
                      title={vehicleLabel(v)}
                      pending={v.publicationPending}
                      missingPrice={v.salePrice == null}
                      preparationHref={`/vendedores/${v.sellerLeadId}?tab=preparacion`}
                      savePrice={
                        viewer.role === 'ADMIN' ? setMissingSalePrice.bind(null, v.id) : undefined
                      }
                      publish={
                        v.readyToPublish
                          ? publishVehicle.bind(null, v.id)
                          : forcePublishVehicle.bind(
                              null,
                              v.id,
                              v.publicationPending.map((item) => item.field)
                            )
                      }
                    />
                  )}
                  {active && published && !holds && (
                    <UnpublishButton vehicleId={v.id} label="Retirar de la web" />
                  )}
                  {active && (published || preparing) && (
                    <InventorySaleActions
                      status={status}
                      vehicleId={v.id}
                      title={vehicleLabel(v)}
                      saleHref={saleHref}
                      published={published && !v.deliveries.length}
                      canDiscard={!holds}
                      offers={v.offers
                        .filter(
                          (o) =>
                            !o.buyerLead.archivedAt && isValidOfferTransition(o.status, 'ACEPTADA')
                        )
                        .map((o) => ({
                          id: o.id,
                          buyer: o.buyerLead.name,
                          amount: Number(o.amount),
                        }))}
                    />
                  )}
                  {status === 'DESCARTADO' && (
                    <Link
                      className="text-sm text-brand underline"
                      href={`/vendedores/${v.sellerLeadId}?tab=actividad`}
                    >
                      Ver historial del vehículo
                    </Link>
                  )}
                  {holds && (published || preparing) && (
                    <p className="text-xs text-muted-foreground">
                      {v.deliveries.length ? 'Hay una entrega activa.' : 'Hay ofertas activas.'}{' '}
                      Resuelve la operación antes de retirar o descartar el vehículo.
                    </p>
                  )}
                  {v.deliveries[0] && (
                    <Link
                      className="block text-sm text-brand underline"
                      href={`/entregas/${v.deliveries[0].id}`}
                    >
                      Ver entrega activa
                    </Link>
                  )}
                  {(v.offers.length > 0 || status === 'RESERVADO' || status === 'VENDIDO') && (
                    <Link className="block text-sm text-brand underline" href={saleHref}>
                      {status === 'RESERVADO'
                        ? 'Ver reserva en Venta'
                        : status === 'VENDIDO'
                          ? 'Ver venta'
                          : 'Ver ofertas activas'}
                    </Link>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-between">
          <span className="font-hanken text-[12.5px] text-ink2">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={inventoryUrl(criteria, order, page - 1)}
                className="rounded-[9px] border border-line bg-card px-3 py-1.5 font-hanken text-[12.5px] font-semibold text-ink2 hover:bg-canvas"
              >
                Anterior
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={inventoryUrl(criteria, order, page + 1)}
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
