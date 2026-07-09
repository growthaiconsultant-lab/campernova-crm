import { cn } from '@/lib/utils'
import type { PillTone } from './pill'

/**
 * Timeline de actividad del rediseño: nodo con icono en círculo (tint del tono),
 * título 13/600, meta mono (autor · fecha) y cuerpo opcional. Línea vertical
 * conectando nodos.
 */
export interface TimelineItem {
  id: string
  icon?: React.ReactNode
  tone?: PillTone
  title: React.ReactNode
  meta?: React.ReactNode
  body?: React.ReactNode
}

const NODE: Record<PillTone, string> = {
  good: 'bg-good-tint text-good',
  warn: 'bg-warn-tint text-warn',
  bad: 'bg-bad-tint text-bad',
  info: 'bg-info-tint text-info',
  brand: 'bg-brand-tint text-brand',
  neutral: 'bg-track text-ink2',
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="flex flex-col">
      {items.map((it, i) => (
        <li key={it.id} className="relative flex gap-3 pb-4 last:pb-0">
          {/* Línea conectora */}
          {i < items.length - 1 && (
            <span className="absolute left-[11px] top-6 h-full w-px bg-line" aria-hidden />
          )}
          <span
            className={cn(
              'z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
              NODE[it.tone ?? 'neutral']
            )}
          >
            {it.icon}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="font-hanken text-[13px] font-semibold text-ink">{it.title}</div>
            {it.meta && <div className="mt-0.5 font-mono text-[11px] text-ink3">{it.meta}</div>}
            {it.body && (
              <div className="mt-1 whitespace-pre-wrap font-hanken text-[12.5px] leading-[1.5] text-ink2">
                {it.body}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
