import type { Metadata } from 'next'
import { Mail, Clock, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PublicNav } from '@/components/public-nav'
import { PublicFooter } from '@/components/public-footer'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Contacto — CampersNova',
  description:
    'Contacta con el equipo de CampersNova. Estamos disponibles de lunes a viernes de 9:00 a 18:00.',
}

const INFO = [
  {
    icon: Mail,
    title: 'Email',
    value: 'info@campersnova.com',
    href: 'mailto:info@campersnova.com',
    detail: 'Respondemos en menos de 24 horas en días laborables.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp',
    value: 'Escríbenos por WhatsApp',
    href: 'https://wa.me/34600000000',
    detail: 'Atención rápida para dudas sobre tasación o el proceso de venta.',
  },
  {
    icon: Clock,
    title: 'Horario',
    value: 'Lunes a viernes, 9:00 – 18:00',
    href: null,
    detail: 'Zona horaria peninsular española (CET/CEST).',
  },
]

export default function ContactoPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicNav />

      {/* Header */}
      <section className="bg-[#294e4c] px-4 pb-16 pt-36">
        <div className="container mx-auto max-w-3xl text-center">
          <h1 className="mb-4 text-4xl font-bold text-white md:text-5xl">Contacto</h1>
          <p className="mx-auto max-w-xl text-lg text-white/75">
            ¿Tienes alguna duda? Escríbenos o consulta la información de contacto a continuación.
          </p>
        </div>
      </section>

      {/* Info cards */}
      <section className="flex-1 px-4 py-20">
        <div className="container mx-auto max-w-3xl">
          <div className="grid gap-6 sm:grid-cols-3">
            {INFO.map(({ icon: Icon, title, value, href, detail }) => (
              <div key={title} className="flex flex-col gap-3 rounded-xl border bg-card p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#294e4c]/10">
                  <Icon className="h-5 w-5 text-[#294e4c]" />
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {title}
                  </p>
                  {href ? (
                    <a
                      href={href}
                      className="text-sm font-medium text-foreground transition-colors hover:text-[#cc6119]"
                    >
                      {value}
                    </a>
                  ) : (
                    <p className="text-sm font-medium text-foreground">{value}</p>
                  )}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{detail}</p>
              </div>
            ))}
          </div>

          {/* CTA vender */}
          <div className="mt-12 rounded-xl border bg-muted/50 p-8 text-center">
            <h2 className="mb-2 text-xl font-semibold text-foreground">
              ¿Quieres vender tu autocaravana o camper?
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Usa nuestro formulario online para recibir una tasación gratuita en menos de 60
              segundos.
            </p>
            <Link href="/vender">
              <Button className="bg-[#cc6119] font-medium text-white hover:bg-[#cc6119]/90">
                Solicitar tasación gratis
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
