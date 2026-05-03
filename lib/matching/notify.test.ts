import { describe, expect, it } from 'vitest'
import { shouldThrottle, MATCH_NOTIFICATION_THROTTLE_MINUTES } from './notify'

describe('shouldThrottle', () => {
  const now = new Date('2026-05-02T12:00:00Z')

  it('no throttle si nunca se envió', () => {
    expect(shouldThrottle(null, now)).toBe(false)
  })

  it('throttle si el último envío fue hace 1 minuto', () => {
    const oneMinAgo = new Date(now.getTime() - 1 * 60 * 1000)
    expect(shouldThrottle(oneMinAgo, now)).toBe(true)
  })

  it('throttle si el último envío fue hace 29 minutos', () => {
    const twentyNineMinAgo = new Date(now.getTime() - 29 * 60 * 1000)
    expect(shouldThrottle(twentyNineMinAgo, now)).toBe(true)
  })

  it('NO throttle si el último envío fue hace exactamente 30 minutos', () => {
    const exactlyThirtyMinAgo = new Date(
      now.getTime() - MATCH_NOTIFICATION_THROTTLE_MINUTES * 60 * 1000
    )
    expect(shouldThrottle(exactlyThirtyMinAgo, now)).toBe(false)
  })

  it('NO throttle si el último envío fue hace 31 minutos', () => {
    const thirtyOneMinAgo = new Date(now.getTime() - 31 * 60 * 1000)
    expect(shouldThrottle(thirtyOneMinAgo, now)).toBe(false)
  })

  it('NO throttle si el último envío fue hace 1 hora', () => {
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    expect(shouldThrottle(oneHourAgo, now)).toBe(false)
  })

  it('umbral configurable: throttle 60 min, lastSent hace 45 → throttle activo', () => {
    const fortyFiveMinAgo = new Date(now.getTime() - 45 * 60 * 1000)
    expect(shouldThrottle(fortyFiveMinAgo, now, 60)).toBe(true)
  })
})
