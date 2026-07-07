/**
 * Normalización de teléfonos (CAM-66 dedup + WhatsApp).
 * Devuelve solo dígitos en forma canónica: móviles españoles con prefijo 34,
 * y quita el doble cero internacional.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  // 9 dígitos españoles (móvil 6xx/7xx) → añadir prefijo 34
  if (digits.length === 9 && /^[67]/.test(digits)) {
    return `34${digits}`
  }
  // 0034xxx → quitar doble cero internacional
  if (digits.startsWith('00')) return digits.slice(2)
  return digits
}

/** Compara dos teléfonos por su forma normalizada. Vacío nunca coincide. */
export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const na = normalizePhone(a)
  const nb = normalizePhone(b)
  return na.length > 0 && na === nb
}
