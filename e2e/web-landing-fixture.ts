import type { Page } from '@playwright/test'
import { expect, test as base } from '@playwright/test'

export { expect, type Page } from '@playwright/test'

export const test = base.extend({
  page: async ({ page }, use) => {
    const contacted: string[] = []
    await page.route(
      (url) => url.hostname === 'niraagency.com' || url.hostname.endsWith('.niraagency.com'),
      async (route) => {
        contacted.push(route.request().method())
        await route.abort()
      }
    )
    await use(page)
    expect(contacted, 'Se intentó contactar con Nira sin que este escenario lo esperase').toEqual(
      []
    )
  },
})

export async function captureNira(page: Page, campaign: 'encuentra' | 'vende', failFirst = false) {
  const bodies: { respuestas: Record<string, string>; nombre: string; contacto: string }[] = []
  await page.route(
    'https://docs.niraagency.com/api/formulario/campersnova-' + campaign,
    async (route) => {
      const body = route.request().postDataJSON()
      expect(route.request().method()).toBe('POST')
      expect(body.respuestas.atribucion).toBeUndefined()
      expect(Object.values(body.respuestas).every((value) => typeof value === 'string')).toBe(true)
      bodies.push(body)
      const ok = !failFirst || bodies.length > 1
      await route.fulfill({ status: ok ? 200 : 503, json: { ok } })
    }
  )
  return bodies
}
