import { createRoot } from 'react-dom/client'
import { CaptureWorkspace } from '@/app/(backoffice)/captaciones/capture-workspace'
import type { CaptureCardData } from '@/app/(backoffice)/captaciones/capture-card'
import { captureViewOf, type CaptureView } from '@/lib/captacion'
import { Topbar } from '@/components/layout/topbar'
import type { CaptureStatus } from '@prisma/client'

const root = createRoot(document.getElementById('root')!)
const base: CaptureCardData = {
  id: 'cap',
  title: 'Ford prueba',
  status: 'NO_CONTACTADO',
  portal: 'WALLAPOP',
  phone: null,
  listingUrl: 'https://example.test/anuncio',
  askingPrice: 42000,
  assignedToId: 'a',
  assignedToName: 'Ana',
  notes: 'Revisar detalles',
  rejectionReason: null,
  entradaScheduledAt: null,
  sellerLeadId: null,
}
const cards: CaptureCardData[] = [
  base,
  {
    ...base,
    id: 'sigue',
    title: 'Camper en seguimiento',
    status: 'EN_CURSO',
    portal: 'COCHES_NET',
    assignedToId: null,
    assignedToName: null,
  },
  {
    ...base,
    id: 'convertida',
    title: 'Vehículo convertido',
    status: 'CONVERTIDO',
    sellerLeadId: 'seller-demo',
  },
  { ...base, id: 'rechazada', title: 'Vehículo rechazado', status: 'RECHAZADO' },
]
function render() {
  const params = new URLSearchParams(location.search)
  const focus = cards.find((c) => c.id === params.get('focus'))
  const view = focus ? captureViewOf(focus) : ((params.get('vista') || 'abiertas') as CaptureView)
  root.render(
    <main className="crm-theme p-3">
      <Topbar userName="Ana" userEmail="demo@example.test" userRole="Agente" />
      <CaptureWorkspace
        cards={cards}
        agents={[{ id: 'a', name: 'Ana' }]}
        view={view}
        portal={params.get('portal') ?? ''}
        owner={params.get('responsable') ?? ''}
        focusId={focus?.id ?? null}
        showCreate={params.get('nueva') === '1'}
      />
    </main>
  )
}
function navigate(url: string) {
  history.pushState(null, '', url)
  render()
}
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest('a')
  if (a?.pathname === '/captaciones') {
    e.preventDefault()
    navigate(a.href)
  }
})
window.addEventListener('popstate', render)
Object.assign(window, {
  inventoryNavigate: navigate,
  captureFixture: {
    create: (data: { title: string; phone: string }, force: boolean) => {
      if (data.phone === '600111111' && !force) return { duplicate: { kind: 'capture', id: 'cap' } }
      cards.unshift({ ...base, id: 'nueva', title: data.title })
      render()
      return { id: 'nueva' }
    },
    status: (id: string, status: CaptureStatus) => {
      cards.find((c) => c.id === id)!.status = status
      render()
      return {}
    },
    schedule: (id: string, at: string) => {
      Object.assign(cards.find((c) => c.id === id)!, {
        status: 'ENTRADA_AGENDADA',
        entradaScheduledAt: at,
      })
      render()
      return {}
    },
  },
})
render()
