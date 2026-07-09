'use client'

import { ErrorState } from '@/components/redesign'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="pt-6">
      <ErrorState
        title="No se pudieron cargar las entregas"
        description="Ha ocurrido un problema al obtener la agenda de entregas. Inténtalo de nuevo."
        onRetry={reset}
      />
    </div>
  )
}
