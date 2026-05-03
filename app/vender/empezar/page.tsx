'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import HCaptcha from '@hcaptcha/react-hcaptcha'
import { Loader2, Upload, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { usePostHog } from 'posthog-js/react'
import { cn } from '@/lib/utils'
import { compressImage } from '@/lib/image/compress'
import { submitPublicLead } from './actions'

// ─── Schemas por paso ────────────────────────────────────────────────────────

const vehicleStepSchema = z.object({
  type: z.enum(['CAMPER', 'AUTOCARAVANA'], { error: 'Selecciona el tipo' }),
  brand: z.string().min(1, 'La marca es obligatoria'),
  model: z.string().min(1, 'El modelo es obligatorio'),
  year: z
    .number({ error: 'El año es obligatorio' })
    .int()
    .min(1980, 'Mínimo 1980')
    .max(new Date().getFullYear() + 1, 'Año no válido'),
  km: z.number({ error: 'Los km son obligatorios' }).int().min(0),
  seats: z.number({ error: 'Las plazas son obligatorias' }).int().min(1).max(20),
  conservationState: z.enum(['EXCELENTE', 'BUENO', 'NORMAL', 'DETERIORADO']).default('NORMAL'),
  length: z.number().positive().optional().nullable(),
  location: z.string().optional(),
  desiredPrice: z.number().positive().optional().nullable(),
  equipment: z.object({
    solar: z.boolean().default(false),
    kitchen: z.boolean().default(false),
    bathroom: z.boolean().default(false),
    shower: z.boolean().default(false),
    heating: z.boolean().default(false),
  }),
})

const contactStepSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  email: z.string().email('Email no válido'),
  phone: z.string().min(6, 'Teléfono demasiado corto'),
  gdprConsent: z.boolean().refine((v) => v === true, {
    message: 'Debes aceptar la política de privacidad para continuar',
  }),
})

type VehicleStepValues = z.input<typeof vehicleStepSchema>
type ContactStepValues = z.input<typeof contactStepSchema>

const EQUIPMENT_ITEMS = [
  { id: 'solar' as const, label: 'Placas solares' },
  { id: 'kitchen' as const, label: 'Cocina' },
  { id: 'bathroom' as const, label: 'Baño' },
  { id: 'shower' as const, label: 'Ducha' },
  { id: 'heating' as const, label: 'Calefacción' },
]

const MIN_PHOTOS = 6
const MAX_PHOTOS = 30
const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp']

// ─── Indicador de progreso ────────────────────────────────────────────────────

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'Vehículo' },
    { n: 2, label: 'Fotos' },
    { n: 3, label: 'Contacto' },
  ]
  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                s.n < current
                  ? 'bg-primary text-primary-foreground'
                  : s.n === current
                    ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                    : 'bg-muted text-muted-foreground'
              )}
            >
              {s.n < current ? '✓' : s.n}
            </div>
            <span
              className={cn(
                'mt-1 text-xs',
                s.n === current ? 'font-medium text-foreground' : 'text-muted-foreground'
              )}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={cn(
                'mb-5 h-0.5 w-16 transition-colors sm:w-24',
                s.n < current ? 'bg-primary' : 'bg-muted'
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Componente de fotos ──────────────────────────────────────────────────────

type LocalPhoto = { id: string; file: File; previewUrl: string }

function PhotoPickerStep({
  photos,
  onChange,
}: {
  photos: LocalPhoto[]
  onChange: (photos: LocalPhoto[]) => void
}) {
  const [isOver, setIsOver] = useState(false)
  const [compressing, setCompressing] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null)
      const list = Array.from(files).filter((f) => ACCEPTED_MIME.includes(f.type))
      if (list.length === 0) {
        setError('Solo se admiten JPEG, PNG o WebP.')
        return
      }
      const slotsLeft = MAX_PHOTOS - photos.length - compressing
      const toProcess = list.slice(0, slotsLeft)
      if (toProcess.length < list.length) {
        setError(`Solo se procesarán ${toProcess.length} fotos (límite ${MAX_PHOTOS}).`)
      }

      setCompressing((n) => n + toProcess.length)
      const results = await Promise.all(
        toProcess.map(async (file) => {
          try {
            const compressed = await compressImage(file)
            const previewUrl = URL.createObjectURL(compressed)
            return { id: crypto.randomUUID(), file: compressed, previewUrl }
          } catch {
            return null
          }
        })
      )
      setCompressing((n) => n - toProcess.length)
      const valid = results.filter((r): r is LocalPhoto => r !== null)
      onChange([...photos, ...valid])
    },
    [photos, compressing, onChange]
  )

  const removePhoto = (id: string) => {
    const photo = photos.find((p) => p.id === id)
    if (photo) URL.revokeObjectURL(photo.previewUrl)
    onChange(photos.filter((p) => p.id !== id))
  }

  const atMax = photos.length + compressing >= MAX_PHOTOS
  const belowMin = photos.length < MIN_PHOTOS

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!atMax) setIsOver(true)
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsOver(false)
          if (e.dataTransfer.files.length > 0) void handleFiles(e.dataTransfer.files)
        }}
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
          'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors',
          isOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:bg-muted/40',
          atMax && 'pointer-events-none opacity-50'
        )}
      >
        <Upload className="mb-3 h-10 w-10 text-muted-foreground" aria-hidden />
        <p className="text-base font-medium">
          {atMax ? `Máximo alcanzado (${MAX_PHOTOS})` : 'Arrastra fotos o haz clic aquí'}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          JPEG, PNG o WebP · se comprimen automáticamente · {photos.length}/{MAX_PHOTOS}
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
      {belowMin && photos.length > 0 && !error && (
        <p className="text-sm text-amber-600">
          Recomendamos al menos {MIN_PHOTOS} fotos para una mejor tasación. Tienes {photos.length}.
        </p>
      )}

      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo, i) => (
            <li
              key={photo.id}
              className="group relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted"
            >
              <Image
                src={photo.previewUrl}
                alt={`Foto ${i + 1}`}
                fill
                sizes="25vw"
                className="object-cover"
                unoptimized
              />
              <div className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
                {i + 1}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removePhoto(photo.id)
                }}
                className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Eliminar foto"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
          {Array.from({ length: compressing }).map((_, i) => (
            <li
              key={`c-${i}`}
              className="flex aspect-[4/3] items-center justify-center rounded-lg border bg-muted"
            >
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function VenderEmpezarPage() {
  const posthog = usePostHog()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [photos, setPhotos] = useState<LocalPhoto[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const captchaRef = useRef<HCaptcha>(null)

  useEffect(() => {
    posthog?.capture('form_view', { form: 'vender' })
  }, [posthog])

  // Dev: bypass hCaptcha — widget doesn't fire on localhost
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      setCaptchaToken('dev-bypass')
    }
  }, [])

  const vehicleForm = useForm<VehicleStepValues>({
    resolver: zodResolver(vehicleStepSchema),
    defaultValues: {
      conservationState: 'NORMAL',
      equipment: { solar: false, kitchen: false, bathroom: false, shower: false, heating: false },
      length: null,
      desiredPrice: null,
      location: '',
    },
  })

  const contactForm = useForm<ContactStepValues>({
    resolver: zodResolver(contactStepSchema),
    defaultValues: { name: '', email: '', phone: '', gdprConsent: false },
  })

  const goToStep2 = vehicleForm.handleSubmit(() => {
    posthog?.capture('form_step_completed', { form: 'vender', step: 1 })
    setStep(2)
  })

  const goToStep3 = () => {
    posthog?.capture('form_step_completed', { form: 'vender', step: 2 })
    setStep(3)
  }

  const handleSubmit = contactForm.handleSubmit(async (contact) => {
    setSubmitError(null)
    if (!captchaToken) {
      setSubmitError('Completa el captcha antes de enviar.')
      return
    }
    setSubmitting(true)
    const vehicle = vehicleForm.getValues()
    const fd = new FormData()

    fd.set('name', contact.name)
    fd.set('email', contact.email)
    fd.set('phone', contact.phone)
    fd.set('type', vehicle.type!)
    fd.set('brand', vehicle.brand)
    fd.set('model', vehicle.model)
    fd.set('year', String(vehicle.year))
    fd.set('km', String(vehicle.km))
    fd.set('seats', String(vehicle.seats))
    fd.set('conservationState', vehicle.conservationState ?? 'NORMAL')
    if (vehicle.length != null) fd.set('length', String(vehicle.length))
    if (vehicle.desiredPrice != null) fd.set('desiredPrice', String(vehicle.desiredPrice))
    if (vehicle.location) fd.set('location', vehicle.location)
    fd.set('equipment.solar', String(vehicle.equipment?.solar ?? false))
    fd.set('equipment.kitchen', String(vehicle.equipment?.kitchen ?? false))
    fd.set('equipment.bathroom', String(vehicle.equipment?.bathroom ?? false))
    fd.set('equipment.shower', String(vehicle.equipment?.shower ?? false))
    fd.set('equipment.heating', String(vehicle.equipment?.heating ?? false))

    for (const p of photos) {
      fd.append('photos', p.file)
    }

    fd.set('gdpr-consent', 'true')
    fd.set('h-captcha-response', captchaToken)

    try {
      const result = await submitPublicLead(fd)
      if (result && 'error' in result) {
        setSubmitError(result.error)
        captchaRef.current?.resetCaptcha()
        setCaptchaToken(null)
      }
    } catch (e) {
      if (e instanceof Error && e.message === 'NEXT_REDIRECT') {
        posthog?.capture('form_submitted', { form: 'vender' })
      } else {
        setSubmitError('Error inesperado. Inténtalo de nuevo.')
        captchaRef.current?.resetCaptcha()
        setCaptchaToken(null)
      }
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <span className="text-lg font-bold text-primary">CampersNova</span>
          <span className="text-sm text-muted-foreground">Vende tu camper o autocaravana</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold sm:text-3xl">¿Quieres vender tu vehículo?</h1>
          <p className="mt-2 text-muted-foreground">
            Te gestionamos la venta sin que tengas que moverte. Rellena el formulario y te
            contactamos en menos de 24h.
          </p>
        </div>

        <StepIndicator current={step} />

        <div className="mt-8 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          {step === 1 && (
            <form onSubmit={goToStep2} className="space-y-5">
              <h2 className="text-lg font-semibold">Datos del vehículo</h2>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Tipo *</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['CAMPER', 'AUTOCARAVANA'] as const).map((t) => (
                    <label
                      key={t}
                      className={cn(
                        'flex cursor-pointer items-center justify-center rounded-lg border-2 p-4 text-sm font-medium transition-colors',
                        vehicleForm.watch('type') === t
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-muted hover:border-muted-foreground/50'
                      )}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        value={t}
                        {...vehicleForm.register('type')}
                      />
                      {t === 'CAMPER' ? '🚐 Camper' : '🏕️ Autocaravana'}
                    </label>
                  ))}
                </div>
                {vehicleForm.formState.errors.type && (
                  <p className="mt-1 text-xs text-destructive">
                    {vehicleForm.formState.errors.type.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Marca *</label>
                  <input
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Ej: Hymer, Carado…"
                    {...vehicleForm.register('brand')}
                  />
                  {vehicleForm.formState.errors.brand && (
                    <p className="mt-1 text-xs text-destructive">
                      {vehicleForm.formState.errors.brand.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Modelo *</label>
                  <input
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Ej: Ducato, Grand California…"
                    {...vehicleForm.register('model')}
                  />
                  {vehicleForm.formState.errors.model && (
                    <p className="mt-1 text-xs text-destructive">
                      {vehicleForm.formState.errors.model.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Año *</label>
                  <input
                    type="number"
                    min={1980}
                    max={new Date().getFullYear() + 1}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={String(new Date().getFullYear())}
                    {...vehicleForm.register('year', { valueAsNumber: true })}
                  />
                  {vehicleForm.formState.errors.year && (
                    <p className="mt-1 text-xs text-destructive">
                      {vehicleForm.formState.errors.year.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Kilómetros *</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Ej: 85000"
                    {...vehicleForm.register('km', { valueAsNumber: true })}
                  />
                  {vehicleForm.formState.errors.km && (
                    <p className="mt-1 text-xs text-destructive">
                      {vehicleForm.formState.errors.km.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Plazas *</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Ej: 4"
                    {...vehicleForm.register('seats', { valueAsNumber: true })}
                  />
                  {vehicleForm.formState.errors.seats && (
                    <p className="mt-1 text-xs text-destructive">
                      {vehicleForm.formState.errors.seats.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Estado conservación *</label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    {...vehicleForm.register('conservationState')}
                  >
                    <option value="EXCELENTE">Excelente</option>
                    <option value="BUENO">Bueno</option>
                    <option value="NORMAL">Normal</option>
                    <option value="DETERIORADO">Deteriorado</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Longitud (m) <span className="text-muted-foreground">(opcional)</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Ej: 6.8"
                    onChange={(e) =>
                      vehicleForm.setValue(
                        'length',
                        e.target.value === '' ? null : Number(e.target.value)
                      )
                    }
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Precio que esperas (€) <span className="text-muted-foreground">(opcional)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="500"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Ej: 35000"
                    onChange={(e) =>
                      vehicleForm.setValue(
                        'desiredPrice',
                        e.target.value === '' ? null : Number(e.target.value)
                      )
                    }
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium">
                    ¿Dónde está el vehículo?{' '}
                    <span className="text-muted-foreground">(opcional)</span>
                  </label>
                  <input
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Ej: Barcelona"
                    {...vehicleForm.register('location')}
                  />
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-medium">
                  Equipamiento{' '}
                  <span className="font-normal text-muted-foreground">(marca lo que tenga)</span>
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {EQUIPMENT_ITEMS.map((item) => (
                    <label key={item.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        {...vehicleForm.register(`equipment.${item.id}`)}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Continuar → Fotos
              </button>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Fotos del vehículo</h2>
              <p className="text-sm text-muted-foreground">
                Más fotos = mejor tasación. Recomendamos al menos {MIN_PHOTOS} (exterior, interior,
                motor, detalles). Las fotos se comprimen automáticamente.
              </p>

              <PhotoPickerStep photos={photos} onChange={setPhotos} />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
                >
                  ← Volver
                </button>
                <button
                  type="button"
                  onClick={goToStep3}
                  className="flex-1 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  {photos.length === 0
                    ? 'Continuar sin fotos →'
                    : `Continuar con ${photos.length} foto${photos.length !== 1 ? 's' : ''} →`}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <h2 className="text-lg font-semibold">Tus datos de contacto</h2>
              <p className="text-sm text-muted-foreground">
                Nos pondremos en contacto en menos de 24h con la tasación de tu vehículo.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Nombre completo *</label>
                  <input
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Tu nombre"
                    {...contactForm.register('name')}
                  />
                  {contactForm.formState.errors.name && (
                    <p className="mt-1 text-xs text-destructive">
                      {contactForm.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Email *</label>
                  <input
                    type="email"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="correo@ejemplo.com"
                    {...contactForm.register('email')}
                  />
                  {contactForm.formState.errors.email && (
                    <p className="mt-1 text-xs text-destructive">
                      {contactForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Teléfono *</label>
                  <input
                    type="tel"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="+34 600 000 000"
                    {...contactForm.register('phone')}
                  />
                  {contactForm.formState.errors.phone && (
                    <p className="mt-1 text-xs text-destructive">
                      {contactForm.formState.errors.phone.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border bg-muted/40 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 accent-primary"
                    {...contactForm.register('gdprConsent')}
                  />
                  <span className="text-sm leading-relaxed text-foreground">
                    He leído y acepto la{' '}
                    <a
                      href="/privacidad"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
                    >
                      Política de privacidad
                    </a>{' '}
                    de CampersNova. Mis datos se usarán únicamente para gestionar la tasación y
                    posible venta del vehículo. *
                  </span>
                </label>
                {contactForm.formState.errors.gdprConsent && (
                  <p className="mt-2 text-xs text-destructive">
                    {contactForm.formState.errors.gdprConsent.message}
                  </p>
                )}
              </div>

              {process.env.NODE_ENV === 'production' && (
                <div className="flex justify-center">
                  <HCaptcha
                    ref={captchaRef}
                    sitekey={process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY!}
                    onVerify={(token) => setCaptchaToken(token)}
                    onExpire={() => setCaptchaToken(null)}
                  />
                </div>
              )}

              {submitError && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {submitError}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={submitting}
                  className="rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
                >
                  ← Volver
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? 'Enviando…' : 'Solicitar tasación gratuita'}
                </button>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Tus datos se usan únicamente para gestionar la venta. Sin spam.
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
