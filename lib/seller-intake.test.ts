import { describe, expect, it } from 'vitest'
import {
  admittedSellerWhere,
  admittedVehicleWhere,
  buildSellerIntakeViewConditions,
  canDecideSellerIntake,
} from './seller-intake'

const TWO_DAYS_AGO = new Date('2026-09-05T00:00:00.000Z')
const START_OF_WEEK = new Date('2026-09-01T00:00:00.000Z')

describe('seller intake · reglas de admisión', () => {
  it('permite admitir una pendiente o corregir una rechazada', () => {
    expect(canDecideSellerIntake('PENDIENTE', 'ADMITIDO')).toBe(true)
    expect(canDecideSellerIntake('RECHAZADO', 'ADMITIDO')).toBe(true)
  })

  it('no permite expulsar un expediente ya admitido', () => {
    expect(canDecideSellerIntake('ADMITIDO', 'RECHAZADO')).toBe(false)
  })

  it('trata repetir la misma decisión como una operación idempotente', () => {
    expect(canDecideSellerIntake('ADMITIDO', 'ADMITIDO')).toBe(true)
    expect(canDecideSellerIntake('RECHAZADO', 'RECHAZADO')).toBe(true)
  })
})

describe('seller intake · separación de bandejas', () => {
  it('la bandeja por defecto incluye solo expedientes admitidos', () => {
    expect(buildSellerIntakeViewConditions('todos', 'u1', TWO_DAYS_AGO, START_OF_WEEK)).toEqual(
      admittedSellerWhere
    )
  })

  it('el inventario operativo exige un vendedor admitido', () => {
    expect(admittedVehicleWhere).toEqual({ sellerLead: { intakeStatus: 'ADMITIDO' } })
  })

  it('Solicitudes web incluye todas las pendientes sin depender de la tasación', () => {
    expect(buildSellerIntakeViewConditions('leads-web', 'u1', TWO_DAYS_AGO, START_OF_WEEK)).toEqual(
      { canal: 'PRO', intakeStatus: 'PENDIENTE' }
    )
  })

  it('Rechazadas web queda como histórico explícito y separado', () => {
    expect(
      buildSellerIntakeViewConditions('web-rechazadas', 'u1', TWO_DAYS_AGO, START_OF_WEEK)
    ).toEqual({ canal: 'PRO', intakeStatus: 'RECHAZADO' })
  })

  it('las vistas operativas conservan el gate de admisión', () => {
    expect(
      buildSellerIntakeViewConditions('sin-asignar', 'u1', TWO_DAYS_AGO, START_OF_WEEK)
    ).toEqual({
      AND: [admittedSellerWhere, { agentId: null, status: { notIn: ['CERRADO', 'DESCARTADO'] } }],
    })
  })
})
