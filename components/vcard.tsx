import Link from 'next/link'
import { Heart } from 'lucide-react'
import type { DummyVehicle } from '@/lib/dummy/vehicles'

const TAG_CLASSES: Record<string, string> = {
  'Nueva entrada': 'bg-cn-terra-500 text-white border-transparent',
  Premium: 'bg-cn-teal-900 text-white border-transparent',
  'Casi nueva': 'bg-cn-teal-900 text-white border-transparent',
}
const DEFAULT_TAG = 'bg-white/90 text-cn-teal-900 border-cn-line'

function eur(n: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

export function VCard({ v }: { v: DummyVehicle }) {
  return (
    <Link
      href={`/comprar/${v.id}`}
      className="group flex flex-col overflow-hidden rounded-cn-lg bg-white transition-all duration-200 hover:-translate-y-1"
      style={{ border: '1px solid var(--cn-line)', boxShadow: 'var(--sh-sm)' }}
    >
      {/* Image placeholder */}
      <div className="relative aspect-[4/3]" style={{ background: 'var(--cn-cream-200)' }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-mono text-[11px] tracking-widest"
            style={{ color: 'var(--cn-ink-500)' }}
          >
            {v.placeholder}
          </span>
        </div>

        <div className="absolute left-3.5 top-3.5 flex flex-wrap gap-1.5">
          {v.tags.map((t) => (
            <span
              key={t}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${TAG_CLASSES[t] ?? DEFAULT_TAG}`}
            >
              {t}
            </span>
          ))}
        </div>

        <button
          aria-label="Guardar"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-sm transition hover:text-cn-terra-500"
          style={{ background: 'rgba(255,255,255,0.7)', color: 'var(--cn-ink-500)' }}
          onClick={(e) => e.preventDefault()}
        >
          <Heart size={15} />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-4 p-[22px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4
              className="text-[22px] leading-[1.15] tracking-[-0.01em]"
              style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-teal-900)' }}
            >
              {v.title}
            </h4>
            <p
              className="mt-1 font-mono text-[13px] tracking-[0.04em]"
              style={{ color: 'var(--cn-ink-500)' }}
            >
              {v.year} · {v.location}
            </p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p
              className="text-[22px] leading-tight"
              style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--cn-teal-900)' }}
            >
              {eur(v.price)}
            </p>
            <span
              className="block text-[11px] tracking-[0.04em]"
              style={{ color: 'var(--cn-ink-500)' }}
            >
              precio total
            </span>
          </div>
        </div>

        {/* Specs */}
        <div
          className="grid grid-cols-4 gap-2.5 border-t pt-3.5"
          style={{ borderColor: 'var(--cn-line)' }}
        >
          {[
            { lab: 'Año', val: String(v.year) },
            { lab: 'KM', val: new Intl.NumberFormat('es-ES').format(v.km) },
            { lab: 'Plazas', val: `${v.seats}/${v.sleeps}` },
            { lab: 'Cambio', val: v.transmission === 'Automático' ? 'Auto' : 'Manual' },
          ].map(({ lab, val }) => (
            <div key={lab} className="flex flex-col gap-0.5">
              <span
                className="font-mono text-[10px] uppercase tracking-[0.08em]"
                style={{ color: 'var(--cn-ink-500)' }}
              >
                {lab}
              </span>
              <span className="text-[13px] font-medium" style={{ color: 'var(--cn-ink-900)' }}>
                {val}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Link>
  )
}
