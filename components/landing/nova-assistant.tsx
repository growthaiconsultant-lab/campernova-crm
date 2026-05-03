import { Sparkles, Shield, Leaf, Handshake } from 'lucide-react'

const FEATURES = [
  {
    icon: Sparkles,
    text: 'Resuelve dudas técnicas en segundos, sin buscar manuales.',
  },
  {
    icon: Shield,
    text: 'Disponible 24/7, también cuando estás lejos de cobertura humana.',
  },
  {
    icon: Leaf,
    text: 'Aprende de tu vehículo: historial, mantenimientos y consejos personalizados.',
  },
  {
    icon: Handshake,
    text: 'Para siempre tuyo. Sin suscripciones, sin coste oculto.',
  },
]

/* Inline SVG QR placeholder — decorative, aria-hidden */
function QrPlaceholder() {
  return (
    <svg
      width="200"
      height="200"
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="img"
    >
      {/* Outer border */}
      <rect x="2" y="2" width="196" height="196" rx="8" stroke="currentColor" strokeWidth="4" />

      {/* Top-left position pattern */}
      <rect x="16" y="16" width="52" height="52" rx="4" stroke="currentColor" strokeWidth="3.5" />
      <rect x="28" y="28" width="28" height="28" rx="2" fill="currentColor" />

      {/* Top-right position pattern */}
      <rect x="132" y="16" width="52" height="52" rx="4" stroke="currentColor" strokeWidth="3.5" />
      <rect x="144" y="28" width="28" height="28" rx="2" fill="currentColor" />

      {/* Bottom-left position pattern */}
      <rect x="16" y="132" width="52" height="52" rx="4" stroke="currentColor" strokeWidth="3.5" />
      <rect x="28" y="144" width="28" height="28" rx="2" fill="currentColor" />

      {/* Data module rows (decorative) */}
      <rect x="84" y="16" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="98" y="16" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="112" y="16" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="84" y="30" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="112" y="30" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="98" y="44" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="84" y="58" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="112" y="58" width="10" height="10" rx="1" fill="currentColor" />

      <rect x="16" y="84" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="30" y="84" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="44" y="84" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="16" y="98" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="44" y="98" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="30" y="112" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="58" y="84" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="58" y="98" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="58" y="112" width="10" height="10" rx="1" fill="currentColor" />

      <rect x="84" y="84" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="98" y="84" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="112" y="84" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="126" y="84" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="84" y="98" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="126" y="98" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="98" y="112" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="112" y="112" width="10" height="10" rx="1" fill="currentColor" />

      <rect x="140" y="84" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="154" y="84" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="168" y="84" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="140" y="98" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="168" y="98" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="154" y="112" width="10" height="10" rx="1" fill="currentColor" />

      <rect x="84" y="126" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="112" y="126" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="126" y="126" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="84" y="140" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="98" y="140" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="126" y="140" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="84" y="154" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="112" y="154" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="140" y="126" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="154" y="140" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="168" y="126" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="168" y="154" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="140" y="168" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="168" y="168" width="10" height="10" rx="1" fill="currentColor" />

      <rect x="16" y="126" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="30" y="126" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="44" y="126" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="58" y="126" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="16" y="140" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="44" y="140" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="58" y="154" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="30" y="154" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="16" y="168" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="44" y="168" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="58" y="168" width="10" height="10" rx="1" fill="currentColor" />
    </svg>
  )
}

export function NovaAssistant() {
  return (
    <section className="px-8 pb-20 pt-4 max-[640px]:px-5">
      <div className="mx-auto max-w-[1280px]">
        <div
          className="overflow-hidden rounded-[24px] px-10 py-14 max-[640px]:px-6 max-[640px]:py-10"
          style={{ background: 'var(--cn-teal-900)' }}
        >
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            {/* Copy — left */}
            <div>
              {/* Badge */}
              <span
                className="mb-5 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold"
                style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Incluido gratis · Exclusivo Campers Nova
              </span>

              <h2
                className="mb-5 text-[2rem] font-bold leading-tight tracking-[-0.02em] text-white lg:text-[2.4rem]"
                style={{ fontFamily: 'var(--font-fraunces)' }}
              >
                Nova Assistant: tu vehículo te responde.
              </h2>

              <p
                className="mb-8 max-w-[46ch] text-[15px] leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.72)' }}
              >
                Cada camper o autocaravana que vendemos lleva un código QR único. Escanéalo y abre
                un chat con tu vehículo: una IA que conoce tu modelo, su equipamiento y su manual.
                Pregúntale lo que necesites — desde cómo encender la calefacción hasta qué hacer si
                salta un testigo en la carretera.
              </p>

              <ul className="flex flex-col gap-3.5">
                {FEATURES.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                      style={{ background: 'rgba(255,255,255,0.12)' }}
                    >
                      <Icon
                        className="h-3.5 w-3.5"
                        style={{ color: 'var(--cn-terra-300, #f5bc96)' }}
                        aria-hidden="true"
                      />
                    </span>
                    <span
                      className="text-[14px] leading-snug"
                      style={{ color: 'rgba(255,255,255,0.82)' }}
                    >
                      {text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* QR visual — right */}
            <div className="flex justify-center lg:justify-end">
              <div className="flex flex-col items-center gap-5">
                <div
                  className="flex h-[220px] w-[220px] items-center justify-center rounded-[16px] p-5"
                  style={{ background: 'white', color: 'var(--cn-teal-900)' }}
                >
                  <QrPlaceholder />
                </div>
                <p
                  className="text-center font-mono text-[11px] font-semibold uppercase leading-relaxed tracking-[0.18em]"
                  style={{ color: 'rgba(255,255,255,0.5)' }}
                >
                  Escanéame
                  <br />
                  en tu vehículo
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
