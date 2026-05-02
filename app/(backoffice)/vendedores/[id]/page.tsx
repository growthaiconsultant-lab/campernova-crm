import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { Button } from '@/components/ui/button'

const CONSERVATION_LABELS: Record<string, string> = {
  EXCELENTE: 'Excelente',
  BUENO: 'Bueno',
  NORMAL: 'Normal',
  DETERIORADO: 'Deteriorado',
}

const TYPE_LABELS: Record<string, string> = {
  CAMPER: 'Camper',
  AUTOCARAVANA: 'Autocaravana',
}

export default async function FichaVendedorPage({ params }: { params: { id: string } }) {
  const lead = await db.sellerLead.findUnique({
    where: { id: params.id },
    include: { vehicle: true, agent: true },
  })

  if (!lead) notFound()

  const v = lead.vehicle

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{lead.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lead #{lead.id.slice(-8)} · Canal CN ·{' '}
            {new Date(lead.createdAt).toLocaleDateString('es-ES')}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/vendedores">← Volver</Link>
        </Button>
      </div>

      {/* Datos del vendedor */}
      <div className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Vendedor
        </h2>
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd>{lead.email}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Teléfono</dt>
            <dd>{lead.phone}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Agente asignado</dt>
            <dd>{lead.agent?.name ?? 'Sin asignar'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Estado</dt>
            <dd>{lead.status}</dd>
          </div>
        </dl>
      </div>

      {/* Datos del vehículo */}
      {v && (
        <div className="rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Vehículo
          </h2>
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Tipo</dt>
              <dd>{TYPE_LABELS[v.type]}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Marca / Modelo</dt>
              <dd>
                {v.brand} {v.model}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Año</dt>
              <dd>{v.year}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Kilómetros</dt>
              <dd>{v.km.toLocaleString('es-ES')} km</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Plazas</dt>
              <dd>{v.seats}</dd>
            </div>
            {v.length && (
              <div>
                <dt className="text-muted-foreground">Longitud</dt>
                <dd>{Number(v.length)} m</dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">Estado conservación</dt>
              <dd>{CONSERVATION_LABELS[v.conservationState]}</dd>
            </div>
            {v.location && (
              <div>
                <dt className="text-muted-foreground">Ubicación</dt>
                <dd>{v.location}</dd>
              </div>
            )}
            {v.desiredPrice && (
              <div>
                <dt className="text-muted-foreground">Precio deseado</dt>
                <dd>{Number(v.desiredPrice).toLocaleString('es-ES')} €</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Ficha completa con edición, fotos y activity log disponible en CAM-15.
      </p>
    </div>
  )
}
