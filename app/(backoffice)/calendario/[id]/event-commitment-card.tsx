'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { setEventCommitment } from '../actions'
import {
  COMMITMENT_CHOICES,
  COMMITMENT_HINTS,
  COMMITMENT_LABELS,
  isCommitmentValidForType,
} from '@/lib/calendar/commitment'
import type { CalendarEventType, EventCommitment } from '@prisma/client'

type Props = {
  eventId: string
  type: CalendarEventType
  commitment: EventCommitment
}

/**
 * I0: permite clasificar un evento cuya naturaleza no se pudo deducir en la migración.
 * Solo se muestra mientras siga `INDETERMINADO`; una vez clasificado no se vuelve atrás.
 */
export function EventCommitmentCard({ eventId, type, commitment }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (commitment !== 'INDETERMINADO') return null

  const choices = COMMITMENT_CHOICES.filter((c) => isCommitmentValidForType(type, c))

  function classify(next: EventCommitment) {
    setError(null)
    startTransition(async () => {
      const result = await setEventCommitment(eventId, next)
      if (result.error) setError(result.error)
      else router.refresh()
    })
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-amber-900">
        <AlertCircle className="h-4 w-4" />
        Pendiente de clasificar
      </p>
      <p className="mt-1 text-[13px] text-amber-900/80">
        Este evento se creó antes de que distinguiéramos compromisos con el cliente de tareas
        internas. Clasifícalo para que el CRM sepa si puede archivarse el lead asociado.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {choices.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => classify(c)}
            disabled={pending}
            className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-[13px] font-medium text-amber-900 transition-colors hover:border-amber-500 disabled:opacity-50"
          >
            {COMMITMENT_LABELS[c]}
            <span className="ml-2 font-normal opacity-70">{COMMITMENT_HINTS[c]}</span>
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-[13px] text-red-600">{error}</p>}
    </div>
  )
}
