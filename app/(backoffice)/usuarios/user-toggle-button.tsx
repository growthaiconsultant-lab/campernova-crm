'use client'

import { useTransition } from 'react'
import { toggleUserActive, toggleUserNotifyOnNewLead } from './actions'
import { toast } from 'sonner'

interface Props {
  userId: string
  field: 'active' | 'notifyOnNewLead'
  value: boolean
}

export function UserToggleButton({ userId, field, value }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      const result =
        field === 'active'
          ? await toggleUserActive(userId, !value)
          : await toggleUserNotifyOnNewLead(userId, !value)

      if (!result.ok) {
        toast.error(result.error)
      }
    })
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      aria-label={value ? 'Desactivar' : 'Activar'}
      className="relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50"
      style={{ background: value ? 'var(--cn-teal-900)' : '#e6e9ee' }}
    >
      <span
        className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform"
        style={{ transform: value ? 'translateX(18px)' : 'translateX(2px)' }}
      />
    </button>
  )
}
