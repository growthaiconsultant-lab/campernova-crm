import Link from 'next/link'
import {
  surveyExperienceLabels,
  type SurveyClient,
  type SurveyResponse,
} from '@/lib/surveys/responses'

const dateTime = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
})

function ratingLabel(value: SurveyResponse['ratings'][number]['value']) {
  if (value === 'no_aplica') return 'No aplica'
  if (value === 'sin_informacion') return 'No recibió información'
  return value === null ? 'Sin valoración' : `${value}/5`
}

export function SurveyResponseList({
  rows,
  clients,
}: {
  rows: SurveyResponse[]
  clients?: Map<string, SurveyClient>
}) {
  if (!rows.length)
    return (
      <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
        Todavía no hay respuestas en esta vista.
      </p>
    )

  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const customer = clients?.get(`${row.crmKind}:${row.crmLeadId}`)
        const contact = [row.contactName, row.contactEmail, row.contactPhone].filter(Boolean)
        return (
          <li key={row.id} className="min-w-0 overflow-hidden rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{surveyExperienceLabels[row.experience]}</p>
                {clients &&
                  (customer ? (
                    <Link className="text-sm underline underline-offset-2" href={customer.href}>
                      {customer.name}
                    </Link>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {row.crmLeadId ? 'Ficha vinculada no disponible' : 'Sin ficha vinculada'}
                    </p>
                  ))}
              </div>
              <time dateTime={row.submittedAt} className="text-sm text-muted-foreground">
                {dateTime.format(new Date(row.submittedAt))}
              </time>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <span>
                Satisfacción general <strong>{row.satisfaction}/5</strong>
              </span>
              <span>
                Atención del equipo <strong>{row.service}/5</strong>
              </span>
            </div>
            {row.reason && (
              <p className="mt-2 break-words text-sm">
                <strong>Motivo</strong> {row.otherReason || row.reason}
              </p>
            )}
            {row.comment && (
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">{row.comment}</p>
            )}
            <details className="mt-3 text-sm">
              <summary className="w-fit cursor-pointer font-medium underline-offset-2 hover:underline">
                Ver detalle de la respuesta
              </summary>
              <dl className="mt-2 space-y-1">
                {row.ratings.map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex flex-wrap justify-between gap-x-4 rounded bg-muted px-2 py-1"
                  >
                    <dt>{label}</dt>
                    <dd className="font-medium">{ratingLabel(value)}</dd>
                  </div>
                ))}
              </dl>
              {contact.length > 0 && (
                <div className="mt-3 break-words">
                  <p className="font-medium">Pidió que le contactemos</p>
                  <p>{contact.join(' · ')}</p>
                </div>
              )}
            </details>
          </li>
        )
      })}
    </ul>
  )
}
