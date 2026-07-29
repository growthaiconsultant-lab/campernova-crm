/**
 * CAP-1 — Fallbacks de PRESENTACIÓN. Se computan en render, NUNCA se persisten.
 *
 * Con la captación progresiva, los campos de negocio (marca/modelo/año de un vehículo,
 * nombre de una persona) pueden faltar y viven como `null` en la base de datos. Estas
 * funciones producen una etiqueta legible cuando el dato no está, sin inventar valores
 * ni escribir placeholders. Nunca devuelven cadenas vacías, `undefined` ni `null`.
 */

/** Sufijo corto y estable de un id (últimos 4-6 chars) para distinguir registros sin nombre. */
export function shortIdSuffix(id: string | null | undefined, len = 4): string {
  if (!id) return ''
  return id.slice(-len)
}

/**
 * Etiqueta de un vehículo a partir de marca/modelo (y opcionalmente año).
 * Si no hay marca ni modelo → "Vehículo sin identificar" (+ sufijo de id si se aporta).
 */
export function vehicleLabel(
  v: { brand?: string | null; model?: string | null; year?: number | null; id?: string | null },
  opts: { withId?: boolean } = {}
): string {
  const base = [v.brand, v.model].filter(Boolean).join(' ').trim()
  if (base) {
    return v.year ? `${base} (${v.year})` : base
  }
  const suffix = opts.withId ? shortIdSuffix(v.id) : ''
  return suffix ? `Vehículo sin identificar · ${suffix}` : 'Vehículo sin identificar'
}

/**
 * Nombre de una persona (comprador/vendedor). Si falta → "Vendedor sin identificar"
 * (o el rol indicado), con sufijo de id opcional para distinguir registros.
 */
export function personLabel(
  name: string | null | undefined,
  opts: { role?: string; id?: string | null } = {}
): string {
  const t = name?.trim()
  if (t) return t
  const role = opts.role ?? 'Sin identificar'
  const suffix = opts.id ? shortIdSuffix(opts.id) : ''
  return suffix ? `${role} · ${suffix}` : role
}

/**
 * Inicial para avatares a partir de un texto que puede ser null.
 * Devuelve un carácter en mayúscula o '?' si no hay dato.
 */
export function initialOf(text: string | null | undefined): string {
  return (text ?? '').trim().charAt(0).toUpperCase() || '?'
}
