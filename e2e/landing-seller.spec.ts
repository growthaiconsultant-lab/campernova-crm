import { test, expect, captureNira, type Page } from './web-landing-fixture'

const CRM = '**/api/landing/vende-tu-camper'
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cn_cookie_consent', 'essential'))
})
async function fill(page: Page, priority = 'Solo saber cuánto vale') {
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
    .filter({ has: page.locator(`[name=prioridad][value="${priority}"]`) })
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

test('validates vehicle fields and consent before submitting', async ({ page }) => {
  let calls = 0
  await page.route(CRM, async (route) => {
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

for (const priority of ['Venderla pronto', 'Sacar el mejor precio']) {
  test(`sends priority ${priority} to the CRM and Nira when Meta refers the visit`, async ({
    page,
  }) => {
    const nira = await captureNira(page, 'vende')
    const received: Record<string, unknown>[] = []
    await page.route(CRM, async (route) => {
      received.push(route.request().postDataJSON())
      await route.fulfill({ json: { ok: true } })
    })
    await page.goto('/vende-tu-camper.html?utm_source=meta&utm_campaign=test')
    await fill(page, priority)
    await page.locator('button[type=submit]').click()
    await expect(page.locator('#cn-done h3')).toHaveText('¡Recibido!')
    expect(nira).toHaveLength(1)
    expect(nira[0].respuestas.event_id).toBe(
      (received[0].respuestas as Record<string, unknown>).event_id
    )
    expect(received).toHaveLength(1)
    expect(received[0]).toMatchObject({
      gdpr_consent: true,
      respuestas: { prioridad: priority, atribucion: { utm_source: 'meta', utm_campaign: 'test' } },
    })
    expect((received[0].respuestas as Record<string, string>).origen).toContain('utm_campaign=test')
    await expect(page.locator('#cn-retry')).toBeHidden()
    await expect(page.locator('#cn-wa')).toHaveAttribute('href', /wa\.me\/34645639185\?text=/)
  })
}

test('retries the same CRM submission after a failure', async ({ page }) => {
  const nira = await captureNira(page, 'vende')
  const bodies: unknown[] = []
  await page.route(CRM, async (route) => {
    bodies.push(route.request().postDataJSON())
    const ok = bodies.length > 1
    await route.fulfill({ status: ok ? 200 : 503, json: { ok } })
  })
  await page.goto('/vende-tu-camper?utm_source=instagram&utm_campaign=qa_retry&ad_id=qa_ad')
  await fill(page)
  await page.locator('button[type=submit]').click()
  await expect(page.locator('#cn-done h3')).toHaveText('Falta completar el envío')
  await page.locator('#cn-retry').click()
  await expect(page.locator('#cn-done h3')).toHaveText('¡Recibido!')
  expect(nira).toHaveLength(1)
  expect(bodies).toHaveLength(2)
  expect(bodies[1]).toEqual(bodies[0])
})

test('keeps prepared WhatsApp and retries after complete failure', async ({ page }) => {
  let calls = 0
  await page.route(CRM, async (route) => {
    calls++
    await route.abort('failed')
  })
  await page.goto('/vende-tu-camper.html')
  await fill(page)
  await page.locator('button[type=submit]').click()
  await expect(page.locator('#cn-done h3')).toHaveText('No se ha podido enviar')
  await expect(page.locator('#cn-wa')).toHaveAttribute('href', /Volkswagen%20California/)
  await expect(page.locator('#cn-retry')).toBeVisible()
  expect(calls).toBe(1)
})
