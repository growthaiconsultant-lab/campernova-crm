import { createRoot } from 'react-dom/client'
import { SellerSaleChannels, SellerSaleOverview } from '@/components/seller-sale-overview'
import type { SalePortal } from '@/lib/portal-listings'
import { sellerSale } from '@/lib/seller-sale'

const root = createRoot(document.getElementById('root')!)
const listings: {
  channel: SalePortal
  url: string
  publishedOn: Date
  withdrawnAt: Date | null
  revision: number
}[] = []
const sale = sellerSale(
  [
    {
      id: 'offer-qa',
      buyerId: 'buyer-qa',
      counterpartLabel: 'Compradora de prueba',
      status: 'ACEPTADA',
      amount: 48500,
      depositAmount: 1000,
      reservedUntil: '2027-01-06T14:00:00Z',
      createdAt: '2026-01-01T12:00:00Z',
    },
  ],
  []
)
function render() {
  root.render(
    <main className="crm-theme space-y-4 p-3">
      <SellerSaleOverview sale={sale} price={49900}>
        <SellerSaleChannels
          vehicle={{
            id: 'v',
            brand: 'Marca de prueba',
            model: 'Camper',
            year: 2021,
            status: 'RESERVADO',
            publishedAt: null,
          }}
          listings={listings}
          ads={[{ channel: 'WALLAPOP' }]}
          sellerId="s"
          editable
          showToolsLink
        />
      </SellerSaleOverview>
    </main>
  )
}
Object.assign(window, {
  portalFixture: {
    save: (
      seller: string,
      vehicle: string,
      input: {
        action: string
        channel: SalePortal
        revision: number
        url: string
        publishedOn: string
      }
    ) => {
      if (seller !== 's' || vehicle !== 'v' || input.channel !== 'WALLAPOP')
        throw Error('Destino incorrecto')
      const previous = listings[0]
      if ((previous?.revision ?? 0) !== input.revision) return { error: 'Conflicto' }
      if (input.action === 'withdraw') {
        previous.withdrawnAt = new Date()
        previous.revision++
      } else
        listings[0] = {
          channel: input.channel,
          url: input.url,
          publishedOn: new Date(input.publishedOn + 'T00:00:00Z'),
          withdrawnAt: null,
          revision: input.revision + 1,
        }
      render()
      return { ok: true }
    },
  },
})
render()
