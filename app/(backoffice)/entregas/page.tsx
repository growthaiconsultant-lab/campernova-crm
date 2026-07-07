import Link from 'next/link'
import { db } from '@/lib/db'
import { requireCanViewEntregas } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import type { DeliveryStatus } from '@prisma/client'

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  PROGRAMADA: 'Programada',
  EN_CURSO: 'En curso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
}

const STATUS_COLORS: Record<DeliveryStatus, string> = {
  PROGRAMADA: 'bg-blue-100 text-blue-700',
  EN_CURSO: 'bg-yellow-100 text-yellow-700',
  COMPLETADA: 'bg-green-100 text-green-700',
  CANCELADA: 'bg-red-100 text-red-700',
}

export default async function EntregasPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  await requireCanViewEntregas()

  const where: Record<string, unknown> = {}
  if (searchParams.status) where.status = searchParams.status

  const deliveries = await db.delivery.findMany({
    where,
    include: {
      vehicle: { select: { id: true, brand: true, model: true, year: true } },
      buyerLead: { select: { id: true, name: true } },
      responsable: { select: { id: true, name: true } },
    },
    orderBy: { scheduledAt: 'asc' },
  })

  const statuses = Object.keys(STATUS_LABELS) as DeliveryStatus[]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Entregas</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{deliveries.length} entregas</p>
        </div>
        <Button asChild>
          <Link href="/entregas/nueva">
            <Plus className="mr-1.5 h-4 w-4" />
            Nueva entrega
          </Link>
        </Button>
      </div>

      <form className="flex flex-wrap gap-3">
        <select
          name="status"
          defaultValue={searchParams.status ?? ''}
          className="h-9 rounded-lg border border-cn-line bg-white px-3 text-sm focus:outline-none"
        >
          <option value="">Todos los estados</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-9 rounded-lg bg-cn-teal-900 px-4 text-sm font-medium text-white hover:opacity-90"
        >
          Filtrar
        </button>
        {searchParams.status && (
          <a
            href="/entregas"
            className="inline-flex h-9 items-center rounded-lg border border-cn-line px-3 text-sm text-cn-ink-500 hover:bg-cn-cream-50"
          >
            Limpiar
          </a>
        )}
      </form>

      {deliveries.length === 0 ? (
        <div className="rounded-xl border border-cn-line py-16 text-center">
          <p className="text-cn-ink-400 text-sm">No hay entregas.</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/entregas/nueva">Crear la primera entrega</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-cn-line">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-cn-line bg-cn-cream-50">
                <th className="px-4 py-2.5 text-left font-medium text-cn-ink-500">Vehículo</th>
                <th className="px-4 py-2.5 text-left font-medium text-cn-ink-500">Comprador</th>
                <th className="px-4 py-2.5 text-left font-medium text-cn-ink-500">Estado</th>
                <th className="hidden px-4 py-2.5 text-left font-medium text-cn-ink-500 md:table-cell">
                  Responsable
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-cn-ink-500">Fecha cita</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-cn-line last:border-0 hover:bg-cn-cream-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/entregas/${d.id}`}
                      className="font-medium text-cn-teal-900 hover:underline"
                    >
                      {d.vehicle.brand} {d.vehicle.model}{' '}
                      <span className="text-cn-ink-400 font-normal">{d.vehicle.year}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-cn-ink-700">{d.buyerLead.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[d.status]}`}
                    >
                      {STATUS_LABELS[d.status]}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-cn-ink-500 md:table-cell">
                    {d.responsable?.name ?? '—'}
                  </td>
                  <td className="text-cn-ink-400 px-4 py-3">
                    {new Date(d.scheduledAt).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
