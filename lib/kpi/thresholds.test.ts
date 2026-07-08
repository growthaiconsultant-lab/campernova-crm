import { describe, expect, it } from 'vitest'
import { sem, semHigherBetter, semLowerBetter } from './thresholds'

describe('semáforos base', () => {
  it('mayor es mejor', () => {
    expect(semHigherBetter(80, 70, 40)).toBe('green')
    expect(semHigherBetter(50, 70, 40)).toBe('amber')
    expect(semHigherBetter(30, 70, 40)).toBe('red')
  })
  it('menor es mejor', () => {
    expect(semLowerBetter(10, 15, 30)).toBe('green')
    expect(semLowerBetter(20, 15, 30)).toBe('amber')
    expect(semLowerBetter(40, 15, 30)).toBe('red')
  })
})

describe('semáforos de negocio (umbrales del dueño)', () => {
  it('ventas/mes objetivo 7', () => {
    expect(sem.monthlySales(7)).toBe('green')
    expect(sem.monthlySales(5)).toBe('amber')
    expect(sem.monthlySales(4)).toBe('red')
  })
  it('margen por operación mínimo 4%', () => {
    expect(sem.marginPct(4)).toBe('green')
    expect(sem.marginPct(3)).toBe('amber')
    expect(sem.marginPct(1)).toBe('red')
  })
  it('1ª respuesta <24h verde, 24-48 ámbar, >48 rojo', () => {
    expect(sem.firstResponseHours(10)).toBe('green')
    expect(sem.firstResponseHours(30)).toBe('amber')
    expect(sem.firstResponseHours(50)).toBe('red')
  })
  it('tiempo de venta <15 verde, 15-30 ámbar, >30 rojo', () => {
    expect(sem.daysToSell(10)).toBe('green')
    expect(sem.daysToSell(20)).toBe('amber')
    expect(sem.daysToSell(40)).toBe('red')
  })
  it('leads sin próxima acción: 0 verde', () => {
    expect(sem.leadsWithoutAction(0)).toBe('green')
    expect(sem.leadsWithoutAction(3)).toBe('amber')
    expect(sem.leadsWithoutAction(9)).toBe('red')
  })
})
