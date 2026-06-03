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
import { LifestyleBanner } from '@/components/landing/lifestyle-banner'
import { PodcastSection } from '@/components/landing/podcast'
import { TestimonialsSection } from '@/components/landing/testimonials'
import { FinalCta } from '@/components/landing/final-cta'
import { LandingAnalytics } from '@/components/landing/analytics'
import { JsonLd } from '@/components/json-ld'
import { autoDealerJsonLd } from '@/lib/seo'

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

export default function LandingPage() {
  return (
    <>
      {/* JSON-LD — negocio local (AutoDealer) con NAP correcto */}
      <JsonLd data={autoDealerJsonLd()} />

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
        <LifestyleBanner />
        <PodcastSection />
        <TestimonialsSection />
        <FinalCta />
      </main>

      <PublicFooter />
      <WhatsAppFab />

      {/* PostHog landing analytics — client only */}
      <LandingAnalytics />
    </>
  )
}
