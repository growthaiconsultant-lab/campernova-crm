'use client'

import { useCallback, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { GripVertical, Loader2, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { compressImage } from '@/lib/image/compress'
import {
  deleteVehiclePhoto,
  reorderVehiclePhotos,
  uploadVehiclePhoto,
} from '@/app/(backoffice)/vendedores/photo-actions'

export type VehiclePhoto = {
  id: string
  url: string
  order: number
}

const MIN_PHOTOS = 6
const MAX_PHOTOS = 30
const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp']

type Props = {
  vehicleId: string
  initialPhotos: VehiclePhoto[]
  className?: string
}

export function VehiclePhotoUploader({ vehicleId, initialPhotos, className }: Props) {
  const [photos, setPhotos] = useState<VehiclePhoto[]>(
    [...initialPhotos].sort((a, b) => a.order - b.order)
  )
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isOver, setIsOver] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [, startReorder] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null)
      const list = Array.from(files)
      const slotsLeft = MAX_PHOTOS - photos.length - uploading
      if (slotsLeft <= 0) {
        setError(`Has alcanzado el máximo de ${MAX_PHOTOS} fotos.`)
        return
      }
      const accepted: File[] = []
      for (const f of list) {
        if (!ACCEPTED_MIME.includes(f.type)) continue
        accepted.push(f)
        if (accepted.length >= slotsLeft) break
      }
      if (accepted.length === 0) {
        setError('Solo se admiten JPEG, PNG o WebP.')
        return
      }
      if (accepted.length < list.length) {
        setError(
          `Se subirán ${accepted.length} fotos. El resto excedía el máximo o no eran imágenes válidas.`
        )
      }

      setUploading((n) => n + accepted.length)
      await Promise.all(
        accepted.map(async (file) => {
          try {
            const compressed = await compressImage(file)
            const fd = new FormData()
            fd.set('vehicleId', vehicleId)
            fd.set('file', compressed)
            const res = await uploadVehiclePhoto(fd)
            if ('error' in res) {
              setError(res.error)
            } else {
              setPhotos((prev) => [...prev, res.photo])
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al procesar la imagen')
          } finally {
            setUploading((n) => n - 1)
          }
        })
      )
    },
    [photos.length, uploading, vehicleId]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsOver(false)
      if (e.dataTransfer.files.length > 0) {
        void handleFiles(e.dataTransfer.files)
      }
    },
    [handleFiles]
  )

  const handleDelete = useCallback(
    async (photoId: string) => {
      setError(null)
      const prev = photos
      setPhotos((p) => p.filter((x) => x.id !== photoId))
      const res = await deleteVehiclePhoto(photoId)
      if ('error' in res) {
        setError(res.error)
        setPhotos(prev)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [photos]
  )

  const persistOrder = useCallback(
    (next: VehiclePhoto[]) => {
      startReorder(async () => {
        const res = await reorderVehiclePhotos(
          vehicleId,
          next.map((p) => p.id)
        )
        if ('error' in res) {
          setError(res.error)
        }
      })
    },
    [vehicleId]
  )

  const moveItem = useCallback(
    (from: number, to: number) => {
      if (from === to) return
      setPhotos((prev) => {
        const next = [...prev]
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        persistOrder(next)
        return next
      })
    },
    [persistOrder]
  )

  const totalCount = photos.length + uploading
  const belowMin = photos.length < MIN_PHOTOS
  const atMax = totalCount >= MAX_PHOTOS

  return (
    <div className={cn('space-y-4', className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!atMax) setIsOver(true)
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={onDrop}
        onClick={() => !atMax && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !atMax) {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors',
          isOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:bg-muted/40',
          atMax && 'pointer-events-none opacity-50'
        )}
        aria-disabled={atMax}
      >
        <Upload className="mb-2 h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">
          {atMax ? `Has alcanzado el máximo (${MAX_PHOTOS})` : 'Arrastra fotos aquí o haz clic'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          JPEG, PNG o WebP · se comprimen a ≤1.5 MB · {photos.length}/{MAX_PHOTOS}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_MIME.join(',')}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {belowMin && !error && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Faltan {MIN_PHOTOS - photos.length} fotos para alcanzar el mínimo recomendado de{' '}
          {MIN_PHOTOS}.
        </p>
      )}

      {(photos.length > 0 || uploading > 0) && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo, index) => (
            <li
              key={photo.id}
              draggable
              onDragStart={(e) => {
                setDragIndex(index)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                if (overIndex !== index) setOverIndex(index)
              }}
              onDragLeave={() => setOverIndex((i) => (i === index ? null : i))}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (dragIndex !== null && dragIndex !== index) {
                  moveItem(dragIndex, index)
                }
                setDragIndex(null)
                setOverIndex(null)
              }}
              onDragEnd={() => {
                setDragIndex(null)
                setOverIndex(null)
              }}
              className={cn(
                'group relative aspect-[4/3] overflow-hidden rounded-md border bg-muted',
                dragIndex === index && 'opacity-40',
                overIndex === index &&
                  dragIndex !== null &&
                  dragIndex !== index &&
                  'ring-2 ring-primary'
              )}
            >
              <Image
                src={photo.url}
                alt={`Foto ${index + 1}`}
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                className="object-cover"
                unoptimized
              />
              <div className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-xs font-medium text-white">
                {index + 1}
              </div>
              <span className="absolute right-1 top-1 cursor-grab rounded bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <GripVertical className="h-4 w-4" aria-hidden />
                <span className="sr-only">Arrastrar para reordenar</span>
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  void handleDelete(photo.id)
                }}
                className="absolute bottom-1 right-1 rounded-full bg-black/70 p-1 text-white opacity-0 transition-opacity hover:bg-destructive group-hover:opacity-100"
                aria-label="Eliminar foto"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
          {Array.from({ length: uploading }).map((_, i) => (
            <li
              key={`pending-${i}`}
              className="flex aspect-[4/3] items-center justify-center rounded-md border bg-muted"
            >
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
