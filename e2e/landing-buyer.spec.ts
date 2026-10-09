import { test, expect, type Page } from '@playwright/test'
const CRM = '**/api/landing/encuentra-tu-camper'
const NIRA = 'https://docs.niraagency.com/api/formulario/campersnova-encuentra'
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
  for (const url of [CRM, NIRA])
    await page.route(url, async (r) => {
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
test('sends original buyer contract without email to both correct destinations', async ({
  page,
}) => {
  const received: Record<string, unknown>[] = []
  for (const url of [CRM, NIRA])
    await page.route(url, async (r) => {
      received.push(r.request().postDataJSON())
      await r.fulfill({ json: { ok: true } })
    })
  await page.goto('/encuentra-tu-camper.html?utm_source=meta&utm_campaign=compra')
  await fill(page)
  await page.locator('button[type=submit]').click()
  await expect(page.locator('#cn-done h3')).toHaveText('¡Recibido!')
  expect(received).toHaveLength(2)
  expect(received.filter((p) => p.gdpr_consent === true)).toHaveLength(1)
  const answers = received.map((p) => p.respuestas as Record<string, string>)
  expect(answers[0].event_id).toBe(answers[1].event_id)
  expect(answers[0].pagina).toBe('/encuentra-tu-camper.html')
  expect(answers[0].origen).toContain('utm_campaign=compra')
  expect(answers[0].email).toBeUndefined()
  expect(
    (received.find((p) => p.gdpr_consent === true)?.respuestas as Record<string, unknown>)
      .atribucion
  ).toEqual({ utm_source: 'meta', utm_campaign: 'compra' })
  expect(
    (received.find((p) => p.gdpr_consent !== true)?.respuestas as Record<string, unknown>)
      .atribucion
  ).toBeUndefined()
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
    let crm: Record<string, unknown> | undefined
    let nira: Record<string, unknown> | undefined
    await page.route(CRM, async (r) => {
      crm = r.request().postDataJSON()
      await r.fulfill({ json: { ok: true } })
    })
    await page.route(NIRA, async (r) => {
      nira = r.request().postDataJSON()
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
    await page.goto('/encuentra-tu-camper.html' + next)
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
    const niraAnswers = nira?.respuestas as Record<string, unknown>
    expect(niraAnswers.atribucion).toBeUndefined()
    expect(Object.values(niraAnswers).every((v) => typeof v === 'string')).toBe(true)
  })
}
for (const failed of ['crm', 'nira'])
  test(`retries only unconfirmed buyer ${failed}`, async ({ page }) => {
    const calls = { crm: 0, nira: 0 }
    for (const [name, url] of [
      ['crm', CRM],
      ['nira', NIRA],
    ] as const)
      await page.route(url, async (r) => {
        calls[name]++
        await r.fulfill({
          status: name === failed && calls[name] === 1 ? 503 : 200,
          json: { ok: !(name === failed && calls[name] === 1) },
        })
      })
    await page.goto('/encuentra-tu-camper.html')
    await fill(page)
    await page.locator('button[type=submit]').click()
    await expect(page.locator('#cn-done h3')).toHaveText('Falta completar el envío')
    await expect(page.locator('#cn-wa')).toHaveAttribute('href', /wa\.me\/34645639185\?text=/)
    await page.locator('#cn-retry').click()
    await expect(page.locator('#cn-done h3')).toHaveText('¡Recibido!')
    expect(calls[failed as 'crm' | 'nira']).toBe(2)
    expect(calls[failed === 'crm' ? 'nira' : 'crm']).toBe(1)
  })
