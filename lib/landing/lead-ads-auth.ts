import { createHash, timingSafeEqual } from 'node:crypto'

/** Server-to-server credential scoped to the buyer endpoint. Never accept a missing key. */
export function authenticateBuyerLeadAds(authorization: string | null): boolean {
  const secret = process.env.META_BUYER_INTAKE_KEY
  if (!secret || secret.length < 32 || !authorization?.startsWith('Bearer ')) return false
  const supplied = authorization.slice(7)
  if (!supplied || supplied.length > 256) return false
  const digest = (value: string) => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(secret), digest(supplied))
}
