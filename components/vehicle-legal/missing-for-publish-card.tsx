import Link from 'next/link'
import type { VehicleStatus } from '@prisma/client'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { DOC_LABELS, PUBLICADO_MIN_PHOTOS, PUBLICADO_REQUIRED_DOCS } from '@/lib/vehicle-legal'
import type { VehicleLegalInput, MissingRequirement } from '@/lib/vehicle-legal'
import { PublishVehicleButton } from './publish-vehicle-button'
import { PreparationLink } from './preparation-link'

interface Props {
  vehicle: VehicleLegalInput
  missing: MissingRequirement[]
  vehicleStatus: VehicleStatus
  sellerId: string
  archived: boolean
  isAdmin: boolean
}

function Requirement({
  requirement,
  vehicle,
  sellerId,
  isAdmin,
}: { requirement: MissingRequirement } & Pick<Props, 'vehicle' | 'sellerId' | 'isAdmin'>) {
  const { field, message } = requirement
  const doc = PUBLICADO_REQUIRED_DOCS.find((category) => field === 'doc_' + category)
  let title = message
  let detail: string | undefined
  let action: React.ReactNode
  if (doc) {
    title = DOC_LABELS[doc]
    detail = 'Falta el archivo en el expediente legal del vehículo.'
    action = (
      <PreparationLink target={'prep-doc-' + doc} chooseFile>
        Adjuntar{' '}
        {doc === 'PERMISO_CIRCULACION' ? (
          'permiso'
        ) : (
          <>
            documento<span className="sr-only"> · {title}</span>
          </>
        )}
      </PreparationLink>
    )
  } else if (field === 'photos' || field.startsWith('photo_')) {
    if (field === 'photos') {
      const left = PUBLICADO_MIN_PHOTOS - vehicle.photoCount
      title = left === 1 ? 'Falta 1 foto del vehículo' : `Faltan ${left} fotos del vehículo`
      detail = `${vehicle.photoCount} guardadas · Mínimo de ${PUBLICADO_MIN_PHOTOS} fotos`
    }
    action = (
      <PreparationLink target="prep-gallery" chooseFile={field === 'photos'}>
        {field === 'photos' ? 'Añadir fotos' : 'Revisar categorías'}
      </PreparationLink>
    )
  } else if (field === 'purchasePrice' || field === 'salePrice') {
    action = isAdmin ? (
      <Link
        className="text-sm font-medium text-sidebar-primary underline"
        href={`/vendedores/${sellerId}?tab=economia#precios-vehiculo`}
      >
        Completar precio →
      </Link>
    ) : (
      <span className="text-sm text-muted-foreground">Lo completa Administración</span>
    )
  } else if (field === 'workOrders') {
    action = <PreparationLink target="prep-workshop">Ver órdenes de taller</PreparationLink>
  } else if (field === 'desiredPrice') {
    action = <PreparationLink target="prep-desired-price">Completar precio deseado</PreparationLink>
  } else if (isAdmin || field === 'plate') {
    action = (
      <PreparationLink target={field === 'chargeCheckedAt' ? 'prep-charges' : field}>
        Completar dato
      </PreparationLink>
    )
  } else {
    action = <span className="text-sm text-muted-foreground">Lo completa Administración</span>
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0 flex-1 basis-52">
        <strong className="text-sm">{title}</strong>
        {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
      </div>
      {action}
    </li>
  )
}

export function MissingForPublishCard({
  vehicle,
  missing,
  archived,
  vehicleStatus,
  sellerId,
  isAdmin,
}: Props) {
  const errors = missing.filter((r) => r.severity === 'error'),
    warnings = missing.filter((r) => r.severity === 'warning')
  const states: Partial<Record<VehicleStatus, string>> = {
    PUBLICADO: 'Vehículo publicado',
    VENDIDO: 'Vehículo vendido',
    RESERVADO: 'Vehículo reservado',
    DESCARTADO: 'Vehículo descartado',
  }
  const state = archived ? 'Ficha del vendedor archivada' : states[vehicleStatus]
  const eligible = !archived && (vehicleStatus === 'NUEVO' || vehicleStatus === 'TASADO')
  const pending =
    errors.length === 1
      ? 'Queda 1 pendiente para publicar'
      : `Quedan ${errors.length} pendientes para publicar`
  return (
    <section
      className="space-y-3 rounded-xl border bg-card p-4 sm:p-5"
      aria-labelledby="prep-heading"
    >
      <div className="flex items-center gap-2">
        {errors.length ? (
          <AlertCircle aria-hidden className="h-5 w-5 text-amber-700 dark:text-amber-300" />
        ) : (
          <CheckCircle2 aria-hidden className="h-5 w-5 text-sidebar-primary" />
        )}
        <h2 id="prep-heading" aria-live="polite" className="text-lg font-semibold">
          {eligible ? (errors.length ? pending : 'Listo para publicar') : state}
        </h2>
      </div>
      {!eligible && errors.length > 0 && (
        <p className="text-sm">Pendientes del expediente ({errors.length})</p>
      )}
      {errors.length > 0 && (
        <ul className="divide-y border-y">
          {errors.map((requirement) => (
            <Requirement
              key={requirement.field}
              requirement={requirement}
              vehicle={vehicle}
              sellerId={sellerId}
              isAdmin={isAdmin}
            />
          ))}
        </ul>
      )}
      {warnings.map((w) => (
        <p
          key={w.field}
          className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          <strong>Aviso · </strong>
          {w.field === 'itvValidUntil' && vehicle.itvValidUntil
            ? 'La ITV vence el ' +
              vehicle.itvValidUntil.toLocaleDateString('es-ES', {
                timeZone: 'Europe/Madrid',
                dateStyle: 'long',
              })
            : w.message}
        </p>
      ))}
      {eligible &&
        (errors.length ? (
          <details>
            <summary className="cursor-pointer text-sm text-muted-foreground">
              Opciones de publicación
            </summary>
            <div className="mt-2">
              <PublishVehicleButton vehicleId={vehicle.id} force />
            </div>
          </details>
        ) : (
          <PublishVehicleButton vehicleId={vehicle.id} />
        ))}
    </section>
  )
}
