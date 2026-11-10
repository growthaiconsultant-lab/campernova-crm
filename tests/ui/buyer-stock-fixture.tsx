import { BuyerTrackedVehicles } from '../../components/buyer-tracked-vehicles'
import { OffersSection } from '../../components/offers-section'
import { createRoot } from 'react-dom/client'
import { BuyerCatalogResults } from '../../components/buyer-catalog-results'
import type { MatchingBuyerInput, MatchingVehicleInput } from '../../lib/matching/types'

const buyer: MatchingBuyerInput = {
  id: 'buyer',
  vehicleType: null,
  minSeats: 4,
  maxBudget: 50000,
  sleepingPlacesRequired: 2,
  criticalEquipment: {},
  useZone: 'Madrid',
  preferredCategory: null,
  preferredBedLayout: null,
  bathroomRequired: null,
  licenseType: null,
  maxLengthM: null,
  maxHeightM: null,
}
const van: MatchingVehicleInput = {
  id: 'base',
  sellerLeadId: 'seller',
  brand: 'Camper',
  model: 'Base',
  year: 2020,
  price: 45000,
  seats: 4,
  sleepingPlaces: 2,
  type: 'CAMPER',
  km: null,
  equipment: {},
  location: null,
  category: null,
  bedLayout: null,
  bathroomType: null,
  maxMassKg: null,
  length: null,
  heightM: null,
}
const vehicles = [
  van,
  { ...van, id: 'preferida', model: 'Preferida', location: 'Madrid' },
  { ...van, id: 'pendiente', model: 'Pendiente', seats: null },
  { ...van, id: 'cara', model: 'Sobre presupuesto', price: 53500 },
]
const selected = ['cara']
const reservation = {
  id: 'reserve',
  status: 'ACEPTADA' as const,
  amount: 48000,
  depositAmount: 2000,
}
const scenario = document.body.dataset.scenario
const root = createRoot(document.getElementById('root')!)
async function render() {
  root.render(
    <main className="crm-theme mx-auto max-w-3xl p-4">
      {await BuyerCatalogResults({ id: buyer.id, selectedVehicleIds: selected, suggestions: [] })}
      <BuyerTrackedVehicles
        id={buyer.id}
        eligible
        vehicles={selected.map((vehicleId) => ({
          vehicleId,
          label: vehicles.find((v) => v.id === vehicleId)?.model ?? 'Vehículo',
          href: '/vendedores/seller',
          offers: vehicleId === 'cara' ? [reservation] : [],
        }))}
      />
      <OffersSection
        side="buyer"
        fixedId={buyer.id}
        candidates={[]}
        offers={[
          {
            ...reservation,
            notes: 'Señal registrada',
            reservedUntil: '2027-03-08T12:00:00Z',
            counterpartLabel: 'Sobre presupuesto',
            counterpartHref: '/vendedores/seller',
          },
        ]}
      />
    </main>
  )
}
Object.assign(window, {
  stockFixture: {
    getBuyer: async () =>
      scenario === 'sin-criterios'
        ? { ...buyer, minSeats: null, maxBudget: null, sleepingPlacesRequired: null, useZone: null }
        : buyer,
    listEligibleVehicles: async () => (scenario === 'sin-stock' ? [] : vehicles),
    save: async ({ vehicleId }: { vehicleId: string }) => {
      selected.push(vehicleId)
      await render()
      return { ok: true, saved: true }
    },
  },
})
void render()
