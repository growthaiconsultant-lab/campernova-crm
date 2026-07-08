import { describe, expect, it } from 'vitest'
import { buildTrustPassport, aggregateTechnicalCategory, type TrustPassportInput } from './index'
import { PUBLICADO_REQUIRED_DOCS } from '../vehicle-legal/requirements'

const NOW = new Date('2026-07-10T12:00:00')

const allDocs = PUBLICADO_REQUIRED_DOCS.map((category) => ({ category, exists: true }))
const okTechnical = (['MECANICA', 'CAMPER', 'ELECTRICIDAD'] as const).map((category) => ({
  category,
  result: 'OK' as const,
}))

const fullyVerified: TrustPassportInput = {
  vin: 'VF1ABC123',
  itvValidUntil: new Date('2027-01-01'),
  chargeCheckedAt: new Date('2026-07-01'),
  titleTransferredAt: new Date('2026-07-05'),
  docs: allDocs,
  hasWorkOrder: true,
  technicalChecks: okTechnical,
}

describe('aggregateTechnicalCategory', () => {
  it('sin ítems → pending', () => {
    expect(aggregateTechnicalCategory([])).toBe('pending')
  })
  it('alguna reparación → fail', () => {
    expect(aggregateTechnicalCategory(['OK', 'NECESITA_REPARACION'])).toBe('fail')
  })
  it('algún pendiente (sin fallos) → pending', () => {
    expect(aggregateTechnicalCategory(['OK', 'PENDIENTE'])).toBe('pending')
  })
  it('todo OK / NO_APLICA → ok', () => {
    expect(aggregateTechnicalCategory(['OK', 'NO_APLICA'])).toBe('ok')
  })
})

describe('buildTrustPassport', () => {
  it('vehículo completo es elegible para el sello y VERIFICADO', () => {
    const p = buildTrustPassport(fullyVerified, NOW)
    expect(p.eligibleForSeal).toBe(true)
    expect(p.blockers).toHaveLength(0)
    expect(p.level).toBe('VERIFICADO')
    expect(p.score).toBe(100)
  })

  it('sin revisión de taller: no elegible + secciones pendientes', () => {
    const p = buildTrustPassport({ ...fullyVerified, hasWorkOrder: false }, NOW)
    expect(p.eligibleForSeal).toBe(false)
    expect(p.blockers).toContain('Sin revisión de taller')
    const tech = p.sections.find((s) => s.key === 'tecnico')!
    expect(tech.checks.every((c) => c.state === 'pending')).toBe(true)
  })

  it('ITV caducada bloquea el sello y marca fail', () => {
    const p = buildTrustPassport({ ...fullyVerified, itvValidUntil: new Date('2026-01-01') }, NOW)
    expect(p.eligibleForSeal).toBe(false)
    expect(p.blockers).toContain('ITV no vigente')
  })

  it('ITV próxima a caducar → warn (no bloquea por sí sola si el resto está)', () => {
    const p = buildTrustPassport({ ...fullyVerified, itvValidUntil: new Date('2026-08-01') }, NOW)
    const itv = p.sections[0].checks.find((c) => c.label === 'ITV vigente')!
    expect(itv.state).toBe('warn')
    expect(p.eligibleForSeal).toBe(true) // warn no es fail
  })

  it('reparación pendiente en taller → fail + bloquea', () => {
    const p = buildTrustPassport(
      {
        ...fullyVerified,
        technicalChecks: [
          { category: 'MECANICA', result: 'NECESITA_REPARACION' },
          { category: 'CAMPER', result: 'OK' },
          { category: 'ELECTRICIDAD', result: 'OK' },
        ],
      },
      NOW
    )
    expect(p.eligibleForSeal).toBe(false)
    expect(p.blockers.some((b) => b.includes('fallidas'))).toBe(true)
  })

  it('faltan docs → bloquea con conteo', () => {
    const p = buildTrustPassport({ ...fullyVerified, docs: allDocs.slice(0, 3) }, NOW)
    expect(p.eligibleForSeal).toBe(false)
    expect(p.blockers.some((b) => b.includes('documento'))).toBe(true)
  })

  it('vehículo vacío → INCOMPLETO, score bajo', () => {
    const p = buildTrustPassport(
      {
        vin: null,
        itvValidUntil: null,
        chargeCheckedAt: null,
        titleTransferredAt: null,
        docs: [],
        hasWorkOrder: false,
        technicalChecks: [],
      },
      NOW
    )
    expect(p.level).toBe('INCOMPLETO')
    expect(p.score).toBe(0)
    expect(p.eligibleForSeal).toBe(false)
  })
})
