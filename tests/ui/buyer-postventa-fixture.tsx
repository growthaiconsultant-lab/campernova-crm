import { createRoot } from 'react-dom/client'
import { BuyerPostventa } from '@/components/buyer-postventa'
import type { BuyerWarranty } from '@/lib/buyer-postventa'

const now = new Date('2026-11-10T12:00:00Z')
const date = new Date('2026-11-09T14:00:00Z')
const empty = new URLSearchParams(location.search).has('al-dia')
const warranty: BuyerWarranty = {
  id: 'garantia-qa',
  vehicle: { id: 'v-qa', brand: 'Marca de prueba', model: 'Camper' },
  delivery: { completedAt: date },
  startDate: date,
  endDate: date,
  extendedTo: new Date('2027-11-09T12:00:00Z'),
  _count: { tickets: empty ? 0 : 1, followups: empty ? 0 : 1 },
  tickets: empty
    ? []
    : [
        {
          id: 't',
          title: 'Revisar el cierre',
          priority: 'ALTA',
          status: 'RESUELTO',
          description: 'Puerta lateral',
          solution: 'Cierre ajustado',
          resolvedAt: date,
          dueAt: date,
          closedAt: null,
          updatedAt: date,
          responsible: { name: 'Equipo de entrega' },
        },
      ],
  followups: [
    {
      id: 'f7',
      type: 'DIA_7',
      status: empty ? 'RESPONDIDO' : 'FALLIDO',
      scheduledFor: date,
      sentAt: empty ? date : null,
      respondedAt: empty ? now : null,
      responseNotes: empty ? 'Primer viaje completado' : null,
    },
    {
      id: 'f30',
      type: 'DIA_30',
      status: 'PENDIENTE',
      scheduledFor: new Date('2026-11-17T12:00:00Z'),
      sentAt: null,
      respondedAt: null,
      responseNotes: null,
    },
  ],
}
createRoot(document.getElementById('root')!).render(
  <main className="crm-theme p-3">
    <BuyerPostventa warranty={warranty} sales={[]} now={now} />
  </main>
)
