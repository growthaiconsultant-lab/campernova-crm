'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CAPTURE_BOARD_COLUMNS,
  CAPTURE_STATUS_COLORS,
  CAPTURE_STATUS_LABELS,
} from '@/lib/captacion'
import { updateCaptureStatus, scheduleEntrada } from './actions'
import { CaptureCard, type CaptureCardData } from './capture-card'
import { cn } from '@/lib/utils'
import type { CaptureStatus } from '@prisma/client'

type Agent = { id: string; name: string }

/** Estados a los que se puede soltar directamente (sin datos extra). */
const DIRECT_DROP: CaptureStatus[] = ['NO_CONTACTADO', 'CONTACTADO', 'EN_CURSO']

/**
 * Tablero de sourcing (CAP1) con drag & drop entre columnas: al soltar cambia
 * el CaptureStatus real. ENTRADA_AGENDADA pide fecha/hora en un diálogo
 * (requisito del modelo); CONVERTIDO no acepta drop (la conversión crea el
 * lead de vendedor y se hace desde el botón de la tarjeta).
 */
export function CaptureBoard({ cards, agents }: { cards: CaptureCardData[]; agents: Agent[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<CaptureStatus | null>(null)
  const [scheduleFor, setScheduleFor] = useState<string | null>(null)
  const [entradaAt, setEntradaAt] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const byStatus = new Map<CaptureStatus, CaptureCardData[]>()
  for (const c of cards) {
    const list = byStatus.get(c.status) ?? []
    list.push(c)
    byStatus.set(c.status, list)
  }

  function handleDrop(target: CaptureStatus) {
    const id = dragId
    setDragId(null)
    setOverCol(null)
    if (!id) return
    const card = cards.find((c) => c.id === id)
    if (!card || card.status === target) return

    if (target === 'CONVERTIDO') {
      setNotice('Convertir crea la ficha de vendedor: usa el botón «Convertir» de la tarjeta.')
      return
    }
    if (target === 'ENTRADA_AGENDADA') {
      setScheduleFor(id)
      return
    }
    if (DIRECT_DROP.includes(target)) {
      setNotice(null)
      startTransition(async () => {
        const res = await updateCaptureStatus(id, target)
        if (res.error) setNotice(res.error)
        else router.refresh()
      })
    }
  }

  function confirmSchedule() {
    if (!scheduleFor || !entradaAt) return
    startTransition(async () => {
      const res = await scheduleEntrada(scheduleFor, new Date(entradaAt).toISOString())
      if (res.error) setNotice(res.error)
      setScheduleFor(null)
      setEntradaAt('')
      router.refresh()
    })
  }

  return (
    <>
      {notice && (
        <div className="border-warn/30 mb-3 flex items-center justify-between gap-3 rounded-[10px] border bg-warn-tint px-3.5 py-2.5 font-hanken text-[12.5px] font-medium text-warn">
          {notice}
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="shrink-0 font-semibold hover:underline"
          >
            Cerrar
          </button>
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {CAPTURE_BOARD_COLUMNS.map((status) => {
          const list = byStatus.get(status) ?? []
          const isOver = overCol === status
          return (
            <div
              key={status}
              onDragOver={(e) => {
                e.preventDefault()
                setOverCol(status)
              }}
              onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
              onDrop={() => handleDrop(status)}
              className={cn(
                'flex w-[288px] shrink-0 flex-col rounded-[13px] border bg-canvas transition-colors',
                isOver ? 'border-brand' : 'border-line'
              )}
            >
              <div className="flex items-center gap-2 border-b border-line2 px-3 py-2.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: CAPTURE_STATUS_COLORS[status] }}
                  aria-hidden
                />
                <span className="font-hanken text-[12.5px] font-semibold text-ink">
                  {CAPTURE_STATUS_LABELS[status]}
                </span>
                <span className="ml-auto rounded-full bg-track px-2 py-0.5 font-mono text-[11px] font-semibold text-ink2">
                  {list.length}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-2.5">
                {list.length === 0 ? (
                  <p className="rounded-[10px] border border-dashed border-line px-3 py-6 text-center font-hanken text-[12px] text-ink3">
                    {isOver ? 'Suelta aquí' : 'Sin tarjetas'}
                  </p>
                ) : (
                  list.map((c) => (
                    <div
                      key={c.id}
                      draggable={!pending && c.status !== 'CONVERTIDO'}
                      onDragStart={() => setDragId(c.id)}
                      onDragEnd={() => {
                        setDragId(null)
                        setOverCol(null)
                      }}
                      className={cn(
                        c.status !== 'CONVERTIDO' && 'cursor-grab active:cursor-grabbing',
                        dragId === c.id && 'opacity-60'
                      )}
                    >
                      <CaptureCard c={c} agents={agents} />
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Diálogo: soltar en «Entrada agendada» pide fecha/hora */}
      {scheduleFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(8,10,14,0.45)' }}
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-[360px] rounded-[14px] border border-line bg-card p-5">
            <h3 className="font-hanken text-[15px] font-bold text-ink">Agendar entrada</h3>
            <p className="mt-1 font-hanken text-[12.5px] text-ink2">
              ¿Cuándo trae el vehículo a la nave?
            </p>
            <input
              type="datetime-local"
              value={entradaAt}
              onChange={(e) => setEntradaAt(e.target.value)}
              className="mt-3 w-full rounded-[10px] border border-line px-3 py-2 font-hanken text-[13px] outline-none focus:border-brand"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setScheduleFor(null)
                  setEntradaAt('')
                }}
                className="rounded-[10px] border border-line bg-card px-3.5 py-2 font-hanken text-[12.5px] font-semibold text-ink2 hover:bg-canvas"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmSchedule}
                disabled={pending || !entradaAt}
                className="rounded-[10px] bg-brand px-3.5 py-2 font-hanken text-[12.5px] font-semibold text-white transition-colors hover:bg-brand2 disabled:opacity-50"
              >
                Agendar entrada
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
