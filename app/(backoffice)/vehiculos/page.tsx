import Link from 'next/link'
import { VehicleGalleryButton } from '@/components/vehicle-gallery-button'
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
                <VehicleGalleryButton
                  vehicleId={v.id}
                  title={vehicleLabel(v)}
                  cover={photo?.url ?? null}
                  coverAlt={photo?.altText}
                  count={v._count.photos}
                />
                <Link
                  href={`/vendedores/${v.sellerLead.id}`}
                  className="block space-y-1 px-3 py-2 focus-visible:outline-offset-[-3px]"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 font-hanken text-sm font-semibold leading-tight text-ink">
                      {vehicleLabel(v)}
                    </span>
                    <span className="shrink-0 text-right text-sm font-semibold text-ink">
                      {v.salePrice != null
                        ? formatEur(Number(v.salePrice), 'cents')
                        : 'Sin precio de venta'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink2">
                    <span>
                      {v.type ? (inventoryTypes[v.type] ?? v.type) : 'Sin tipo'}
                      {v.km != null ? ` · ${v.km.toLocaleString('es-ES')} km` : ''}
                    </span>
                    {v.plate && <span className="font-mono">{v.plate}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink2">
                    <span className="inline-flex items-center gap-1 font-medium">
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: STATUS_HEX[v.status] }}
                      />
                      {VEHICLE_STATUS_LABELS[v.status]}
                    </span>
                    <span>{VEHICLE_ORIGIN_LABELS[v.sellerLead.canal]}</span>
                    {v.sellerLead.status === 'DESCARTADO' && <span>Vendedor descartado</span>}
                    {compatibleCount > 0 && (
                      <span className="font-medium text-brand">
                        {compatibleCount} compatible{compatibleCount === 1 ? '' : 's'}
                      </span>
                    )}
                    {v.salePrice == null && reference != null && (
                      <span>
                        {v.valuationRecommended != null ? 'Tasación' : 'Precio deseado'} ·{' '}
                        {formatEur(Number(reference), 'cents')}
                      </span>
                    )}
                  </div>
                </Link>
                {!(active && preparing) && viewer.role === 'ADMIN' && v.salePrice == null && (
                  <InventoryPriceEditor
                    label={vehicleLabel(v)}
                    savePrice={setMissingSalePrice.bind(null, v.id)}
                  />
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-3 py-1.5">
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
                  <Link
                    href={`/vendedores/${v.sellerLeadId}?tab=preparacion#checklist-match`}
                    className="py-1 text-xs font-medium text-brand underline"
                  >
                    Checklist para el match
                  </Link>
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
