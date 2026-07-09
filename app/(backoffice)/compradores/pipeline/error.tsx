'use client'

import { ErrorState } from '@/components/redesign'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="pt-6">
      <ErrorState
        title="No se pudo cargar el pipeline"
        description="Ha ocurrido un problema al obtener el pipeline de compra. Inténtalo de nuevo."
        onRetry={reset}
      />
    </div>
  )
}
