import Link from 'next/link'

function formatEur(value: number): string {
  return value.toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })
}

export default function VenderSuccessPage({
  searchParams,
}: {
  searchParams: { brand?: string; model?: string; min?: string; rec?: string; max?: string }
}) {
  const brand = searchParams.brand ?? ''
  const model = searchParams.model ?? ''
  const vehicleName = brand && model ? `${brand} ${model}` : 'tu vehículo'

  const min = searchParams.min ? Number(searchParams.min) : null
  const rec = searchParams.rec ? Number(searchParams.rec) : null
  const max = searchParams.max ? Number(searchParams.max) : null
  const hasValuation = min && rec && max && rec > 0

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <span className="text-lg font-bold text-primary">CampersNova</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        {/* Icono */}
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl dark:bg-green-900/30">
          ✅
        </div>

        <h1 className="text-2xl font-bold sm:text-3xl">
          ¡Recibido! Gracias por confiar en nosotros
        </h1>

        <p className="mt-3 max-w-md text-muted-foreground">
          Hemos recibido los datos de{' '}
          <span className="font-medium text-foreground">{vehicleName}</span>. Uno de nuestros
          agentes revisará la información y te contactará en menos de 24h con una tasación
          personalizada.
        </p>

        {/* Tasación */}
        <div className="mt-8 w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Tasación preliminar</p>
          {hasValuation ? (
            <>
              <p className="mt-1 text-3xl font-bold text-primary">{formatEur(rec!)}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Rango: {formatEur(min!)} – {formatEur(max!)}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Estimación calculada automáticamente.{' '}
                <span className="font-medium text-foreground">Tu agente la confirma en 24 h.</span>
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-xl font-semibold text-primary">En revisión</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Tu agente estudiará las características del vehículo y te enviará una tasación
                personalizada en las próximas 24–48 h.
              </p>
            </>
          )}
        </div>

        {/* Próximos pasos */}
        <div className="mt-8 w-full max-w-sm rounded-xl border bg-muted/40 p-5 text-left">
          <p className="mb-3 text-sm font-semibold">¿Qué pasa ahora?</p>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="font-semibold text-primary">1.</span>
              Tu agente revisará las fotos y datos del vehículo.
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-primary">2.</span>
              Te llamamos o escribimos para confirmar los detalles.
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-primary">3.</span>
              Publicamos el anuncio y gestionamos las visitas. Tú no haces nada.
            </li>
          </ol>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          ¿Tienes dudas? Escríbenos a{' '}
          <a href="mailto:info@campersnova.com" className="font-medium text-primary underline">
            info@campersnova.com
          </a>
        </p>

        <Link
          href="https://campersnova.com"
          className="mt-6 text-sm text-muted-foreground underline hover:text-foreground"
        >
          Volver a campersnova.com →
        </Link>
      </main>
    </div>
  )
}
