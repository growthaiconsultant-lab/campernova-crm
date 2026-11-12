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
    expect(contacted, 'Los formularios web solo entregan la solicitud al CRM').toEqual([])
  },
})
