'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { advanceLeadStatus } from './quick-advance-actions'

type Props = {
  leadId: string
  nextStatus: string
  label: string
  variant?: 'default' | 'outline' | 'secondary'
}

export function QuickAdvanceButton({ leadId, nextStatus, label, variant = 'default' }: Props) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <Button
      size="sm"
      variant={variant}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await advanceLeadStatus(leadId, nextStatus)
          if (!result?.error) router.refresh()
        })
      }
    >
      {isPending ? 'Guardando…' : label}
    </Button>
  )
}
