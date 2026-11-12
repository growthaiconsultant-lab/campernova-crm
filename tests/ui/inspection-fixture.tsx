import { createRoot } from 'react-dom/client'
import { InspectionReview, type ReviewItem } from '@/app/(backoffice)/taller/[id]/inspection-review'
const root = createRoot(document.getElementById('root')!)
const base: ReviewItem = {
  id: 'element',
  item: 'Calefacción',
  category: 'CAMPER',
  installed: null,
  catalogAtLoad: null,
  result: 'PENDIENTE',
  notes: null,
  ownerQuote: false,
  version: '2026-11-12T10:00:00Z',
}
let rows: ReviewItem[] = [base]
function render() {
  root.render(
    <main className="crm-theme p-4" data-crm-shell>
      <InspectionReview rows={rows} orderId="order" editable />
    </main>
  )
}
Object.assign(window, {
  inspectionFixture: {
    save(
      _order: string,
      id: string,
      input: Pick<ReviewItem, 'installed' | 'result' | 'notes' | 'ownerQuote'>
    ) {
      rows = rows.map((r) =>
        r.id === id ? { ...r, ...input, version: new Date().toISOString() } : r
      )
      render()
      return { version: rows[0].version }
    },
    add(_order: string, input: Pick<ReviewItem, 'item' | 'category'>) {
      rows = [...rows, { ...base, ...input, id: 'added' }]
      render()
      return { ok: true }
    },
  },
})
render()
