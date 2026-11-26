import { afterEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({ buyers: vi.fn(), sellers: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: { buyerLead: { findMany: prisma.buyers }, sellerLead: { findMany: prisma.sellers } },
}))

import {
  readSurveyResponses,
  resolveSurveyClients,
  surveyCursor,
  type SurveyResponse,
} from './responses'

const response: SurveyResponse = {
  id: '7ec52929-0068-42ac-bb7f-180a7b0d0e50',
  submittedAt: '2026-11-26T12:00:00.000Z',
  experience: 'compra',
  satisfaction: 5,
  service: 4,
  reason: null,
  otherReason: null,
  comment: null,
  contactName: null,
  contactEmail: null,
  contactPhone: null,
  crmKind: 'buyer',
  crmLeadId: 'previous-buyer',
  ratings: [{ label: 'Entrega', value: 'no_aplica' }],
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('survey responses', () => {
  it('validates pagination and queries the configured survey only from the server', async () => {
    const cursor = surveyCursor(response.submittedAt + '|' + response.id)
    const readToken = 'fa'.repeat(32)
    vi.stubEnv('SURVEY_CRM_READ_TOKEN', readToken)
    vi.stubEnv('SURVEY_SITE_URL', 'http://127.0.0.1:4788/')
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ rows: [response], nextCursor: null }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(readSurveyResponses({ experience: 'sin_venta', cursor })).resolves.toEqual({
      rows: [response],
      nextCursor: null,
    })
    const [url, request] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('http://127.0.0.1:4788/api/crm/respuestas')
    expect(request).toMatchObject({
      method: 'POST',
      cache: 'no-store',
      redirect: 'error',
      headers: { Authorization: 'Bearer ' + readToken },
    })
    expect(JSON.parse(request.body)).toEqual({ experience: 'sin_venta', cursor })
    expect(surveyCursor('bad cursor')).toBeUndefined()
  })

  it('fails closed without a read token', async () => {
    vi.stubEnv('SURVEY_CRM_READ_TOKEN', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(readSurveyResponses({})).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('links a merged buyer to the current CRM record and leaves general responses unassigned', async () => {
    prisma.buyers.mockResolvedValue([
      {
        id: 'previous-buyer',
        name: 'Anterior',
        mergedInto: { id: 'current-buyer', name: 'Actual' },
      },
    ])
    const clients = await resolveSurveyClients([
      response,
      { ...response, crmKind: null, crmLeadId: null },
    ])
    expect(clients.get('buyer:previous-buyer')).toEqual({
      name: 'Actual',
      href: '/compradores/current-buyer?tab=encuestas',
    })
    expect(clients.size).toBe(1)
    expect(prisma.sellers).not.toHaveBeenCalled()
  })
})
