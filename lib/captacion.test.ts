import { describe, expect, it } from 'vitest'
import {
  CAPTURE_BOARD_COLUMNS,
  CAPTURE_STATUS_LABELS,
  captureAnchorId,
  findDuplicateCaptureByPhone,
  isTerminalCaptureStatus,
  isValidCaptureStatus,
  isValidPortal,
  PORTAL_LABELS,
  resolveCaptureFocusId,
  splitCaptureTitle,
} from './captacion'

describe('labels/opciones', () => {
  it('4 portales y 6 estados', () => {
    expect(Object.keys(PORTAL_LABELS)).toHaveLength(4)
    expect(Object.keys(CAPTURE_STATUS_LABELS)).toHaveLength(6)
  })
  it('el tablero excluye RECHAZADO', () => {
    expect(CAPTURE_BOARD_COLUMNS).not.toContain('RECHAZADO')
    expect(CAPTURE_BOARD_COLUMNS).toHaveLength(5)
  })
  it('validadores', () => {
    expect(isValidPortal('WALLAPOP')).toBe(true)
    expect(isValidPortal('EBAY')).toBe(false)
    expect(isValidCaptureStatus('EN_CURSO')).toBe(true)
    expect(isValidCaptureStatus('X')).toBe(false)
  })
})

describe('foco de captación', () => {
  it('resuelve sólo identificadores presentes en el conjunto autorizado', () => {
    expect(resolveCaptureFocusId('capture-2', ['capture-1', 'capture-2'])).toBe('capture-2')
    expect(resolveCaptureFocusId('capture-3', ['capture-1', 'capture-2'])).toBeNull()
    expect(resolveCaptureFocusId(undefined, ['capture-1'])).toBeNull()
  })

  it('prefija el ancla para evitar colisiones con otros elementos', () => {
    expect(captureAnchorId('capture-2')).toBe('captacion-capture-2')
  })
})

describe('isTerminalCaptureStatus', () => {
  it('CONVERTIDO y RECHAZADO son terminales', () => {
    expect(isTerminalCaptureStatus('CONVERTIDO')).toBe(true)
    expect(isTerminalCaptureStatus('RECHAZADO')).toBe(true)
    expect(isTerminalCaptureStatus('EN_CURSO')).toBe(false)
  })
})

describe('splitCaptureTitle', () => {
  it('marca = primera palabra, modelo = resto', () => {
    expect(splitCaptureTitle('Benimar Tessoro 495')).toEqual({
      brand: 'Benimar',
      model: 'Tessoro 495',
    })
  })
  it('una sola palabra → modelo por determinar', () => {
    expect(splitCaptureTitle('California')).toEqual({
      brand: 'California',
      model: 'Por determinar',
    })
  })
  it('vacío/nulo → placeholders editables', () => {
    expect(splitCaptureTitle('')).toEqual({ brand: 'Por determinar', model: 'Por determinar' })
    expect(splitCaptureTitle(null)).toEqual({ brand: 'Por determinar', model: 'Por determinar' })
  })
})

describe('findDuplicateCaptureByPhone', () => {
  const rows = [
    { id: 'c1', phone: '600 11 22 33', status: 'CONTACTADO' as const },
    { id: 'c2', phone: '611222333', status: 'RECHAZADO' as const },
    { id: 'c3', phone: '622333444', status: 'CONVERTIDO' as const },
  ]

  it('detecta un duplicado vivo por teléfono normalizado', () => {
    expect(findDuplicateCaptureByPhone('0034600112233', rows)?.id).toBe('c1')
  })
  it('ignora captaciones rechazadas/convertidas', () => {
    expect(findDuplicateCaptureByPhone('611222333', rows)).toBeNull()
    expect(findDuplicateCaptureByPhone('622333444', rows)).toBeNull()
  })
  it('sin coincidencia o teléfono vacío → null', () => {
    expect(findDuplicateCaptureByPhone('699999999', rows)).toBeNull()
    expect(findDuplicateCaptureByPhone('', rows)).toBeNull()
  })
})
