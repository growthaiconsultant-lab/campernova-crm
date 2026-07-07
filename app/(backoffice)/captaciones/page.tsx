import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import {
  CAPTURE_BOARD_COLUMNS,
  CAPTURE_STATUS_COLORS,
  CAPTURE_STATUS_LABELS,
} from '@/lib/captacion'
import { QuickAddCapture } from './quick-add-capture'
import { CaptureCard, type CaptureCardData } from './capture-card'
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
    <div className="-mx-6 -mt-6">
      <header className="z-20 flex min-h-[64px] flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] bg-white px-4 py-2 md:px-8 lg:sticky lg:top-0 lg:h-[73px] lg:py-0">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748b]">
            CRM · Captación
          </div>
          <h1 className="mt-0.5 text-[20px] font-bold tracking-tight text-[#0a0a0a]">
            Captaciones
          </h1>
        </div>
        <p className="text-[12px] text-[#64748b]">
          {activeCount} activa{activeCount === 1 ? '' : 's'}
        </p>
      </header>

      <div className="space-y-4 px-4 pb-16 pt-4 md:px-8">
        <QuickAddCapture />

        {/* Tablero por estado */}
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[900px] gap-3"
            style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}
          >
            {CAPTURE_BOARD_COLUMNS.map((status) => {
              const list = byStatus.get(status) ?? []
              return (
                <div key={status} className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc]">
                  <div className="flex items-center justify-between border-b border-[#e2e8f0] px-3 py-2">
                    <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#0a0a0a]">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: CAPTURE_STATUS_COLORS[status] }}
                      />
                      {CAPTURE_STATUS_LABELS[status]}
                    </span>
                    <span className="rounded-full bg-white px-1.5 py-0.5 font-mono text-[11px] text-[#64748b]">
                      {list.length}
                    </span>
                  </div>
                  <div className="space-y-2 p-2">
                    {list.length === 0 ? (
                      <p className="px-1 py-6 text-center text-[11px] text-[#94a3b8]">—</p>
                    ) : (
                      list.map((c) => <CaptureCard key={c.id} c={c} agents={agents} />)
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Rechazadas */}
        {rejected.length > 0 && (
          <details className="rounded-xl border border-[#e2e8f0] bg-white">
            <summary className="cursor-pointer px-4 py-3 text-[13px] font-medium text-[#64748b]">
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
    </div>
  )
}
