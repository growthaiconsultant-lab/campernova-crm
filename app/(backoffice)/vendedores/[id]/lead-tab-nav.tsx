'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export type LeadTab = {
  key: string
  label: string
  badge?: string | number
}

type Props = {
  tabs: LeadTab[]
}

export function LeadTabNav({ tabs }: Props) {
  const sp = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const active = sp.get('tab') ?? 'resumen'

  return (
    <div className="flex overflow-x-auto border-b border-border bg-background">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => router.push(`${pathname}?tab=${tab.key}`)}
          className={cn(
            'flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-3 text-sm transition-colors',
            active === tab.key
              ? 'border-sidebar-primary font-medium text-sidebar-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {tab.label}
          {tab.badge !== undefined && tab.badge !== '' && (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none',
                active === tab.key
                  ? 'bg-sidebar-primary/10 text-sidebar-primary'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
