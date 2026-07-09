'use client'

import { ErrorState } from '@/components/redesign'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="pt-6">
      <ErrorState
        title="No se pudo cargar postventa"
        description="Ha ocurrido un problema al obtener garantías y tickets. Inténtalo de nuevo."
        onRetry={reset}
      />
    </div>
  )
}
