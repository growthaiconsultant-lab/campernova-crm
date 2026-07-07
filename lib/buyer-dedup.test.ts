import { describe, expect, it } from 'vitest'
import { findDuplicateBuyerByPhone } from './buyer-dedup'

const rows = [
  { id: 'b1', name: 'Ana', phone: '600 11 22 33', status: 'CONTACTADO' },
  { id: 'b2', name: 'Luis', phone: '+34 711 222 333', status: 'NUEVO' },
]
const deps = { listBuyersWithPhone: async () => rows }

describe('findDuplicateBuyerByPhone', () => {
  it('detecta duplicado con formato distinto', async () => {
    const hit = await findDuplicateBuyerByPhone('0034600112233', deps)
    expect(hit?.id).toBe('b1')
    expect(hit?.name).toBe('Ana')
  })

  it('devuelve null si no hay coincidencia', async () => {
    const hit = await findDuplicateBuyerByPhone('699999999', deps)
    expect(hit).toBeNull()
  })

  it('devuelve null con teléfono vacío', async () => {
    const hit = await findDuplicateBuyerByPhone('', deps)
    expect(hit).toBeNull()
  })
})
