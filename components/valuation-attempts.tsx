import type { VehicleValuationAttempt, User } from '@prisma/client'

type AttemptWithAuthor = VehicleValuationAttempt & { createdBy: Pick<User, 'name'> | null }

const OUTCOME_META: Record<string, { label: string; className: string }> = {
  COMPLETADA: { label: 'Completada', className: 'bg-green-100 text-green-700' },
  SIN_REFERENCIA: { label: 'Sin referencia', className: 'bg-yellow-100 text-yellow-700' },
  FALLO_TECNICO: { label: 'Fallo técnico', className: 'bg-red-100 text-red-700' },
}

const PURPOSE_LABELS: Record<string, string> = { OFICIAL: 'Oficial', PRELIMINAR: 'Preliminar' }
const METHOD_LABELS: Record<string, string> = { AUTO: 'Automática', MANUAL: 'Manual' }

function fmtEur(value: unknown): string {
  if (value === null || value === undefined) return '—'
  const n = typeof value === 'object' ? (value as { toNumber(): number }).toNumber() : Number(value)
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

/**
 * Lista de INTENTOS de valoración (A3): incluye los que NO produjeron cifras (SIN_REFERENCIA /
 * FALLO_TECNICO), imposibles de ver en el historial de `Valuation`. Fuente de trazabilidad de
 * valoración. Muestra finalidad, resultado, método, confianza, referencia/error, autor y fecha.
 */
export function ValuationAttempts({ attempts }: { attempts: AttemptWithAuthor[] }) {
  if (attempts.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin intentos de valoración registrados.</p>
  }

  return (
    <ul className="space-y-2">
      {attempts.map((a) => {
        const outcome = OUTCOME_META[a.outcome] ?? OUTCOME_META.SIN_REFERENCIA
        return (
          <li key={a.id} className="rounded-md border border-border px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">
                {PURPOSE_LABELS[a.purpose] ?? a.purpose}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${outcome.className}`}
              >
                {outcome.label}
              </span>
              <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">
                {METHOD_LABELS[a.method] ?? a.method}
              </span>
              {a.confidence && (
                <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">
                  {a.confidence}
                </span>
              )}
              {a.outcome === 'COMPLETADA' && (
                <span className="text-muted-foreground">
                  {fmtEur(a.recommended)} ({fmtEur(a.min)} – {fmtEur(a.max)})
                </span>
              )}
            </div>
            {(a.referenceUsed || a.errorCode || a.reason) && (
              <p className="mt-1 text-muted-foreground">
                {a.referenceUsed ?? ''}
                {a.errorCode ? `Error: ${a.errorCode}` : ''}
                {a.reason ? ` · ${a.reason}` : ''}
              </p>
            )}
            <p className="mt-1 text-muted-foreground">
              {new Date(a.createdAt).toLocaleString('es-ES', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {a.createdBy ? ` · ${a.createdBy.name}` : ''}
            </p>
          </li>
        )
      })}
    </ul>
  )
}
