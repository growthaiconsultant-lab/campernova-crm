/**
 * Tarjeta de vehículo para las rejillas del catálogo público.
 * Server Component — enlaza a la ficha `/comprar/{slug}`.
 */
import Image from 'next/image'
import Link from 'next/link'
import { MapPin, BadgeCheck } from 'lucide-react'
import type { PublicVehicle } from '@/lib/public-catalog'

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

export function VehicleCatalogCard({ vehicle: v }: { vehicle: PublicVehicle }) {
  const photo = v.photos[0]
  return (
    <Link
      href={`/comprar/${v.slug}`}
      className="group flex flex-col overflow-hidden rounded-cn-lg bg-white transition-shadow hover:shadow-lg"
      style={{ border: '1px solid var(--cn-line)' }}
    >
      <div className="relative aspect-[4/3] w-full" style={{ background: 'var(--cn-cream-200)' }}>
        {photo ? (
          <Image
            src={photo.url}
            alt={photo.alt}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="flex h-full items-center justify-center font-mono text-[11px] tracking-widest"
            style={{ color: 'var(--cn-ink-500)' }}
          >
            FOTOS PRÓXIMAMENTE
          </div>
        )}
        <span
          className="absolute left-3 top-3 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-white"
          style={{ background: 'rgba(10,10,10,0.78)' }}
        >
          {v.typeLabel}
        </span>
        {v.verified && (
          <span
            className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold text-white"
            style={{ background: '#1f8a5b' }}
          >
            <BadgeCheck size={12} />
            Verificado
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3
          className="text-[18px] leading-tight tracking-[-0.01em]"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-teal-900)' }}
        >
          {v.title} {v.year}
        </h3>

        <p
          className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.06em]"
          style={{ color: 'var(--cn-ink-500)' }}
        >
          {fmtKm(v.km)} · {v.seats} plazas
          {v.length ? ` · ${v.length} m` : ''}
        </p>

        {v.location && (
          <p
            className="mt-2 inline-flex items-center gap-1 text-[12px]"
            style={{ color: 'var(--cn-ink-500)' }}
          >
            <MapPin size={12} />
            {v.location}
          </p>
        )}

        <p
          className="mt-auto pt-4 text-[22px] leading-none"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-teal-900)' }}
        >
          {v.price != null ? eur(v.price) : 'Precio a consultar'}
        </p>
      </div>
    </Link>
  )
}
