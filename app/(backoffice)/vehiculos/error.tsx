'use client'

import { ErrorState } from '@/components/redesign'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="pt-6">
      <ErrorState
        title="No se pudo cargar el inventario"
        description="Ha ocurrido un problema al obtener los vehículos. Inténtalo de nuevo."
        onRetry={reset}
      />
    </div>
  )
}
