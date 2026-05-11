import Link from 'next/link'
import { db } from '@/lib/db'
import { requireCanViewTaller } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import type { WorkOrderStatus, WorkOrderApprovalLevel } from '@prisma/client'

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  PENDIENTE: 'Pendiente',
  EN_DIAGNOSTICO: 'En diagnóstico',
  PRESUPUESTADA: 'Presupuestada',
  EN_CURSO: 'En curso',
  COMPLETADA: 'Completada',
  RECHAZADA: 'Rechazada',
}

const STATUS_COLORS: Record<WorkOrderStatus, string> = {
  PENDIENTE: 'bg-gray-100 text-gray-700',
  EN_DIAGNOSTICO: 'bg-blue-100 text-blue-700',
  PRESUPUESTADA: 'bg-yellow-100 text-yellow-700',
  EN_CURSO: 'bg-teal-100 text-teal-700',
  COMPLETADA: 'bg-green-100 text-green-700',
  RECHAZADA: 'bg-red-100 text-red-700',
}

const APPROVAL_LABELS: Record<WorkOrderApprovalLevel, string> = {
  NO_REQUIERE: 'Sin requerir',
  REQUIERE_CEO: 'Pendiente CEO',
  APROBADA_CEO: 'Aprobada',
  RECHAZADA_CEO: 'Rechazada CEO',
}

const APPROVAL_COLORS: Record<WorkOrderApprovalLevel, string> = {
  NO_REQUIERE: 'bg-gray-100 text-gray-600',
  REQUIERE_CEO: 'bg-orange-100 text-orange-700',
  APROBADA_CEO: 'bg-green-100 text-green-700',
  RECHAZADA_CEO: 'bg-red-100 text-red-700',
}

export default async function TallerPage({
  searchParams,
}: {
  searchParams: { status?: string; assigned?: string }
}) {
  await requireCanViewTaller()

  const where: Record<string, unknown> = {}
  if (searchParams.status) where.status = searchParams.status
  if (searchParams.assigned) where.assignedToId = searchParams.assigned

  const [workOrders, users] = await Promise.all([
    db.workOrder.findMany({
      where,
      include: {
        vehicle: {
          select: {
            id: true,
            brand: true,
            model: true,
            year: true,
            sellerLead: { select: { id: true, name: true } },
          },
        },
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const statuses = Object.keys(STATUS_LABELS) as WorkOrderStatus[]

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Taller</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {workOrders.length} órdenes de trabajo
          </p>
        </div>
        <Button asChild>
          <Link href="/taller/nueva">
            <Plus className="mr-1.5 h-4 w-4" />
            Nueva orden
          </Link>
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
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
          <select
            name="assigned"
            defaultValue={searchParams.assigned ?? ''}
            className="h-9 rounded-lg border border-cn-line bg-white px-3 text-sm focus:outline-none"
          >
            <option value="">Todos los mecánicos</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-9 rounded-lg bg-cn-teal-900 px-4 text-sm font-medium text-white hover:opacity-90"
          >
            Filtrar
          </button>
          {(searchParams.status || searchParams.assigned) && (
            <a
              href="/taller"
              className="inline-flex h-9 items-center rounded-lg border border-cn-line px-3 text-sm text-cn-ink-500 hover:bg-cn-cream-50"
            >
              Limpiar
            </a>
          )}
        </form>
      </div>

      {/* Tabla */}
      {workOrders.length === 0 ? (
        <div className="rounded-xl border border-cn-line py-16 text-center">
          <p className="text-cn-ink-400 text-sm">No hay órdenes de trabajo.</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/taller/nueva">Crear la primera orden</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-cn-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cn-line bg-cn-cream-50">
                <th className="px-4 py-2.5 text-left font-medium text-cn-ink-500">Vehículo</th>
                <th className="px-4 py-2.5 text-left font-medium text-cn-ink-500">Descripción</th>
                <th className="px-4 py-2.5 text-left font-medium text-cn-ink-500">Estado</th>
                <th className="hidden px-4 py-2.5 text-left font-medium text-cn-ink-500 sm:table-cell">
                  Aprobación
                </th>
                <th className="hidden px-4 py-2.5 text-right font-medium text-cn-ink-500 md:table-cell">
                  Coste est.
                </th>
                <th className="hidden px-4 py-2.5 text-left font-medium text-cn-ink-500 lg:table-cell">
                  Asignado
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-cn-ink-500">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {workOrders.map((wo) => (
                <tr
                  key={wo.id}
                  className="border-b border-cn-line last:border-0 hover:bg-cn-cream-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/taller/${wo.id}`}
                      className="font-medium text-cn-teal-900 hover:underline"
                    >
                      {wo.vehicle.brand} {wo.vehicle.model}{' '}
                      <span className="text-cn-ink-400 font-normal">{wo.vehicle.year}</span>
                    </Link>
                    <p className="text-cn-ink-400 text-xs">{wo.vehicle.sellerLead?.name}</p>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-cn-ink-700">
                    {wo.description}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[wo.status]}`}
                    >
                      {STATUS_LABELS[wo.status]}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${APPROVAL_COLORS[wo.approvalLevel]}`}
                    >
                      {APPROVAL_LABELS[wo.approvalLevel]}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-right font-medium text-cn-ink-700 md:table-cell">
                    {wo.estimatedCost
                      ? Number(wo.estimatedCost).toLocaleString('es-ES', {
                          style: 'currency',
                          currency: 'EUR',
                          maximumFractionDigits: 0,
                        })
                      : '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-cn-ink-500 lg:table-cell">
                    {wo.assignedTo?.name ?? '—'}
                  </td>
                  <td className="text-cn-ink-400 px-4 py-3">
                    {new Date(wo.createdAt).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
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
