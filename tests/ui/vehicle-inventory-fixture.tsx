import { InventoryPriceEditor } from '@/app/(backoffice)/vehiculos/inventory-price-editor'
import { Toaster } from 'sonner'
import { formatEur } from '@/lib/format/currency'
import { createRoot } from 'react-dom/client'
import { VehicleFilters } from '@/app/(backoffice)/vehiculos/vehicle-filters'
import { inventoryUrl, readInventoryParams } from '@/lib/vehicle-inventory-filters'

const root = createRoot(document.getElementById('root')!)
let price: number | null = null
async function savePrice(value: string) {
  price = Number(value)
  render()
  return { ok: true } as const
}
function render() {
  const { criteria, order } = readInventoryParams(
    Object.fromEntries(new URLSearchParams(location.search))
  )
  root.render(
    <main className="crm-theme p-3">
      <VehicleFilters
        key={inventoryUrl(criteria, 'createdAt:desc')}
        applied={criteria}
        order={order}
      />
      {(criteria.priceState === 'missing'
        ? price === null
        : criteria.priceState === 'priced'
          ? price !== null
          : true) && (
        <article aria-label="Camper de prueba">
          <a href="/vendedores/qa">Camper de prueba</a>
          {price === null ? (
            <InventoryPriceEditor label="Camper de prueba" savePrice={savePrice} />
          ) : (
            formatEur(price, 'cents')
          )}
        </article>
      )}
      <Toaster />
    </main>
  )
}
Object.assign(window, {
  inventoryNavigate(url: string) {
    history.pushState(null, '', url)
    render()
  },
})
window.addEventListener('popstate', render)
render()
