'use client'

import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

type Props = {
  text: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  maxWidth?: number
}

export function InfoTooltip({ text, side = 'top', maxWidth = 260 }: Props) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex cursor-default items-center text-muted-foreground/60 transition-colors hover:text-muted-foreground focus-visible:outline-none"
            tabIndex={0}
            aria-label="Más información"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="max-w-[var(--tooltip-max-w)] text-xs leading-relaxed"
          style={{ '--tooltip-max-w': `${maxWidth}px` } as React.CSSProperties}
        >
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
