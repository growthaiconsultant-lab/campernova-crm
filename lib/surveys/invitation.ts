// ENC-1 wire format. Keep this module in sync between the CRM and survey.
export type SurveyLeadKind = 'buyer' | 'seller'
export type SurveyInvitation = {
  kind: SurveyLeadKind
  leadId: string
  invitationId: string
  expires: number
}

const encoder = new TextEncoder()
const version = encoder.encode('campersnova:survey:v1')
const idPattern = /^[A-Za-z0-9_-]{1,80}$/
const invitationPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const invitationLifetimeMs = 90 * 24 * 60 * 60 * 1000

export function isSurveyLeadId(value: unknown): value is string {
  return typeof value === 'string' && idPattern.test(value)
}

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...Array.from(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (character) =>
    character.charCodeAt(0)
  )
}

async function invitationKey(secret: string): Promise<CryptoKey> {
  const pairs = secret.match(/.{2}/g) ?? []
  return crypto.subtle.importKey(
    'raw',
    Uint8Array.from(pairs, (pair) => Number.parseInt(pair, 16)),
    'AES-GCM',
    false,
    ['encrypt', 'decrypt']
  )
}

export function validSurveySecret(secret: unknown): secret is string {
  return typeof secret === 'string' && /^[0-9a-f]{64}$/i.test(secret)
}

export async function sealSurveyInvitation(
  claim: SurveyInvitation,
  secret: string
): Promise<string> {
  if (!validSurveySecret(secret)) throw new Error('Invalid survey invitation key')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: version },
      await invitationKey(secret),
      encoder.encode(JSON.stringify(claim))
    )
  )
  const envelope = new Uint8Array(iv.length + ciphertext.length)
  envelope.set(iv)
  envelope.set(ciphertext, iv.length)
  return toBase64Url(envelope)
}

export async function openSurveyInvitation(
  token: string,
  secret: string | undefined,
  now = Date.now()
): Promise<SurveyInvitation | null> {
  if (!validSurveySecret(secret) || !/^[A-Za-z0-9_-]{43,450}$/.test(token)) return null

  try {
    const envelope = fromBase64Url(token)
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: envelope.slice(0, 12), additionalData: version },
      await invitationKey(secret),
      envelope.slice(12)
    )
    const claim: Partial<SurveyInvitation> = JSON.parse(new TextDecoder().decode(plaintext))
    if (
      (claim.kind !== 'buyer' && claim.kind !== 'seller') ||
      !isSurveyLeadId(claim.leadId) ||
      typeof claim.invitationId !== 'string' ||
      !invitationPattern.test(claim.invitationId) ||
      typeof claim.expires !== 'number' ||
      !Number.isSafeInteger(claim.expires) ||
      claim.expires <= now
    ) {
      return null
    }
    return {
      kind: claim.kind,
      leadId: claim.leadId,
      invitationId: claim.invitationId,
      expires: claim.expires,
    }
  } catch {
    return null
  }
}
