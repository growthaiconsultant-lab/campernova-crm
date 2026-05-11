import Link from 'next/link'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { WorkOrderForm } from './work-order-form'

export default async function NuevaOrdenPage() {
  await requireAuth()

  const [vehicles, users] = await Promise.all([
    db.vehicle.findMany({
      where: { status: { in: ['NUEVO', 'TASADO', 'PUBLICADO', 'RESERVADO'] } },
      include: { sellerLead: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    db.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const vehicleOptions = vehicles.map((v) => ({
    id: v.id,
    brand: v.brand,
    model: v.model,
    year: v.year,
    sellerLeadName: v.sellerLead?.name ?? null,
  }))

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/taller">← Taller</Link>
        </Button>
        <h1 className="text-2xl font-bold">Nueva orden de trabajo</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la orden</CardTitle>
          <CardDescription>
            Selecciona el vehículo, describe el trabajo y establece el presupuesto. Si el coste
            estimado supera el límite de aprobación, la orden requerirá visto bueno del CEO antes de
            pasar a EN_CURSO.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkOrderForm vehicles={vehicleOptions} users={users} />
        </CardContent>
      </Card>
    </div>
  )
}
