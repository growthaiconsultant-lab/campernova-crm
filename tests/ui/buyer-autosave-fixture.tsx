import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BuyerLeadEditForm } from '../../app/(backoffice)/compradores/[id]/buyer-lead-edit-form'
import type { UpdateBuyerLeadValues } from '../../lib/validators/buyer-lead'

declare global {
  interface Window {
    autosaveHarness: {
      mode: 'ok' | 'error' | 'throw'
      delay: number
      calls: { data: UpdateBuyerLeadValues; fields: (keyof UpdateBuyerLeadValues)[] }[]
      persisted: UpdateBuyerLeadValues
      destination: string | null
      save: (
        data: UpdateBuyerLeadValues,
        fields: (keyof UpdateBuyerLeadValues)[]
      ) => Promise<{ ok: boolean } | { error: { formErrors: string[] } }>
    }
  }
}
const initial: UpdateBuyerLeadValues = {
  name: 'Comprador de ejemplo',
  email: null,
  phone: '600000000',
  status: 'CONTACTADO',
  agentId: null,
  source: 'WEB',
  vehicleType: 'CAMPER',
  maxBudget: 50000,
  useZone: '',
  financingNeeded: true,
  purchaseTimeline: '1_3_meses',
  criticalEquipment: {
    solar: false,
    kitchen: false,
    bathroom: false,
    shower: false,
    heating: false,
  },
}
window.autosaveHarness = {
  mode: 'ok',
  delay: 150,
  calls: [],
  persisted: structuredClone(initial),
  destination: null,
  async save(data, fields) {
    const h = window.autosaveHarness
    h.calls.push({ data: structuredClone(data), fields })
    await new Promise((resolve) => setTimeout(resolve, h.delay))
    if (h.mode === 'throw') throw Error('Offline de prueba')
    if (h.mode === 'error') return { error: { formErrors: ['Error de prueba al guardar'] } }
    Object.assign(h.persisted, Object.fromEntries(fields.map((key) => [key, data[key]])))
    return { ok: true }
  },
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="crm-theme min-h-screen bg-background p-4 text-foreground md:p-8">
      <a href="/compradores" className="mb-4 block">
        Volver a compradores
      </a>
      <BuyerLeadEditForm leadId="example" defaultValues={initial} agents={[]} />
    </main>
  </StrictMode>
)
