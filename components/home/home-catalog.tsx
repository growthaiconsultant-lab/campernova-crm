'use client'

import { useState } from 'react'
import Link from 'next/link'
import { VehicleCatalogCard, type CardVehicle } from '@/components/catalog/vehicle-catalog-card'

const archive: (CardVehicle & { note: string })[] = [
  {
    slug: 'ford-nugget',
    title: 'Ford Nugget',
    typeLabel: 'Camper',
    price: null,
    monthlyPaymentFrom: null,
    note: 'Transit Custom · Techo elevable',
    photos: [
      { url: '/cn-landing/media/v-nugget.jpg', alt: 'Ford Nugget con techo elevable' },
      {
        url: '/images/landing/nugget-archivo-trasera.webp',
        alt: 'Vista trasera de la Ford Nugget',
      },
    ],
  },
  {
    slug: 'autocaravana-perfilada',
    title: 'Autocaravana perfilada',
    typeLabel: 'Autocaravana',
    price: null,
    monthlyPaymentFrom: null,
    note: '',
    photos: [
      {
        url: '/cn-landing/media/hero-compra-m.jpg',
        alt: 'Autocaravanas de archivo en la exposición',
      },
    ],
  },
]
const filters = [
  ['Todos', 'Todos'],
  ['Camper', 'Campers'],
  ['Autocaravana', 'Autocaravanas'],
]
export function HomeCatalog({ vehicles }: { vehicles: CardVehicle[] }) {
  const [filter, setFilter] = useState('Todos')
  const stock = vehicles.filter((v) => filter === 'Todos' || v.typeLabel === filter)
  const examples = archive
    .filter(
      (v) =>
        (filter === 'Todos' || v.typeLabel === filter) &&
        !stock.some((item) => item.title.toLowerCase() === v.title.toLowerCase())
    )
    .slice(0, Math.max(0, 3 - stock.length))
  return (
    <section id="comprar" className="home-catalog">
      <div className="spread">
        <div className="catalog-heading">
          <h2>Campers y autocaravanas</h2>
          <Link className="quietlink" href="/comprar/vehiculos">
            Ver todo el catálogo ↗
          </Link>
        </div>
        <div className="catalog-filters" role="group" aria-label="Filtrar por tipo">
          {filters.map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {stock.length === 0 && (
          <p className="catalog-empty">
            Consulta el <Link href="/comprar/vehiculos">catálogo completo</Link> o{' '}
            <Link href="/busqueda-bajo-pedido">cuéntanos qué buscas</Link> para encontrar tu próxima
            camper.
          </p>
        )}
        <div className="catalog-grid">
          {stock.slice(0, 6).map((v) => (
            <VehicleCatalogCard key={v.slug} vehicle={v} showDetails={false} />
          ))}
          {examples.map((v) => (
            <VehicleCatalogCard key={v.slug} vehicle={v} archiveNote={v.note} showDetails={false} />
          ))}
        </div>
      </div>
    </section>
  )
}
