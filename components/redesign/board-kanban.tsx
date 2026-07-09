'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Tablero kanban del rediseño (Pipeline, Captaciones — ESPEC §5): columnas por
 * estado con contador; tarjetas arrastrables entre columnas; al soltar cambia
 * el estado real (callback `onMove`). Genérico y tipado.
 */
export interface BoardColumn {
  id: string
  label: string
  /** Color de acento del estado (hex de lib/state-machine / lib/captacion). */
  accent?: string
}

export interface BoardKanbanProps<T> {
  columns: BoardColumn[]
  items: T[]
  getId: (item: T) => string
  getColumn: (item: T) => string
  renderCard: (item: T) => React.ReactNode
  /** Si se pasa, las tarjetas son arrastrables y al soltar se llama con el
   *  nuevo estado (columna destino). */
  onMove?: (id: string, toColumn: string) => void
  className?: string
  /** Ancho mínimo de columna (px). */
  columnWidth?: number
}

export function BoardKanban<T>({
  columns,
  items,
  getId,
  getColumn,
  renderCard,
  onMove,
  className,
  columnWidth = 288,
}: BoardKanbanProps<T>) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)

  const byColumn = (colId: string) => items.filter((it) => getColumn(it) === colId)

  return (
    <div className={cn('flex gap-3.5 overflow-x-auto pb-2', className)}>
      {columns.map((col) => {
        const colItems = byColumn(col.id)
        const isOver = overCol === col.id
        return (
          <div
            key={col.id}
            onDragOver={
              onMove
                ? (e) => {
                    e.preventDefault()
                    setOverCol(col.id)
                  }
                : undefined
            }
            onDrop={
              onMove
                ? () => {
                    if (dragId) onMove(dragId, col.id)
                    setDragId(null)
                    setOverCol(null)
                  }
                : undefined
            }
            className={cn(
              'flex shrink-0 flex-col rounded-[14px] border bg-canvas transition-colors',
              isOver ? 'border-brand' : 'border-line'
            )}
            style={{ width: columnWidth }}
          >
            {/* Cabecera de columna */}
            <div className="flex items-center gap-2 border-b border-line px-3.5 py-3">
              {col.accent && (
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: col.accent }}
                  aria-hidden
                />
              )}
              <span className="font-hanken text-[12.5px] font-semibold text-ink">{col.label}</span>
              <span className="ml-auto rounded-full bg-track px-2 py-0.5 font-mono text-[11px] font-semibold text-ink2">
                {colItems.length}
              </span>
            </div>

            {/* Tarjetas */}
            <div className="flex flex-1 flex-col gap-2.5 p-2.5">
              {colItems.map((it) => (
                <div
                  key={getId(it)}
                  draggable={Boolean(onMove)}
                  onDragStart={onMove ? () => setDragId(getId(it)) : undefined}
                  onDragEnd={onMove ? () => setDragId(null) : undefined}
                  className={cn(onMove && 'cursor-grab active:cursor-grabbing')}
                >
                  {renderCard(it)}
                </div>
              ))}
              {colItems.length === 0 && (
                <div className="rounded-[10px] border border-dashed border-line px-3 py-6 text-center font-hanken text-[12px] text-ink3">
                  Sin tarjetas
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Tarjeta base para el kanban (superficie blanca, borde línea, radio 10px). */
export function BoardCard({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('rounded-[10px] border border-line bg-card p-3', className)}>{children}</div>
  )
}
