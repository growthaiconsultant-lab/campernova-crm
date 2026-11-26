import Link from 'next/link'
import { requireAgente } from '@/lib/auth'
import { SurveyResponseList } from '@/components/surveys/response-list'
import {
  readSurveyResponses,
  resolveSurveyClients,
  surveyCursor,
  surveyExperience,
  surveyExperienceLabels,
} from '@/lib/surveys/responses'

export const dynamic = 'force-dynamic'

export default async function EncuestasPage({
  searchParams,
}: {
  searchParams: { tipo?: string; cursor?: string }
}) {
  await requireAgente()
  const selected = surveyExperience.safeParse(searchParams.tipo)
  const experience = selected.success ? selected.data : undefined
  const cursor = surveyCursor(searchParams.cursor)
  const page = await readSurveyResponses({ experience, cursor })
  const clients = page ? await resolveSurveyClients(page.rows) : undefined
  const baseHref = experience ? '/encuestas?tipo=' + experience : '/encuestas'

  return (
    <section className="ph-no-capture ph-mask mx-auto max-w-5xl space-y-5" data-sentry-mask>
      <h1 className="text-2xl font-semibold">Encuestas de satisfacción</h1>
      <nav aria-label="Filtrar por experiencia" className="flex flex-wrap gap-2">
        {[undefined, ...surveyExperience.options].map((kind) => (
          <Link
            key={kind ?? 'todos'}
            href={kind ? '/encuestas?tipo=' + kind : '/encuestas'}
            aria-current={kind === experience ? 'page' : undefined}
            className={`rounded-md border px-3 py-2 text-sm font-medium ${kind === experience ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'}`}
          >
            {kind ? surveyExperienceLabels[kind] : 'Todas'}
          </Link>
        ))}
      </nav>
      {page ? (
        <SurveyResponseList rows={page.rows} clients={clients} />
      ) : (
        <p role="status" className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
          No se pueden consultar las respuestas en este momento.
        </p>
      )}
      {(cursor || page?.nextCursor) && (
        <nav className="flex flex-wrap gap-4 text-sm" aria-label="Páginas de respuestas">
          {cursor && (
            <Link className="underline" href={baseHref}>
              Volver a las más recientes
            </Link>
          )}
          {page?.nextCursor && (
            <Link
              className="underline"
              href={
                baseHref +
                (experience ? '&' : '?') +
                'cursor=' +
                encodeURIComponent(page.nextCursor)
              }
            >
              Respuestas anteriores
            </Link>
          )}
        </nav>
      )}
    </section>
  )
}
