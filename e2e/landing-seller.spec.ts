import { test, expect, type Page } from '@playwright/test'

const CRM = '**/api/landing/vende-tu-camper'
const NIRA = 'https://docs.niraagency.com/api/formulario/campersnova-vende'
async function fill(page: Page) {
  await page
    .locator('.opts label')
    .filter({ has: page.locator('[name=tipo]') })
    .first()
    .click()
  await page.locator('[name=modelo]').fill('Volkswagen California Ocean')
  await page.locator('[name=anio]').fill('2019')
  await page.locator('[name=km]').fill('85.000')
  await page.locator('[data-ir="1"]').click()
  await page
    .locator('.opts label')
    .filter({ has: page.locator('[name=prioridad]') })
    .last()
    .click()
  await page.locator('[name=nombre]').fill('Prueba técnica')
  await page.locator('[name=telefono]').fill('600000000')
  await page.locator('[name=acepto]').check()
}

test('loads campaign assets and renders without overflow or JS errors', async ({
  page,
  request,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/vende-tu-camper.html')
  await expect(page.locator('h1')).toContainText('Vende tu camper')
  await expect(page.locator('#cn-form')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const assets = await page.evaluate(() => {
    const attrs = ['src', 'href', 'poster', 'srcset', 'data-audio']
    return Array.from(
      new Set(
        Array.from(document.querySelectorAll('*')).flatMap((el) =>
          attrs
            .map((attr) => el.getAttribute(attr))
            .filter((v): v is string => !!v && v.startsWith('cn-landing/'))
        )
      )
    )
  })
  for (const asset of assets) {
    const response = await request.get('/' + asset)
    expect(response.status(), asset).toBe(200)
    expect(response.headers()['content-type'], asset).not.toContain('text/html')
  }
  await page.screenshot({ path: testInfo.outputPath('landing-hero.png') })
  expect(errors).toEqual([])
})

test('validates vehicle fields and consent before either submission', async ({ page }) => {
  let calls = 0
  await page.route(CRM, async (route) => {
    calls++
    await route.fulfill({ json: { ok: true } })
  })
  await page.route(NIRA, async (route) => {
    calls++
    await route.fulfill({ json: { ok: true } })
  })
  await page.goto('/vende-tu-camper.html')
  await page.locator('[data-ir="1"]').click()
  await expect(page.locator('.step.on .err')).toContainText('Dinos si es camper')
  await fill(page)
  await page.locator('[name=acepto]').uncheck()
  await page.locator('button[type=submit]').click()
  await expect(page.locator('.step.on .err')).toContainText('Marca la casilla')
  expect(calls).toBe(0)
})

test('sends both contracts and attribution and waits for both confirmations', async ({ page }) => {
  const received: Record<string, unknown>[] = []
  await page.route(CRM, async (route) => {
    received.push(route.request().postDataJSON())
    await route.fulfill({ json: { ok: true } })
  })
  await page.route(NIRA, async (route) => {
    received.push(route.request().postDataJSON())
    await route.fulfill({ json: { ok: true } })
  })
  await page.goto('/vende-tu-camper.html?utm_source=meta&utm_campaign=test')
  await fill(page)
  await page.locator('button[type=submit]').click()
  await expect(page.locator('#cn-done h3')).toHaveText('¡Recibido!')
  expect(received).toHaveLength(2)
  expect(received.filter((p) => p.gdpr_consent === true)).toHaveLength(1)
  const answers = received.map((p) => p.respuestas as Record<string, string>)
  expect(answers[0].event_id).toBe(answers[1].event_id)
  expect(answers[0].origen).toContain('utm_campaign=test')
  await expect(page.locator('#cn-retry')).toBeHidden()
  await expect(page.locator('#cn-wa')).toHaveAttribute('href', /wa\.me\/34645639185\?text=/)
})

for (const failed of ['crm', 'nira']) {
  test(`retries only ${failed} after partial failure`, async ({ page }) => {
    const count = { crm: 0, nira: 0 }
    const keys: string[] = []
    for (const name of ['crm', 'nira'] as const) {
      await page.route(name === 'crm' ? CRM : NIRA, async (route) => {
        count[name]++
        keys.push(route.request().postDataJSON().respuestas.event_id)
        await route.fulfill({
          status: name === failed && count[name] === 1 ? 503 : 200,
          json: { ok: !(name === failed && count[name] === 1) },
        })
      })
    }
    await page.goto('/vende-tu-camper.html')
    await fill(page)
    await page.locator('button[type=submit]').click()
    await expect(page.locator('#cn-done h3')).toHaveText('Falta completar el envío')
    await page.locator('#cn-retry').click()
    await expect(page.locator('#cn-done h3')).toHaveText('¡Recibido!')
    expect(count).toEqual(failed === 'crm' ? { crm: 2, nira: 1 } : { crm: 1, nira: 2 })
    expect(new Set(keys).size).toBe(1)
  })
}

test('keeps prepared WhatsApp and retries after complete failure', async ({ page }) => {
  let calls = 0
  await page.route(CRM, async (route) => {
    calls++
    await route.abort('failed')
  })
  await page.route(NIRA, async (route) => {
    calls++
    await route.fulfill({ json: { ok: false } })
  })
  await page.goto('/vende-tu-camper.html')
  await fill(page)
  await page.locator('button[type=submit]').click()
  await expect(page.locator('#cn-done h3')).toHaveText('No se ha podido enviar')
  await expect(page.locator('#cn-wa')).toHaveAttribute('href', /Volkswagen%20California/)
  await expect(page.locator('#cn-retry')).toBeVisible()
  expect(calls).toBe(2)
})
