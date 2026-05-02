import type { Metadata } from 'next'
import { PublicNav } from '@/components/public-nav'
import { PublicFooter } from '@/components/public-footer'
import { WhatsAppFab } from '@/components/whatsapp-fab'
import { HeroSection } from '@/components/landing/hero'
import { TrustStrip } from '@/components/landing/trust-strip'
import { ValuationCalculator } from '@/components/landing/valuation-calculator'
import { HowItWorksSection } from '@/components/landing/how-it-works'
import { ComparisonSection } from '@/components/landing/comparison'
import { FaqSection } from '@/components/landing/faq'
import { FinalCta } from '@/components/landing/final-cta'
import { LandingAnalytics } from '@/components/landing/analytics'

export const metadata: Metadata = {
  title: 'CampersNova · Vende tu camper o autocaravana sin perder valor',
  description:
    'Tasación gratuita en 60 segundos. Te ayudamos a vender tu camper o autocaravana al precio justo. Solo 4% al cierre. Sin coste por adelantado.',
  openGraph: {
    title: 'CampersNova · Vende tu camper o autocaravana sin perder valor',
    description: 'Tasación gratuita en 60 segundos. Solo 4% al cierre. Sin coste por adelantado.',
    url: 'https://campersnova.com',
    siteName: 'CampersNova',
    images: [
      {
        url: '/images/lifestyle/theorivierenlaan-vwbus-2450216.jpg',
        width: 1200,
        height: 630,
        alt: 'CampersNova — vende tu camper o autocaravana',
      },
    ],
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CampersNova · Vende tu camper sin perder valor',
    description: 'Tasación gratuita en 60 segundos. Solo 4% al cierre.',
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
            logo: 'https://campersnova.com/images/brand/Logo Campers Nova.png',
            contactPoint: {
              '@type': 'ContactPoint',
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

      <div className="min-h-screen bg-background">
        <PublicNav />

        <main>
          <HeroSection />
          <TrustStrip />
          <ValuationCalculator />
          <HowItWorksSection />
          <ComparisonSection />
          <FaqSection />
          <FinalCta />
        </main>

        <PublicFooter />
        <WhatsAppFab />

        {/* PostHog landing events — client only */}
        <LandingAnalytics />
      </div>
    </>
  )
}
