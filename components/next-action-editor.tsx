'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Check, X } from 'lucide-react'
import { setNextAction } from '@/app/(backoffice)/next-action-actions'
import {
  formatNextActionDue,
  isNextActionOverdue,
  NEXT_ACTION_LABELS,
  NEXT_ACTION_OPTIONS,
} from '@/lib/next-action'
import type { NextActionType } from '@prisma/client'

type Props = {
  leadType: 'seller' | 'buyer'
  leadId: string
  nextActionType: NextActionType | null
  /** ISO string (serializable RSC→client) */
  nextActionDueAt: string | null
  /** Texto sugerido por estado, mostrado cuando no hay acción programada */
  fallbackText: string
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * CAM-60: muestra y edita la próxima acción real del lead.
 * Diseñado para vivir dentro de la ProximaAccionCard oscura (texto claro).
 */
export function NextActionEditor({
  leadType,
  leadId,
  nextActionType,
  nextActionDueAt,
  fallbackText,
}: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [type, setType] = useState<NextActionType>(nextActionType ?? 'LLAMAR')
  const [due, setDue] = useState(nextActionDueAt ? toDatetimeLocal(nextActionDueAt) : '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const dueDate = nextActionDueAt ? new Date(nextActionDueAt) : null
  const overdue = isNextActionOverdue(dueDate)

  function save() {
    setError(null)
    startTransition(async () => {
      const result = await setNextAction({
        leadType,
        leadId,
        type,
        dueAt: due ? new Date(due).toISOString() : null,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setEditing(false)
        router.refresh()
      }
    })
  }

  function clear() {
    setError(null)
    startTransition(async () => {
      const result = await setNextAction({ leadType, leadId, type: null, dueAt: null })
      if (result.error) {
        setError(result.error)
      } else {
        setEditing(false)
        router.refresh()
      }
    })
  }

  if (editing) {
    return (
      <div className="relative mt-2 space-y-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as NextActionType)}
          className="w-full rounded-lg border border-white/20 bg-white/10 px-2.5 py-2 text-[13px] text-white outline-none [&>option]:text-black"
        >
          {NEXT_ACTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          type="datetime-local"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="w-full rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-[13px] text-white outline-none [color-scheme:dark]"
        />
        {error && <p className="text-[11px] text-red-300">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[12px] font-semibold text-black disabled:opacity-50"
            style={{ background: '#0e7d6b' }}
          >
            <Check className="h-3.5 w-3.5" />
            Guardar
          </button>
          {nextActionType && (
            <button
              type="button"
              onClick={clear}
              disabled={pending}
              className="rounded-lg border border-white/20 px-2.5 py-1.5 text-[12px] text-white/70 hover:text-white disabled:opacity-50"
            >
              Quitar
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={pending}
            aria-label="Cancelar"
            className="rounded-lg border border-white/20 px-2.5 py-1.5 text-white/70 hover:text-white disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative mt-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-snug text-white">
            {nextActionType ? NEXT_ACTION_LABELS[nextActionType] : fallbackText}
          </p>
          {dueDate && (
            <p
              className={`mt-0.5 font-mono text-[11px] ${overdue ? 'font-semibold text-red-300' : 'text-white/60'}`}
            >
              {overdue ? '⚠ Vencida · ' : ''}
              {formatNextActionDue(dueDate)}
            </p>
          )}
          {!nextActionType && (
            <p className="mt-0.5 text-[11px] text-white/50">Sin acción programada</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Editar próxima acción"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
