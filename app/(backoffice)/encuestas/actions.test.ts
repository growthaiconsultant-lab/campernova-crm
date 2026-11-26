import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const deps = vi.hoisted(() => ({
  authorize: vi.fn(),
  buyer: vi.fn(),
  seller: vi.fn(),
  send: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ requireAgente: deps.authorize }))
vi.mock('@/lib/db', () => ({
  db: { buyerLead: { findUnique: deps.buyer }, sellerLead: { findUnique: deps.seller } },
}))
vi.mock('@/lib/email/client', () => ({ getResend: () => ({ emails: { send: deps.send } }) }))

import { sealSurveyInvitation } from '@/lib/surveys/invitation'
import { sendSurveyEmail } from './actions'

const key = 'ff'.repeat(32)
const recipient = 'qa@example.test'
const invitationId = '7ec52929-0068-42ac-bb7f-180a7b0d0e50'

async function payload(kind: 'buyer' | 'seller') {
  return {
    token: await sealSurveyInvitation(
      { kind, leadId: 'lead-for-qa', invitationId, expires: Date.now() + 10000 },
      key
    ),
    recipient,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('SURVEY_CRM_INVITE_KEY', key)
  vi.stubEnv('SURVEY_SITE_URL', 'https://encuesta.example.test')
  vi.stubEnv('EMAIL_FROM', 'CampersNova <qa@example.test>')
  vi.stubEnv('RESEND_API_KEY', 'example-test-key')
  deps.authorize.mockResolvedValue({ role: 'AGENTE' })
  deps.buyer.mockResolvedValue({ email: recipient, archivedAt: null, mergedIntoId: null })
  deps.seller.mockResolvedValue({ email: recipient, archivedAt: null })
  deps.send.mockResolvedValue({ error: null })
})
afterEach(() => vi.unstubAllEnvs())

describe('sendSurveyEmail', () => {
  it.each(['buyer', 'seller'] as const)(
    'looks up a %s contact and reuses the same invitation on retry',
    async (kind) => {
      const input = await payload(kind)
      await expect(sendSurveyEmail(input)).resolves.toMatchObject({ ok: true })
      await expect(sendSurveyEmail(input)).resolves.toMatchObject({ ok: true })
      expect(deps[kind]).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'lead-for-qa' } })
      )
      expect(deps.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: recipient,
          text: expect.stringContaining('#i=' + input.token),
        }),
        { idempotencyKey: 'survey-invitation/' + invitationId }
      )
      expect(deps.send.mock.calls[0]).toEqual(deps.send.mock.calls[1])
    }
  )

  it('rejects a changed recipient, an archived contact, and an unauthorized caller before sending', async () => {
    const input = await payload('buyer')
    await expect(
      sendSurveyEmail({ ...input, recipient: 'wrong@example.test' })
    ).resolves.toMatchObject({ ok: false })
    deps.buyer.mockResolvedValue({ email: recipient, archivedAt: new Date(), mergedIntoId: null })
    await expect(sendSurveyEmail(input)).resolves.toMatchObject({ ok: false })
    deps.authorize.mockRejectedValue(new Error('Forbidden'))
    await expect(sendSurveyEmail(input)).rejects.toThrow('Forbidden')
    expect(deps.send).not.toHaveBeenCalled()
  })
})
