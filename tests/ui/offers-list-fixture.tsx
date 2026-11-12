import { createRoot } from 'react-dom/client'
import { OffersList, type ListOffer } from '../../app/(backoffice)/ofertas/offers-list'

const base: ListOffer = {
  id: 'propuesta',
  status: 'PROPUESTA',
  buyer: 'Comprador de prueba',
  buyerId: 'comprador',
  vehicle: 'Camper de prueba',
  amount: 42300.25,
  depositAmount: null,
  reservedUntil: null,
  updatedAt: '2026-11-11T12:00:00Z',
  rejectionReason: null,
}
const reservation: ListOffer = { ...base, status: 'ACEPTADA', depositAmount: 1500.75 }
const rows: ListOffer[] = [
  base,
  { ...reservation, id: 'sin-plazo' },
  { ...reservation, id: 'hoy', reservedUntil: '2026-11-11T23:30:00Z' },
  { ...reservation, id: 'ayer', reservedUntil: '2026-11-11T00:00:00Z' },
  { ...reservation, id: 'manana', reservedUntil: '2026-11-13T00:00:00Z' },
  {
    ...base,
    id: 'aceptada',
    status: 'ACEPTADA',
    depositAmount: 0,
    reservedUntil: '2026-11-10T00:00:00Z',
  },
  { ...base, id: 'contraoferta', status: 'CONTRAOFERTA' },
  ...(['CONVERTIDA', 'RECHAZADA', 'CANCELADA', 'RETIRADA', 'EXPIRADA'] as const).map((status) => ({
    ...reservation,
    status,
    id: status,
    reservedUntil: '2025-11-03T00:00:00Z',
    rejectionReason: status === 'RECHAZADA' ? ('PRECIO' as const) : null,
  })),
]
const query = new URLSearchParams(location.search)
createRoot(document.getElementById('root')!).render(
  <main className="crm-theme p-3">
    <OffersList
      rows={query.has('vacio') ? [] : rows}
      history={query.get('vista') === 'historial'}
      initialNow={Date.now()}
    />
  </main>
)
