import type { Metadata } from 'next'
import { PublicNav } from '@/components/public-nav'
import { PublicFooter } from '@/components/public-footer'
import { WhatsAppFab } from '@/components/whatsapp-fab'
import { HeroSection } from '@/components/landing/hero'
import { TrustStrip } from '@/components/landing/trust-strip'
import { TwoRoutes } from '@/components/landing/two-routes'
import { SearchMethod } from '@/components/landing/search-method'
import { NovaAssistant } from '@/components/landing/nova-assistant'
import { HowItWorksSection } from '@/components/landing/how-it-works'
import { WhyUsPillars } from '@/components/landing/why-us-pillars'
import { SellBlock } from '@/components/landing/sell-block'
import { LandingAnalytics } from '@/components/landing/analytics'

export const metadata: Metadata = {
  title: 'CampersNova · Compraventa de campers y autocaravanas',
  description:
    'Compra o vende tu camper o autocaravana con confianza. Tasación gratuita, gestión profesional y solo 4% al cierre. Instalaciones en Barcelona.',
  openGraph: {
    title: 'CampersNova · Compraventa de campers y autocaravanas',
    description:
      'Compra o vende tu camper o autocaravana. Tasación gratuita. Solo 4% al cierre. Sin coste por adelantado.',
    url: 'https://campersnova.com',
    siteName: 'CampersNova',
    images: [
      {
        url: '/images/landing/hero-vw-bus.jpg',
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
    description: 'Tasación gratuita. Solo 4% al cierre. Instalaciones en Barcelona.',
  },
  alternates: {
    canonical: 'https://campersnova.com',
  },
}

export default function LandingPage() {
  return (
    <>
      {/* JSON-LD Organization */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'CampersNova',
            url: 'https://campersnova.com',
            logo: 'https://campersnova.com/images/brand/Logo%20Campers%20Nova.png',
            contactPoint: {
              '@type': 'ContactPoint',
              telephone: '+34-629-925-821',
              email: 'info@campersnova.com',
              contactType: 'customer service',
              areaServed: 'ES',
              availableLanguage: 'Spanish',
            },
            description:
              'Intermediación profesional para la compraventa de campers y autocaravanas semi-nuevas en España.',
          }),
        }}
      />

      <PublicNav />

      <main>
        <HeroSection />
        <TrustStrip />
        <TwoRoutes />
        <SearchMethod />
        <NovaAssistant />
        <HowItWorksSection />
        <WhyUsPillars />
        <SellBlock />
      </main>

      <PublicFooter />
      <WhatsAppFab />

      {/* PostHog landing analytics — client only */}
      <LandingAnalytics />
    </>
  )
}
