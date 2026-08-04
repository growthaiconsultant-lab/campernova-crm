import { timingSafeEqual } from 'node:crypto'

/**
 * Valida la cabecera que Vercel Cron construye a partir de `CRON_SECRET`.
 * Falla cerrado en cualquier entorno: Preview y desarrollo también pueden
 * ejecutar efectos reales si comparten credenciales de servicios externos.
 */
export function isCronRequestAuthorized(
  request: Request,
  secret = process.env.CRON_SECRET
): boolean {
  if (!secret) return false

  const actual = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)

  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  )
}
