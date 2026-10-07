'use client'

import { forwardRef } from 'react'
import { BUYER_SOURCE_OPTIONS, buyerSourceLabel, type BuyerSource } from '@/lib/buyer-source'

type Props = {
  value?: BuyerSource | null
  onChange: (value: BuyerSource | null | undefined) => void
  onBlur?: () => void
  name?: string
  id?: string
  disabled?: boolean
  legacySource?: string | null
  className?: string
}

export const BuyerSourceSelect = forwardRef<HTMLSelectElement, Props>(function BuyerSourceSelect(
  { value, onChange, legacySource, className, ...props },
  ref
) {
  return (
    <select
      {...props}
      ref={ref}
      aria-label="Origen de captación"
      className={className ?? 'h-10 w-full rounded-md border bg-background px-3 text-sm'}
      value={value === undefined && legacySource ? '__keep__' : (value ?? '__none__')}
      onChange={(event) =>
        onChange(
          event.target.value === '__keep__'
            ? undefined
            : event.target.value === '__none__'
              ? null
              : (event.target.value as BuyerSource)
        )
      }
    >
      <option value="__none__">Sin especificar</option>
      {legacySource && (
        <option value="__keep__">Conservar origen actual: {buyerSourceLabel(legacySource)}</option>
      )}
      {value === 'CHAT_WEB' && <option value="CHAT_WEB">Chat web (origen actual)</option>}
      {BUYER_SOURCE_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
})
