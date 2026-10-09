import { attributionFromActivities, landingAttributionRows } from '@/lib/landing/attribution'

export function LandingAttribution({
  activities,
  compact = false,
}: {
  activities: { content: string | null; agentId?: string | null }[]
  compact?: boolean
}) {
  const attribution = attributionFromActivities(activities)
  if (!attribution) return null
  const rows = landingAttributionRows(attribution)
  if (compact) {
    const summary = rows.filter((r) =>
      ['Landing', 'Origen del enlace', 'Campaña'].includes(r.label)
    )
    return (
      <div
        className="mt-1 max-w-64 break-words text-[11px] text-muted-foreground"
        title={rows.map((r) => `${r.label}: ${r.value}`).join('\n')}
      >
        {summary.map((r) => (
          <div key={r.label}>
            {r.label === 'Campaña' ? 'Campaña: ' : ''}
            {r.value}
          </div>
        ))}
      </div>
    )
  }
  return (
    <section
      aria-label="Origen de la campaña"
      className="mt-3 rounded-lg border border-border bg-muted/30 p-3"
    >
      <p className="mb-2 text-xs font-semibold">Origen de la campaña</p>
      <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="min-w-0 break-words">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="font-medium">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
