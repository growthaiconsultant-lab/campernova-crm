'use server'

import { randomUUID } from 'node:crypto'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { createSellerLeadSchema } from '@/lib/validators/seller-lead'
import {
  VEHICLE_PHOTOS_BUCKET,
  vehiclePhotoPath,
  vehiclePhotoPublicUrl,
} from '@/lib/supabase/storage'
import { sendSellerLeadConfirmation, sendAgentLeadNotification } from '@/lib/email/send'
import { runAndSaveAutoValuation } from '@/lib/valuation/save'
import { recalculateMatchesForVehicle } from '@/lib/matching'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 2 * 1024 * 1024

const HCAPTCHA_SECRET =
  process.env.NODE_ENV === 'production'
    ? (process.env.HCAPTCHA_SECRET_KEY ?? '')
    : '0x0000000000000000000000000000000000000000' // test secret (pairs with test sitekey)

async function verifyHCaptcha(token: string): Promise<boolean> {
  const res = await fetch('https://api.hcaptcha.com/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: HCAPTCHA_SECRET, response: token }),
  })
  const data = (await res.json()) as { success: boolean }
  return data.success === true
}

export async function submitPublicLead(formData: FormData) {
  // Verify GDPR consent server-side (defence in depth — client also validates)
  if (formData.get('gdpr-consent') !== 'true') {
    return { error: 'Debes aceptar la política de privacidad para continuar.' }
  }

  // Capture IP for consent audit trail
  const reqHeaders = await headers()
  const consentIp =
    reqHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ?? reqHeaders.get('x-real-ip') ?? null
  const consentAt = new Date()

  // Verify captcha first
  const captchaToken = formData.get('h-captcha-response')
  if (typeof captchaToken !== 'string' || !captchaToken) {
    return { error: 'Completa el captcha antes de enviar.' }
  }
  const captchaOk = process.env.NODE_ENV !== 'production' || (await verifyHCaptcha(captchaToken))
  if (!captchaOk) {
    return { error: 'Verificación captcha fallida. Inténtalo de nuevo.' }
  }

  // Parse scalar fields
  const raw = {
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    type: formData.get('type'),
    brand: formData.get('brand'),
    model: formData.get('model'),
    year: Number(formData.get('year')),
    km: Number(formData.get('km')),
    seats: Number(formData.get('seats')),
    length: formData.get('length') ? Number(formData.get('length')) : null,
    conservationState: formData.get('conservationState'),
    location: formData.get('location') ?? '',
    desiredPrice: formData.get('desiredPrice') ? Number(formData.get('desiredPrice')) : null,
    equipment: {
      solar: formData.get('equipment.solar') === 'true',
      kitchen: formData.get('equipment.kitchen') === 'true',
      bathroom: formData.get('equipment.bathroom') === 'true',
      shower: formData.get('equipment.shower') === 'true',
      heating: formData.get('equipment.heating') === 'true',
    },
  }

  const parsed = createSellerLeadSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: 'Datos del formulario inválidos. Revisa los campos.' }
  }

  const photos = formData.getAll('photos') as File[]
  for (const file of photos) {
    if (!ALLOWED_MIME.includes(file.type)) {
      return { error: `Formato de imagen no permitido: ${file.name}` }
    }
    if (file.size > MAX_FILE_SIZE) {
      return { error: `La imagen ${file.name} supera 2 MB.` }
    }
  }

  const {
    name,
    email,
    phone,
    type,
    brand,
    model,
    year,
    km,
    seats,
    length,
    conservationState,
    location,
    desiredPrice,
    equipment,
  } = parsed.data

  // Create lead + vehicle in a single transaction
  const lead = await db.sellerLead.create({
    data: {
      name,
      email,
      phone,
      canal: 'PRO',
      status: 'NUEVO',
      agentId: null,
      gdprConsentAt: consentAt,
      gdprConsentIp: consentIp,
      vehicle: {
        create: {
          type,
          brand,
          model,
          year,
          km,
          seats,
          length: length ?? null,
          conservationState,
          location: location ?? null,
          desiredPrice: desiredPrice ?? null,
          equipment,
          status: 'NUEVO',
        },
      },
    },
    include: { vehicle: true },
  })

  const vehicleId = lead.vehicle!.id

  // Auto-tasación — resultado usado en página de éxito y email
  const valuation = await runAndSaveAutoValuation(vehicleId, {
    brand,
    model,
    type,
    year,
    km,
    conservationState,
    equipment,
  })

  // Recalcula matches con el precio recién tasado
  await recalculateMatchesForVehicle(vehicleId, db)

  // Upload photos to Storage
  if (photos.length > 0) {
    const supabase = createClient()
    await Promise.all(
      photos.map(async (file, index) => {
        const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
        const path = vehiclePhotoPath(vehicleId, `${randomUUID()}.${ext}`)
        const { error } = await supabase.storage
          .from(VEHICLE_PHOTOS_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false })
        if (!error) {
          await db.vehiclePhoto.create({
            data: { vehicleId, url: vehiclePhotoPublicUrl(path), order: index },
          })
        }
      })
    )
  }

  // Send confirmation email to seller — non-blocking, incluye tasación si está disponible
  const valuationForEmail =
    valuation && valuation.method !== 'NONE'
      ? { min: valuation.min, recommended: valuation.recommended, max: valuation.max }
      : null

  await sendSellerLeadConfirmation({
    to: email,
    sellerName: name,
    brand,
    model,
    year,
    km,
    valuation: valuationForEmail,
  })

  // Notify all active agents — non-blocking
  const activeUsers = await db.user.findMany({
    where: { active: true },
    select: { email: true },
  })
  await sendAgentLeadNotification({
    agentEmails: activeUsers.map((u) => u.email),
    leadId: lead.id,
    sellerName: name,
    sellerEmail: email,
    sellerPhone: phone,
    canal: 'PRO',
    brand,
    model,
    year,
    km,
    vehicleType: type,
    location: location ?? null,
    desiredPrice: desiredPrice != null ? String(desiredPrice) : null,
    conservationState,
  })

  const successUrl = new URL(
    '/vender/success',
    process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  )
  successUrl.searchParams.set('brand', brand)
  successUrl.searchParams.set('model', model)
  if (valuation && valuation.method !== 'NONE') {
    successUrl.searchParams.set('min', String(valuation.min))
    successUrl.searchParams.set('rec', String(valuation.recommended))
    successUrl.searchParams.set('max', String(valuation.max))
  }

  redirect(successUrl.pathname + successUrl.search)
}
