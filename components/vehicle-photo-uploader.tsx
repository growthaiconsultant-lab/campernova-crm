'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ArrowLeft, ArrowRight, GripVertical, Loader2, Upload, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { compressImage } from '@/lib/image/compress'
import {
  listVehiclePhotos,
  deleteVehiclePhoto,
  reorderVehiclePhotos,
  setVehiclePhotoCategory,
  uploadVehiclePhoto,
} from '@/app/(backoffice)/vendedores/photo-actions'
import type { PhotoCategory } from '@prisma/client'

import { PUBLICADO_MIN_PHOTOS as MIN_PHOTOS } from '@/lib/vehicle-legal/requirements'

export type VehiclePhoto = {
  id: string
  url: string
  order: number
  altText?: string | null
  category?: PhotoCategory | null
}

const MAX_PHOTOS = 30
const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp']
// PUB-1: categorías de foto para el anuncio. Opcional (Sin categoría) mientras el gate esté relajado.
const CATEGORY_OPTIONS: { value: PhotoCategory; label: string }[] = [
  { value: 'EXTERIOR', label: 'Exterior' },
  { value: 'INTERIOR', label: 'Interior' },
  { value: 'DETALLE', label: 'Detalle' },
  { value: 'DOCUMENTAL', label: 'Documental' },
]

type Props = {
  vehicleId: string
  initialPhotos: VehiclePhoto[]
  onBusyChange?: (busy: boolean) => void
  className?: string
}

export function VehiclePhotoUploader({ vehicleId, initialPhotos, className, onBusyChange }: Props) {
  const [photos, setPhotos] = useState<VehiclePhoto[]>(
    [...initialPhotos].sort((a, b) => a.order - b.order)
  )
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isOver, setIsOver] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const working = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    setPhotos(initialPhotos)
  }, [initialPhotos])

  async function run(operation: () => Promise<void>) {
    if (working.current) return
    working.current = true
    setBusy(true)
    onBusyChange?.(true)
    setError(null)
    try {
      await operation()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido guardar el cambio.')
      try {
        setPhotos(await listVehiclePhotos(vehicleId))
      } catch {
        /* Se conserva la última galería disponible. */
      }
    } finally {
      working.current = false
      setBusy(false)
      setUploading(0)
      onBusyChange?.(false)
    }
  }
  function handleFiles(files: FileList | File[]) {
    const list = Array.from(files)
    const accepted = list
      .filter((f) => ACCEPTED_MIME.includes(f.type))
      .slice(0, Math.max(0, MAX_PHOTOS - photos.length))
    return run(async () => {
      if (!accepted.length) {
        setError(
          photos.length >= MAX_PHOTOS
            ? 'Has alcanzado el máximo de 30 fotos.'
            : 'Solo se admiten JPEG, PNG o WebP.'
        )
        return
      }
      if (accepted.length < list.length)
        setError('Algunas fotos superan el límite o tienen un formato no admitido.')
      setUploading(accepted.length)
      for (const file of accepted) {
        const fd = new FormData()
        fd.set('vehicleId', vehicleId)
        fd.set('file', await compressImage(file))
        const res = await uploadVehiclePhoto(fd)
        if ('error' in res) throw new Error(res.error)
        setPhotos((prev) => [...prev.filter((p) => p.id !== res.photo.id), res.photo])
        setUploading((n) => n - 1)
      }
    })
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsOver(false)
    if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files)
  }
  function moveItem(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || to >= photos.length) return
    void run(async () => {
      const next = [...photos]
      next.splice(to, 0, next.splice(from, 1)[0])
      const res = await reorderVehiclePhotos(
        vehicleId,
        next.map((p) => p.id),
        photos.map((p) => p.id)
      )
      if ('error' in res) throw new Error(res.error)
      setPhotos(next.map((p, order) => ({ ...p, order })))
    })
  }
  function remove(photo: VehiclePhoto, index: number) {
    if (!window.confirm(`¿Eliminar la foto ${index + 1} de la galería del vehículo?`)) return
    void run(async () => {
      const res = await deleteVehiclePhoto(photo.id)
      if ('error' in res) throw new Error(res.error)
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
    })
  }
  function categorize(photo: VehiclePhoto, value: string) {
    void run(async () => {
      const category = value ? (value as PhotoCategory) : null
      const res = await setVehiclePhotoCategory(photo.id, category)
      if ('error' in res) throw new Error(res.error)
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, category } : p)))
    })
  }
  const totalCount = photos.length + uploading
  const belowMin = photos.length < MIN_PHOTOS
  const atMax = totalCount >= MAX_PHOTOS

  return (
    <fieldset disabled={busy} aria-busy={busy} className={cn('min-w-0 space-y-3', className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!atMax) setIsOver(true)
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={onDrop}
        onClick={() => !busy && !atMax && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !atMax && !busy) {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-3 text-center transition-colors',
          isOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:bg-muted/40',
          atMax && 'pointer-events-none opacity-50'
        )}
        aria-disabled={atMax}
      >
        <Upload className="mb-1 h-5 w-5 text-muted-foreground" aria-hidden />
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

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {belowMin && !error && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Faltan {MIN_PHOTOS - photos.length} fotos para alcanzar el mínimo de publicación de{' '}
          {MIN_PHOTOS}.
        </p>
      )}

      {(photos.length > 0 || uploading > 0) && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo, index) => (
            <li
              key={photo.id}
              data-photo-index={index}
              draggable={!busy}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', photo.id)
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
                'group overflow-hidden rounded-md border bg-card',
                dragIndex === index && 'opacity-40',
                overIndex === index &&
                  dragIndex !== null &&
                  dragIndex !== index &&
                  'ring-2 ring-primary'
              )}
            >
              <div className="relative aspect-[4/3] bg-muted">
                <Image
                  src={photo.url}
                  alt={photo.altText || `Foto ${index + 1}`}
                  fill
                  sizes="(min-width: 640px) 200px, 45vw"
                  className="object-contain"
                  draggable={false}
                  unoptimized
                />
              </div>
              <div className="space-y-1 p-1.5">
                <div className="flex items-center justify-between gap-1 text-xs font-medium">
                  <span>{index === 0 ? '1 · Portada' : 'Foto ' + (index + 1)}</span>
                  <span
                    className="cursor-grab touch-none rounded p-2"
                    aria-label="Arrastrar para reordenar"
                    onPointerDown={(e) => {
                      if (e.pointerType !== 'mouse' && !busy) {
                        e.currentTarget.setPointerCapture(e.pointerId)
                        setDragIndex(index)
                      }
                    }}
                    onPointerMove={(e) => {
                      if (
                        e.pointerType !== 'mouse' &&
                        e.currentTarget.hasPointerCapture(e.pointerId)
                      ) {
                        const target = document
                          .elementFromPoint(e.clientX, e.clientY)
                          ?.closest<HTMLElement>('[data-photo-index]')
                        setOverIndex(
                          target && e.currentTarget.closest('ul')?.contains(target)
                            ? Number(target.dataset.photoIndex)
                            : null
                        )
                      }
                    }}
                    onPointerUp={(e) => {
                      if (
                        e.pointerType !== 'mouse' &&
                        e.currentTarget.hasPointerCapture(e.pointerId)
                      ) {
                        const target = document
                          .elementFromPoint(e.clientX, e.clientY)
                          ?.closest<HTMLElement>('[data-photo-index]')
                        if (target && e.currentTarget.closest('ul')?.contains(target))
                          moveItem(index, Number(target.dataset.photoIndex))
                        setDragIndex(null)
                        setOverIndex(null)
                      }
                    }}
                    onPointerCancel={() => {
                      setDragIndex(null)
                      setOverIndex(null)
                    }}
                  >
                    <GripVertical size={16} aria-hidden />
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="rounded border p-1.5 disabled:opacity-30"
                    disabled={index === 0}
                    aria-label={`Adelantar foto ${index + 1}`}
                    onClick={() => moveItem(index, index - 1)}
                  >
                    <ArrowLeft size={15} />
                  </button>
                  <button
                    type="button"
                    className="rounded border p-1.5 disabled:opacity-30"
                    disabled={index === photos.length - 1}
                    aria-label={`Retrasar foto ${index + 1}`}
                    onClick={() => moveItem(index, index + 1)}
                  >
                    <ArrowRight size={15} />
                  </button>
                  <button
                    type="button"
                    className="ml-auto rounded p-1.5 hover:text-destructive"
                    aria-label={`Eliminar foto ${index + 1}`}
                    onClick={() => remove(photo, index)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <select
                  value={photo.category ?? ''}
                  onChange={(e) => categorize(photo, e.target.value)}
                  aria-label={`Categoría de la foto ${index + 1}`}
                  className="w-full rounded border bg-background p-1 text-xs"
                >
                  <option value="">Sin categoría</option>
                  {CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
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
    </fieldset>
  )
}
