import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail, Phone, MapPin, Clock, MessageCircle, ArrowRight } from 'lucide-react'
import { PublicNav } from '@/components/public-nav'
import { PublicFooter } from '@/components/public-footer'

export const metadata: Metadata = {
  title: 'Contacto · CampersNova',
  description:
    'Contacta con el equipo de CampersNova. Teléfono, email, WhatsApp e instalaciones en Barcelona. Lun–Vie 10:00–19:00.',
}

const MAPS_URL =
  'https://www.google.com/maps/dir//CAMPERS+NOVA,+SL,+Carrer+Torre+de+Cellers,+08150,+Barcelona/@41.4089216,2.1528576,10z/data=!4m8!4m7!1m0!1m5!1m1!1s0x12a4ebf0fa3704c3:0x5219e56327ff3bb7!2m2!1d2.2429082!2d41.5648851'

const CHANNELS = [
  {
    Icon: Phone,
    title: 'Teléfono',
    value: '645 63 91 85',
    href: 'tel:+34645639185',
    detail: 'Lun–Vie 10:00–19:00 · Sáb 10:00–13:00',
  },
  {
    Icon: MessageCircle,
    title: 'WhatsApp',
    value: 'Escríbenos por WhatsApp',
    href: 'https://wa.me/34645639185',
    detail: 'Respuesta rápida para dudas sobre tasación o compra.',
  },
  {
    Icon: Mail,
    title: 'Email',
    value: 'info@campersnova.com',
    href: 'mailto:info@campersnova.com',
    detail: 'Respondemos en menos de 24 horas en días laborables.',
  },
  {
    Icon: MapPin,
    title: 'Instalaciones',
    value: 'Carrer Torre de Cellers · 08150 Barcelona',
    href: MAPS_URL,
    detail: 'Visítanos y prueba cualquier vehículo del catálogo.',
  },
]

export default function ContactoPage() {
  return (
    <>
      <PublicNav />

      <main className="min-h-screen pt-20" style={{ background: 'var(--cn-cream-100)' }}>
        {/* Hero */}
        <section
          className="px-8 pb-16 pt-16 max-[640px]:px-5"
          style={{ background: 'var(--cn-teal-900)' }}
        >
          <div className="mx-auto max-w-[1280px]">
            <p
              className="font-mono text-[11px] uppercase tracking-[0.18em]"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              · Contacto
            </p>
            <h1
              className="mt-4 text-[clamp(2.2rem,5vw,3.5rem)] leading-[1.05] tracking-[-0.02em] text-white"
              style={{ fontFamily: 'var(--font-fraunces)', maxWidth: '22ch' }}
            >
              Estamos aquí para ayudarte.
            </h1>
            <p
              className="mt-5 text-[18px] leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.72)', maxWidth: '52ch' }}
            >
              Cuéntanos qué necesitas. Te respondemos por el canal que prefieras.
            </p>
          </div>
        </section>

        {/* Channels */}
        <section className="px-8 py-16 max-[640px]:px-5">
          <div className="mx-auto max-w-[1280px]">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {CHANNELS.map(({ Icon, title, value, href, detail }) => (
                <a
                  key={title}
                  href={href}
                  target={href.startsWith('http') ? '_blank' : undefined}
                  rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="group flex flex-col gap-4 rounded-cn-lg p-6 transition hover:-translate-y-0.5"
                  style={{
                    background: '#fff',
                    border: '1px solid var(--cn-line)',
                    boxShadow: 'var(--sh-sm)',
                  }}
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-[10px]"
                    style={{ background: 'var(--cn-cream-200)', color: 'var(--cn-teal-700)' }}
                  >
                    <Icon size={20} />
                  </div>
                  <div>
                    <p
                      className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em]"
                      style={{ color: 'var(--cn-ink-500)' }}
                    >
                      {title}
                    </p>
                    <p
                      className="text-[14px] font-medium leading-snug group-hover:underline"
                      style={{ color: 'var(--cn-teal-900)' }}
                    >
                      {value}
                    </p>
                  </div>
                  <p
                    className="mt-auto text-[13px] leading-relaxed"
                    style={{ color: 'var(--cn-ink-500)' }}
                  >
                    {detail}
                  </p>
                </a>
              ))}
            </div>

            {/* Hours */}
            <div
              className="mt-8 flex items-start gap-4 rounded-cn-lg p-6"
              style={{ background: 'var(--cn-cream-50)', border: '1px solid var(--cn-line)' }}
            >
              <Clock
                size={20}
                style={{ color: 'var(--cn-teal-700)', flexShrink: 0, marginTop: 2 }}
              />
              <div>
                <p className="text-[14px] font-semibold" style={{ color: 'var(--cn-teal-900)' }}>
                  Horario de atención
                </p>
                <p className="mt-1 text-[14px]" style={{ color: 'var(--cn-ink-500)' }}>
                  Lunes – Viernes · 10:00 – 19:00 &nbsp;·&nbsp; Sábado · 10:00 – 13:00 &nbsp;·&nbsp;
                  Domingo · Cerrado
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA band */}
        <section
          className="px-8 py-16 max-[640px]:px-5"
          style={{ background: 'var(--cn-cream-50)', borderTop: '1px solid var(--cn-line)' }}
        >
          <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-6 text-center">
            <h2
              className="text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.1] tracking-[-0.02em]"
              style={{
                fontFamily: 'var(--font-fraunces)',
                color: 'var(--cn-teal-900)',
                maxWidth: '28ch',
              }}
            >
              ¿Quieres vender tu camper o autocaravana?
            </h2>
            <p className="text-[16px]" style={{ color: 'var(--cn-ink-500)', maxWidth: '48ch' }}>
              Empieza con una tasación gratuita online. Te respondemos en menos de 24 horas.
            </p>
            <Link
              href="/vender"
              className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-semibold text-white transition hover:opacity-90"
              style={{ background: 'var(--cn-terra-500)' }}
            >
              Solicitar tasación gratis
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </>
  )
}
