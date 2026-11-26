import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), read: vi.fn(), buyerAliases: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAgente: mocks.authorize }))
vi.mock('@/lib/db', () => ({ db: { buyerLead: { findMany: mocks.buyerAliases } } }))
vi.mock('@/lib/surveys/responses', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/surveys/responses')>()),
  readSurveyResponses: mocks.read,
}))
vi.mock('@/components/surveys/email-invitation', () => ({
  EmailInvitation: () => 'Preparar email',
}))

import { LeadSurveys } from '@/components/surveys/lead-surveys'
import EncuestasPage from './page'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.authorize.mockResolvedValue({ role: 'ADMIN' })
  mocks.read.mockResolvedValue({ rows: [], nextCursor: null })
  mocks.buyerAliases.mockResolvedValue([{ id: 'old-profile' }])
})

describe('CRM survey pages', () => {
  it('renders the three experience filters and checks the staff role before reading', async () => {
    const html = renderToStaticMarkup(await EncuestasPage({ searchParams: { tipo: 'sin_venta' } }))
    expect(html).toContain('/encuestas?tipo=compra')
    expect(html).toContain('/encuestas?tipo=venta')
    expect(html).toContain('Venta no cerrada')
    expect(mocks.read).toHaveBeenCalledWith({ experience: 'sin_venta', cursor: undefined })

    mocks.authorize.mockRejectedValueOnce(new Error('Forbidden'))
    await expect(EncuestasPage({ searchParams: {} })).rejects.toThrow('Forbidden')
    expect(mocks.read).toHaveBeenCalledTimes(1)
  })

  it('prepares WhatsApp and email for the correct profile and keeps old buyer references visible', async () => {
    vi.stubEnv('SURVEY_CRM_INVITE_KEY', '12'.repeat(32))
    try {
      const lead = {
        id: 'active-profile',
        name: 'Perfil QA',
        archivedAt: null,
        email: 'qa@example.test',
        phone: '600000000',
      }
      const html = renderToStaticMarkup(await LeadSurveys({ kind: 'buyer', lead }))
      expect(html).toContain('Preparar email')
      expect(html).toContain('https://wa.me/34600000000?text=')
      expect(html).toContain('encuesta.campersnova.com%2F%23i%3D')
      expect(mocks.read).toHaveBeenCalledWith({
        kind: 'buyer',
        leadIds: ['active-profile', 'old-profile'],
        cursor: undefined,
      })
      const archived = renderToStaticMarkup(
        await LeadSurveys({ kind: 'seller', lead: { ...lead, archivedAt: new Date() } })
      )
      expect(archived).toContain('Ficha archivada')
      expect(archived).not.toContain('Preparar WhatsApp')
      expect(archived).not.toContain('Preparar email')
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
