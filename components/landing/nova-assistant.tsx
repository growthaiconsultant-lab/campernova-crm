import Link from 'next/link'
import { Sparkles, Shield, Leaf, Handshake } from 'lucide-react'

const FEATURES = [
  { icon: Sparkles, text: 'Resuelve dudas técnicas en segundos, sin buscar manuales.' },
  { icon: Shield, text: 'Disponible 24/7, también cuando estás lejos de cobertura humana.' },
  {
    icon: Leaf,
    text: 'Aprende de tu vehículo: historial, mantenimientos y consejos personalizados.',
  },
  { icon: Handshake, text: 'Para siempre tuyo. Sin suscripciones, sin coste oculto.' },
]

function QrSvg({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="16" y="16" width="52" height="52" rx="4" stroke="currentColor" strokeWidth="4" />
      <rect x="28" y="28" width="28" height="28" rx="2" fill="currentColor" />
      <rect x="132" y="16" width="52" height="52" rx="4" stroke="currentColor" strokeWidth="4" />
      <rect x="144" y="28" width="28" height="28" rx="2" fill="currentColor" />
      <rect x="16" y="132" width="52" height="52" rx="4" stroke="currentColor" strokeWidth="4" />
      <rect x="28" y="144" width="28" height="28" rx="2" fill="currentColor" />
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
      <rect x="112" y="84" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="84" y="98" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="112" y="98" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="98" y="112" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="140" y="84" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="168" y="84" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="154" y="98" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="140" y="112" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="168" y="112" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="84" y="126" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="112" y="126" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="98" y="140" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="84" y="154" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="112" y="154" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="140" y="126" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="154" y="140" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="168" y="154" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="140" y="168" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="168" y="168" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="16" y="126" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="44" y="126" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="58" y="140" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="30" y="154" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="16" y="168" width="10" height="10" rx="1" fill="currentColor" />
      <rect x="44" y="168" width="10" height="10" rx="1" fill="currentColor" />
    </svg>
  )
}

function NovaVisual() {
  return (
    /* Extra padding bottom+right so the rotated QR card is not clipped */
    <div className="relative pb-14 pr-12">
      {/* Chat card */}
      <div
        className="rounded-[20px] p-5 shadow-2xl"
        style={{ background: 'var(--cn-cream-50, #f5f0e6)' }}
      >
        {/* Header */}
        <div
          className="mb-4 flex items-center gap-3 rounded-[12px] px-4 py-3"
          style={{ background: 'var(--cn-teal-900)' }}
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
            style={{ background: 'var(--cn-terra-500)' }}
          >
            N
          </div>
          <div>
            <p className="text-[13px] font-semibold text-white">Nova · tu California Coast</p>
            <p
              className="flex items-center gap-1.5 text-[11px]"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
              En línea · responde en segundos
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-end">
            <div
              className="max-w-[82%] rounded-[12px] px-4 py-2.5 text-[13px] leading-relaxed text-white"
              style={{ background: 'var(--cn-teal-900)' }}
            >
              ¿Cómo enciendo la calefacción estacionaria?
            </div>
          </div>
          <div className="flex justify-start">
            <div
              className="max-w-[82%] rounded-[12px] px-4 py-2.5 text-[13px] leading-relaxed"
              style={{
                background: 'white',
                color: 'var(--cn-teal-900)',
                border: '1px solid var(--cn-line)',
              }}
            >
              Pulsa el botón con el símbolo de llama en el panel del techo durante 2 segundos.
              Selecciona temperatura con la rueda. Tarda unos 5 min en arrancar 🔥
            </div>
          </div>
          <div className="flex justify-end">
            <div
              className="max-w-[82%] rounded-[12px] px-4 py-2.5 text-[13px] leading-relaxed text-white"
              style={{ background: 'var(--cn-teal-900)' }}
            >
              Me ha saltado un testigo amarillo de aceite
            </div>
          </div>
          {/* Typing indicator */}
          <div className="flex justify-start">
            <div
              className="rounded-[12px] px-4 py-3"
              style={{ background: 'white', border: '1px solid var(--cn-line)' }}
            >
              <div className="flex items-center gap-1">
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                  style={{ animationDelay: '0ms' }}
                />
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QR floating card — overlaps bottom-right, slightly rotated */}
      <div
        className="absolute bottom-0 right-0 rotate-6 rounded-[16px] p-4 shadow-2xl"
        style={{ background: 'white', color: 'var(--cn-teal-900)' }}
        aria-hidden="true"
      >
        <QrSvg size={110} />
        <p
          className="mt-2.5 text-center font-mono text-[9px] font-semibold uppercase leading-relaxed tracking-[0.16em]"
          style={{ color: 'var(--cn-ink-500)' }}
        >
          Escanéame
          <br />
          en tu vehículo
        </p>
      </div>
    </div>
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

              <ul className="mb-8 flex flex-col gap-3.5">
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

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href="/comprar"
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: 'var(--cn-terra-500)' }}
                >
                  Empezar búsqueda guiada
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14" />
                    <path d="M13 5l7 7-7 7" />
                  </svg>
                </Link>
                <Link
                  href="/como-funciona"
                  className="text-[14px] font-medium transition-opacity hover:opacity-80"
                  style={{ color: 'rgba(245,212,194,0.9)' }}
                >
                  Cómo funciona
                </Link>
              </div>
            </div>

            {/* Visual — right */}
            <NovaVisual />
          </div>
        </div>
      </div>
    </section>
  )
}
