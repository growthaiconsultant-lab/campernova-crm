import { describe, it, expect } from 'vitest'
import { officialRequestFingerprint } from './idempotency'
import type { FingerprintMode } from './idempotency'

const MANUAL: FingerprintMode = {
  kind: 'MANUAL',
  min: 10000,
  recommended: 12000,
  max: 14000,
  confidence: 'MEDIA',
  reason: 'Tras inspección',
}

describe('officialRequestFingerprint', () => {
  it('es determinista: misma petición → misma huella', () => {
    const a = officialRequestFingerprint({ vehicleId: 'v1', mode: MANUAL })
    const b = officialRequestFingerprint({ vehicleId: 'v1', mode: { ...MANUAL } })
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/) // sha256 hex
  })

  it('normaliza diferencias irrelevantes: espacios en el motivo y decimales de dinero', () => {
    const base = officialRequestFingerprint({ vehicleId: 'v1', mode: MANUAL })
    const padded = officialRequestFingerprint({
      vehicleId: 'v1',
      mode: { ...MANUAL, reason: '  Tras inspección  ' },
    })
    const money = officialRequestFingerprint({
      vehicleId: 'v1',
      mode: { ...MANUAL, min: 10000.0, recommended: 12000.0, max: 14000.0 },
    })
    expect(padded).toBe(base)
    expect(money).toBe(base)
  })

  it('otro vehículo → otra huella', () => {
    expect(officialRequestFingerprint({ vehicleId: 'v1', mode: MANUAL })).not.toBe(
      officialRequestFingerprint({ vehicleId: 'v2', mode: MANUAL })
    )
  })

  it('AUTO ≠ MANUAL para el mismo vehículo', () => {
    expect(officialRequestFingerprint({ vehicleId: 'v1', mode: { kind: 'AUTO' } })).not.toBe(
      officialRequestFingerprint({ vehicleId: 'v1', mode: MANUAL })
    )
  })

  it('cambios materiales del payload manual cambian la huella', () => {
    const base = officialRequestFingerprint({ vehicleId: 'v1', mode: MANUAL })
    const cases: FingerprintMode[] = [
      { ...MANUAL, recommended: 12500 }, // rango distinto
      { ...MANUAL, confidence: 'ALTA' }, // confianza distinta
      { ...MANUAL, reason: 'Otro motivo' }, // motivo distinto
      { ...MANUAL, referenceUsed: 'Comparables 2024' }, // referencia declarada
    ]
    for (const mode of cases) {
      expect(officialRequestFingerprint({ vehicleId: 'v1', mode })).not.toBe(base)
    }
  })

  it('referenceUsed null vs "" vs undefined son equivalentes (null canónico)', () => {
    const a = officialRequestFingerprint({
      vehicleId: 'v1',
      mode: { ...MANUAL, referenceUsed: null },
    })
    const b = officialRequestFingerprint({
      vehicleId: 'v1',
      mode: { ...MANUAL, referenceUsed: '  ' },
    })
    const c = officialRequestFingerprint({ vehicleId: 'v1', mode: { ...MANUAL } })
    expect(a).toBe(b)
    expect(a).toBe(c)
  })
})
