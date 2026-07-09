import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import {
  CAPTURE_BOARD_COLUMNS,
  CAPTURE_STATUS_COLORS,
  CAPTURE_STATUS_LABELS,
} from '@/lib/captacion'
import { QuickAddCapture } from './quick-add-capture'
import { CaptureCard, type CaptureCardData } from './capture-card'
import { Eyebrow } from '@/components/redesign'
import type { CaptureStatus } from '@prisma/client'

export default async function CaptacionesPage() {
  await requireAgente()

  const [captures, agents] = await Promise.all([
    db.vehicleCapture.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { assignedTo: { select: { name: true } } },
    }),
    db.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const cards: CaptureCardData[] = captures.map((c) => ({
    id: c.id,
    listingUrl: c.listingUrl,
    phone: c.phone,
    portal: c.portal,
    title: c.title,
    askingPrice: c.askingPrice ? Number(c.askingPrice) : null,
    status: c.status,
    notes: c.notes,
    rejectionReason: c.rejectionReason,
    entradaScheduledAt: c.entradaScheduledAt ? c.entradaScheduledAt.toISOString() : null,
    assignedToId: c.assignedToId,
    assignedToName: c.assignedTo?.name ?? null,
    sellerLeadId: c.sellerLeadId,
  }))

  const byStatus = new Map<CaptureStatus, CaptureCardData[]>()
  for (const c of cards) {
    const list = byStatus.get(c.status) ?? []
    list.push(c)
    byStatus.set(c.status, list)
  }
  const rejected = byStatus.get('RECHAZADO') ?? []
  const activeCount = cards.filter((c) => c.status !== 'RECHAZADO').length

  return (
    <div>
      {/* Título de módulo (chrome global en el header 60px) */}
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <Eyebrow>CRM · Captación</Eyebrow>
          <h1 className="mt-1 font-hanken text-[23px] font-bold tracking-[-0.02em] text-ink">
            Captaciones
          </h1>
          <p className="mt-1 font-hanken text-[13.5px] text-ink2">
            Anuncios de portales que perseguimos para captar stock ·{' '}
            <b className="text-ink">
              {activeCount} activa{activeCount === 1 ? '' : 's'}
            </b>
          </p>
        </div>
        {rejected.length > 0 && (
          <a
            href="#rechazadas"
            className="shrink-0 rounded-[9px] border border-line bg-card px-[13px] py-2 font-hanken text-[12px] font-semibold text-ink2 transition-colors hover:bg-canvas"
          >
            Rechazadas ({rejected.length})
          </a>
        )}
      </div>

      <div className="mb-4">
        <QuickAddCapture />
      </div>

      {/* Tablero por estado (CAP1) */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {CAPTURE_BOARD_COLUMNS.map((status) => {
          const list = byStatus.get(status) ?? []
          return (
            <div
              key={status}
              className="flex w-[288px] shrink-0 flex-col rounded-[13px] border border-line bg-canvas"
            >
              <div className="flex items-center gap-2 border-b border-line2 px-3 py-2.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: CAPTURE_STATUS_COLORS[status] }}
                  aria-hidden
                />
                <span className="font-hanken text-[12.5px] font-semibold text-ink">
                  {CAPTURE_STATUS_LABELS[status]}
                </span>
                <span className="ml-auto rounded-full bg-track px-2 py-0.5 font-mono text-[11px] font-semibold text-ink2">
                  {list.length}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-2.5">
                {list.length === 0 ? (
                  <p className="rounded-[10px] border border-dashed border-line px-3 py-6 text-center font-hanken text-[12px] text-ink3">
                    Sin tarjetas
                  </p>
                ) : (
                  list.map((c) => <CaptureCard key={c.id} c={c} agents={agents} />)
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Rechazadas */}
      {rejected.length > 0 && (
        <details id="rechazadas" className="mt-4 rounded-[14px] border border-line bg-card">
          <summary className="cursor-pointer px-4 py-3 font-hanken text-[13px] font-semibold text-ink2">
            Rechazadas ({rejected.length})
          </summary>
          <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {rejected.map((c) => (
              <CaptureCard key={c.id} c={c} agents={agents} />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
