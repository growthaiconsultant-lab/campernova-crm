'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

export function ForbiddenToast() {
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('error') === 'forbidden') {
      toast.error('No tienes permiso para acceder a esa sección.')
    }
  }, [searchParams])

  return null
}
