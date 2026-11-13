import type { Metadata } from 'next'
import { CatalogView, type RelatedLink } from '@/components/catalog/catalog-view'
import { pageMetadata } from '@/lib/seo'
import { getCatalogInventory, getCatalogBrands, CATEGORIES } from '@/lib/public-catalog'

// ISR: refleja el stock publicado en el CRM cada 10 min.
export const revalidate = 600

const PATH = '/comprar/vehiculos'

export async function generateMetadata(): Promise<Metadata> {
  const { available, reserved } = await getCatalogInventory()
  return pageMetadata({
    title: 'Catálogo de autocaravanas y campers seminuevas en venta',
    description:
      'Todas las autocaravanas y campers seminuevas disponibles en CampersNova, con garantía de 2 años en vehículo y vivienda, financiación y cambio de nombre gratuito.',
    path: PATH,
    noindex: available.length + reserved.length === 0,
  })
}

export default async function CatalogHubPage() {
  const [{ available: vehicles, reserved }, brands] = await Promise.all([
    getCatalogInventory(),
    getCatalogBrands(),
  ])

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
      intro="Compra con garantía de 2 años en vehículo y vivienda, financiación a tu medida y cambio de nombre gratuito."
      vehicles={vehicles}
      reserved={reserved}
      related={{
        heading: 'Filtrar el catálogo',
        links: [...categoryLinks, ...brandLinks],
      }}
    />
  )
}
