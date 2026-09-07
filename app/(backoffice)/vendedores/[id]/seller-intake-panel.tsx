'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Inbox, XCircle } from 'lucide-react'
import type { SellerIntakeStatus } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { decideSellerIntake } from '../intake-actions'

type Props = {
  leadId: string
  status: SellerIntakeStatus
}

export function SellerIntakePanel({ leadId, status }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  if (status === 'ADMITIDO') return null

  function decide(target: 'ADMITIDO' | 'RECHAZADO') {
    setError(null)
    startTransition(async () => {
      const result = await decideSellerIntake({ leadId, target })
      if ('error' in result) setError(result.error ?? 'No se pudo guardar la decisión.')
      else router.refresh()
    })
  }

  const rejected = status === 'RECHAZADO'

  return (
    <section
      className={`border-b px-4 py-3 md:px-10 ${
        rejected ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
      }`}
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          {rejected ? (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
          ) : (
            <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          )}
          <div>
            <p className={`text-sm font-semibold ${rejected ? 'text-red-900' : 'text-amber-900'}`}>
              {rejected ? 'Solicitud web rechazada' : 'Solicitud web pendiente de admisión'}
            </p>
            <p className={`text-xs ${rejected ? 'text-red-700' : 'text-amber-700'}`}>
              {rejected
                ? 'Se conserva para trazabilidad. Puedes admitirla si la decisión cambia.'
                : 'Revisa los datos antes de incorporarla al trabajo diario del equipo.'}
            </p>
            {error && <p className="mt-1 text-xs font-medium text-red-700">{error}</p>}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {!rejected && (
            <Button variant="outline" disabled={pending} onClick={() => decide('RECHAZADO')}>
              Rechazar
            </Button>
          )}
          <Button disabled={pending} onClick={() => decide('ADMITIDO')}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            {pending ? 'Guardando…' : 'Admitir en CRM'}
          </Button>
        </div>
      </div>
    </section>
  )
}
