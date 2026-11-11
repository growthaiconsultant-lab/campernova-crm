import { createRoot } from 'react-dom/client'
import { VehicleEditForm } from '@/app/(backoffice)/vendedores/[id]/vehicle-edit-form'
import type { UpdateVehicleValues } from '@/lib/validators/seller-lead'
import type { Catalog } from '@/lib/matching/catalog'

let values: UpdateVehicleValues = {
  brand: 'Fiat',
  status: 'NUEVO',
  equipment: { solar: true },
  winterized: null,
  seats: 4,
}
let catalog: Catalog = {}
let revision = 0
const root = createRoot(document.getElementById('root')!)
function render() {
  root.render(
    <VehicleEditForm
      key={revision}
      vehicleId="demo"
      version={new Date(revision).toISOString()}
      defaultValues={values}
      catalog={catalog}
      salePrice={null}
    />
  )
}
Object.assign(window, {
  checklist: {
    async save(_id: string, next: UpdateVehicleValues, snapshot: { catalog: Catalog }) {
      values = next
      catalog = snapshot.catalog
      revision++
      render()
      return { ok: true }
    },
  },
})
render()
