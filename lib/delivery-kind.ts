import type { DeliveryKind } from '@prisma/client'

export const DELIVERY_KIND_LABELS: Record<DeliveryKind, string> = {
  VENTA: 'Entrega por venta',
  DEVOLUCION_VENDEDOR: 'Devolución al vendedor',
  ENTREGA_TALLER: 'Salida de taller',
}

type DeliveryRecipient = {
  buyerLead: { name: string | null } | null
  recipientSellerLead?: { name: string | null } | null
}

/** Nunca confundir el vendedor actual del vehículo con el destinatario histórico. */
export function deliveryRecipientName(delivery: DeliveryRecipient): string {
  return delivery.buyerLead?.name ?? delivery.recipientSellerLead?.name ?? 'Sin nombre registrado'
}

export function deliveryCreatesSale(kind: DeliveryKind): boolean {
  return kind === 'VENTA'
}
