'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { updateMatchStatus } from '@/app/(backoffice)/matches/actions'
import type { MatchStatus } from '@prisma/client'

// ─── Types (plain JS — sin Decimal de Prisma) ────────────────────────────────

export type VehicleMatchData = {
  id: string
  score: number
  status: string
  buyerLead: {
    id: string
    name: string
    vehicleType: string | null
    minSeats: number | null
    maxBudget: number | null
    criticalEquipment: Record<string, boolean>
  }
}

export type BuyerMatchData = {
  id: string
  score: number
  status: string
  vehicle: {
    id: string
    brand: string
    model: string
    year: number
    km: number
    price: number | null
    photoUrl: string | null
    sellerLeadId: string
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MATCH_STATUS_LABELS: Record<string, string> = {
  SUGERIDO: 'Sugerido',
  PROPUESTO_CLIENTE: 'Propuesto',
  VISITA: 'Visita',
  OFERTA: 'Oferta',
  CERRADO: 'Cerrado',
  RECHAZADO: 'Rechazado',
}

const MATCH_STATUS_COLORS: Record<string, string> = {
  SUGERIDO: 'bg-blue-100 text-blue-700',
  PROPUESTO_CLIENTE: 'bg-purple-100 text-purple-700',
  VISITA: 'bg-teal-100 text-teal-700',
  OFERTA: 'bg-orange-100 text-orange-700',
  CERRADO: 'bg-green-100 text-green-700',
  RECHAZADO: 'bg-gray-100 text-gray-500',
}

const NEXT_STATUSES: Record<
  string,
  { status: MatchStatus; label: string; destructive?: boolean }[]
> = {
  SUGERIDO: [
    { status: 'PROPUESTO_CLIENTE', label: 'Proponer' },
    { status: 'RECHAZADO', label: 'Rechazar', destructive: true },
  ],
  PROPUESTO_CLIENTE: [
    { status: 'VISITA', label: 'Visita' },
    { status: 'RECHAZADO', label: 'Rechazar', destructive: true },
  ],
  VISITA: [
    { status: 'OFERTA', label: 'Oferta' },
    { status: 'RECHAZADO', label: 'Rechazar', destructive: true },
  ],
  OFERTA: [
    { status: 'CERRADO', label: 'Cerrar trato' },
    { status: 'RECHAZADO', label: 'Rechazar', destructive: true },
  ],
}

const EQUIPMENT_LABELS: Record<string, string> = {
  solar: 'Solar',
  kitchen: 'Cocina',
  bathroom: 'Baño',
  shower: 'Ducha',
  heating: 'Calefacción',
}

function scoreBadgeClass(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-700'
  if (score >= 60) return 'bg-teal-100 text-teal-700'
  if (score >= 40) return 'bg-yellow-100 text-yellow-700'
  return 'bg-gray-100 text-gray-500'
}

function formatEur(value: number): string {
  return value.toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })
}

// ─── Status transition buttons ────────────────────────────────────────────────

function StatusButtons({ matchId, currentStatus }: { matchId: string; currentStatus: string }) {
  const [isPending, startTransition] = useTransition()
  const transitions = NEXT_STATUSES[currentStatus] ?? []

  if (transitions.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {transitions.map(({ status, label, destructive }) => (
        <Button
          key={status}
          size="sm"
          variant={destructive ? 'outline' : 'secondary'}
          className={destructive ? 'text-destructive hover:text-destructive' : ''}
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await updateMatchStatus(matchId, status)
            })
          }
        >
          {label}
        </Button>
      ))}
    </div>
  )
}

// ─── Individual match cards ───────────────────────────────────────────────────

function BuyerMatchCard({ match }: { match: VehicleMatchData }) {
  const { buyerLead } = match
  const equipment = Object.entries(buyerLead.criticalEquipment)
    .filter(([, v]) => v)
    .map(([k]) => EQUIPMENT_LABELS[k] ?? k)

  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        {/* Avatar + nombre */}
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium uppercase">
            {buyerLead.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{buyerLead.name}</p>
            <p className="text-xs text-muted-foreground">
              {buyerLead.vehicleType === 'CAMPER'
                ? 'Camper'
                : buyerLead.vehicleType === 'AUTOCARAVANA'
                  ? 'Autocaravana'
                  : 'Cualquier tipo'}
              {buyerLead.minSeats ? ` · ${buyerLead.minSeats}+ plazas` : ''}
            </p>
          </div>
        </div>
        {/* Badges */}
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${scoreBadgeClass(match.score)}`}
          >
            {match.score}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${MATCH_STATUS_COLORS[match.status] ?? ''}`}
          >
            {MATCH_STATUS_LABELS[match.status] ?? match.status}
          </span>
        </div>
      </div>

      {/* Detalles */}
      <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
        {buyerLead.maxBudget && (
          <span className="rounded bg-muted px-1.5 py-0.5">
            hasta {formatEur(buyerLead.maxBudget)}
          </span>
        )}
        {equipment.slice(0, 3).map((e) => (
          <span key={e} className="rounded bg-muted px-1.5 py-0.5">
            {e}
          </span>
        ))}
        {equipment.length > 3 && (
          <span className="rounded bg-muted px-1.5 py-0.5">+{equipment.length - 3}</span>
        )}
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <StatusButtons matchId={match.id} currentStatus={match.status} />
        <Button asChild variant="ghost" size="sm" className="shrink-0 text-xs">
          <Link href={`/compradores/${buyerLead.id}`}>Ver ficha →</Link>
        </Button>
      </div>
    </div>
  )
}

function VehicleMatchCard({ match }: { match: BuyerMatchData }) {
  const { vehicle } = match

  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex items-start gap-3">
        {/* Miniatura de foto */}
        <div className="h-14 w-20 shrink-0 overflow-hidden rounded bg-muted">
          {vehicle.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={vehicle.photoUrl}
              alt={`${vehicle.brand} ${vehicle.model}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              Sin foto
            </div>
          )}
        </div>

        {/* Info vehículo */}
        <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {vehicle.brand} {vehicle.model} ({vehicle.year})
            </p>
            <p className="text-xs text-muted-foreground">
              {vehicle.km.toLocaleString('es-ES')} km
              {vehicle.price ? ` · ${formatEur(vehicle.price)}` : ''}
            </p>
          </div>
          {/* Badges */}
          <div className="flex shrink-0 items-center gap-1.5">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${scoreBadgeClass(match.score)}`}
            >
              {match.score}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${MATCH_STATUS_COLORS[match.status] ?? ''}`}
            >
              {MATCH_STATUS_LABELS[match.status] ?? match.status}
            </span>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-between gap-2">
        <StatusButtons matchId={match.id} currentStatus={match.status} />
        <Button asChild variant="ghost" size="sm" className="shrink-0 text-xs">
          <Link href={`/vendedores/${vehicle.sellerLeadId}`}>Ver ficha →</Link>
        </Button>
      </div>
    </div>
  )
}

// ─── Sección principal (colapsable) ──────────────────────────────────────────

type MatchesSectionProps =
  | { side: 'vehicle'; matches: VehicleMatchData[] }
  | { side: 'buyer'; matches: BuyerMatchData[] }

export function MatchesSection(props: MatchesSectionProps) {
  const [open, setOpen] = useState(false)
  const count = props.matches.length
  const title = props.side === 'vehicle' ? 'Compradores interesados' : 'Vehículos sugeridos'

  return (
    <Card>
      <CardHeader className="cursor-pointer select-none py-4" onClick={() => setOpen((v) => !v)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {title}
            {count > 0 && (
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                {count}
              </span>
            )}
          </CardTitle>
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>

      {open && (
        <CardContent className="pt-0">
          {count === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin matches aún. Se calculan automáticamente al guardar el vehículo o el comprador.
            </p>
          ) : (
            <div className="space-y-2">
              {props.side === 'vehicle'
                ? (props.matches as VehicleMatchData[]).map((m) => (
                    <BuyerMatchCard key={m.id} match={m} />
                  ))
                : (props.matches as BuyerMatchData[]).map((m) => (
                    <VehicleMatchCard key={m.id} match={m} />
                  ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
