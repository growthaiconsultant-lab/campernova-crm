import { describe, expect, it } from 'vitest'
import {
  isTerminalWorkOrderStatus,
  isWorkOrderTransitionAllowed,
  WORK_ORDER_CORRECTION_TARGET,
  WORK_ORDER_REOPEN_TARGET,
} from './transitions'

describe('work order transition policy', () => {
  it('separa avance, corrección y reapertura', () => {
    expect(isWorkOrderTransitionAllowed('PENDIENTE', 'EN_DIAGNOSTICO', 'forward')).toBe(true)
    expect(isWorkOrderTransitionAllowed('EN_DIAGNOSTICO', 'PENDIENTE', 'correction')).toBe(true)
    expect(isWorkOrderTransitionAllowed('COMPLETADA', 'EN_CURSO', 'reopen')).toBe(true)
    expect(isWorkOrderTransitionAllowed('COMPLETADA', 'EN_CURSO', 'correction')).toBe(false)
  })

  it('declara un único destino de corrección y reapertura por estado', () => {
    expect(WORK_ORDER_CORRECTION_TARGET).toEqual({
      EN_DIAGNOSTICO: 'PENDIENTE',
      PRESUPUESTADA: 'EN_DIAGNOSTICO',
      EN_CURSO: 'PRESUPUESTADA',
    })
    expect(WORK_ORDER_REOPEN_TARGET).toEqual({
      COMPLETADA: 'EN_CURSO',
      RECHAZADA: 'PENDIENTE',
    })
  })

  it('considera terminales completada y rechazada', () => {
    expect(isTerminalWorkOrderStatus('COMPLETADA')).toBe(true)
    expect(isTerminalWorkOrderStatus('RECHAZADA')).toBe(true)
    expect(isTerminalWorkOrderStatus('EN_CURSO')).toBe(false)
  })
})
