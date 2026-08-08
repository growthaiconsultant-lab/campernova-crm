type MagicLinkEnvironment = {
  NEXT_PUBLIC_APP_URL?: string
  VERCEL_BRANCH_URL?: string
  VERCEL_ENV?: string
}

const LOCAL_APP_URL = 'http://localhost:3000'
const VERCEL_DEPLOYMENT_HOST = /^[a-z0-9-]+\.vercel\.app$/i

function configuredAppUrl(value: string | undefined): URL {
  try {
    return new URL(value || LOCAL_APP_URL)
  } catch {
    return new URL(LOCAL_APP_URL)
  }
}

/**
 * En Preview, el magic link debe volver al alias estable de la misma rama que lo generó.
 * `NEXT_PUBLIC_APP_URL` sigue siendo la URL canónica para producción y desarrollo, mientras que
 * `VERCEL_BRANCH_URL` mantiene el callback en el alias estable y autorizado del Preview.
 */
export function resolveMagicLinkRedirectUrl(
  env: MagicLinkEnvironment = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  }
): string {
  const appUrl = configuredAppUrl(env.NEXT_PUBLIC_APP_URL)
  const vercelHost = env.VERCEL_BRANCH_URL?.trim().toLowerCase()

  const origin =
    env.VERCEL_ENV === 'preview' && vercelHost && VERCEL_DEPLOYMENT_HOST.test(vercelHost)
      ? new URL(`https://${vercelHost}`)
      : appUrl

  return new URL('/auth/callback', origin).toString()
}
