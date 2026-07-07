import Link from 'next/link'
import {
  ChevronLeft,
  Truck,
  LogIn,
  Wrench,
  Sparkles,
  CalendarClock,
  Phone,
  Brush,
  MoreHorizontal,
} from 'lucide-react'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { NATIVE_EVENT_TYPES } from '@/lib/calendar/event-meta'
import type { CalendarEventType } from '@prisma/client'
import { EventForm } from './event-form'

/**
 * Selector de tipo de evento (F3). Los 8 tipos de la hoja del dueño se crean
 * "desde el calendario": los nativos (Cita/Llamada/Limpieza/Otros) abren el
 * formulario del calendario; los que ya tienen módulo (Entrega/Entrada/
 * Reparación/Mejora) redirigen a su formulario existente — sin duplicar datos.
 */
const CHOICES: {
  key: string
  label: string
  desc: string
  icon: React.ElementType
  hrefFor: (sp: { buyer?: string; vehicle?: string }) => string
}[] = [
  {
    key: 'ENTREGA',
    label: 'Entrega',
    desc: 'Entrega final al comprador (checklist, firma)',
    icon: Truck,
    hrefFor: () => '/entregas/nueva',
  },
  {
    key: 'ENTRADA',
    label: 'Entrada / Recepción',
    desc: 'Vehículo que ofrece un vendedor',
    icon: LogIn,
    hrefFor: () => '/vendedores/nuevo',
  },
  {
    key: 'REPARACION',
    label: 'Reparación',
    desc: 'Orden de taller (corregir un problema)',
    icon: Wrench,
    hrefFor: (sp) => `/taller/nueva?kind=REPARACION${sp.vehicle ? `&vehicleId=${sp.vehicle}` : ''}`,
  },
  {
    key: 'MEJORA',
    label: 'Mejora',
    desc: 'Trabajo que aumenta el valor del vehículo',
    icon: Sparkles,
    hrefFor: (sp) => `/taller/nueva?kind=MEJORA${sp.vehicle ? `&vehicleId=${sp.vehicle}` : ''}`,
  },
  {
    key: 'CITA',
    label: 'Cita',
    desc: 'Visita, prueba o reunión con un comprador',
    icon: CalendarClock,
    hrefFor: (sp) =>
      `/calendario/nuevo?type=CITA${sp.buyer ? `&buyer=${sp.buyer}` : ''}${sp.vehicle ? `&vehicle=${sp.vehicle}` : ''}`,
  },
  {
    key: 'LLAMADA',
    label: 'Llamada',
    desc: 'Llamada de seguimiento a un cliente',
    icon: Phone,
    hrefFor: (sp) => `/calendario/nuevo?type=LLAMADA${sp.buyer ? `&buyer=${sp.buyer}` : ''}`,
  },
  {
    key: 'LIMPIEZA',
    label: 'Limpieza',
    desc: 'Limpieza de un vehículo',
    icon: Brush,
    hrefFor: (sp) => `/calendario/nuevo?type=LIMPIEZA${sp.vehicle ? `&vehicle=${sp.vehicle}` : ''}`,
  },
  {
    key: 'OTRO',
    label: 'Otros',
    desc: 'Cualquier otro evento',
    icon: MoreHorizontal,
    hrefFor: () => '/calendario/nuevo?type=OTRO',
  },
]

export default async function NuevoEventoPage({
  searchParams,
}: {
  searchParams: { type?: string; buyer?: string; vehicle?: string; seller?: string }
}) {
  await requireAgente()

  const nativeType =
    searchParams.type && (NATIVE_EVENT_TYPES as string[]).includes(searchParams.type)
      ? (searchParams.type as CalendarEventType)
      : null

  // ── Selector de tipo (sin type nativo elegido) ──
  if (!nativeType) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <Link
            href="/calendario"
            className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Calendario
          </Link>
          <h1 className="mt-1 text-2xl font-bold">Nuevo evento</h1>
          <p className="mt-1 text-sm text-muted-foreground">¿Qué quieres crear?</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CHOICES.map((c) => {
            const Icon = c.icon
            return (
              <Link
                key={c.key}
                href={c.hrefFor({ buyer: searchParams.buyer, vehicle: searchParams.vehicle })}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/40 hover:bg-muted"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-[14px] font-semibold text-foreground">{c.label}</span>
                  <span className="mt-0.5 block text-[12px] text-muted-foreground">{c.desc}</span>
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Formulario del evento nativo ──
  const [agents, buyers, vehicles] = await Promise.all([
    db.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    db.buyerLead.findMany({
      where: { status: { notIn: ['CERRADO', 'PERDIDO'] } },
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    db.vehicle.findMany({
      where: { status: { in: ['TASADO', 'PUBLICADO', 'RESERVADO'] } },
      select: { id: true, brand: true, model: true, year: true },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    }),
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href="/calendario/nuevo"
          className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Tipo de evento
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Nuevo evento</h1>
      </div>

      <EventForm
        agents={agents.map((a) => ({ id: a.id, label: a.name }))}
        buyers={buyers.map((b) => ({ id: b.id, label: b.name }))}
        vehicles={vehicles.map((v) => ({
          id: v.id,
          label: `${v.brand} ${v.model} (${v.year})`,
        }))}
        defaults={{
          type: nativeType,
          buyerLeadId: searchParams.buyer,
          vehicleId: searchParams.vehicle,
          sellerLeadId: searchParams.seller,
        }}
      />
    </div>
  )
}
