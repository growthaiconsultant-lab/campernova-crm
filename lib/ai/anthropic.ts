import { createAnthropic } from '@ai-sdk/anthropic'

/**
 * Normaliza la base URL de Anthropic para el AI SDK de Vercel.
 *
 * El AI SDK construye la petición como `${baseURL}/messages`, por lo que `baseURL` DEBE
 * incluir el segmento de versión (`/v1`). Algunos entornos exportan
 * `ANTHROPIC_BASE_URL=https://api.anthropic.com` (sin `/v1`) — válido para el SDK oficial
 * `@anthropic-ai/sdk`, que añade `/v1/messages` por su cuenta, pero NO para el AI SDK: este
 * acabaría llamando a `https://api.anthropic.com/messages` → 404, el stream se cierra vacío y
 * el chat se queda "pensando" para siempre. Solo se reproduce en local (en Vercel la variable
 * no existe y el SDK usa su default con `/v1`).
 *
 * Garantizamos que `/v1` (o cualquier `/vN`) esté presente. Si la variable no está definida,
 * devolvemos `undefined` y el SDK usa su default (`https://api.anthropic.com/v1`).
 */
export function resolveAnthropicBaseURL(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim()
  if (!trimmed) return undefined
  const noTrailing = trimmed.replace(/\/+$/, '')
  return /\/v\d+$/.test(noTrailing) ? noTrailing : `${noTrailing}/v1`
}

/** Provider Anthropic para el AI SDK con la base URL ya normalizada (ver arriba). */
export const anthropic = createAnthropic({
  baseURL: resolveAnthropicBaseURL(process.env.ANTHROPIC_BASE_URL),
})
