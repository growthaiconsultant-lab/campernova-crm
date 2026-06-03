import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Shield, Eye, Handshake, Sparkles, Check, MapPin, Phone } from 'lucide-react'
import { PublicNav } from '@/components/public-nav'
import { PublicFooter } from '@/components/public-footer'
import { JsonLd } from '@/components/json-ld'
import { SITE_URL } from '@/lib/seo'
import {
  getPublishedVehicleBySlug,
  equipmentLabels,
  type PublicVehicle,
} from '@/lib/public-catalog'

// ISR on-demand: la ficha se renderiza en la primera petición y se cachea 10 min.
// No usamos generateStaticParams para no depender de la DB en el build (resiliencia).
export const revalidate = 600
export const dynamicParams = true

function eur(n: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtKm(n: number) {
  return new Intl.NumberFormat('es-ES').format(n) + ' km'
}

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const v = await getPublishedVehicleBySlug(params.id)
  if (!v) return {}
  const canonical = `/comprar/${v.slug}`
  const desc =
    v.description ??
    `${v.title} ${v.year} · ${fmtKm(v.km)} · ${v.typeLabel} seminueva con garantía en CampersNova.`
  return {
    title: `${v.title} ${v.year}`,
    description: desc,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      url: `${SITE_URL}${canonical}`,
      title: `${v.title} ${v.year}`,
      description: desc,
      images: v.photos[0] ? [{ url: v.photos[0].url, alt: v.photos[0].alt }] : undefined,
    },
  }
}

function vehicleJsonLd(v: PublicVehicle) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Vehicle',
    name: `${v.title} ${v.year}`,
    description: v.description ?? undefined,
    vehicleModelDate: String(v.year),
    vehicleSeatingCapacity: v.seats,
    bodyType: v.typeLabel,
    brand: { '@type': 'Brand', name: v.brand },
    model: v.model,
    image: v.photos.map((p) => p.url),
    mileageFromOdometer: { '@type': 'QuantitativeValue', value: v.km, unitCode: 'KMT' },
    ...(v.price != null && {
      offers: {
        '@type': 'Offer',
        price: v.price,
        priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/UsedCondition',
        url: `${SITE_URL}/comprar/${v.slug}`,
        seller: { '@type': 'AutoDealer', name: 'CampersNova' },
      },
    }),
  }
}

export default async function VehicleDetailPage({ params }: Props) {
  const v = await getPublishedVehicleBySlug(params.id)
  if (!v) notFound()

  const equipment = equipmentLabels(v.equipment)
  const specs = [
    { lab: 'Año', val: String(v.year) },
    { lab: 'Kilómetros', val: fmtKm(v.km) },
    { lab: 'Plazas', val: String(v.seats) },
    ...(v.length ? [{ lab: 'Longitud', val: `${v.length} m` }] : []),
    { lab: 'Tipo', val: v.typeLabel },
    ...(v.location ? [{ lab: 'Ubicación', val: v.location }] : []),
  ]

  const mainPhoto = v.photos[0]
  const sidePhotos = v.photos.slice(1, 3)

  return (
    <>
      <JsonLd data={vehicleJsonLd(v)} />
      <PublicNav />

      <main className="min-h-screen pt-20" style={{ background: 'var(--cn-cream-100)' }}>
        <div className="mx-auto max-w-[1280px] px-8 pb-24 pt-8 max-[640px]:px-5">
          {/* Breadcrumb */}
          <nav
            className="mb-6 flex items-center gap-2 font-mono text-[13px] tracking-[0.06em]"
            style={{ color: 'var(--cn-ink-500)' }}
          >
            <Link href="/" className="hover:underline">
              Inicio
            </Link>
            <span>/</span>
            <Link href="/comprar" className="hover:underline">
              Comprar
            </Link>
            <span>/</span>
            <span style={{ color: 'var(--cn-teal-900)' }}>
              {v.title} {v.year}
            </span>
          </nav>

          {/* Gallery */}
          <div
            className="mb-10 overflow-hidden rounded-cn-lg"
            style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, aspectRatio: '16/9' }}
          >
            <div className="relative" style={{ background: 'var(--cn-cream-200)' }}>
              {mainPhoto ? (
                <Image
                  src={mainPhoto.url}
                  alt={mainPhoto.alt}
                  fill
                  sizes="(max-width: 1000px) 100vw, 66vw"
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="flex h-full items-center justify-center font-mono text-xs tracking-widest" style={{ color: 'var(--cn-ink-500)' }}>
                  Fotos próximamente
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 8 }}>
              {[0, 1].map((i) => {
                const photo = sidePhotos[i]
                return (
                  <div key={i} className="relative" style={{ background: 'var(--cn-cream-200)' }}>
                    {photo ? (
                      <Image
                        src={photo.url}
                        alt={photo.alt}
                        fill
                        sizes="33vw"
                        className="object-cover"
                      />
                    ) : (
                      i === 1 &&
                      v.photos.length > 3 && (
                        <span
                          className="absolute bottom-2 right-2 rounded-full px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] text-white"
                          style={{ background: 'rgba(10,10,10,0.82)' }}
                        >
                          + {v.photos.length - 3} fotos
                        </span>
                      )
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Detail layout */}
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 56, alignItems: 'flex-start' }}
            className="max-[1000px]:block"
          >
            {/* LEFT */}
            <div>
              {v.location && (
                <div className="mb-3.5 flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1 text-[12px]"
                    style={{ color: 'var(--cn-ink-500)' }}
                  >
                    <MapPin size={12} />
                    {v.location}
                  </span>
                </div>
              )}

              <h1
                className="text-[clamp(2rem,4vw,3rem)] leading-[1.05] tracking-[-0.02em]"
                style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-teal-900)' }}
              >
                {v.title} {v.year}
              </h1>
              {v.description && (
                <p
                  className="mt-5 whitespace-pre-line text-[18px] leading-relaxed"
                  style={{ color: 'var(--cn-ink-700)', maxWidth: '60ch' }}
                >
                  {v.description}
                </p>
              )}

              {/* Spec grid */}
              <div className="mt-12">
                <h2
                  className="text-[24px] tracking-[-0.02em]"
                  style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-teal-900)' }}
                >
                  Ficha técnica
                </h2>
                <div className="mt-6 grid grid-cols-2 gap-x-1">
                  {specs.map(({ lab, val }, i) => (
                    <div
                      key={lab}
                      className="flex gap-3 py-3.5"
                      style={{ borderTop: i >= 2 ? `1px solid var(--cn-line)` : 'none' }}
                    >
                      <div>
                        <div
                          className="font-mono text-[11px] uppercase tracking-[0.06em]"
                          style={{ color: 'var(--cn-ink-500)' }}
                        >
                          {lab}
                        </div>
                        <div
                          className="mt-0.5 text-[14px] font-medium"
                          style={{ color: 'var(--cn-ink-900)' }}
                        >
                          {val}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Equipment */}
              {equipment.length > 0 && (
                <div className="mt-14">
                  <h2
                    className="text-[24px] tracking-[-0.02em]"
                    style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-teal-900)' }}
                  >
                    Equipamiento
                  </h2>
                  <ul
                    className="mt-6 grid grid-cols-2 gap-x-6 gap-y-0"
                    style={{ listStyle: 'none', padding: 0 }}
                  >
                    {equipment.map((item) => (
                      <li
                        key={item}
                        className="flex items-center gap-2.5 border-b py-2.5 text-[14px]"
                        style={{ color: 'var(--cn-ink-700)', borderColor: 'var(--cn-line)' }}
                      >
                        <Check size={16} style={{ color: 'var(--cn-teal-700)', flexShrink: 0 }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warranty block */}
              <div
                className="mt-14 rounded-cn-lg p-7"
                style={{ background: 'var(--cn-cream-50)', border: '1px solid var(--cn-line)' }}
              >
                <p
                  className="font-mono text-[11px] uppercase tracking-[0.14em]"
                  style={{ color: 'var(--cn-teal-700)' }}
                >
                  · Garantía Campers Nova
                </p>
                <h2
                  className="mt-3 text-[22px] tracking-[-0.02em]"
                  style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-teal-900)' }}
                >
                  Comprar con tranquilidad
                </h2>
                <ul className="mt-4 space-y-3" style={{ listStyle: 'none', padding: 0 }}>
                  {[
                    'Vehículo revisado por mecánico independiente',
                    'Documentación completa y kilometraje verificado',
                    'Asesoramiento durante y después de la compra',
                    'Gestión de transferencia incluida',
                  ].map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-3 text-[14px]"
                      style={{ color: 'var(--cn-ink-700)' }}
                    >
                      <span
                        className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                        style={{ background: 'var(--cn-teal-900)' }}
                      >
                        <Check size={11} className="text-white" />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* RIGHT — sticky sidebar */}
            <aside
              className="rounded-cn-lg p-7 max-[1000px]:mt-12"
              style={{ background: '#fff', border: '1px solid var(--cn-line)', position: 'sticky', top: '96px' }}
            >
              <p
                className="text-[38px] leading-none"
                style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-teal-900)' }}
              >
                {v.price != null ? eur(v.price) : 'Precio a consultar'}
              </p>
              {v.price != null && (
                <p
                  className="mt-1.5 font-mono text-[12px] uppercase tracking-[0.06em]"
                  style={{ color: 'var(--cn-ink-500)' }}
                >
                  Precio total · IVA incluido
                </p>
              )}

              <div className="mt-6 flex flex-col gap-2.5">
                <Link
                  href="/comprar"
                  className="w-full rounded-cn-sm py-3 text-center text-[14px] font-semibold text-white transition hover:opacity-90"
                  style={{ background: 'var(--cn-teal-900)' }}
                >
                  Solicitar información
                </Link>
                <a
                  href="tel:+34645639185"
                  className="mx-auto mt-2 flex items-center gap-2 text-[13px] hover:underline"
                  style={{ color: 'var(--cn-teal-700)' }}
                >
                  <Phone size={14} />
                  645 63 91 85
                </a>
              </div>

              {/* Trust icons */}
              <div
                className="mt-7 flex flex-col gap-3 border-t pt-5"
                style={{ borderColor: 'var(--cn-line)' }}
              >
                {[
                  { Icon: Shield, text: 'Vehículo revisado y documentado' },
                  { Icon: Eye, text: 'Visita presencial sin compromiso' },
                  { Icon: Handshake, text: 'Trámites de transferencia incluidos' },
                ].map(({ Icon, text }) => (
                  <div
                    key={text}
                    className="flex items-center gap-3 text-[13px]"
                    style={{ color: 'var(--cn-ink-700)' }}
                  >
                    <Icon size={18} style={{ color: 'var(--cn-teal-700)', flexShrink: 0 }} />
                    {text}
                  </div>
                ))}
              </div>

              {/* Nova Assistant badge */}
              <div
                className="relative mt-5 flex items-start gap-3.5 overflow-hidden rounded-cn-md p-4"
                style={{ background: 'var(--cn-teal-900)' }}
              >
                <div
                  className="relative z-10 grid h-9 w-9 flex-shrink-0 place-items-center rounded-[10px]"
                  style={{
                    background: 'rgba(181,158,125,0.15)',
                    border: '1px solid rgba(181,158,125,0.35)',
                    color: '#f5d4c2',
                  }}
                >
                  <Sparkles size={18} />
                </div>
                <div className="relative z-10">
                  <strong
                    className="block text-[16px] font-medium leading-tight text-white"
                    style={{ fontFamily: 'var(--font-fraunces)' }}
                  >
                    Nova Assistant incluido
                  </strong>
                  <span
                    className="mt-0.5 block text-[12px] leading-snug"
                    style={{ color: 'rgba(255,255,255,0.72)' }}
                  >
                    QR único en tu camper o autocaravana. Pregúntale a tu vehículo lo que necesites,
                    24/7.
                  </span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <PublicFooter />
    </>
  )
}
