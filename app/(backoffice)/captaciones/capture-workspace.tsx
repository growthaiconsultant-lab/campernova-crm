'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  captureAnchorId,
  captureDay,
  stockInPeriod,
  captureViewOf,
  captureViews,
  PORTAL_OPTIONS,
  type CaptureView,
} from '@/lib/captacion'
import { CaptureCard, type CaptureCardData } from './capture-card'
import { CaptureBoard } from './capture-board'
import { QuickAddCapture } from './quick-add-capture'

type Props = {
  cards: CaptureCardData[]
  agents: { id: string; name: string }[]
  view: CaptureView
  focusId: string | null
  owner: string
  portal: string
  showCreate: boolean
}

function url(view: CaptureView, portal: string, owner: string) {
  const query = new URLSearchParams()
  if (view !== 'abiertas') query.set('vista', view)
  if (portal) query.set('portal', portal)
  if (owner) query.set('responsable', owner)
  return '/captaciones' + (query.size ? '?' + query : '')
}

export function CaptureWorkspace({
  cards,
  agents,
  view,
  focusId,
  owner,
  portal,
  showCreate,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)
  const [from, setFrom] = useState(() =>
    focusId ? '' : captureDay(new Date()).slice(0, 7) + '-01'
  )
  const [to, setTo] = useState(() => (focusId ? '' : captureDay(new Date())))
  const filtered = cards.filter(
    (c) =>
      (!portal || c.portal === portal) &&
      (!owner || (owner === 'sin-asignar' ? !c.assignedToId : c.assignedToId === owner))
  )
  const groups: Record<CaptureView, CaptureCardData[]> = {
    abiertas: [],
    convertidas: [],
    rechazadas: [],
    stock: [],
    sinInteres: [],
  }
  for (const c of filtered) groups[captureViewOf(c)].push(c)
  const stock = groups.stock
    .filter((c) => stockInPeriod(c.arrivalAt, from, to))
    .sort((a, b) => b.arrivalAt!.localeCompare(a.arrivalAt!))
  const boardCards = [...groups.abiertas, ...groups.sinInteres, ...stock]
  const totals = new Map<string, number>()
  for (const c of stock) {
    const id = c.assignedToId ?? ''
    totals.set(id, (totals.get(id) ?? 0) + 1)
  }
  const visible = view === 'stock' ? stock : groups[view]
  const responsible = new Map(agents.map((a) => [a.id, a.name]))
  for (const c of cards)
    if (c.assignedToId && c.assignedToName) responsible.set(c.assignedToId, c.assignedToName)
  function filter(nextPortal: string, nextOwner: string) {
    startTransition(() => router.push(url(view, nextPortal, nextOwner), { scroll: false }))
  }
  useEffect(() => {
    if (focusId)
      document
        .getElementById(captureAnchorId(focusId))
        ?.scrollIntoView({ block: 'center', inline: 'nearest' })
  }, [focusId, view])
  return (
    <div className="min-w-0 max-w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-hanken text-2xl font-bold tracking-tight text-ink">Captaciones</h1>
          <p className="text-sm text-ink2">Anuncios de portales para captar vehículos.</p>
        </div>
        <Dialog
          open={adding || showCreate}
          onOpenChange={(open) => {
            setAdding(open)
            if (!open && showCreate) router.replace(url(view, portal, owner), { scroll: false })
          }}
        >
          <DialogTrigger asChild>
            <Button type="button">
              <Plus size={16} />
              Nueva captación
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nueva captación</DialogTitle>
              <DialogDescription>
                Guarda los datos disponibles del anuncio para iniciar el contacto.
              </DialogDescription>
            </DialogHeader>
            <QuickAddCapture
              onOpenCapture={(id) => {
                setAdding(false)
                router.push(
                  '/captaciones?focus=' + encodeURIComponent(id) + '#' + captureAnchorId(id)
                )
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
      <nav aria-label="Vistas de captaciones" className="flex flex-wrap gap-1 border-b pb-2">
        {(Object.keys(captureViews) as CaptureView[]).map((key) => (
          <Link
            key={key}
            href={url(key, portal, owner)}
            scroll={false}
            aria-current={view === key ? 'page' : undefined}
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-ink2 hover:bg-muted aria-[current=page]:bg-brand-tint aria-[current=page]:text-brand"
          >
            {captureViews[key]}{' '}
            <span className="font-mono text-xs">
              {key === 'abiertas'
                ? boardCards.length
                : key === 'stock'
                  ? stock.length
                  : groups[key].length}
            </span>
          </Link>
        ))}
      </nav>
      <fieldset
        disabled={pending}
        aria-label="Filtros de captaciones"
        className="flex flex-wrap items-end gap-3"
      >
        <label className="grid gap-1 text-xs font-medium">
          Portal
          <select
            className="rounded-md border bg-background p-2 text-sm"
            value={portal}
            onChange={(e) => filter(e.target.value, owner)}
          >
            <option value="">Todos los portales</option>
            {PORTAL_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium">
          Responsable
          <select
            className="max-w-full rounded-md border bg-background p-2 text-sm"
            value={owner}
            onChange={(e) => filter(portal, e.target.value)}
          >
            <option value="">Todo el equipo</option>
            <option value="sin-asignar">Sin asignar</option>
            {Array.from(responsible, ([id, name]) => (
              <option value={id} key={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {(portal || owner) && (
          <button
            type="button"
            className="py-2 text-sm text-brand underline"
            onClick={() => filter('', '')}
          >
            Limpiar filtros
          </button>
        )}
      </fieldset>
      {(view === 'stock' || view === 'abiertas') && (
        <fieldset className="flex flex-wrap items-end gap-3">
          <legend className="mb-2 text-sm font-semibold">Entradas por fecha de recepción</legend>
          <label className="grid gap-1 text-xs">
            Desde
            <input
              type="date"
              className="rounded-md border p-2"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs">
            Hasta
            <input
              type="date"
              className="rounded-md border p-2"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="p-2 text-sm text-brand underline"
            onClick={() => {
              setFrom('')
              setTo('')
            }}
          >
            Todo el histórico
          </button>
        </fieldset>
      )}
      {view === 'stock' && stock.length > 0 && (
        <ul aria-label="Entradas por comercial" className="flex flex-wrap gap-4 text-sm">
          {Array.from(totals, ([id, count]) => (
            <li key={id}>
              {responsible.get(id) ?? 'Sin asignar'} · <strong>{count}</strong>
            </li>
          ))}
        </ul>
      )}
      {view === 'abiertas' ? (
        <CaptureBoard cards={boardCards} agents={agents} focusId={focusId} />
      ) : visible.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((c) => (
            <CaptureCard key={c.id} c={c} agents={agents} focused={focusId === c.id} />
          ))}
        </div>
      ) : (
        <p role="status" className="rounded-xl border bg-card p-5 text-sm">
          No hay captaciones en esta vista
          {portal || owner ? ' con estos filtros' : ''}.
        </p>
      )}
    </div>
  )
}
