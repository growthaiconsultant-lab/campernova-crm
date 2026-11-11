import { GenerateAdButton } from '@/components/vehicle-ads/generate-ad-button'
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
let publication = false
const drafts: Partial<
  Record<SalePortal, { id: string; content: string; author: null; canEdit: boolean }>
> = {
  WALLAPOP: { id: 'draft-w', content: 'Texto original de Wallapop', author: null, canEdit: true },
}
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
          ads={Object.keys(drafts).map((channel) => ({ channel: channel as SalePortal }))}
          sellerId="s"
          editable
          showToolsLink={!publication}
          renderTextTool={
            publication
              ? (channel) => (
                  <GenerateAdButton
                    vehicleId="v"
                    channel={channel}
                    lastAd={
                      drafts[channel]
                        ? { ...drafts[channel]!, createdAt: new Date('2026-01-01T12:00Z') }
                        : null
                    }
                  />
                )
              : undefined
          }
        />
      </SellerSaleOverview>
    </main>
  )
}
Object.assign(window, {
  portalFixture: {
    openPublication() {
      publication = true
      render()
    },
    saveText(input: { channel: SalePortal; content: string }) {
      drafts[input.channel] = {
        id: 'draft-' + input.channel,
        content: input.content,
        author: null,
        canEdit: true,
      }
      render()
      return { id: drafts[input.channel]!.id }
    },
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
