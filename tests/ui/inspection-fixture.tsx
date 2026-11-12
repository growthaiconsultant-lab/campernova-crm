import { createRoot } from 'react-dom/client'
import { InspectionReview, type ReviewItem } from '@/app/(backoffice)/taller/[id]/inspection-review'
import { OwnerQuotePanel } from '@/app/(backoffice)/taller/[id]/owner-quote-panel'
import type { QuoteView, QuoteLine } from '@/lib/entry/owner-quote'
let quotes: QuoteView[] = []
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
      <InspectionReview rows={rows} orderId="order" editable>
        {rows.some((r) => r.ownerQuote) && (
          <OwnerQuotePanel
            key={quotes[0]?.revision ?? 0}
            orderId="order"
            canEdit
            sellerId="seller"
            email="propietario@example.test"
            quotes={quotes}
            marks={rows.filter((r) => r.ownerQuote)}
          />
        )}
      </InspectionReview>
    </main>
  )
}
Object.assign(window, {
  inspectionFixture: {
    saveQuote(_order: string, input: { lines: QuoteLine[] }) {
      quotes = [
        {
          version: 1,
          revision: 1,
          status: 'BORRADOR',
          ownerName: null,
          ownerEmail: null,
          reason: null,
          sentAt: null,
          answeredAt: null,
          lines: input.lines.map((l) => ({ ...l, item: base.item })),
        },
      ]
      render()
      return { ok: true }
    },
    sendQuote(_order: string, input: { email: string }) {
      quotes = [
        {
          ...quotes[0],
          revision: 2,
          status: 'PENDIENTE',
          ownerEmail: input.email,
          sentAt: new Date().toISOString(),
        },
      ]
      render()
      return { ok: true }
    },
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
