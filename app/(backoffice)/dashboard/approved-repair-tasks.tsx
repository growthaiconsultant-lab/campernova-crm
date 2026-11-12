'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ScheduleCard } from '../taller/[id]/schedule-card'
import type { ApprovedRepairQueue } from '@/lib/dashboard/approved-repairs'
import { euro, quoteTotal } from '@/lib/entry/owner-quote'

export function ApprovedRepairTasks({ queue }: { queue: ApprovedRepairQueue }) {
  const router = useRouter()
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [router])
  return (
    <>
      {queue.tasks.map((t) => (
        <article
          key={t.quoteId}
          data-sentry-mask
          className="my-2 space-y-2 rounded-lg border border-line bg-card p-4"
        >
          <p className="text-xs font-semibold text-brand">
            Por programar · Presupuesto v{t.version} aceptado{' '}
            {t.answeredAt &&
              new Date(t.answeredAt).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })}
          </p>
          <h3 className="font-semibold">Programar reparaciones · {t.vehicle}</h3>
          <p className="text-sm text-ink2">
            {t.owner && 'Propietario · ' + t.owner + ' · '}Coordinación ·{' '}
            {t.coordinator || 'Sin asignar'}
          </p>
          <ul className="divide-y text-sm">
            {t.lines.map((l) => (
              <li key={l.itemId} className="flex justify-between gap-3 py-2">
                <div className="min-w-0 break-words">
                  <strong>{l.item}</strong>
                  <p>{l.description}</p>
                </div>
                <span className="shrink-0">{euro(l.cents ?? 0)}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm font-semibold">
            Total aprobado con IVA · {euro(quoteTotal(t.lines))}
          </p>
          <details>
            <summary className="w-fit cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Programar en taller
            </summary>
            <ScheduleCard
              quoteId={t.quoteId}
              users={queue.users}
              assignedToId={null}
              assignedToName={null}
              scheduledStart={null}
              scheduledEnd={null}
              estimatedHours={null}
              isClosed={false}
              canEdit
            />
          </details>
          <Link
            className="inline-block text-sm text-brand underline"
            href={'/taller/' + t.inspectionId + '#inspeccion-entrada'}
          >
            Ver inspección
          </Link>
        </article>
      ))}
      <Link
        className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline"
        href="/taller/agenda"
      >
        Ver agenda de taller
      </Link>
    </>
  )
}
