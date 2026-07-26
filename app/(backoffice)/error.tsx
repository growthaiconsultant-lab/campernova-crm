'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { ButtonLink, ErrorState } from '@/components/redesign'

/**
 * Error boundary general del backoffice.
 *
 * Cubre las rutas del grupo que no definen el suyo propio (calendario, analytics,
 * usuarios…). Sin él, cualquier excepción escala a `app/global-error.tsx`, que
 * reemplaza el documento entero y hace perder el shell del CRM.
 *
 * Client Component por requisito de Next.js para los error boundaries.
 */
export default function BackofficeError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="pt-6">
      <ErrorState
        title="No se ha podido cargar esta sección"
        description="Se ha producido un error inesperado. Puedes volver a intentarlo o regresar al panel principal."
        onRetry={reset}
      />
      <div className="mt-4 flex justify-center">
        <ButtonLink href="/dashboard" variant="secondary">
          Volver al dashboard
        </ButtonLink>
      </div>
    </div>
  )
}
