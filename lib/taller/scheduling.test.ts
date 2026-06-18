import { describe, it, expect } from 'vitest'
import {
  isWorkingDay,
  nextWorkingDay,
  addWorkingDays,
  workingDaysForHours,
  suggestSchedule,
  computeHoursDeviation,
} from './scheduling'

// Fechas de referencia (verificadas): 2026-06-01 es LUNES.
const MON = new Date(2026, 5, 1) // lun 1 jun 2026
const FRI = new Date(2026, 5, 5) // vie 5 jun 2026
const SAT = new Date(2026, 5, 6) // sáb 6 jun 2026
const SUN = new Date(2026, 5, 7) // dom 7 jun 2026

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

describe('referencia de fechas', () => {
  it('2026-06-01 es lunes', () => {
    expect(MON.getDay()).toBe(1)
    expect(SAT.getDay()).toBe(6)
    expect(SUN.getDay()).toBe(0)
  })
})

describe('isWorkingDay', () => {
  it('lun-vie son laborables; sáb y dom no', () => {
    expect(isWorkingDay(MON)).toBe(true)
    expect(isWorkingDay(FRI)).toBe(true)
    expect(isWorkingDay(SAT)).toBe(false)
    expect(isWorkingDay(SUN)).toBe(false)
  })
})

describe('nextWorkingDay', () => {
  it('un laborable se queda igual', () => {
    expect(ymd(nextWorkingDay(MON))).toBe('2026-06-01')
  })
  it('sábado y domingo saltan al lunes', () => {
    expect(ymd(nextWorkingDay(SAT))).toBe('2026-06-08')
    expect(ymd(nextWorkingDay(SUN))).toBe('2026-06-08')
  })
})

describe('addWorkingDays', () => {
  it('n=0 devuelve el primer laborable en/después de from', () => {
    expect(ymd(addWorkingDays(MON, 0))).toBe('2026-06-01')
    expect(ymd(addWorkingDays(SAT, 0))).toBe('2026-06-08')
  })
  it('suma días laborables saltando fines de semana', () => {
    expect(ymd(addWorkingDays(MON, 4))).toBe('2026-06-05') // lun → vie
    expect(ymd(addWorkingDays(MON, 5))).toBe('2026-06-08') // salta sáb/dom → lun
    expect(ymd(addWorkingDays(FRI, 1))).toBe('2026-06-08') // vie +1 → lun
  })
})

describe('workingDaysForHours', () => {
  it('redondea hacia arriba, mínimo 1 si hay horas', () => {
    expect(workingDaysForHours(0)).toBe(0)
    expect(workingDaysForHours(1)).toBe(1)
    expect(workingDaysForHours(8)).toBe(1)
    expect(workingDaysForHours(9)).toBe(2)
    expect(workingDaysForHours(16)).toBe(2)
    expect(workingDaysForHours(17)).toBe(3)
  })
})

describe('suggestSchedule', () => {
  it('1 día de trabajo sin backlog → start=end=from', () => {
    const r = suggestSchedule({ plannedHours: 8, from: MON, backlogHours: 0 })
    expect(ymd(r.start)).toBe('2026-06-01')
    expect(ymd(r.end)).toBe('2026-06-01')
    expect(r.workingDaysNeeded).toBe(1)
  })

  it('16h → 2 días laborables consecutivos', () => {
    const r = suggestSchedule({ plannedHours: 16, from: MON })
    expect(ymd(r.start)).toBe('2026-06-01')
    expect(ymd(r.end)).toBe('2026-06-02')
    expect(r.workingDaysNeeded).toBe(2)
  })

  it('24h → 3 días (lun→mié)', () => {
    const r = suggestSchedule({ plannedHours: 24, from: MON })
    expect(ymd(r.start)).toBe('2026-06-01')
    expect(ymd(r.end)).toBe('2026-06-03')
    expect(r.workingDaysNeeded).toBe(3)
  })

  it('con backlog de 1 día, arranca al día siguiente', () => {
    const r = suggestSchedule({ plannedHours: 8, from: MON, backlogHours: 8 })
    expect(ymd(r.start)).toBe('2026-06-02')
    expect(ymd(r.end)).toBe('2026-06-02')
  })

  it('respeta el fin de semana al desplazar por backlog', () => {
    // viernes + 1 día de backlog → arranca el lunes siguiente
    const r = suggestSchedule({ plannedHours: 8, from: FRI, backlogHours: 8 })
    expect(ymd(r.start)).toBe('2026-06-08')
    expect(ymd(r.end)).toBe('2026-06-08')
  })

  it('hoursPerDay configurable cambia los días necesarios', () => {
    const r = suggestSchedule({ plannedHours: 12, from: MON, hoursPerDay: 4 })
    expect(r.workingDaysNeeded).toBe(3) // 12 / 4 = 3
    expect(ymd(r.end)).toBe('2026-06-03')
  })
})

describe('computeHoursDeviation', () => {
  it('sin previsión', () => {
    const d = computeHoursDeviation(null, 10)
    expect(d.status).toBe('sin_prevision')
    expect(d.deviation).toBeNull()
    expect(d.deviationPct).toBeNull()
    expect(d.real).toBe(10)
  })

  it('dentro de tolerancia', () => {
    const d = computeHoursDeviation(8, 8)
    expect(d.status).toBe('dentro')
    expect(d.deviation).toBe(0)
    expect(d.deviationPct).toBe(0)
  })

  it('desviado hacia arriba (8 previstas, 25 reales)', () => {
    const d = computeHoursDeviation(8, 25)
    expect(d.status).toBe('desviado_arriba')
    expect(d.deviation).toBe(17)
    expect(d.deviationPct).toBeGreaterThan(15)
  })

  it('por debajo de lo previsto', () => {
    const d = computeHoursDeviation(10, 8, 15)
    expect(d.status).toBe('por_debajo') // -20% < -15%
    expect(d.deviation).toBe(-2)
  })

  it('pequeña desviación dentro de la tolerancia del 15%', () => {
    const d = computeHoursDeviation(8, 9, 15) // +12.5%
    expect(d.status).toBe('dentro')
  })
})
