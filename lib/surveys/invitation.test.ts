import { describe, expect, it } from 'vitest'
import { openSurveyInvitation, sealSurveyInvitation, type SurveyInvitation } from './invitation'

const key = '1a'.repeat(32)
const claim: SurveyInvitation = {
  kind: 'seller',
  leadId: 'lead-example_1',
  invitationId: '7ec52929-0068-42ac-bb7f-180a7b0d0e50',
  expires: 1234567890000,
}

describe('survey invitation', () => {
  it('seals the CRM reference, produces different URLs, and restores the claim in the receiver', async () => {
    const token = await sealSurveyInvitation(claim, key)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(token).not.toContain(claim.leadId)
    expect(await sealSurveyInvitation(claim, key)).not.toEqual(token)
    expect(await openSurveyInvitation(token, key, claim.expires - 1)).toEqual(claim)
  })

  it('rejects tampering, wrong keys and expiry', async () => {
    const token = await sealSurveyInvitation(claim, key)
    const altered = (token.startsWith('a') ? 'b' : 'a') + token.slice(1)
    await expect(openSurveyInvitation(altered, key, claim.expires - 1)).resolves.toBeNull()
    await expect(
      openSurveyInvitation(token, 'b2'.repeat(32), claim.expires - 1)
    ).resolves.toBeNull()
    await expect(openSurveyInvitation(token, key, claim.expires)).resolves.toBeNull()
  })
})
