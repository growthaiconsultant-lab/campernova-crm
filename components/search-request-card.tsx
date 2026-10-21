import {
  formatSearchAnswer,
  readSearchSnapshot,
  type SearchAnswerRow,
  type SearchAnswerSection,
} from '@/lib/search-request/presentation'

function Answer({ row }: { row: SearchAnswerRow }) {
  return (
    <div
      className={
        row.kind === 'textarea' || row.value.length > 130 ? 'min-w-0 sm:col-span-2' : 'min-w-0'
      }
    >
      <dt className="text-xs leading-relaxed text-muted-foreground">{row.label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-[15px] font-medium leading-relaxed text-foreground [overflow-wrap:anywhere]">
        {formatSearchAnswer(row)}
      </dd>
    </div>
  )
}

function AnswerSection({ section }: { section: SearchAnswerSection }) {
  const answered = section.rows.filter((row) => row.provided)
  const empty = section.rows.filter((row) => !row.provided)
  return (
    <section
      className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5"
      aria-label={section.title}
    >
      <h3 className="mb-4 text-base font-semibold text-foreground">{section.title}</h3>
      <dl className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        {answered.map((row) => (
          <Answer key={row.key} row={row} />
        ))}
      </dl>
      {empty.length > 0 && (
        <details className="mt-5 border-t border-border pt-3">
          <summary className="cursor-pointer py-1 text-xs text-muted-foreground">
            Sin responder ({empty.length})
          </summary>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
            {empty.map((row) => (
              <li key={row.key}>{row.label}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

export function SearchRequestCard({
  content,
  receivedAt,
}: {
  content: string | null
  receivedAt: string
}) {
  const sections = readSearchSnapshot(content)
  const answered = sections?.filter((section) => section.rows.some((row) => row.provided)) ?? []
  const empty = sections?.filter((section) => section.rows.every((row) => !row.provided)) ?? []
  const rows = sections?.flatMap((section) => section.rows) ?? []
  const find = (key: string) => rows.find((row) => row.key === key && row.provided)
  const summary = ['budget', 'budgetLimit', 'deadline', 'finance']
    .map(find)
    .filter((row): row is SearchAnswerRow => !!row)
  const priorities = answered.find((section) =>
    section.rows.some((row) => row.key === 'essential1')
  )
  const ordered = priorities
    ? [priorities, ...answered.filter((section) => section !== priorities)]
    : answered

  return (
    <section
      className="ph-no-capture ph-mask mt-5 min-w-0 rounded-2xl border border-border bg-muted/20 p-4 sm:p-6"
      aria-labelledby="search-request-title"
      data-sentry-mask
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="search-request-title" className="text-lg font-semibold text-foreground">
            Ficha de búsqueda bajo pedido
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Respuestas originales del cliente · Recibida el {receivedAt}
          </p>
        </div>
        <span className="rounded-full bg-card px-3 py-1.5 text-xs text-muted-foreground">
          Solicitud de contacto
        </span>
      </div>
      {sections ? (
        <>
          {summary.length > 0 && (
            <dl className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {summary.map((row) => (
                <div key={row.key} className="min-w-0 rounded-xl border border-border bg-card p-4">
                  <dt className="text-xs leading-relaxed text-muted-foreground">{row.label}</dt>
                  <dd className="mt-2 break-words text-lg font-semibold text-sidebar-primary">
                    {formatSearchAnswer(row)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2">
            {ordered.map((section) => (
              <AnswerSection key={section.title} section={section} />
            ))}
          </div>
          {empty.length > 0 && (
            <details className="mt-4 rounded-xl border border-border bg-card p-4">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                Apartados sin respuestas ({empty.length})
              </summary>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                {empty.map((section) => (
                  <section key={section.title}>
                    <h3 className="text-sm font-semibold">{section.title}</h3>
                    <ul className="mt-2 space-y-1 text-xs leading-relaxed text-muted-foreground">
                      {section.rows.map((row) => (
                        <li key={row.key}>{row.label}</li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </details>
          )}
        </>
      ) : (
        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
          Esta ficha conserva un formato anterior o incluye texto que requiere revisión. Puedes
          consultar todas las respuestas en el original completo.
        </p>
      )}
      <details className="mt-5 rounded-xl border border-border bg-card p-4" open={!sections}>
        <summary className="cursor-pointer py-1 text-sm font-medium text-sidebar-primary">
          Ver ficha original completa
        </summary>
        <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">
          {content ?? 'No se ha podido recuperar el contenido de la ficha.'}
        </p>
      </details>
    </section>
  )
}
