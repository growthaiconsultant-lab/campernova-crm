'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Pencil } from 'lucide-react'
import type { LeadTemperature, NextActionType } from '@prisma/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { BuyerSourceSelect } from '@/components/buyer-source-select'
import { isBuyerSource } from '@/lib/buyer-source'
import { TEMPERATURE_COLORS, TEMPERATURE_OPTIONS } from '@/lib/lead-temperature'
import {
  NEXT_ACTION_LABELS,
  NEXT_ACTION_OPTIONS,
  formatNextActionDue,
  isNextActionOverdue,
} from '@/lib/next-action'
import { cn } from '@/lib/utils'
import { updateBuyerQuickField } from './quick-edit-actions'

type LeadRef = { leadId: string; buyerName: string; updatedAt: string }
type Agent = { id: string; name: string }
const selectClass =
  'max-w-full cursor-pointer rounded-lg border border-line bg-card px-2 py-1.5 text-xs font-medium text-ink2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60'

function useQuickSave({ leadId, updatedAt }: LeadRef) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [refreshing, startRefresh] = useTransition()
  const [error, setError] = useState<string | null>(null)
  async function save(
    change:
      | { field: 'temperature' | 'agentId' | 'source'; value: string | null }
      | { field: 'nextAction'; value: { type: NextActionType | null; dueAt: string | null } }
  ) {
    if (saving || refreshing) return false
    setSaving(true)
    setError(null)
    try {
      const result = await updateBuyerQuickField({
        leadId,
        expectedUpdatedAt: updatedAt,
        ...change,
      })
      if ('error' in result) {
        setError(result.error)
        startRefresh(() => router.refresh())
        return false
      }
      startRefresh(() => router.refresh())
      return true
    } catch {
      setError('No se pudo guardar. Revisa los datos actuales e inténtalo de nuevo.')
      startRefresh(() => router.refresh())
      return false
    } finally {
      setSaving(false)
    }
  }
  return { save, pending: saving || refreshing, error, resetError: () => setError(null) }
}

export function BuyerQuickSelect(
  props: LeadRef &
    (
      | { field: 'temperature'; value: LeadTemperature | null }
      | { field: 'source'; value: string | null }
      | { field: 'agentId'; value: string | null; agentName: string | null; agents: Agent[] }
    )
) {
  const messageId = useId()
  const { save, pending, error } = useQuickSave(props)
  const options =
    props.field === 'temperature'
      ? TEMPERATURE_OPTIONS
      : props.field === 'agentId'
        ? props.agents.map((agent) => ({ value: agent.id, label: agent.name }))
        : []
  const colors =
    props.field === 'temperature' && props.value ? TEMPERATURE_COLORS[props.value] : null
  const currentAgentMissing =
    props.field === 'agentId' &&
    props.value &&
    !props.agents.some((agent) => agent.id === props.value)
  return (
    <div
      className="inline-flex max-w-full flex-col items-start gap-1"
      onClick={(event) => event.stopPropagation()}
    >
      {props.field === 'source' ? (
        <BuyerSourceSelect
          value={isBuyerSource(props.value) ? props.value : props.value ? undefined : null}
          legacySource={props.value && !isBuyerSource(props.value) ? props.value : null}
          aria-label={`Origen de ${props.buyerName}`}
          title="Cambiar origen"
          aria-describedby={pending || error ? messageId : undefined}
          aria-busy={pending}
          disabled={pending}
          className={selectClass}
          onChange={(value) => {
            if (value !== undefined && value !== props.value) void save({ field: 'source', value })
          }}
        />
      ) : (
        <select
          aria-label={`${props.field === 'temperature' ? 'Temperatura' : 'Responsable'} de ${props.buyerName}`}
          title={`Cambiar ${props.field === 'temperature' ? 'temperatura' : 'responsable'}`}
          aria-describedby={pending || error ? messageId : undefined}
          aria-busy={pending}
          disabled={pending}
          value={props.value ?? '__none__'}
          className={selectClass}
          style={colors ? { backgroundColor: colors.bg, color: colors.text } : undefined}
          onChange={(event) => {
            const value = event.target.value === '__none__' ? null : event.target.value
            if (value !== props.value) void save({ field: props.field, value })
          }}
        >
          <option value="__none__">
            {props.field === 'temperature' ? 'Sin valorar' : 'Sin asignar'}
          </option>
          {currentAgentMissing && props.field === 'agentId' && (
            <option value={props.value!} disabled>
              {props.agentName ?? 'Responsable actual'} (actual)
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
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

function toDatetimeLocal(iso: string | null) {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function BuyerNextActionControl(
  props: LeadRef & {
    nextActionType: NextActionType | null
    nextActionDueAt: string | null
  }
) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<NextActionType>(props.nextActionType ?? 'LLAMAR')
  const [due, setDue] = useState(toDatetimeLocal(props.nextActionDueAt))
  const [dateError, setDateError] = useState<string | null>(null)
  const { save, pending, error, resetError } = useQuickSave(props)
  const typeId = useId()
  const dueId = useId()
  const messageId = useId()
  const currentDate = props.nextActionDueAt ? new Date(props.nextActionDueAt) : null
  function changeOpen(value: boolean) {
    if (pending) return
    if (value) {
      setType(props.nextActionType ?? 'LLAMAR')
      setDue(toDatetimeLocal(props.nextActionDueAt))
      setDateError(null)
      resetError()
    }
    setOpen(value)
  }
  async function submit(clear = false) {
    setDateError(null)
    const date = due ? new Date(due) : null
    if (!clear && date && Number.isNaN(date.getTime())) {
      setDateError('Fecha no válida')
      return
    }
    if (
      await save({
        field: 'nextAction',
        value: { type: clear ? null : type, dueAt: clear ? null : (date?.toISOString() ?? null) },
      })
    )
      setOpen(false)
  }
  return (
    <div className="max-w-full" onClick={(event) => event.stopPropagation()}>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label={`Editar próxima acción de ${props.buyerName}`}
            className={cn(
              'inline-flex max-w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs font-medium transition-colors hover:bg-line2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isNextActionOverdue(currentDate) ? 'text-bad' : 'text-ink2'
            )}
          >
            <Clock size={13} className="shrink-0" />
            <span>
              {props.nextActionType
                ? NEXT_ACTION_LABELS[props.nextActionType]
                : 'Sin próxima acción'}
              {currentDate ? ` · ${formatNextActionDue(currentDate)}` : ''}
            </span>
            <Pencil size={12} className="shrink-0 text-ink3" />
          </button>
        </DialogTrigger>
        <DialogContent
          className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg"
          onInteractOutside={(event) => {
            if (pending) event.preventDefault()
          }}
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle>Próxima acción</DialogTitle>
            <DialogDescription>
              {props.buyerName}: elige la acción y, si quieres, su fecha.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label htmlFor={typeId} className="text-sm font-medium">
                Acción
              </label>
              <select
                id={typeId}
                value={type}
                disabled={pending}
                onChange={(event) => setType(event.target.value as NextActionType)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {NEXT_ACTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor={dueId} className="text-sm font-medium">
                Fecha y hora (opcional)
              </label>
              <input
                id={dueId}
                type="datetime-local"
                value={due}
                disabled={pending}
                onChange={(event) => setDue(event.target.value)}
                className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm"
              />
            </div>
            {pending ? (
              <p id={messageId} role="status" className="text-xs text-muted-foreground">
                Guardando…
              </p>
            ) : error || dateError ? (
              <p id={messageId} role="alert" className="text-sm text-destructive">
                {error ?? dateError}
              </p>
            ) : null}
            <DialogFooter className="gap-2">
              {props.nextActionType && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => void submit(true)}
                >
                  Quitar acción
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => changeOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
