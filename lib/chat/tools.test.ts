import { describe, it, expect } from 'vitest'
import { registerBuyerLeadSchema } from './tools'

const base = {
  nombre: 'Ana López',
  email: 'ana@example.com',
  telefono: '600111222',
  necesidad: 'Familia de 4 para escapadas de fin de semana',
}

describe('registerBuyerLeadSchema — contrato de creación de lead', () => {
  it('acepta los campos mínimos obligatorios', () => {
    expect(registerBuyerLeadSchema.safeParse(base).success).toBe(true)
  })

  it('acepta un objeto completo con opcionales (incl. taxonomía RV)', () => {
    const full = {
      ...base,
      tipo: 'AUTOCARAVANA',
      plazas: 4,
      presupuestoMin: 20000,
      presupuestoMax: 45000,
      zona: 'Cataluña',
      plazos: '1_3_meses',
      equipamiento: { shower: true, solar: true },
      categoria: 'PERFILADA',
      tipoCama: 'ISLA',
      plazasDormir: 2,
      banoObligatorio: true,
      carnet: 'B',
      usoInvierno: true,
      garajeDeporte: false,
      viajaConNinos: false,
      largoMaxM: 6.5,
      altoMaxM: 2.9,
    }
    const parsed = registerBuyerLeadSchema.safeParse(full)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.categoria).toBe('PERFILADA')
      expect(parsed.data.carnet).toBe('B')
      expect(parsed.data.altoMaxM).toBe(2.9)
    }
  })

  it('rechaza una categoría RV fuera del enum', () => {
    expect(registerBuyerLeadSchema.safeParse({ ...base, categoria: 'FURGO_RARA' }).success).toBe(
      false
    )
  })

  it('rechaza un carnet fuera del enum (B/C1)', () => {
    expect(registerBuyerLeadSchema.safeParse({ ...base, carnet: 'A2' }).success).toBe(false)
  })

  it('rechaza email inválido', () => {
    expect(registerBuyerLeadSchema.safeParse({ ...base, email: 'no-es-email' }).success).toBe(false)
  })

  it('rechaza nombre demasiado corto', () => {
    expect(registerBuyerLeadSchema.safeParse({ ...base, nombre: 'A' }).success).toBe(false)
  })

  it('rechaza teléfono demasiado corto', () => {
    expect(registerBuyerLeadSchema.safeParse({ ...base, telefono: '123' }).success).toBe(false)
  })

  it('rechaza tipo fuera del enum', () => {
    expect(registerBuyerLeadSchema.safeParse({ ...base, tipo: 'COCHE' }).success).toBe(false)
  })

  it('rechaza plazos fuera del enum', () => {
    expect(registerBuyerLeadSchema.safeParse({ ...base, plazos: 'mañana' }).success).toBe(false)
  })

  it('rechaza un número de plazas fuera de rango (2–9)', () => {
    expect(registerBuyerLeadSchema.safeParse({ ...base, plazas: 20 }).success).toBe(false)
    expect(registerBuyerLeadSchema.safeParse({ ...base, plazas: 1 }).success).toBe(false)
  })
})
