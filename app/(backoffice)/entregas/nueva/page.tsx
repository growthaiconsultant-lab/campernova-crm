import { db } from '@/lib/db'
import { requireCanEditEntregas } from '@/lib/auth'
import { NewDeliveryForm } from './new-delivery-form'
import { ACTIVE_DELIVERY_STATUSES } from '@/lib/delivery-creation'

export default async function NuevaEntregaPage() {
  await requireCanEditEntregas()

  // Una entrega se programa a partir de una Offer CONVERTIDA cuyo vehículo sigue RESERVADO y aún no
  // tiene entrega activa ni completada. La operación fija vehículo + comprador + oferta.
  const offers = await db.offer.findMany({
    where: {
      status: 'CONVERTIDA',
      vehicle: {
        status: 'RESERVADO',
        deliveries: { none: { status: { in: [...ACTIVE_DELIVERY_STATUSES, 'COMPLETADA'] } } },
      },
    },
    select: {
      id: true,
      amount: true,
      vehicle: { select: { id: true, brand: true, model: true, year: true } },
      buyerLead: { select: { id: true, name: true } },
    },
    orderBy: { decidedAt: 'desc' },
  })

  const users = await db.user.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  const operations = offers.map((o) => ({
    offerId: o.id,
    vehicleId: o.vehicle.id,
    buyerLeadId: o.buyerLead.id,
    label: `${o.vehicle.brand} ${o.vehicle.model} (${o.vehicle.year}) · ${o.buyerLead.name}`,
  }))

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nueva entrega</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Programa la entrega de una venta ya cerrada (oferta convertida)
        </p>
      </div>
      <NewDeliveryForm operations={operations} users={users} />
    </div>
  )
}
