import Link from 'next/link'
import type { BuyerAgendaEntry } from '@/lib/buyer-agenda'

export function BuyerAgendaRow({
  entry,
  reminderEditor,
}: {
  entry: BuyerAgendaEntry
  reminderEditor?: React.ReactNode
}) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="break-words font-semibold">{entry.title}</p>
        {entry.eventId && (
          <Link
            className="py-1 text-sm font-medium text-brand underline"
            href={`/calendario/${entry.eventId}`}
          >
            Gestionar acción
          </Link>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {!entry.eventId && 'Recordatorio de la ficha · '}
        {entry.due ? (
          <>
            {entry.due < new Date() && <span className="font-semibold">Vencida · </span>}
            <time dateTime={entry.due.toISOString()}>
              {entry.due.toLocaleString('es-ES', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'Europe/Madrid',
              })}
            </time>{' '}
            · hora de Madrid
          </>
        ) : (
          'Sin fecha'
        )}
      </p>
      {entry.description && (
        <p className="whitespace-pre-wrap break-words text-sm">{entry.description}</p>
      )}
      {entry.assignee && (
        <p className="text-xs text-muted-foreground">Responsable · {entry.assignee}</p>
      )}
      {reminderEditor}
    </div>
  )
}
