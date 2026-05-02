import Link from 'next/link'
import { ArrowRight, FileText, Phone, Users, FileCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FadeIn } from '@/components/landing/motion'

const STEPS = [
  {
    icon: FileText,
    number: '01',
    title: 'Cuéntanos sobre tu camper',
    desc: 'Rellenas un formulario rápido con datos y fotos. Tardas unos 5 minutos. Sin compromiso.',
  },
  {
    icon: Phone,
    number: '02',
    title: 'Te damos la tasación final',
    desc: 'Un agente revisa todo y te contacta en 24h con el precio definitivo y los siguientes pasos.',
  },
  {
    icon: Users,
    number: '03',
    title: 'Publicamos y filtramos compradores',
    desc: 'Nos encargamos del anuncio y las fotos profesionales si hace falta. Solo pasamos compradores reales.',
  },
  {
    icon: FileCheck,
    number: '04',
    title: 'Cierre y papeleo',
    desc: 'Cuando aparece la oferta correcta, gestionamos la transferencia y el ITP. Tú firmas y cobras.',
  },
]

export function HowItWorksSection() {
  return (
    <section id="como-funciona" className="scroll-mt-16 bg-muted/30 px-4 py-20">
      <div className="container mx-auto max-w-5xl">
        <FadeIn className="mb-14 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#cc6119]">
            El proceso
          </p>
          <h2 className="mb-3 font-display text-3xl font-bold text-foreground md:text-4xl">
            Nosotros nos encargamos de todo.
          </h2>
          <p className="mx-auto max-w-md text-muted-foreground">
            Tú solo recibes ofertas reales. Cuatro pasos, sin burocracia.
          </p>
        </FadeIn>

        {/* Steps grid */}
        <div className="relative grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {/* Connector line — desktop only */}
          <div
            className="absolute left-[12.5%] right-[12.5%] top-7 hidden h-px bg-[#294e4c]/20 lg:block"
            aria-hidden="true"
          />

          {STEPS.map(({ icon: Icon, number, title, desc }, i) => (
            <FadeIn key={number} delay={i * 0.1}>
              <div className="relative flex flex-col items-center text-center lg:items-start lg:text-left">
                {/* Icon block */}
                <div className="relative z-10 mb-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#294e4c] shadow-md">
                    <Icon className="h-6 w-6 text-white" strokeWidth={1.5} />
                  </div>
                  <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#cc6119] text-[10px] font-bold text-white">
                    {i + 1}
                  </span>
                </div>

                <h3 className="mb-2 text-base font-semibold text-foreground">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.4} className="mt-12 text-center">
          <Link href="/#calculadora">
            <Button
              size="lg"
              className="h-12 bg-[#cc6119] px-8 text-base font-semibold text-white hover:bg-[#cc6119]/90"
            >
              Empezar con la tasación gratis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </FadeIn>
      </div>
    </section>
  )
}
