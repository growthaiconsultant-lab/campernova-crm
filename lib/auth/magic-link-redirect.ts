type MagicLinkEnvironment = {
  NEXT_PUBLIC_APP_URL?: string
  NODE_ENV?: string
  VERCEL_BRANCH_URL?: string
  VERCEL_ENV?: string
}

const LOCAL_APP_URL = 'http://localhost:3000'
const VERCEL_BRANCH_HOST = /^[a-z0-9-]+\.vercel\.app$/i

export class MagicLinkConfigurationError extends Error {
  constructor() {
    super('Magic link callback URL is not configured for this environment')
    this.name = 'MagicLinkConfigurationError'
  }
}

function parseHttpUrl(value: string | undefined): URL | null {
  if (!value) return null

  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
    return url
  } catch {
    return null
  }
}

/**
 * Devuelve un callback server-controlled y separado por entorno.
 * Preview falla de forma cerrada si Vercel no expone el alias estable de la rama.
 */
export function resolveMagicLinkRedirectUrl(
  env: MagicLinkEnvironment = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  }
): string {
  if (env.VERCEL_ENV === 'preview') {
    const branchHost = env.VERCEL_BRANCH_URL?.trim().toLowerCase()
    if (!branchHost || !VERCEL_BRANCH_HOST.test(branchHost)) {
      throw new MagicLinkConfigurationError()
    }

    return new URL('/auth/callback', `https://${branchHost}`).toString()
  }

  const configuredAppUrl = parseHttpUrl(env.NEXT_PUBLIC_APP_URL)
  if (configuredAppUrl) {
    return new URL('/auth/callback', configuredAppUrl.origin).toString()
  }

  if (env.VERCEL_ENV === 'development' || env.NODE_ENV !== 'production') {
    return new URL('/auth/callback', LOCAL_APP_URL).toString()
  }

  throw new MagicLinkConfigurationError()
}
