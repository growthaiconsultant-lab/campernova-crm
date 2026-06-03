import type { Metadata } from 'next'
import { CatalogView, type RelatedLink } from '@/components/catalog/catalog-view'
import { pageMetadata } from '@/lib/seo'
import { getPublishedVehiclesSafe, getCatalogBrands, CATEGORIES } from '@/lib/public-catalog'

// ISR: refleja el stock publicado en el CRM cada 10 min.
export const revalidate = 600

const PATH = '/comprar/vehiculos'

export async function generateMetadata(): Promise<Metadata> {
  const vehicles = await getPublishedVehiclesSafe()
  return pageMetadata({
    title: 'Catálogo de autocaravanas y campers seminuevas en venta',
    description:
      'Todas las autocaravanas y campers seminuevas disponibles en CampersNova: revisadas en taller propio, con garantía de 12 meses, financiación y cambio de nombre incluido.',
    path: PATH,
    noindex: vehicles.length === 0,
  })
}

export default async function CatalogHubPage() {
  const [vehicles, brands] = await Promise.all([getPublishedVehiclesSafe(), getCatalogBrands()])

  const categoryLinks: RelatedLink[] = CATEGORIES.map((c) => {
    const count = vehicles.filter((v) => v.type === c.type).length
    return {
      href: `/comprar/${c.slug}`,
      label: c.labelPlural,
      sub: count > 0 ? String(count) : undefined,
    }
  })

  const brandLinks: RelatedLink[] = brands.map((b) => ({
    href: `/comprar/marcas/${b.slug}`,
    label: b.brand,
    sub: String(b.count),
  }))

  return (
    <CatalogView
      breadcrumb={[
        { label: 'Inicio', href: '/' },
        { label: 'Comprar', href: '/comprar' },
        { label: 'Catálogo' },
      ]}
      eyebrow="Stock disponible"
      title="Autocaravanas y campers seminuevas en venta"
      intro="Cada vehículo de CampersNova pasa por nuestro taller, una revisión mecánica independiente y verificación documental antes de publicarse. Compra con garantía de 12 meses ampliable, financiación a tu medida y cambio de nombre incluido."
      vehicles={vehicles}
      related={{
        heading: 'Filtrar el catálogo',
        links: [...categoryLinks, ...brandLinks],
      }}
    />
  )
}
