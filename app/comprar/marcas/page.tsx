import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { PublicNav } from '@/components/public-nav'
import { PublicFooter } from '@/components/public-footer'
import { JsonLd } from '@/components/json-ld'
import { pageMetadata, SITE_URL } from '@/lib/seo'
import { getCatalogBrands } from '@/lib/public-catalog'

export const revalidate = 600

const PATH = '/comprar/marcas'

export async function generateMetadata(): Promise<Metadata> {
  const brands = await getCatalogBrands()
  return pageMetadata({
    title: 'Autocaravanas y campers seminuevas por marca',
    description:
      'Explora nuestro stock de autocaravanas y campers seminuevas por marca. Todas revisadas en taller propio y con garantía de 12 meses en CampersNova.',
    path: PATH,
    noindex: brands.length === 0,
  })
}

export default async function BrandsIndexPage() {
  const brands = await getCatalogBrands()

  const breadcrumb = [
    { label: 'Inicio', href: '/' },
    { label: 'Comprar', href: '/comprar' },
    { label: 'Marcas' },
  ]

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: breadcrumb.map((c, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: c.label,
            ...(c.href ? { item: `${SITE_URL}${c.href}` } : {}),
          })),
        }}
      />
      <PublicNav />

      <main className="min-h-screen pt-20" style={{ background: 'var(--cn-cream-100)' }}>
        <div className="mx-auto max-w-[1280px] px-8 pb-24 pt-8 max-[640px]:px-5">
          <nav
            className="mb-7 flex flex-wrap items-center gap-2 font-mono text-[13px] tracking-[0.06em]"
            style={{ color: 'var(--cn-ink-500)' }}
            aria-label="Migas de pan"
          >
            {breadcrumb.map((c, i) => (
              <span key={c.label} className="flex items-center gap-2">
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

          <header className="mb-10 max-w-[44ch]">
            <p
              className="font-mono text-[11px] uppercase tracking-[0.14em]"
              style={{ color: 'var(--cn-teal-700)' }}
            >
              · Marcas
            </p>
            <h1
              className="mt-3 text-[clamp(2.2rem,5vw,3.4rem)] leading-[1.04] tracking-[-0.02em]"
              style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-teal-900)' }}
            >
              Autocaravanas y campers por marca
            </h1>
            <p className="mt-5 text-[17px] leading-relaxed" style={{ color: 'var(--cn-ink-700)' }}>
              Selecciona una marca para ver el stock disponible. Cada vehículo se entrega revisado,
              con garantía de 12 meses ampliable y cambio de nombre incluido.
            </p>
          </header>

          {brands.length > 0 ? (
            <div className="grid grid-cols-3 gap-4 max-[1000px]:grid-cols-2 max-[640px]:grid-cols-1">
              {brands.map((b) => (
                <Link
                  key={b.slug}
                  href={`/comprar/marcas/${b.slug}`}
                  className="group flex items-center justify-between rounded-cn-lg bg-white p-5 transition-shadow hover:shadow-md"
                  style={{ border: '1px solid var(--cn-line)' }}
                >
                  <div>
                    <h2
                      className="text-[20px] tracking-[-0.01em]"
                      style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-teal-900)' }}
                    >
                      {b.brand}
                    </h2>
                    <p
                      className="mt-1 font-mono text-[11px] uppercase tracking-[0.06em]"
                      style={{ color: 'var(--cn-ink-500)' }}
                    >
                      {b.count} {b.count === 1 ? 'vehículo' : 'vehículos'}
                    </p>
                  </div>
                  <ArrowUpRight
                    size={18}
                    style={{ color: 'var(--cn-teal-700)' }}
                    className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </Link>
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
                Aún no hay marcas con stock publicado
              </h2>
              <p
                className="mx-auto mt-3 max-w-[46ch] text-[15px] leading-relaxed"
                style={{ color: 'var(--cn-ink-700)' }}
              >
                Estamos preparando nuevos vehículos. Cuéntale a Nova qué marca buscas y te avisamos
                en cuanto entre algo que encaje.
              </p>
              <Link
                href="/comprar"
                className="mt-7 inline-flex items-center gap-2 rounded-cn-sm px-5 py-3 text-[14px] font-semibold text-white transition hover:opacity-90"
                style={{ background: 'var(--cn-teal-900)' }}
              >
                Decirle a Nova qué busco
                <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </main>

      <PublicFooter />
    </>
  )
}
