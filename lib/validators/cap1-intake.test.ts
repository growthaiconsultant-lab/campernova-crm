import { describe, it, expect } from 'vitest'
import {
  createSellerLeadSchema,
  createSellerLeadPublicSchema,
  updateSellerLeadSchema,
  updateVehicleSchema,
} from './seller-lead'
import { createBuyerLeadSchema, updateBuyerLeadSchema } from './buyer-lead'
import { optionalText, optionalEmail, optionalInt } from './optional'

// CAP-1 — captación progresiva: ningún campo de negocio obligatorio al crear/editar; vacío → null;
// si se informa un valor, debe tener formato/dominio válidos. El formulario PÚBLICO no se relaja.

describe('CAP-1 · helpers de opcionalidad', () => {
  it('optionalText: vacío/espacios → null; recorta; tope de longitud', () => {
    expect(optionalText().parse('')).toBeNull()
    expect(optionalText().parse('   ')).toBeNull()
    expect(optionalText().parse(undefined)).toBeNull()
    expect(optionalText().parse(null)).toBeNull()
    expect(optionalText().parse('  Ana  ')).toBe('Ana')
    expect(optionalText(3).safeParse('abcd').success).toBe(false)
  })
  it('optionalEmail: vacío → null; formato validado solo si se informa', () => {
    expect(optionalEmail().parse('')).toBeNull()
    expect(optionalEmail().safeParse('no-email').success).toBe(false)
    expect(optionalEmail().parse('a@b.com')).toBe('a@b.com')
  })
  it('optionalInt: vacío/undefined/NaN → null (nunca 0); rango si se informa', () => {
    expect(optionalInt().parse('')).toBeNull()
    expect(optionalInt().parse(undefined)).toBeNull()
    expect(optionalInt().parse(Number.NaN)).toBeNull()
    expect(optionalInt({ min: 0 }).safeParse(-5).success).toBe(false)
    expect(optionalInt({ min: 0 }).parse(0)).toBe(0)
    expect(optionalInt().parse(80000)).toBe(80000)
  })
})

describe('CAP-1 · createSellerLead (interno)', () => {
  it('objeto vacío es válido; campos de negocio → null (sin placeholders)', () => {
    const r = createSellerLeadSchema.parse({})
    expect(r.name).toBeNull()
    expect(r.email).toBeNull()
    expect(r.phone).toBeNull()
    expect(r.brand).toBeNull()
    expect(r.model).toBeNull()
    expect(r.year).toBeNull()
    expect(r.km).toBeNull()
    expect(r.seats).toBeNull()
    expect(r.type ?? null).toBeNull()
    expect(r.conservationState).toBe('NORMAL') // tiene default; nunca bloquea
  })
  it('strings vacíos → null; números vacíos → null (no 0)', () => {
    const r = createSellerLeadSchema.parse({
      name: '  ',
      brand: '',
      km: '',
      year: undefined,
      seats: null,
    })
    expect(r.name).toBeNull()
    expect(r.brand).toBeNull()
    expect(r.km).toBeNull()
    expect(r.year).toBeNull()
    expect(r.seats).toBeNull()
  })
  it('valida formato/dominio SOLO si se informa el valor', () => {
    expect(createSellerLeadSchema.safeParse({ email: 'malo' }).success).toBe(false)
    expect(createSellerLeadSchema.safeParse({ km: -5 }).success).toBe(false)
    expect(createSellerLeadSchema.safeParse({ year: 1900 }).success).toBe(false)
    const ok = createSellerLeadSchema.parse({ email: 'a@b.com', km: 1000, year: 2020 })
    expect(ok.email).toBe('a@b.com')
    expect(ok.km).toBe(1000)
    expect(ok.year).toBe(2020)
  })
})

describe('CAP-1 · updates internos', () => {
  it('updateSellerLead: solo status; contacto opcional → null', () => {
    const r = updateSellerLeadSchema.parse({ status: 'NUEVO', agentId: null })
    expect(r.name).toBeNull()
    expect(r.email).toBeNull()
    expect(r.phone).toBeNull()
    expect(r.status).toBe('NUEVO')
  })
  it('updateVehicle: solo status; datos de vehículo → null', () => {
    const r = updateVehicleSchema.parse({ status: 'NUEVO' })
    expect(r.brand).toBeNull()
    expect(r.km).toBeNull()
    expect(r.type ?? null).toBeNull()
    expect(r.status).toBe('NUEVO')
  })
  it('updateBuyerLead: solo status; contacto → null', () => {
    const r = updateBuyerLeadSchema.parse({ status: 'NUEVO', agentId: null })
    expect(r.name).toBeNull()
    expect(r.email).toBeNull()
    expect(r.phone).toBeNull()
  })
})

describe('CAP-1 · createBuyerLead (interno)', () => {
  it('objeto vacío es válido; contacto → null', () => {
    const r = createBuyerLeadSchema.parse({})
    expect(r.name).toBeNull()
    expect(r.email).toBeNull()
    expect(r.phone).toBeNull()
  })
})

describe('CAP-1 · el formulario PÚBLICO /vender NO se relaja', () => {
  it('objeto vacío → inválido (campos de negocio siguen obligatorios)', () => {
    expect(createSellerLeadPublicSchema.safeParse({}).success).toBe(false)
  })
  it('con todos los datos → válido', () => {
    const ok = createSellerLeadPublicSchema.safeParse({
      name: 'Ana',
      email: 'a@b.com',
      phone: '600111222',
      type: 'CAMPER',
      brand: 'VW',
      model: 'California',
      year: 2020,
      km: 1000,
      seats: 4,
    })
    expect(ok.success).toBe(true)
  })
})
