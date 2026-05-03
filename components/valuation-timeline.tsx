import type { Valuation, User } from '@prisma/client'

type ValuationWithAuthor = Valuation & { createdBy: Pick<User, 'name'> | null }

const CONFIDENCE_COLORS = {
  ALTA: 'bg-green-100 text-green-700',
  MEDIA: 'bg-yellow-100 text-yellow-700',
  BAJA: 'bg-red-100 text-red-700',
}

const METHOD_LABELS = {
  AUTO: 'Automática',
  MANUAL: 'Manual',
}

function formatEur(value: number | string | { toNumber(): number } | null): string {
  if (value === null || value === undefined) return '—'
  const n = typeof value === 'object' ? value.toNumber() : Number(value)
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

type Props = { valuations: ValuationWithAuthor[] }

export function ValuationTimeline({ valuations }: Props) {
  if (valuations.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin tasaciones registradas todavía.</p>
  }

  return (
    <ol className="space-y-3">
      {valuations.map((v, idx) => (
        <li key={v.id} className="flex gap-3">
          {/* línea vertical */}
          <div className="flex flex-col items-center">
            <div
              className={`mt-1 h-2.5 w-2.5 rounded-full border-2 ${idx === 0 ? 'border-campernova-accent bg-campernova-accent' : 'border-muted-foreground bg-background'}`}
            />
            {idx < valuations.length - 1 && <div className="mt-1 w-px flex-1 bg-border" />}
          </div>

          {/* contenido */}
          <div className="min-w-0 space-y-1 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{formatEur(v.recommended)}</span>
              <span className="text-xs text-muted-foreground">
                ({formatEur(v.min)} – {formatEur(v.max)})
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CONFIDENCE_COLORS[v.confidence]}`}
              >
                {v.confidence}
              </span>
              <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {METHOD_LABELS[v.method]}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(v.createdAt).toLocaleString('es-ES', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {v.createdBy ? ` · ${v.createdBy.name}` : ''}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
