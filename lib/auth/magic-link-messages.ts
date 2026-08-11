type AuthErrorLike = {
  code?: unknown
  status?: unknown
}

export const GENERIC_MAGIC_LINK_ERROR = 'No se pudo enviar el enlace. Inténtalo de nuevo.'

export const RATE_LIMIT_MAGIC_LINK_ERROR =
  'Se ha alcanzado temporalmente el límite de correos. Espera antes de solicitar otro enlace y usa siempre el más reciente.'

export function magicLinkErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return GENERIC_MAGIC_LINK_ERROR

  const { code, status } = error as AuthErrorLike
  if (code === 'over_email_send_rate_limit' || status === 429) {
    return RATE_LIMIT_MAGIC_LINK_ERROR
  }

  return GENERIC_MAGIC_LINK_ERROR
}
