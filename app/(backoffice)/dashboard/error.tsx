'use client'

import { ErrorState } from '@/components/redesign'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="pt-6">
      <ErrorState
        title="No se pudo cargar tu día"
        description="Ha ocurrido un problema al preparar el dashboard. Inténtalo de nuevo."
        onRetry={reset}
      />
    </div>
  )
}
