import { test, expect, captureNira, type Page } from './web-landing-fixture'
const CRM = '**/api/landing/encuentra-tu-camper'
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cn_cookie_consent', 'essential'))
})
async function choose(page: Page, name: string) {
  await page
    .locator('.opts label')
    .filter({ has: page.locator(`[name=${name}]`) })
    .first()
    .click()
}
async function fill(page: Page) {
  for (const name of ['tipo', 'plazas', 'presupuesto']) await choose(page, name)
  await page.locator('[data-ir="1"]').click()
  await choose(page, 'cuando')
  await page.locator('[name=nombre]').fill('Prueba técnica')
  await page.locator('[name=telefono]').fill('600000000')
  await page.locator('[name=acepto]').check()
}
test('buyer assets render without JS errors or overflow', async ({ page, request }, info) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/encuentra-tu-camper.html')
  await expect(page.locator('#cn-form')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const assets = await page.evaluate(() =>
    Array.from(
      new Set(
        Array.from(document.querySelectorAll('*')).flatMap((el) =>
          ['src', 'href', 'poster', 'srcset', 'data-audio']
            .map((attr) => el.getAttribute(attr))
            .filter((v): v is string => !!v && v.startsWith('cn-landing/'))
        )
      )
    )
  )
  for (const asset of assets) {
    const r = await request.get('/' + asset)
    expect(r.status(), asset).toBe(200)
    expect(r.headers()['content-type'], asset).not.toContain('text/html')
  }
  expect(errors).toEqual([])
  await page.screenshot({ path: info.outputPath('buyer-hero.png') })
})
test('validates required choices and consent before any destination', async ({ page }) => {
  let calls = 0
  await page.route(CRM, async (r) => {
    calls++
    await r.fulfill({ json: { ok: true } })
  })
  await page.goto('/encuentra-tu-camper.html')
  await page.locator('[data-ir="1"]').click()
  await expect(page.locator('.step.on .err')).toBeVisible()
  await fill(page)
  await page.locator('[name=acepto]').uncheck()
  await page.locator('button[type=submit]').click()
  await expect(page.locator('.step.on .err')).toContainText('Marca la casilla')
  expect(calls).toBe(0)
})
test('sends original buyer contract without email only to the CRM', async ({ page }) => {
  const received: Record<string, unknown>[] = []
  await page.route(CRM, async (r) => {
    received.push(r.request().postDataJSON())
    await r.fulfill({ json: { ok: true } })
  })
  await page.goto('/encuentra-tu-camper.html?utm_source=google&utm_campaign=compra')
  await fill(page)
  await page.locator('button[type=submit]').click()
  await expect(page.locator('#cn-done h3')).toHaveText('¡Recibido!')
  expect(received).toHaveLength(1)
  expect(received[0]).toMatchObject({
    gdpr_consent: true,
    respuestas: {
      pagina: '/encuentra-tu-camper.html',
      atribucion: { utm_source: 'google', utm_campaign: 'compra' },
    },
  })
  const answers = received[0].respuestas as Record<string, unknown>
  expect(answers.origen).toContain('utm_campaign=compra')
  expect(answers.email).toBeUndefined()
  await expect(page.locator('#cn-retry')).toBeHidden()
})
for (const visit of [
  'untagged',
  'new-campaign',
  'blank-tags',
  'unresolved-template',
  'blocked-storage',
]) {
  test(`buyer preserves a coherent campaign snapshot: ${visit}`, async ({ page }) => {
    const nira = await captureNira(page, 'encuentra')
    let crm: Record<string, unknown> | undefined
    await page.route(CRM, async (r) => {
      crm = r.request().postDataJSON()
      await r.fulfill({ json: { ok: true } })
    })
    if (visit === 'blocked-storage')
      await page.addInitScript(() => {
        Object.defineProperty(window, 'sessionStorage', {
          get() {
            throw new Error('blocked')
          },
        })
      })
    await page.goto(
      '/encuentra-tu-camper.html?utm_source=instagram&utm_campaign=qa_old&utm_content=qa_old_ad&ad_id=qa_old_id'
    )
    const next =
      visit === 'new-campaign'
        ? '?utm_source=facebook&utm_campaign=qa_new&campaign_id=qa_campaign&adset_id=qa_set&ad_id=qa_new_id&placement=feed'
        : visit === 'blank-tags'
          ? '?utm_source='
          : visit === 'unresolved-template'
            ? '?utm_source=%7B%7Bsite_source_name%7D%7D&ad_id=%7B%7Bad.id%7D%7D'
            : visit === 'blocked-storage'
              ? '?utm_source=meta&utm_campaign=qa_storage'
              : ''
    await page.goto('/encuentra-tu-camper.html' + next, { referer: page.url() })
    await fill(page)
    await page.locator('button[type=submit]').click()
    await expect(page.locator('#cn-done h3')).toHaveText('¡Recibido!')
    const answers = crm?.respuestas as Record<string, unknown>
    const expected =
      visit === 'new-campaign'
        ? {
            utm_source: 'facebook',
            utm_campaign: 'qa_new',
            campaign_id: 'qa_campaign',
            adset_id: 'qa_set',
            ad_id: 'qa_new_id',
            placement: 'feed',
          }
        : visit === 'untagged'
          ? {
              utm_source: 'instagram',
              utm_campaign: 'qa_old',
              utm_content: 'qa_old_ad',
              ad_id: 'qa_old_id',
            }
          : visit === 'blocked-storage'
            ? { utm_source: 'meta', utm_campaign: 'qa_storage' }
            : {}
    expect(answers.atribucion).toEqual(expected)
    expect(nira).toHaveLength(expected.utm_source ? 1 : 0)
    if (nira.length) expect(nira[0].respuestas.event_id).toBe(answers.event_id)
  })
}

test('retries the same CRM submission after a failure', async ({ page }) => {
  const bodies: unknown[] = []
  await page.route(CRM, async (route) => {
    bodies.push(route.request().postDataJSON())
    const ok = bodies.length > 1
    await route.fulfill({ status: ok ? 200 : 503, json: { ok } })
  })
  await page.goto('/encuentra-tu-camper')
  await fill(page)
  await page.locator('button[type=submit]').click()
  await expect(page.locator('#cn-done h3')).toHaveText('No se ha podido enviar')
  await page.locator('#cn-retry').click()
  await expect(page.locator('#cn-done h3')).toHaveText('¡Recibido!')
  expect(bodies).toHaveLength(2)
  expect(bodies[1]).toEqual(bodies[0])
})

test('a click from Meta retries only Nira after the CRM confirmed', async ({ page }) => {
  const nira = await captureNira(page, 'encuentra', true)
  let crm = 0
  await page.route(CRM, async (route) => {
    crm++
    await route.fulfill({ json: { ok: true } })
  })
  await page.goto('/encuentra-tu-camper?fbclid=example-click')
  await fill(page)
  await page.locator('button[type=submit]').click()
  await expect(page.locator('#cn-done h3')).toHaveText('Falta completar el envío')
  await page.locator('#cn-retry').click()
  await expect(page.locator('#cn-done h3')).toHaveText('¡Recibido!')
  expect(crm).toBe(1)
  expect(nira).toHaveLength(2)
  expect(nira[1]).toEqual(nira[0])
})
