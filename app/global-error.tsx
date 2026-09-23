'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="es">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-2xl font-bold text-foreground">Algo ha salido mal</h1>
          <p className="text-muted-foreground">
            Hemos registrado el error. Recarga la página para volver a intentarlo.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Recargar página
          </button>
        </div>
      </body>
    </html>
  )
}
