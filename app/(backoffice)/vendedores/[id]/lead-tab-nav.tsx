'use client'

import { useRef } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export type LeadTab = {
  key: string
  label: string
  badge?: string | number
}

type Props = {
  tabs: LeadTab[]
  defaultTab?: string
}

export function LeadTabNav({ tabs, defaultTab = 'resumen' }: Props) {
  const sp = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const active = sp.get('tab') ?? defaultTab
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const go = (key: string) => router.push(`${pathname}?tab=${key}`)

  const onKeyDown = (e: React.KeyboardEvent, idx: number) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End']
    if (!keys.includes(e.key)) return
    e.preventDefault()
    let next = idx
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    refs.current[next]?.focus()
    go(tabs[next].key)
  }

  return (
    <div
      role="tablist"
      aria-label="Secciones de la ficha"
      className="flex overflow-x-auto border-b border-border bg-background"
    >
      {tabs.map((tab, idx) => {
        const selected = active === tab.key
        return (
          <button
            key={tab.key}
            ref={(el) => {
              refs.current[idx] = el
            }}
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => go(tab.key)}
            onKeyDown={(e) => onKeyDown(e, idx)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              selected
                ? 'border-sidebar-primary font-medium text-sidebar-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge !== '' && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none',
                  selected
                    ? 'bg-sidebar-primary/10 text-sidebar-primary'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
