import Link from 'next/link'
import { requireAgente } from '@/lib/auth'

export default async function MatchesPage() {
  await requireAgente()

  return (
    <div>
      <h1 className="text-2xl font-bold">Matches</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Abre la ficha de un comprador y entra en «Vehículos de interés» para ver qué unidades
        encajan y qué falta confirmar.
      </p>
      <Link href="/compradores" className="mt-4 inline-block underline">
        Ver compradores
      </Link>
    </div>
  )
}
