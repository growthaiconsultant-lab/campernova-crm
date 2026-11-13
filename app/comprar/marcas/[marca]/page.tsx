import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CatalogView, type RelatedLink } from '@/components/catalog/catalog-view'
import { pageMetadata } from '@/lib/seo'
import { getPublishedVehiclesByBrandSlug, getCatalogBrands, CATEGORIES } from '@/lib/public-catalog'

// ISR on-demand: no usamos generateStaticParams para no depender de la DB en el build.
export const revalidate = 600
export const dynamicParams = true

interface Props {
  params: { marca: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getPublishedVehiclesByBrandSlug(params.marca)
  if (!data) return {}
  return pageMetadata({
    title: `${data.brand} seminuevas en venta con garantía`,
    description: `Autocaravanas y campers ${data.brand} seminuevas en venta en CampersNova, con garantía de 2 años en vehículo y vivienda, financiación y cambio de nombre gratuito.`,
    path: `/comprar/marcas/${params.marca}`,
  })
}

export default async function BrandPage({ params }: Props) {
  const data = await getPublishedVehiclesByBrandSlug(params.marca)
  if (!data) notFound()

  const brands = await getCatalogBrands()
  const otherBrandLinks: RelatedLink[] = brands
    .filter((b) => b.slug !== params.marca)
    .slice(0, 6)
    .map((b) => ({ href: `/comprar/marcas/${b.slug}`, label: b.brand, sub: String(b.count) }))

  const categoryLinks: RelatedLink[] = CATEGORIES.map((c) => ({
    href: `/comprar/${c.slug}`,
    label: c.labelPlural,
  }))

  return (
    <CatalogView
      breadcrumb={[
        { label: 'Inicio', href: '/' },
        { label: 'Comprar', href: '/comprar' },
        { label: 'Marcas', href: '/comprar/marcas' },
        { label: data.brand },
      ]}
      eyebrow={`Marca · ${data.brand}`}
      title={`${data.brand} seminuevas en venta`}
      intro={`Nuestro stock disponible de la marca ${data.brand}. Cada vehículo se entrega con garantía de 2 años en vehículo y vivienda, financiación a tu medida y cambio de nombre gratuito.`}
      vehicles={data.vehicles}
      related={{
        heading: 'Seguir explorando',
        links: [...categoryLinks, ...otherBrandLinks],
      }}
    />
  )
}
