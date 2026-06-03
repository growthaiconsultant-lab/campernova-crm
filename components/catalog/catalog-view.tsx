/**
 * Vista reutilizable de listado del catálogo público (hub, categorías, marcas).
 * Server Component: incluye nav/footer, breadcrumb, hero con copy SEO, rejilla de
 * vehículos (o estado vacío) y datos estructurados (BreadcrumbList + ItemList).
 */
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { PublicNav } from '@/components/public-nav'
import { PublicFooter } from '@/components/public-footer'
import { JsonLd } from '@/components/json-ld'
import { VehicleCatalogCard } from '@/components/catalog/vehicle-catalog-card'
import { SITE_URL } from '@/lib/seo'
import type { PublicVehicle } from '@/lib/public-catalog'

export type Crumb = { label: string; href?: string }
export type RelatedLink = { href: string; label: string; sub?: string }

export type CatalogViewProps = {
  breadcrumb: Crumb[]
  eyebrow: string
  title: string
  intro: string
  vehicles: PublicVehicle[]
  related?: { heading: string; links: RelatedLink[] }
}

function breadcrumbJsonLd(crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: `${SITE_URL}${c.href}` } : {}),
    })),
  }
}

function itemListJsonLd(vehicles: PublicVehicle[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: vehicles.length,
    itemListElement: vehicles.map((v, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/comprar/${v.slug}`,
      name: `${v.title} ${v.year}`,
    })),
  }
}

export function CatalogView({
  breadcrumb,
  eyebrow,
  title,
  intro,
  vehicles,
  related,
}: CatalogViewProps) {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(breadcrumb)} />
      {vehicles.length > 0 && <JsonLd data={itemListJsonLd(vehicles)} />}
      <PublicNav />

      <main className="min-h-screen pt-20" style={{ background: 'var(--cn-cream-100)' }}>
        <div className="mx-auto max-w-[1280px] px-8 pb-24 pt-8 max-[640px]:px-5">
          {/* Breadcrumb */}
          <nav
            className="mb-7 flex flex-wrap items-center gap-2 font-mono text-[13px] tracking-[0.06em]"
            style={{ color: 'var(--cn-ink-500)' }}
            aria-label="Migas de pan"
          >
            {breadcrumb.map((c, i) => (
              <span key={`${c.label}-${i}`} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden>/</span>}
                {c.href ? (
                  <Link href={c.href} className="hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span style={{ color: 'var(--cn-teal-900)' }}>{c.label}</span>
                )}
              </span>
            ))}
          </nav>

          {/* Hero */}
          <header className="mb-10 max-w-[44ch]">
            <p
              className="font-mono text-[11px] uppercase tracking-[0.14em]"
              style={{ color: 'var(--cn-teal-700)' }}
            >
              · {eyebrow}
            </p>
            <h1
              className="mt-3 text-[clamp(2.2rem,5vw,3.4rem)] leading-[1.04] tracking-[-0.02em]"
              style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-teal-900)' }}
            >
              {title}
            </h1>
            <p className="mt-5 text-[17px] leading-relaxed" style={{ color: 'var(--cn-ink-700)' }}>
              {intro}
            </p>
            {vehicles.length > 0 && (
              <p
                className="mt-4 font-mono text-[12px] uppercase tracking-[0.08em]"
                style={{ color: 'var(--cn-ink-500)' }}
              >
                {vehicles.length}{' '}
                {vehicles.length === 1 ? 'vehículo disponible' : 'vehículos disponibles'}
              </p>
            )}
          </header>

          {/* Related facet links */}
          {related && related.links.length > 0 && (
            <nav className="mb-10 flex flex-wrap gap-2.5" aria-label={related.heading}>
              {related.links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-full px-4 py-2 text-[13px] font-medium transition-colors"
                  style={{
                    border: '1px solid var(--cn-line)',
                    background: '#fff',
                    color: 'var(--cn-teal-900)',
                  }}
                >
                  {l.label}
                  {l.sub ? <span style={{ color: 'var(--cn-ink-500)' }}> · {l.sub}</span> : null}
                </Link>
              ))}
            </nav>
          )}

          {/* Grid or empty state */}
          {vehicles.length > 0 ? (
            <div className="grid grid-cols-3 gap-6 max-[1000px]:grid-cols-2 max-[640px]:grid-cols-1">
              {vehicles.map((v) => (
                <VehicleCatalogCard key={v.slug} vehicle={v} />
              ))}
            </div>
          ) : (
            <div
              className="rounded-cn-lg p-10 text-center"
              style={{ background: 'var(--cn-cream-50)', border: '1px solid var(--cn-line)' }}
            >
              <h2
                className="text-[24px] tracking-[-0.02em]"
                style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-teal-900)' }}
              >
                Estamos preparando nuevo stock
              </h2>
              <p
                className="mx-auto mt-3 max-w-[46ch] text-[15px] leading-relaxed"
                style={{ color: 'var(--cn-ink-700)' }}
              >
                Cada vehículo pasa por taller, revisión y verificación documental antes de
                publicarse. Cuéntale a Nova qué buscas y te avisamos en cuanto entre algo que
                encaje.
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/comprar"
                  className="inline-flex items-center gap-2 rounded-cn-sm px-5 py-3 text-[14px] font-semibold text-white transition hover:opacity-90"
                  style={{ background: 'var(--cn-teal-900)' }}
                >
                  Decirle a Nova qué busco
                  <ArrowRight size={16} />
                </Link>
                <Link
                  href="/vender"
                  className="text-[14px] font-medium hover:underline"
                  style={{ color: 'var(--cn-teal-700)' }}
                >
                  ¿Quieres vender el tuyo?
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      <PublicFooter />
    </>
  )
}
