'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setBuyerTemperature } from './temperature-actions'
import { TEMPERATURE_COLORS, TEMPERATURE_OPTIONS } from '@/lib/lead-temperature'
import type { LeadTemperature } from '@prisma/client'

type Props = {
  leadId: string
  temperature: LeadTemperature | null
}

/**
 * CAM-62: selector de temperatura de un clic (segmented chips HOT/WARM/COLD).
 */
export function TemperatureChip({ leadId, temperature }: Props) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function select(value: LeadTemperature) {
    if (value === temperature || pending) return
    startTransition(async () => {
      const result = await setBuyerTemperature(leadId, value)
      if (!result.error) router.refresh()
    })
  }

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-[#e6e9ee] bg-white p-0.5 ${pending ? 'opacity-60' : ''}`}
      role="radiogroup"
      aria-label="Temperatura del lead"
    >
      {TEMPERATURE_OPTIONS.map(({ value, label }) => {
        const active = temperature === value
        const c = TEMPERATURE_COLORS[value]
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={pending}
            onClick={() => select(value)}
            title={label}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors"
            style={
              active
                ? { background: c.bg, color: c.text }
                : { background: 'transparent', color: '#8b94a3' }
            }
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: active ? c.dot : '#cbd5e1' }}
            />
            {label}
          </button>
        )
      })}
    </div>
  )
}
