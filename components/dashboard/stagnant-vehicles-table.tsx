import Link from 'next/link'
import { VEHICLE_STATUS_LABELS, VEHICLE_STATUS_CLASSES } from '@/lib/state-machine'
import type { StagnantVehicle } from '@/lib/dashboard/metrics'
import type { VehicleStatus } from '@prisma/client'

type Props = {
  vehicles: StagnantVehicle[]
}

const EUR = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

export function StagnantVehiclesTable({ vehicles }: Props) {
  if (vehicles.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        Ningún vehículo lleva más de 90 días en el mismo estado.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-2 font-medium">Vehículo</th>
            <th className="py-2 font-medium">Estado</th>
            <th className="py-2 text-right font-medium">Días</th>
            <th className="py-2 text-right font-medium">Precio</th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map((v) => {
            const price = v.salePrice ?? v.purchasePrice
            const isCritical = v.daysInStatus > 180
            return (
              <tr key={v.id} className="border-b last:border-0">
                <td className="py-2">
                  {v.sellerLeadId ? (
                    <Link
                      href={`/vendedores/${v.sellerLeadId}`}
                      className="font-medium hover:underline"
                    >
                      {v.brand} {v.model} {v.year ?? ''}
                    </Link>
                  ) : (
                    <span className="font-medium">
                      {v.brand} {v.model} {v.year ?? ''}
                    </span>
                  )}
                </td>
                <td className="py-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${VEHICLE_STATUS_CLASSES[v.status as VehicleStatus]}`}
                  >
                    {VEHICLE_STATUS_LABELS[v.status as VehicleStatus]}
                  </span>
                </td>
                <td className="py-2 text-right">
                  <span
                    className={`font-semibold ${isCritical ? 'text-red-600' : 'text-amber-600'}`}
                  >
                    {v.daysInStatus}d
                  </span>
                </td>
                <td className="py-2 text-right text-muted-foreground">
                  {price ? EUR.format(price) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
