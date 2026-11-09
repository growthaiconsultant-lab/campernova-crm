import Link from 'next/link'
import { db } from '@/lib/db'
import { prismaMatchingDeps } from '@/lib/matching/prisma-deps'
import { scorePair, compareMatches } from '@/lib/matching/find'
import { assessPair } from '@/lib/matching/assessment'

export async function BuyerCatalogResults({ id }: { id: string }) {
  const deps = prismaMatchingDeps(db)
  const buyer = await deps.getBuyer(id)
  if (!buyer) return null
  const vehicles = await deps.listEligibleVehicles()
  const rows = vehicles.map((vehicle) => {
    const result = assessPair(vehicle, buyer)
    return { vehicle, result, rank: scorePair(vehicle, buyer, undefined, result) }
  })
  if (
    rows.length &&
    rows.every(
      ({ result: r }) => !r.met.length && !r.wanted.length && !r.failed.length && !r.missing.length
    )
  )
    return <p>Añade criterios a la búsqueda para comparar el stock.</p>
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h2 className="font-semibold">Comparación con el stock disponible</h2>
      {(['apto', 'pendiente', 'descartado'] as const).map((state) => {
        const group = rows
          .filter((r) => r.result.state === state)
          .sort((a, b) => compareMatches(a.rank, b.rank))
        const label = {
          apto: 'Aptos para recomendar',
          pendiente: 'Pendientes de comprobar',
          descartado: 'Descartados para esta búsqueda',
        }[state]
        return (
          <details key={state} open={state === 'apto'}>
            <summary className="cursor-pointer">
              {label} ({group.length})
            </summary>
            <ul className="divide-y">
              {group.map(({ vehicle: v, result: r }) => (
                <li className="py-2" key={v.id}>
                  <Link className="font-medium underline" href={'/vendedores/' + v.sellerLeadId}>
                    {[v.brand, v.model, v.year].filter(Boolean).join(' ') ||
                      'Ver ficha del vehículo'}
                  </Link>
                  <p>
                    {r.confirmed.length} de {r.wanted.length} preferencias confirmadas
                  </p>
                  {r.met.length > 0 && <p>Imprescindibles cubiertos: {r.met.join('; ')}</p>}
                  {r.confirmed.length > 0 && (
                    <p>Preferencias cubiertas: {r.confirmed.join('; ')}</p>
                  )}
                  {r.failed.length > 0 && <p>Incumple: {r.failed.join('; ')}</p>}
                  {r.missing.length > 0 && (
                    <p>Imprescindible por confirmar: {r.missing.join('; ')}</p>
                  )}
                  {r.unknown.length > 0 && (
                    <p>Preferencias por confirmar: {r.unknown.join('; ')}</p>
                  )}
                  {r.wanted.some((x) => !r.confirmed.includes(x) && !r.unknown.includes(x)) && (
                    <p>
                      Otras preferencias sin cubrir:{' '}
                      {r.wanted
                        .filter((x) => !r.confirmed.includes(x) && !r.unknown.includes(x))
                        .join('; ')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )
      })}
    </section>
  )
}
