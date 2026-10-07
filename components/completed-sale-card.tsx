import Link from 'next/link'
import { personLabel, vehicleLabel } from '@/lib/display'
import type { CompletedSale } from '@/lib/completed-sales'

export function CompletedSaleCard({
  sales,
  side,
}: {
  sales: CompletedSale[]
  side: 'buyer' | 'seller'
}) {
  const title =
    side === 'seller'
      ? 'Comprador final'
      : sales.length > 1
        ? 'Vehículos comprados'
        : 'Vehículo comprado'

  return (
    <section aria-label={title} className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </h2>
      {sales.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">
          No hay ninguna venta completada asociada.
        </p>
      ) : (
        <ul className="space-y-4">
          {sales.map((sale) => (
            <li
              key={sale.id}
              className="space-y-2 border-b border-border pb-4 last:border-0 last:pb-0"
            >
              <Link
                href={`/vendedores/${sale.vehicle.sellerLead.id}`}
                className="block text-[13px] font-semibold text-foreground hover:underline"
              >
                {vehicleLabel(sale.vehicle)}
              </Link>
              <dl className="space-y-2 text-[12px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Matrícula</dt>
                  <dd className="text-right font-medium">
                    {sale.vehicle.plate?.trim() || 'Sin registrar'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">
                    {side === 'buyer' ? 'Vendedor' : 'Comprador'}
                  </dt>
                  <dd className="min-w-0 text-right font-medium">
                    {side === 'buyer' ? (
                      <Link
                        href={`/vendedores/${sale.vehicle.sellerLead.id}`}
                        className="text-sidebar-primary hover:underline"
                      >
                        {personLabel(sale.vehicle.sellerLead.name, {
                          role: 'Vendedor sin identificar',
                          id: sale.vehicle.sellerLead.id,
                        })}
                      </Link>
                    ) : sale.buyerLead ? (
                      <Link
                        href={`/compradores/${sale.buyerLead.id}`}
                        className="text-sidebar-primary hover:underline"
                      >
                        {personLabel(sale.buyerLead.name, {
                          role: 'Comprador sin identificar',
                          id: sale.buyerLead.id,
                        })}
                      </Link>
                    ) : (
                      'Sin identificar'
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Fecha de compra</dt>
                  <dd className="text-right font-medium">
                    {sale.completedAt
                      ? sale.completedAt.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })
                      : 'Sin registrar'}
                  </dd>
                </div>
              </dl>
              <Link
                href={`/entregas/${sale.id}`}
                className="block text-[12px] font-medium text-sidebar-primary hover:underline"
              >
                Ver entrega completada →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
