import { createRoot } from 'react-dom/client'
import { InventorySaleActions } from '@/app/(backoffice)/vehiculos/inventory-sale-actions'
import { Toaster } from 'sonner'
let result = ''
const root = createRoot(document.getElementById('root')!)
async function discard(id: string, status: string, reason: string) {
  result = [id, status, reason].join(' / ')
  render()
  return { ok: true }
}
async function reserve(
  id: string,
  state: string,
  extras: { expectedVehicleId: string; depositAmount: number; reservedUntil: string }
) {
  result = [extras.expectedVehicleId, id, state, extras.depositAmount, extras.reservedUntil].join(
    ' / '
  )
  render()
  return {}
}
Object.assign(window, { operations: { reserve, discard } })
function render() {
  root.render(
    <main className="crm-theme p-3">
      {result ? (
        <p>{result}</p>
      ) : (
        <>
          <article aria-label="En venta">
            <InventorySaleActions
              vehicleId="v1"
              status="PUBLICADO"
              title="Ford Nugget"
              saleHref="/vendedores/demo?tab=compradores#venta-ofertas"
              published
              canDiscard={false}
              offers={[
                { id: 'of-1', buyer: 'Comprador A', amount: 44000 },
                { id: 'of-2', buyer: 'Comprador B', amount: 45000 },
              ]}
            />
          </article>
          <article aria-label="Sin ofertas">
            <InventorySaleActions
              vehicleId="v2"
              status="PUBLICADO"
              title="Sprinter"
              saleHref="/vendedores/demo?tab=compradores#venta-ofertas"
              published
              canDiscard
              offers={[]}
            />
          </article>
        </>
      )}
      <Toaster />
    </main>
  )
}
render()
