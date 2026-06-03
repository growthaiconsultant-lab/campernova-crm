import type { Metadata } from 'next'
import { CatalogView, type RelatedLink } from '@/components/catalog/catalog-view'
import { pageMetadata } from '@/lib/seo'
import { getPublishedVehiclesSafe, getCatalogBrands } from '@/lib/public-catalog'

export const revalidate = 600

const PATH = '/comprar/autocaravanas'

export async function generateMetadata(): Promise<Metadata> {
  const vehicles = await getPublishedVehiclesSafe({ type: 'AUTOCARAVANA' })
  return pageMetadata({
    title: 'Autocaravanas seminuevas en venta · revisadas y con garantía',
    description:
      'Autocaravanas seminuevas en venta en Barcelona: capuchinas, perfiladas e integrales revisadas en taller propio, con garantía de 12 meses, financiación y cambio de nombre incluido.',
    path: PATH,
    noindex: vehicles.length === 0,
  })
}

export default async function AutocaravanasPage() {
  const [vehicles, brands] = await Promise.all([
    getPublishedVehiclesSafe({ type: 'AUTOCARAVANA' }),
    getCatalogBrands(),
  ])

  const brandLinks: RelatedLink[] = brands
    .filter((b) => b.types.includes('AUTOCARAVANA'))
    .map((b) => ({ href: `/comprar/marcas/${b.slug}`, label: b.brand, sub: String(b.count) }))

  return (
    <CatalogView
      breadcrumb={[
        { label: 'Inicio', href: '/' },
        { label: 'Comprar', href: '/comprar' },
        { label: 'Autocaravanas' },
      ]}
      eyebrow="Autocaravanas"
      title="Autocaravanas seminuevas en venta"
      intro="Capuchinas, perfiladas e integrales seleccionadas una a una. Revisamos cada autocaravana en nuestro taller, verificamos kilometraje y documentación, y la entregamos con garantía de 12 meses ampliable. Financiación a tu medida y cambio de nombre incluido."
      vehicles={vehicles}
      related={{
        heading: 'Otras formas de buscar',
        links: [
          { href: '/comprar/campers', label: 'Ver campers' },
          { href: '/comprar/vehiculos', label: 'Todo el catálogo' },
          ...brandLinks,
        ],
      }}
    />
  )
}
