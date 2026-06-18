import {
  SELLER_LEAD_STATUS_LABELS,
  SELLER_LEAD_STATUS_CLASSES,
  VEHICLE_STATUS_LABELS,
  VEHICLE_STATUS_CLASSES,
  BUYER_LEAD_STATUS_LABELS,
  BUYER_LEAD_STATUS_CLASSES,
} from '@/lib/state-machine'

type Entity = 'seller' | 'vehicle' | 'buyer'

const MAPS: Record<Entity, { labels: Record<string, string>; classes: Record<string, string> }> = {
  seller: { labels: SELLER_LEAD_STATUS_LABELS, classes: SELLER_LEAD_STATUS_CLASSES },
  vehicle: { labels: VEHICLE_STATUS_LABELS, classes: VEHICLE_STATUS_CLASSES },
  buyer: { labels: BUYER_LEAD_STATUS_LABELS, classes: BUYER_LEAD_STATUS_CLASSES },
}

const FALLBACK = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'

/**
 * Pill de estado con una única fuente de verdad: lib/state-machine.
 * `entity` selecciona el mapa (vendedor / vehículo / comprador). No redefinir
 * labels ni colores de estado en las páginas — usar siempre este componente.
 */
export function StatusPill({
  status,
  entity,
  className = '',
}: {
  status: string
  entity: Entity
  className?: string
}) {
  const map = MAPS[entity]
  const label = map.labels[status] ?? status
  const cls = map.classes[status] ?? FALLBACK
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${cls} ${className}`}
    >
      {label}
    </span>
  )
}
