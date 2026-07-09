'use client'

import { ErrorState } from '@/components/redesign'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-[1200px] pt-6">
      <ErrorState
        title="No se pudieron cargar las ofertas"
        description="Ha ocurrido un problema al obtener ofertas y reservas. Inténtalo de nuevo."
        onRetry={reset}
      />
    </div>
  )
}
