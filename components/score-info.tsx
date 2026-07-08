'use client'

import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { ScoreItem } from '@/lib/scoring'

/**
 * Block 19: icono (i) que despliega el desglose de un score (label · pts/max)
 * en un tooltip, para que el comercial entienda de dónde sale la puntuación.
 */
export function ScoreInfo({
  breakdown,
  side = 'bottom',
}: {
  breakdown: ScoreItem[]
  side?: 'top' | 'bottom' | 'left' | 'right'
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex cursor-default items-center text-muted-foreground/60 transition-colors hover:text-muted-foreground focus-visible:outline-none"
            tabIndex={0}
            aria-label="Desglose del score"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="w-[220px] text-xs">
          <p className="mb-1.5 font-semibold">Desglose del score</p>
          <div className="space-y-1">
            {breakdown.map((i) => (
              <div key={i.label} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{i.label}</span>
                <span className="font-mono tabular-nums">
                  {i.points}/{i.max}
                </span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
