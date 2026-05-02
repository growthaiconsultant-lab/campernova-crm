import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FadeIn } from '@/components/landing/motion'

export function HeroSection() {
  return (
    <section
      id="main-content"
      className="overflow-hidden bg-[#294e4c] px-4 pb-16 pt-28 md:pb-24 md:pt-36"
    >
      <div className="container mx-auto max-w-6xl">
        <div className="grid items-center gap-10 lg:grid-cols-[3fr_2fr]">
          {/* ── Left column: copy ──────────────────────────────────── */}
          <div className="flex flex-col items-start">
            <FadeIn delay={0}>
              <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-[#cc6119]">
                Expertos en compraventa de campers y autocaravanas
              </p>
            </FadeIn>

            <FadeIn delay={0.1}>
              <h1 className="mb-6 font-display text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl lg:text-[3.5rem] xl:text-6xl">
                Vende tu camper sin perder valor ni tiempo.
              </h1>
            </FadeIn>

            <FadeIn delay={0.2}>
              <p className="mb-8 max-w-lg text-lg leading-relaxed text-white/75 md:text-xl">
                Tasación gratuita en menos de 60 segundos. Si decides vender, nos encargamos de todo
                y solo cobramos si la vendemos.
              </p>
            </FadeIn>

            <FadeIn delay={0.3} className="w-full sm:w-auto">
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <Link href="/#calculadora" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="h-12 w-full bg-[#cc6119] px-7 text-base font-semibold text-white transition-all duration-150 hover:bg-[#cc6119]/90 active:scale-[0.98] sm:w-auto"
                  >
                    Calcular precio de mi camper
                    <ArrowRight className="ml-2 h-4 w-4 shrink-0" />
                  </Button>
                </Link>
                <Link href="/#como-funciona" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 w-full border-white/30 bg-transparent text-base text-white hover:bg-white/10 sm:w-auto"
                  >
                    Ver cómo funciona
                  </Button>
                </Link>
              </div>

              <p className="mt-3 text-xs text-white/45">
                Sin coste · Sin compromiso · Resultado al instante
              </p>
            </FadeIn>
          </div>

          {/* ── Right column: hero image ────────────────────────────── */}
          <FadeIn delay={0.2} y={10} className="relative order-first w-full lg:order-last">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl shadow-2xl shadow-black/40 lg:aspect-[3/4]">
              <Image
                src="/images/lifestyle/theorivierenlaan-vwbus-2450216.jpg"
                alt="Autocaravana aparcada en un entorno natural — CampersNova"
                fill
                className="object-cover object-center"
                priority
                sizes="(max-width: 1024px) 100vw, 40vw"
              />
              {/* Gradient overlay for text legibility if needed */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#294e4c]/20 to-transparent" />
            </div>

            {/* Floating badge */}
            <div className="absolute -bottom-4 -left-4 flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-lg">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#294e4c]/10">
                <span className="text-lg">⚡</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#1c1917]">Tasación en &lt;60 seg</p>
                <p className="text-xs text-[#78716c]">Resultado al instante</p>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
