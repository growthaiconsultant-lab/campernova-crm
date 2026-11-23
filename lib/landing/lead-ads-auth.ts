import { createHash, timingSafeEqual } from 'node:crypto'

function authenticateLeadAds(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !authorization?.startsWith('Bearer ')) return false
  const supplied = authorization.slice(7)
  if (!supplied || supplied.length > 256) return false
  const digest = (value: string) => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(secret), digest(supplied))
}

export function authenticateBuyerLeadAds(authorization: string | null): boolean {
  return authenticateLeadAds(authorization, process.env.META_BUYER_INTAKE_KEY)
}

export function authenticateSellerLeadAds(authorization: string | null): boolean {
  return authenticateLeadAds(authorization, process.env.META_SELLER_INTAKE_KEY)
}
