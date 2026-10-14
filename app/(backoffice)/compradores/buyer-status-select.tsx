'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { BuyerLeadStatus } from '@prisma/client'
import {
  BUYER_LEAD_STATUS_CLASSES,
  BUYER_LEAD_STATUS_LABELS,
  BUYER_LEAD_TRANSITIONS,
} from '@/lib/state-machine'
import { cn } from '@/lib/utils'
import { setBuyerStatus } from './status-actions'

export function BuyerStatusSelect({
  leadId,
  status,
  buyerName,
}: {
  leadId: string
  status: BuyerLeadStatus
  buyerName: string
}) {
  const router = useRouter()
  const messageId = useId()
  const [saving, setSaving] = useState(false)
  const [refreshing, startRefresh] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const pending = saving || refreshing

  async function change(next: BuyerLeadStatus) {
    if (pending || next === status) return
    setSaving(true)
    setError(null)
    try {
      const result = await setBuyerStatus({ leadId, expectedStatus: status, status: next })
      if ('error' in result) setError(result.error)
      startRefresh(() => router.refresh())
    } catch {
      setError('No se pudo guardar el estado. Revisa el estado actual e inténtalo de nuevo.')
      startRefresh(() => router.refresh())
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="inline-flex max-w-full flex-col items-start gap-1"
      onClick={(event) => event.stopPropagation()}
    >
      <select
        aria-label={`Estado de ${buyerName}`}
        aria-describedby={pending || error ? messageId : undefined}
        aria-busy={pending}
        disabled={pending}
        value={status}
        title="Cambiar estado del comprador"
        onChange={(event) => void change(event.target.value as BuyerLeadStatus)}
        className={cn(
          'max-w-full cursor-pointer rounded-full border border-transparent py-1 pl-2.5 pr-6 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60',
          BUYER_LEAD_STATUS_CLASSES[status]
        )}
      >
        {[status, ...BUYER_LEAD_TRANSITIONS[status]].map((value) => (
          <option key={value} value={value}>
            {BUYER_LEAD_STATUS_LABELS[value]}
          </option>
        ))}
      </select>
      {pending ? (
        <span id={messageId} role="status" className="text-[11px] text-muted-foreground">
          Guardando…
        </span>
      ) : error ? (
        <span
          id={messageId}
          role="alert"
          className="max-w-[240px] text-xs font-normal text-destructive"
        >
          {error}
        </span>
      ) : null}
    </div>
  )
}
