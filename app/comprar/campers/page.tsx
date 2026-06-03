import type { Metadata } from 'next'
import { CatalogView, type RelatedLink } from '@/components/catalog/catalog-view'
import { pageMetadata } from '@/lib/seo'
import { getPublishedVehiclesSafe, getCatalogBrands } from '@/lib/public-catalog'

export const revalidate = 600

const PATH = '/comprar/campers'

export async function generateMetadata(): Promise<Metadata> {
  const vehicles = await getPublishedVehiclesSafe({ type: 'CAMPER' })
  return pageMetadata({
    title: 'Campers seminuevas en venta · revisadas y con garantía',
    description:
      'Campers y furgonetas camper seminuevas en venta en Barcelona: revisadas en taller propio, con garantía de 12 meses, financiación y cambio de nombre incluido.',
    path: PATH,
    noindex: vehicles.length === 0,
  })
}

export default async function CampersPage() {
  const [vehicles, brands] = await Promise.all([
    getPublishedVehiclesSafe({ type: 'CAMPER' }),
    getCatalogBrands(),
  ])

  const brandLinks: RelatedLink[] = brands
    .filter((b) => b.types.includes('CAMPER'))
    .map((b) => ({ href: `/comprar/marcas/${b.slug}`, label: b.brand, sub: String(b.count) }))

  return (
    <CatalogView
      breadcrumb={[
        { label: 'Inicio', href: '/' },
        { label: 'Comprar', href: '/comprar' },
        { label: 'Campers' },
      ]}
      eyebrow="Campers"
      title="Campers seminuevas en venta"
      intro="Furgonetas camper listas para viajar, seleccionadas por estado, equipamiento y kilometraje. Cada camper pasa por nuestro taller y se entrega con garantía de 12 meses ampliable, financiación a tu medida y cambio de nombre incluido."
      vehicles={vehicles}
      related={{
        heading: 'Otras formas de buscar',
        links: [
          { href: '/comprar/autocaravanas', label: 'Ver autocaravanas' },
          { href: '/comprar/vehiculos', label: 'Todo el catálogo' },
          ...brandLinks,
        ],
      }}
    />
  )
}
