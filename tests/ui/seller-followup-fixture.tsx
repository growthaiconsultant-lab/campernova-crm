import { createRoot } from 'react-dom/client'
import { SellerFollowupForm } from '@/components/seller-followup-form'
let attempts = 0
let first: unknown
createRoot(document.getElementById('root')!).render(
  <main className="crm-theme p-3">
    <SellerFollowupForm
      archived={false}
      assignee="Comercial de prueba"
      callReminder={{ dueAt: null }}
      save={async (input) => {
        if (!attempts++) {
          first = input
          return { error: 'Reintenta el guardado' }
        }
        if (JSON.stringify(input) !== JSON.stringify(first))
          return { error: 'El reintento debe conservar la solicitud' }
        return { ok: true, eventId: 'qa' }
      }}
    />
  </main>
)
