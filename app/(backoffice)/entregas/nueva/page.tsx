import { db } from '@/lib/db'
import { requireCanViewEntregas } from '@/lib/auth'
import { NewDeliveryForm } from './new-delivery-form'

export default async function NuevaEntregaPage() {
  await requireCanViewEntregas()

  const [vehicles, buyers, users] = await Promise.all([
    db.vehicle.findMany({
      where: { status: { in: ['PUBLICADO', 'RESERVADO'] } },
      select: { id: true, brand: true, model: true, year: true },
      orderBy: [{ brand: 'asc' }, { model: 'asc' }],
    }),
    db.buyerLead.findMany({
      where: { status: { notIn: ['CERRADO', 'PERDIDO'] } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    db.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nueva entrega</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Programa la entrega física de un vehículo
        </p>
      </div>
      <NewDeliveryForm vehicles={vehicles} buyers={buyers} users={users} />
    </div>
  )
}
