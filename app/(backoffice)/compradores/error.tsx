'use client'

import { ErrorState } from '@/components/redesign'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="pt-6">
      <ErrorState
        title="No se pudieron cargar los compradores"
        description="Ha ocurrido un problema al obtener la bandeja de compradores. Inténtalo de nuevo."
        onRetry={reset}
      />
    </div>
  )
}
