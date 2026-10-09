import { describe, expect, it } from 'vitest'
import { landingSellerSchema, landingLeadId } from './seller-intake'
import { landingPayload } from '@/tests/fixtures/landing-seller'

describe('landing seller input', () => {
  it('normalizes km and keeps the whole make/model without guessing', () => {
    const data = landingSellerSchema.parse(landingPayload())
    expect(data.respuestas.km).toBe(85000)
    expect(data.respuestas.modelo).toBe('Volkswagen California Ocean')
    expect(data.respuestas.anio).toBe(2019)
  })
  it.each(['-1', '85abc', '85.5', '2000001'])('rejects invalid mileage %s', (km) => {
    const data = landingPayload()
    data.respuestas.km = km
    expect(landingSellerSchema.safeParse(data).success).toBe(false)
  })
  it.each(['1979', '9999', '2019.5'])('rejects invalid year %s', (year) => {
    const data = landingPayload()
    data.respuestas.anio = year
    expect(landingSellerSchema.safeParse(data).success).toBe(false)
  })
  it('binds retries to the complete payload and event key', () => {
    const first = landingSellerSchema.parse(landingPayload())
    expect(landingLeadId(first)).toBe(landingLeadId(landingSellerSchema.parse(landingPayload())))
    expect(landingLeadId(first)).not.toBe(
      landingLeadId(landingSellerSchema.parse(landingPayload('other-event')))
    )
    const changed = landingPayload()
    changed.respuestas.modelo = 'Different vehicle'
    expect(landingLeadId(first)).not.toBe(landingLeadId(landingSellerSchema.parse(changed)))
  })
  it('rejects missing consent, honeypot and mismatched contacts', () => {
    expect(
      landingSellerSchema.safeParse({ ...landingPayload(), gdpr_consent: false }).success
    ).toBe(false)
    expect(landingSellerSchema.safeParse({ ...landingPayload(), web_url: 'bot' }).success).toBe(
      false
    )
    expect(
      landingSellerSchema.safeParse({ ...landingPayload(), contacto: '611111111' }).success
    ).toBe(false)
  })
})
