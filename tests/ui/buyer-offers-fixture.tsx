import { createRoot } from 'react-dom/client'
import { OffersSection, type OfferRow } from '../../components/offers-section'

const template: OfferRow = {
  id: 'proposal',
  amount: 50500.25,
  depositAmount: null,
  status: 'PROPUESTA',
  notes: 'Incluye toldo',
  createdAt: '2026-11-01T12:00:00Z',
  reservedUntil: null,
  counterpartLabel: 'Modelo de prueba',
  counterpartHref: '/vendedores/test',
}
let rows: OfferRow[] = [
  { ...template, id: 'later', depositAmount: 1000, status: 'ACEPTADA' },
  {
    ...template,
    id: 'today',
    depositAmount: 1000.5,
    status: 'ACEPTADA',
    reservedUntil: '2026-11-10T00:00:00Z',
  },
  {
    ...template,
    id: 'expired',
    depositAmount: 290.05,
    status: 'ACEPTADA',
    reservedUntil: '2026-11-08T00:00:00Z',
  },
  { ...template, id: 'accepted', status: 'ACEPTADA', depositAmount: 0 },
  {
    ...template,
    id: 'closed',
    status: 'CANCELADA',
    depositAmount: 2000,
    reservedUntil: '2026-11-03T00:00:00Z',
    notes: 'Condiciones originales',
  },
  template,
]
const root = createRoot(document.getElementById('root')!)
function render() {
  root.render(
    <main className="crm-theme max-w-md p-3">
      <a href="#oferta-closed">Abrir operación anterior</a>
      <OffersSection
        offers={rows}
        candidates={[{ id: 'v', label: 'Modelo de prueba' }]}
        side="buyer"
        fixedId="b"
        initialDay="2026-11-10"
      />
    </main>
  )
}
Object.assign(window, {
  offerFixture: {
    async create(input: { amount: number; notes: string; vehicleId: string; buyerLeadId: string }) {
      if (input.vehicleId !== 'v' || input.buyerLeadId !== 'b') return { error: 'Ficha incorrecta' }
      rows = [{ ...template, id: 'created', amount: input.amount, notes: input.notes }, ...rows]
      render()
      return { id: 'created' }
    },
    async update(
      id: string,
      status: OfferRow['status'],
      extra: { depositAmount: number | null; reservedUntil: string | null }
    ) {
      if (extra.depositAmount === 1) return { error: 'Señal de prueba no admitida' }
      rows = rows.map((o) =>
        o.id === id
          ? {
              ...o,
              status,
              depositAmount: extra.depositAmount,
              reservedUntil: extra.reservedUntil
                ? new Date(extra.reservedUntil).toISOString()
                : null,
            }
          : o
      )
      render()
      return {}
    },
  },
})
render()
