import { describe, it, expect } from 'vitest'
import {
  COMMITMENT_CHOICES,
  COMMITMENT_LABELS,
  canReclassify,
  isCommitmentChoice,
  isCommitmentValidForType,
  requiresExplicitCommitment,
  resolveCommitment,
} from './commitment'

describe('resolveCommitment — tipos con semántica propia', () => {
  it('CITA se clasifica siempre como compromiso externo', () => {
    expect(resolveCommitment('CITA')).toEqual({ ok: true, value: 'EXTERNO' })
  })

  it('LIMPIEZA se clasifica siempre como tarea interna', () => {
    expect(resolveCommitment('LIMPIEZA')).toEqual({ ok: true, value: 'INTERNO' })
  })

  it('acepta que el cliente reenvíe el valor forzado (idempotente)', () => {
    expect(resolveCommitment('CITA', 'EXTERNO')).toEqual({ ok: true, value: 'EXTERNO' })
  })

  it('rechaza degradar una CITA a tarea interna aunque el cliente lo pida', () => {
    expect(resolveCommitment('CITA', 'INTERNO')).toEqual({ ok: false, reason: 'incompatible' })
  })

  it('rechaza promover una LIMPIEZA a compromiso externo', () => {
    expect(resolveCommitment('LIMPIEZA', 'EXTERNO')).toEqual({ ok: false, reason: 'incompatible' })
  })
})

describe('resolveCommitment — tipos que exigen elección', () => {
  it.each(['LLAMADA', 'OTRO'] as const)('%s sin clasificación se rechaza', (type) => {
    expect(resolveCommitment(type)).toEqual({ ok: false, reason: 'required' })
    expect(resolveCommitment(type, null)).toEqual({ ok: false, reason: 'required' })
  })

  it.each(['LLAMADA', 'OTRO'] as const)('%s admite ambas clasificaciones explícitas', (type) => {
    expect(resolveCommitment(type, 'EXTERNO')).toEqual({ ok: true, value: 'EXTERNO' })
    expect(resolveCommitment(type, 'INTERNO')).toEqual({ ok: true, value: 'INTERNO' })
  })

  it('no permite elegir INDETERMINADO a mano', () => {
    expect(resolveCommitment('LLAMADA', 'INDETERMINADO')).toEqual({
      ok: false,
      reason: 'incompatible',
    })
  })

  it('requiresExplicitCommitment solo aplica a LLAMADA y OTRO', () => {
    expect(requiresExplicitCommitment('LLAMADA')).toBe(true)
    expect(requiresExplicitCommitment('OTRO')).toBe(true)
    expect(requiresExplicitCommitment('CITA')).toBe(false)
    expect(requiresExplicitCommitment('LIMPIEZA')).toBe(false)
    expect(requiresExplicitCommitment('SEGUIMIENTO')).toBe(false)
  })
})

describe('resolveCommitment — SEGUIMIENTO', () => {
  it('queda INDETERMINADO: no es creable desde la UI y no se reactiva aquí', () => {
    expect(resolveCommitment('SEGUIMIENTO')).toEqual({ ok: true, value: 'INDETERMINADO' })
  })

  it('nunca se clasifica automáticamente como interno', () => {
    const res = resolveCommitment('SEGUIMIENTO')
    expect(res.ok && res.value).not.toBe('INTERNO')
  })
})

describe('resolveCommitment — cambio de tipo', () => {
  // Reutiliza la misma función: al cambiar el tipo se vuelve a resolver, de modo que
  // nunca se conserva silenciosamente una clasificación incompatible.
  it('pasar a CITA impone EXTERNO aunque viniera de INTERNO', () => {
    expect(resolveCommitment('CITA', null)).toEqual({ ok: true, value: 'EXTERNO' })
  })

  it('pasar a LIMPIEZA impone INTERNO aunque viniera de EXTERNO', () => {
    expect(resolveCommitment('LIMPIEZA', null)).toEqual({ ok: true, value: 'INTERNO' })
  })

  it('pasar a LLAMADA u OTRO vuelve a exigir elección explícita', () => {
    expect(resolveCommitment('LLAMADA', null)).toEqual({ ok: false, reason: 'required' })
    expect(resolveCommitment('OTRO', null)).toEqual({ ok: false, reason: 'required' })
  })
})

describe('isCommitmentValidForType', () => {
  it('valida las parejas admitidas', () => {
    expect(isCommitmentValidForType('CITA', 'EXTERNO')).toBe(true)
    expect(isCommitmentValidForType('CITA', 'INTERNO')).toBe(false)
    expect(isCommitmentValidForType('LIMPIEZA', 'INTERNO')).toBe(true)
    expect(isCommitmentValidForType('LIMPIEZA', 'INDETERMINADO')).toBe(false)
    expect(isCommitmentValidForType('LLAMADA', 'EXTERNO')).toBe(true)
    expect(isCommitmentValidForType('LLAMADA', 'INDETERMINADO')).toBe(false)
    expect(isCommitmentValidForType('SEGUIMIENTO', 'INDETERMINADO')).toBe(true)
  })
})

describe('canReclassify', () => {
  it('permite clasificar un indeterminado como externo o interno', () => {
    expect(canReclassify('LLAMADA', 'EXTERNO')).toEqual({ ok: true, value: 'EXTERNO' })
    expect(canReclassify('OTRO', 'INTERNO')).toEqual({ ok: true, value: 'INTERNO' })
  })

  it('no permite volver a INDETERMINADO', () => {
    expect(canReclassify('LLAMADA', 'INDETERMINADO')).toEqual({
      ok: false,
      reason: 'incompatible',
    })
  })

  it('respeta la clasificación forzada por el tipo', () => {
    expect(canReclassify('CITA', 'INTERNO')).toEqual({ ok: false, reason: 'incompatible' })
    expect(canReclassify('LIMPIEZA', 'EXTERNO')).toEqual({ ok: false, reason: 'incompatible' })
  })

  it('rechaza valores fuera del enum', () => {
    expect(canReclassify('LLAMADA', 'CUALQUIERA' as never)).toEqual({
      ok: false,
      reason: 'incompatible',
    })
  })
})

describe('catálogo', () => {
  it('solo se ofrecen EXTERNO e INTERNO como elección', () => {
    expect(COMMITMENT_CHOICES).toEqual(['EXTERNO', 'INTERNO'])
    expect(isCommitmentChoice('INDETERMINADO')).toBe(false)
  })

  it('las etiquetas son legibles, no el nombre técnico del enum', () => {
    expect(COMMITMENT_LABELS.EXTERNO).toBe('Compromiso externo')
    expect(COMMITMENT_LABELS.INTERNO).toBe('Tarea interna')
    expect(COMMITMENT_LABELS.INDETERMINADO).toBe('Pendiente de clasificar')
  })
})
