import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { buyerMergePreview, BuyerMergeError } from '@/lib/buyer-merge'
import { unifyBuyerContacts } from './actions'

export const dynamic = 'force-dynamic'

export default async function UnifyBuyersPage({
  searchParams,
}: {
  searchParams: { ids?: string }
}) {
  await requireAdmin()
  try {
    const p = await buyerMergePreview(db, searchParams.ids?.split(',') ?? [])
    const blocked = !!(
      p.target.mergedIntoId ||
      p.source.mergedIntoId ||
      p.target.archivedAt ||
      p.source.archivedAt ||
      [p.target, p.source].some(
        (row) =>
          row._count.offers ||
          row._count.deliveries ||
          row.warranty ||
          row._count.documents ||
          row._count.operationalDocuments ||
          row.tradeInSellerLeadId
      )
    )
    return (
      <div className="max-w-3xl space-y-5 p-6">
        <h1 className="text-2xl font-bold">Unificar fichas de comprador</h1>
        <p>
          Ficha principal:{' '}
          <Link className="underline" href={`/compradores/${p.target.id}`}>
            {p.target.name}
          </Link>
          . Ficha que se archivará:{' '}
          <Link className="underline" href={`/compradores/${p.source.id}`}>
            {p.source.name}
          </Link>
          .
        </p>
        <p className="font-semibold">Responsable: {p.responsible.name}</p>
        <p>
          {p.first
            ? `Primera atención registrada: ${p.first.createdAt.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })} (${p.first.type}).`
            : 'Sin atención humana registrada. Se conserva el responsable de la ficha más antigua.'}
        </p>
        <p>
          Se conservarán {p.target._count.activities + p.source._count.activities} actividades y{' '}
          {p.target._count.chatSessions + p.source._count.chatSessions} conversaciones, con sus
          autores y fechas originales.
        </p>
        <p>
          Las notas y conversaciones se reunirán en la ficha principal. Los datos originales de la
          ficha absorbida quedarán archivados y los enlaces antiguos abrirán la ficha principal.
        </p>
        {blocked ? (
          <p>
            No se puede aplicar esta unificación: hay fichas archivadas, unificadas o dependencias
            que requieren revisión especializada.
          </p>
        ) : (
          <form action={unifyBuyerContacts}>
            {[p.target.id, p.source.id].map((id) => (
              <input key={id} type="hidden" name="ids" value={id} />
            ))}
            <input type="hidden" name="targetVersion" value={p.target.updatedAt.toISOString()} />
            <input type="hidden" name="sourceVersion" value={p.source.updatedAt.toISOString()} />
            <input type="hidden" name="responsibleId" value={p.responsible.id} />
            <button className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">
              Unificar y conservar el historial
            </button>
          </form>
        )}
      </div>
    )
  } catch (error) {
    if (!(error instanceof BuyerMergeError)) throw error
    return <p className="p-6">{error.message}</p>
  }
}
