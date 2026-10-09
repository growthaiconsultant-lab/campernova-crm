import { describe, expect, it } from 'vitest'
import { landingBuyerSchema, landingBuyerId } from './buyer-intake'
import { landingBuyerPayload } from '@/tests/fixtures/landing-buyer'
import { createBuyerLeadSchema, updateBuyerLeadSchema } from '@/lib/validators/buyer-lead'

describe('buyer campaign contract', () => {
  it('accepts the original form without email and normalizes NBSP in sleeping ranges', () => {
    expect(landingBuyerSchema.parse(landingBuyerPayload()).respuestas.plazas).toBe('1 o 2')
  })
  it.each(['tipo', 'plazas', 'presupuesto', 'cuando'])('rejects an unknown %s', (key) => {
    const p = landingBuyerPayload()
    expect(
      landingBuyerSchema.safeParse({ ...p, respuestas: { ...p.respuestas, [key]: 'inventado' } })
        .success
    ).toBe(false)
  })
  it('rejects honeypot, missing consent, wrong campaign and mismatched identity', () => {
    const p = landingBuyerPayload()
    for (const input of [
      { ...p, web_url: 'spam' },
      { ...p, gdpr_consent: false },
      { ...p, nombre: 'Otro' },
      { ...p, respuestas: { ...p.respuestas, pagina: '/vende-tu-camper.html' } },
      { ...p, respuestas: { ...p.respuestas, detalle: 'x'.repeat(2001) } },
    ])
      expect(landingBuyerSchema.safeParse(input).success).toBe(false)
  })
  it('binds idempotence to the full request, independent of IP', () => {
    const p = landingBuyerSchema.parse(landingBuyerPayload())
    expect(landingBuyerId(p)).toBe(landingBuyerId(p))
    expect(
      landingBuyerId({ ...p, respuestas: { ...p.respuestas, detalle: 'Otra búsqueda' } })
    ).not.toBe(landingBuyerId(p))
  })
  it('backoffice accepts missing/empty email as null and still rejects invalid emails', () => {
    for (const email of [null, '', undefined]) {
      expect(
        createBuyerLeadSchema.parse({ name: 'Prueba', phone: '600000000', email }).email
      ).toBeNull()
      expect(
        updateBuyerLeadSchema.parse({
          name: 'Prueba',
          phone: '600000000',
          email,
          status: 'NUEVO',
          agentId: null,
        }).email
      ).toBeNull()
    }
    expect(
      createBuyerLeadSchema.safeParse({ name: 'Prueba', phone: '600000000', email: 'incorrecto' })
        .success
    ).toBe(false)
  })
})
