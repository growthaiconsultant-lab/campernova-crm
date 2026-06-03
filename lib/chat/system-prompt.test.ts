import { describe, it, expect } from 'vitest'
import { BUYER_GREETING, BUYER_SYSTEM_PROMPT } from './system-prompt'

describe('system prompt del chat comprador', () => {
  it('el saludo no está vacío y menciona a CampersNova', () => {
    expect(BUYER_GREETING.length).toBeGreaterThan(20)
    expect(BUYER_GREETING).toContain('CampersNova')
  })

  it('instruye al modelo a invocar register_buyer_lead', () => {
    expect(BUYER_SYSTEM_PROMPT).toContain('register_buyer_lead')
  })

  it('incluye el marcador [INTENT_VENTA] y la redirección a /vender', () => {
    expect(BUYER_SYSTEM_PROMPT).toContain('[INTENT_VENTA]')
    expect(BUYER_SYSTEM_PROMPT).toContain('/vender')
  })

  it('prohíbe inventar precios, modelos o disponibilidad', () => {
    expect(BUYER_SYSTEM_PROMPT.toLowerCase()).toContain('no inventes')
  })
})
