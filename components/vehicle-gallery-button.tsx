'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Camera, Images } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { VehiclePhotoUploader, type VehiclePhoto } from './vehicle-photo-uploader'
import { listVehiclePhotos } from '@/app/(backoffice)/vendedores/photo-actions'
import { cn } from '@/lib/utils'

type Props = {
  vehicleId: string
  title: string
  cover: string | null
  coverAlt?: string | null
  count: number
  compact?: boolean
}

export function VehicleGalleryButton({
  vehicleId,
  title,
  cover,
  coverAlt,
  count,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const [photos, setPhotos] = useState<VehiclePhoto[] | null>(null)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const request = useRef(0)

  async function load() {
    const id = ++request.current
    setPhotos(null)
    setError(false)
    try {
      const items = await listVehiclePhotos(vehicleId)
      if (request.current === id) setPhotos(items)
    } catch {
      if (request.current === id) setError(true)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return
        setOpen(next)
        if (next) void load()
        else request.current++
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`Abrir galería de ${title} · ${count} fotos`}
          className={cn(
            'relative flex shrink-0 items-center justify-center overflow-hidden bg-muted text-muted-foreground focus-visible:ring-2 focus-visible:ring-brand',
            compact ? 'h-14 w-16 rounded-lg border sm:w-20' : 'h-40 w-full'
          )}
        >
          {cover ? (
            <Image
              src={cover}
              alt={coverAlt || title}
              fill
              sizes={compact ? '80px' : '(max-width:640px) 100vw, (max-width:1024px) 50vw, 25vw'}
              className="object-contain"
            />
          ) : (
            <Camera aria-hidden size={compact ? 20 : 28} />
          )}
          <span className="absolute bottom-1 right-1 inline-flex items-center gap-1 rounded bg-black/65 px-1 py-0.5 text-[10px] font-medium text-white">
            <Images size={12} aria-hidden />
            {count}
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] max-w-4xl overflow-y-auto p-4 sm:p-5">
        <DialogHeader>
          <DialogTitle>Fotos de {title}</DialogTitle>
          <DialogDescription>
            Arrastra las fotos para ordenarlas. La primera es la portada del anuncio.
          </DialogDescription>
        </DialogHeader>
        {photos ? (
          <VehiclePhotoUploader
            vehicleId={vehicleId}
            initialPhotos={photos}
            onBusyChange={setBusy}
          />
        ) : error ? (
          <p role="alert">
            No se pudieron cargar las fotos.{' '}
            <button type="button" className="underline" onClick={() => void load()}>
              Reintentar
            </button>
          </p>
        ) : (
          <p role="status">Cargando fotos…</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
