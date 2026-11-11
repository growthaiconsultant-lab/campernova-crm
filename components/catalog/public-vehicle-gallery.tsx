'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { PublicVehiclePhoto } from '@/lib/public-catalog'

export function PublicVehicleGallery({ photos }: { photos: PublicVehiclePhoto[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  const active = Math.max(
    0,
    photos.findIndex((p) => p.url === selected)
  )
  const current = photos[active]
  return (
    <section aria-label="Fotos del vehículo" className="mb-6">
      <div className="relative flex aspect-[16/9] max-h-[62vh] items-center justify-center rounded-cn-lg bg-[var(--cn-cream-200)]">
        {current ? (
          <Image
            src={current.url}
            alt={current.alt}
            fill
            sizes="(max-width: 1000px) 100vw, 1000px"
            className="object-contain"
            priority
          />
        ) : (
          <span>Fotos próximamente</span>
        )}
      </div>
      {photos.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto p-1">
          {photos.map((photo, i) => (
            <button
              type="button"
              key={photo.url}
              aria-label={`Ver foto ${i + 1} de ${photos.length}`}
              aria-pressed={i === active}
              onClick={() => setSelected(photo.url)}
              className="relative h-14 w-20 shrink-0 rounded bg-[var(--cn-cream-200)] aria-pressed:ring-2 aria-pressed:ring-current"
            >
              <Image src={photo.url} alt="" fill sizes="80px" className="object-contain" />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
