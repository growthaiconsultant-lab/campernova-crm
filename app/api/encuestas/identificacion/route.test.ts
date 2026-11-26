import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const storage = vi.hoisted(() => ({ buyer: vi.fn(), seller: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: { buyerLead: { findUnique: storage.buyer }, sellerLead: { findUnique: storage.seller } },
}))

import { sealSurveyInvitation } from '@/lib/surveys/invitation'
import { POST } from './route'

const invitationKey = 'bc'.repeat(32)
const bearer = 'a0'.repeat(32)

async function call(
  kind: 'buyer' | 'seller',
  method: 'email' | 'telefono',
  contact: string,
  authorized = true
) {
  const invitation = await sealSurveyInvitation(
    {
      kind,
      leadId: 'fixture-crm',
      invitationId: crypto.randomUUID(),
      expires: Date.now() + 10000,
    },
    invitationKey
  )
  return POST(
    new Request('http://127.0.0.1/api/encuestas/identificacion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (authorized ? bearer : 'cc'.repeat(32)),
      },
      body: JSON.stringify({ invitation, method, contact }),
    })
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('SURVEY_CRM_READ_TOKEN', bearer)
  vi.stubEnv('SURVEY_CRM_INVITE_KEY', invitationKey)
})
afterEach(() => vi.unstubAllEnvs())

describe('identificación de respuestas mediante un contacto registrado', () => {
  it('rechaza clientes sin credencial de servidor antes de consultar Prisma', async () => {
    const response = await call('buyer', 'email', 'contacto@example.test', false)
    expect(response.status).toBe(401)
    expect(storage.buyer).not.toHaveBeenCalled()
  })

  it('compara email con la ficha vigente del comprador unificado sin devolver el contacto', async () => {
    storage.buyer.mockResolvedValue({
      id: 'fixture-crm',
      name: 'Anterior',
      email: 'otro@example.test',
      phone: null,
      mergedInto: {
        id: 'canonica',
        name: 'Nombre Apellido',
        email: 'Contacto@Example.Test',
        phone: null,
      },
    })
    expect((await call('buyer', 'email', 'otro@example.test')).status).toBe(422)
    const result = await call('buyer', 'email', ' contacto@example.test ')
    expect(result.status).toBe(200)
    expect(result.headers.get('cache-control')).toBe('no-store')
    expect(await result.json()).toEqual({ leadId: 'canonica', firstName: 'Nombre' })
  })

  it('permite a un vendedor identificarse por teléfono, también con número fijo nacional', async () => {
    storage.seller.mockResolvedValue({
      id: 'fixture-crm',
      name: 'Cliente Prueba',
      email: null,
      phone: '93 555 01 22',
    })
    expect((await call('seller', 'telefono', '+34 93 555 01 22')).status).toBe(200)
    expect((await call('seller', 'telefono', '+34 93 555 01 24')).status).toBe(422)
    expect((await call('seller', 'telefono', '555 01 22')).status).toBe(422)
  })

  it('no confirma una ficha sin nombre, aunque el dato de contacto coincida', async () => {
    storage.seller.mockResolvedValue({
      id: 'fixture-crm',
      name: '  ',
      email: 'contacto@example.test',
      phone: null,
    })
    expect((await call('seller', 'email', 'contacto@example.test')).status).toBe(422)
  })
})
