import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BuyerUsageEditor } from '../../components/buyer-usage-editor'
import { BuyerEquipmentEditor } from '../../components/match-catalog-editor'
import { usageLabel, type BuyerUsage } from '../../lib/buyer-vehicle-use'
import type { Catalog } from '../../lib/matching/catalog'

const initial: BuyerUsage = { intendedUse: null, otherUse: null, useZone: 'Costa' }
const catalog: Catalog = { beds: { values: ['Doble fija', 'Elevable'], required: true, all: true } }
declare global {
  interface Window {
    usageFixture: {
      fail: boolean
      save: (
        type: 'usage' | 'catalog',
        value: BuyerUsage | Catalog
      ) => Promise<{ ok: true } | { error: string }>
    }
  }
}
function Fixture() {
  const [usage, setUsage] = useState(initial)
  const [saved, setSaved] = useState(catalog)
  window.usageFixture = {
    fail: window.usageFixture?.fail ?? false,
    async save(type, value) {
      if (window.usageFixture.fail) return { error: 'Error de prueba al guardar.' }
      if (type === 'usage') setUsage(value as BuyerUsage)
      else setSaved(value as Catalog)
      return { ok: true }
    },
  }
  return (
    <main className="crm-theme">
      <p aria-label="Uso principal">{usageLabel(usage)}</p>
      <BuyerUsageEditor initial={usage} id="example" readOnly={false} />
      <BuyerEquipmentEditor initial={saved} id="example" family="CAMPER" />
    </main>
  )
}
createRoot(document.getElementById('root')!).render(<Fixture />)
