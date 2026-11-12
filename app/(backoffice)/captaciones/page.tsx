import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { CaptureWorkspace } from './capture-workspace'
import type { CaptureCardData } from './capture-card'
import { captureViewOf, isValidPortal, resolveCaptureFocusId } from '@/lib/captacion'

export default async function CaptacionesPage({
  searchParams,
}: {
  searchParams: {
    focus?: string
    vista?: string
    portal?: string
    responsable?: string
    nueva?: string
  }
}) {
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
    askingPrice: c.askingPrice == null ? null : Number(c.askingPrice),
    status: c.status,
    notes: c.notes,
    rejectionReason: c.rejectionReason,
    entradaScheduledAt: c.entradaScheduledAt ? c.entradaScheduledAt.toISOString() : null,
    assignedToId: c.assignedToId,
    assignedToName: c.assignedTo?.name ?? null,
    sellerLeadId: c.sellerLeadId,
  }))

  const focusId = resolveCaptureFocusId(
    searchParams.focus,
    cards.map((c) => c.id)
  )
  const focused = cards.find((c) => c.id === focusId)
  const view = focused
    ? captureViewOf(focused)
    : searchParams.vista === 'convertidas' || searchParams.vista === 'rechazadas'
      ? searchParams.vista
      : 'abiertas'
  return (
    <CaptureWorkspace
      cards={cards}
      agents={agents}
      view={view}
      focusId={focusId}
      portal={
        !focused && searchParams.portal && isValidPortal(searchParams.portal)
          ? searchParams.portal
          : ''
      }
      owner={focused ? '' : (searchParams.responsable ?? '')}
      showCreate={searchParams.nueva === '1'}
    />
  )
}
