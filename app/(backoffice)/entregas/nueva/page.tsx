import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { OPERATIONAL_DELIVERY_ROLES } from '@/lib/operations-policy'
import { NewDeliveryForm } from './new-delivery-form'
export default async function NuevaEntregaPage() {
  await requireRole(OPERATIONAL_DELIVERY_ROLES)
  const users = await db.user.findMany({
    where: { active: true, role: { in: OPERATIONAL_DELIVERY_ROLES } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Nueva entrega</h1>
      <p className="text-sm text-muted-foreground">
        Elige vehículo, tipo y destinatario. No necesitas oferta, match, reserva, checklist ni
        firma.
      </p>
      <NewDeliveryForm users={users} />
    </div>
  )
}
