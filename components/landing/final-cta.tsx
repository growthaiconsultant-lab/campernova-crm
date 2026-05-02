import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FadeIn } from '@/components/landing/motion'

export function FinalCta() {
  return (
    <section className="bg-[#294e4c] px-4 py-20">
      <div className="container mx-auto max-w-3xl text-center">
        <FadeIn>
          <h2 className="mb-4 font-display text-3xl font-bold leading-tight text-white md:text-4xl">
            Tu autocaravana tiene un precio justo.
            <br className="hidden sm:block" /> Descúbrelo en 60 segundos.
          </h2>
          <p className="mb-8 text-lg leading-relaxed text-white/75">
            Empieza con una tasación gratuita. Te respondemos en 24 h.
          </p>

          <Link href="/#calculadora">
            <Button
              size="lg"
              className="h-12 bg-[#cc6119] px-10 text-base font-semibold text-white hover:bg-[#cc6119]/90"
            >
              Calcular precio de mi camper
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>

          <p className="mt-4 text-sm text-white/40">
            O escríbenos a{' '}
            <a
              href="mailto:info@campersnova.com"
              className="underline underline-offset-2 transition-colors hover:text-white/70"
            >
              info@campersnova.com
            </a>
          </p>
        </FadeIn>
      </div>
    </section>
  )
}
