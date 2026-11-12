import type { Metadata } from 'next'
import { PublicHome } from '@/components/home/public-home'
import { LandingAnalytics } from '@/components/landing/analytics'
import { JsonLd } from '@/components/json-ld'
import { autoDealerJsonLd } from '@/lib/seo'
import { getCatalogInventory } from '@/lib/public-catalog'

export const revalidate = 600

export const metadata: Metadata = {
  // `absolute` evita que la plantilla del layout añada "· CampersNova" (ya está en el título).
  title: { absolute: 'CampersNova · Compraventa de campers y autocaravanas seminuevas' },
  description:
    'Compra o vende tu camper o autocaravana con confianza. Tasación gratuita, gestión profesional. Solo cobramos si vendemos. Instalaciones en Barcelona.',
  openGraph: {
    title: 'CampersNova · Compraventa de campers y autocaravanas',
    description:
      'Compra o vende tu camper o autocaravana. Tasación gratuita. Solo cobramos si vendemos. Sin coste por adelantado.',
    url: 'https://campersnova.com',
    siteName: 'CampersNova',
    images: [
      {
        url: '/images/landing/hero-sunset-window.png',
        width: 1200,
        height: 630,
        alt: 'CampersNova — compraventa de campers y autocaravanas',
      },
    ],
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CampersNova · Compraventa de campers y autocaravanas',
    description: 'Tasación gratuita. Solo cobramos si vendemos. Instalaciones en Barcelona.',
  },
  alternates: {
    canonical: 'https://campersnova.com',
  },
}

export default async function LandingPage() {
  const { available } = await getCatalogInventory()
  const vehicles = available.map((v) => ({
    slug: v.slug,
    title: v.title,
    type: v.typeLabel,
    photo: v.photos[0] ?? null,
    price: v.price,
    monthlyPaymentFrom: v.monthlyPaymentFrom,
    specs: [
      v.year,
      v.km != null ? v.km.toLocaleString('es-ES') + ' km' : null,
      v.seats != null ? v.seats + ' plazas' : null,
    ]
      .filter((value) => value != null)
      .join(' · '),
  }))
  return (
    <>
      <JsonLd data={autoDealerJsonLd()} />
      <PublicHome vehicles={vehicles} />
      <LandingAnalytics />
    </>
  )
}
