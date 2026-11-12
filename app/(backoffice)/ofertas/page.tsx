import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { personLabel, vehicleLabel } from '@/lib/display'
import { OffersList } from './offers-list'

export default async function OfertasPage({ searchParams }: { searchParams: { vista?: string } }) {
  await requireAgente()
  const offers = await db.offer.findMany({
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    select: {
      id: true,
      status: true,
      amount: true,
      depositAmount: true,
      reservedUntil: true,
      updatedAt: true,
      rejectionReason: true,
      vehicle: { select: { id: true, brand: true, model: true, year: true } },
      buyerLead: { select: { id: true, name: true } },
    },
  })
  const rows = offers.map((o) => ({
    id: o.id,
    status: o.status,
    amount: Number(o.amount),
    depositAmount: o.depositAmount === null ? null : Number(o.depositAmount),
    reservedUntil: o.reservedUntil?.toISOString() ?? null,
    updatedAt: o.updatedAt.toISOString(),
    rejectionReason: o.rejectionReason,
    vehicle: vehicleLabel(o.vehicle, { withId: true }),
    buyer: personLabel(o.buyerLead.name, { role: 'Comprador sin identificar', id: o.buyerLead.id }),
    buyerId: o.buyerLead.id,
  }))
  return (
    <OffersList rows={rows} history={searchParams.vista === 'historial'} initialNow={Date.now()} />
  )
}
