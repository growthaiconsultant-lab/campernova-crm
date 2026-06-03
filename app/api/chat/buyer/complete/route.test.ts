import { describe, it, expect } from 'vitest'
import { POST } from './route'

describe('POST /api/chat/buyer/complete (deprecado)', () => {
  it('devuelve 410 Gone con error "deprecated"', async () => {
    const res = await POST()
    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.error).toBe('deprecated')
  })
})
