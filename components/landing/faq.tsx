'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { FadeIn } from '@/components/landing/motion'

const FAQ_ITEMS = [
  {
    q: '¿Cuánto cobráis exactamente?',
    a: 'El 4% sobre el precio de venta, y solo si vendemos. Sin coste de alta, sin coste mensual, sin sorpresas. Si tu camper se vende por 35.000 €, recibes 33.600 €. Si no vendemos, no nos debes nada.',
  },
  {
    q: '¿Cuánto tarda en venderse mi camper?',
    a: 'El tiempo medio en nuestro stock ronda los 42 días. Depende del precio, el estado y la época del año. Las campers bien tasadas y con buenas fotos se venden significativamente más rápido.',
  },
  {
    q: '¿Quién paga el cambio de titularidad y el ITP?',
    a: 'El comprador se ocupa del ITP. Nosotros gestionamos la transferencia y el papeleo para que tú no tengas que hacer nada: solo firmar y entregar las llaves.',
  },
  {
    q: '¿Cómo me protegéis de fraudes y compradores tóxicos?',
    a: 'Filtramos cada lead antes de pasarlo a visita. No damos tu teléfono ni dirección hasta que el comprador es serio. Las visitas se organizan de forma controlada.',
  },
  {
    q: '¿Y si no se vende?',
    a: 'Si pasados un tiempo razonable no hay ofertas, revisamos juntos el precio o las condiciones. Sin coste para ti. Si decides retirarla, no nos debes nada.',
  },
  {
    q: '¿Hacéis fotos profesionales?',
    a: 'Sí, si tu camper lo necesita y vives en zona accesible. Tú decides si quieres usar tus fotos o que enviemos un fotógrafo. El servicio está incluido en la comisión.',
  },
  {
    q: '¿Aceptáis cualquier camper o autocaravana?',
    a: 'Aceptamos vehículos en buen estado general, ITV en regla y antigüedad razonable. Te decimos si es viable en la primera valoración, sin compromiso.',
  },
  {
    q: '¿Tengo que dejar la furgo en algún sitio?',
    a: 'No. La furgo se queda contigo durante toda la venta. Solo organizamos visitas cuando hay un comprador real interesado.',
  },
]

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id="preguntas" className="scroll-mt-16 bg-muted/30 px-4 py-20">
      <div className="container mx-auto max-w-3xl">
        <FadeIn className="mb-12 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#cc6119]">
            Preguntas frecuentes
          </p>
          <h2 className="mb-3 font-display text-3xl font-bold text-foreground md:text-4xl">
            Todo lo que necesitas saber
          </h2>
          <p className="text-muted-foreground">
            Sin letra pequeña. Si algo no está aquí,{' '}
            <a
              href="/contacto"
              className="text-[#294e4c] underline underline-offset-2 transition-colors hover:text-[#cc6119]"
            >
              escríbenos
            </a>
            .
          </p>
        </FadeIn>

        <div className="space-y-2">
          {FAQ_ITEMS.map(({ q, a }, i) => {
            const isOpen = openIndex === i
            return (
              <FadeIn key={q} delay={i * 0.05}>
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="flex min-h-[44px] w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-muted/40"
                  >
                    <span className="pr-4 text-sm font-medium text-foreground md:text-base">
                      {q}
                    </span>
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="shrink-0"
                    >
                      <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
                    </motion.span>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-4 pt-1 text-sm leading-relaxed text-muted-foreground">
                          {a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </FadeIn>
            )
          })}
        </div>
      </div>

      {/* JSON-LD FAQPage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
              '@type': 'Question',
              name: q,
              acceptedAnswer: { '@type': 'Answer', text: a },
            })),
          }),
        }}
      />
    </section>
  )
}
