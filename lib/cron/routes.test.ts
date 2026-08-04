import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONFIGURED_CRON_PATHS, isConfiguredCronPath } from './routes'

describe('configuración de rutas cron', () => {
  it('coincide exactamente con las rutas declaradas en vercel.json', () => {
    const vercelConfig = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8')) as {
      crons: Array<{ path: string }>
    }

    expect(vercelConfig.crons.map((cron) => cron.path)).toEqual([...CONFIGURED_CRON_PATHS])
  })

  it('no acepta prefijos, sufijos ni slash adicional', () => {
    expect(isConfiguredCronPath('/api/cron/postventa-followups')).toBe(true)
    expect(isConfiguredCronPath('/api/cron')).toBe(false)
    expect(isConfiguredCronPath('/api/cron/postventa-followups/')).toBe(false)
    expect(isConfiguredCronPath('/api/cron/postventa-followups/extra')).toBe(false)
  })
})
