type MagicLinkEnvironment = {
  NEXT_PUBLIC_APP_URL?: string
  VERCEL_ENV?: string
  VERCEL_URL?: string
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
 * En Preview, cada despliegue necesita devolver el magic link al mismo origen que lo generó.
 * `NEXT_PUBLIC_APP_URL` sigue siendo la URL canónica para producción y desarrollo, mientras que
 * `VERCEL_URL` evita que un Preview herede por error `localhost` u otro dominio canónico.
 */
export function resolveMagicLinkRedirectUrl(
  env: MagicLinkEnvironment = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
  }
): string {
  const appUrl = configuredAppUrl(env.NEXT_PUBLIC_APP_URL)
  const vercelHost = env.VERCEL_URL?.trim().toLowerCase()

  const origin =
    env.VERCEL_ENV === 'preview' && vercelHost && VERCEL_DEPLOYMENT_HOST.test(vercelHost)
      ? new URL(`https://${vercelHost}`)
      : appUrl

  return new URL('/auth/callback', origin).toString()
}
