import { createRoot } from 'react-dom/client'
import { VehicleFilters } from '@/app/(backoffice)/vehiculos/vehicle-filters'
import { inventoryUrl, readInventoryParams } from '@/lib/vehicle-inventory-filters'

const root = createRoot(document.getElementById('root')!)
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
