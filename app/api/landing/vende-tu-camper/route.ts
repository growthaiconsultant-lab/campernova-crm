import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  landingSellerSchema,
  LandingRateLimitError,
  saveLandingSeller,
} from '@/lib/landing/seller-intake'

export const runtime = 'nodejs'

const MAX_BYTES = 16 * 1024
const json = (body: object, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return json({ ok: false, error: 'origin' }, 403)
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return json({ ok: false, error: 'content_type' }, 415)
  }
  let body: unknown
  try {
    const reader = request.body?.getReader()
    if (!reader) return json({ ok: false, error: 'invalid_data' }, 400)
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BYTES) {
        await reader.cancel()
        return json({ ok: false, error: 'too_large' }, 413)
      }
      chunks.push(value)
    }
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return json({ ok: false, error: 'invalid_data' }, 400)
  }
  const parsed = landingSellerSchema.safeParse(body)
  if (!parsed.success) return json({ ok: false, error: 'invalid_data' }, 400)
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null
  try {
    await saveLandingSeller(db, parsed.data, ip)
    return json({ ok: true })
  } catch (error) {
    if (error instanceof LandingRateLimitError) return json({ ok: false, error: 'rate_limit' }, 429)
    // No request, contact details or database error payload in logs.
    console.error('[landing/seller] persistence failed')
    return json({ ok: false, error: 'unavailable' }, 503)
  }
}
