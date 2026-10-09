import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'
const tag = readFileSync('docs/analytics/gtm-meta-base.html', 'utf8').match(
  /<script>([\s\S]*?)<\/script>/
)![1]
async function intercept(page: Page, delay?: Promise<void>) {
  const requests = { gtm: 0, meta: 0 }
  await page.route('https://www.googletagmanager.com/gtm.js**', async (r) => {
    requests.gtm++
    if (delay) await delay
    await r.fulfill({ contentType: 'application/javascript', body: tag })
  })
  await page.route('https://connect.facebook.net/**', async (r) => {
    requests.meta++
    await r.fulfill({
      contentType: 'application/javascript',
      body: `window.__metaCalls=window.fbq.queue.map(function(a){return Array.from(a)});window.fbq.callMethod=function(){window.__metaCalls.push(Array.from(arguments))};`,
    })
  })
  await page.route('https://www.facebook.com/**', (r) => r.abort())
  return requests
}
async function calls(page: Page, event: string) {
  return page.evaluate(
    (event) =>
      ((window as unknown as { __metaCalls?: unknown[][] }).__metaCalls || []).filter(
        (c) => c[0] === 'track' && c[1] === event
      ),
    event
  )
}
async function fill(page: Page, slug: string) {
  for (const name of slug === 'vende-tu-camper' ? ['tipo'] : ['tipo', 'plazas', 'presupuesto']) {
    await page
      .locator('.opts label')
      .filter({ has: page.locator(`[name=${name}]`) })
      .first()
      .click()
  }
  if (slug === 'vende-tu-camper') {
    await page.locator('[name=modelo]').fill('Camper de prueba')
    await page.locator('[name=anio]').fill('2020')
    await page.locator('[name=km]').fill('50000')
  }
  await page.locator('[data-ir="1"]').click()
  const name = slug === 'vende-tu-camper' ? 'prioridad' : 'cuando'
  await page
    .locator('.opts label')
    .filter({ has: page.locator(`[name=${name}]`) })
    .first()
    .click()
  await page.locator('[name=nombre]').fill('QA - NO CONTACTAR')
  await page.locator('[name=telefono]').fill('600000000')
  await page.locator('[name=acepto]').check()
}
for (const slug of ['vende-tu-camper', 'encuentra-tu-camper']) {
  for (const extension of ['', '.html']) {
    test(`public ${slug}${extension} preserves UTM and gates tracking`, async ({ page }) => {
      const requests = await intercept(page)
      const response = await page.goto(`/${slug}${extension}?utm_source=instagram&utm_campaign=qa`)
      expect(response!.status()).toBe(200)
      expect(page.url()).toContain(`/${slug}${extension}?utm_source=instagram`)
      await expect(page.locator('#cn-cookies')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      )
      expect(requests).toEqual({ gtm: 0, meta: 0 })
      await page.locator('[data-consent=no]').click()
      await expect(page.locator('#cn-cookies')).toBeHidden()
      await page.reload()
      await expect(page.locator('#cn-form')).toBeVisible()
      expect(requests).toEqual({ gtm: 0, meta: 0 })
      await page.evaluate(() => localStorage.removeItem('cn_cookie_consent'))
      await page.reload()
      await page.locator('[data-consent=si]').click()
      await expect.poll(async () => (await calls(page, 'PageView')).length).toBe(1)
      expect(requests).toEqual({ gtm: 1, meta: 1 })
      expect(await page.evaluate(() => localStorage.getItem('cn_cookie_consent'))).toBe('all')
      await page.evaluate(() => window.CNConsent!.set('all'))
      expect((await calls(page, 'PageView')).length).toBe(1)
    })
  }
  test(`clean ${slug} keeps canonical form contract and deduplicates Lead/Contact`, async ({
    page,
  }) => {
    const requests = await intercept(page)
    await page.addInitScript(() => localStorage.setItem('cn_cookie_consent', 'all'))
    const bodies: Record<string, unknown>[] = []
    let crmCount = 0
    await page.route(`**/api/landing/${slug}`, async (r) => {
      crmCount++
      bodies.push(r.request().postDataJSON())
      await r.fulfill({ status: crmCount === 1 ? 503 : 200, json: { ok: crmCount !== 1 } })
    })
    await page.route('https://docs.niraagency.com/api/formulario/**', async (r) => {
      bodies.push(r.request().postDataJSON())
      await r.fulfill({ json: { ok: true } })
    })
    await page.goto(`/${slug}?utm_source=instagram&utm_campaign=qa_tracking&ad_id=qa_ad`)
    await expect.poll(async () => (await calls(page, 'PageView')).length).toBe(1)
    await fill(page, slug)
    await page.locator('button[type=submit]').click()
    await expect(page.locator('#cn-done h3')).toHaveText('Falta completar el envío')
    await expect.poll(async () => (await calls(page, 'Lead')).length).toBe(1)
    await page.locator('#cn-retry').click()
    await expect(page.locator('#cn-done h3')).toHaveText('¡Recibido!')
    expect((await calls(page, 'Lead')).length).toBe(1)
    const answers = bodies.map((b) => b.respuestas as Record<string, unknown>)
    expect(answers.every((a) => a.pagina === `/${slug}.html`)).toBe(true)
    const crm = bodies.find((b) => b.gdpr_consent === true)!
    expect((crm.respuestas as Record<string, unknown>).atribucion).toEqual({
      utm_source: 'instagram',
      utm_campaign: 'qa_tracking',
      ad_id: 'qa_ad',
    })
    expect((await calls(page, 'Lead'))[0][3]).toEqual({ eventID: answers[0].event_id })
    expect(JSON.stringify(await calls(page, 'Lead'))).not.toContain('600000000')
    await page.evaluate(() =>
      document.addEventListener('click', (e) => {
        if ((e.target as Element).closest('a[href*="wa.me"]')) e.preventDefault()
      })
    )
    await page.locator('#cn-wa').click()
    expect((await calls(page, 'Contact')).length).toBe(1)
    expect(requests).toEqual({ gtm: 1, meta: 1 })
  })
}
test('queues a consented Lead until the GTM pixel is ready without duplication', async ({
  page,
}) => {
  let release!: () => void
  const wait = new Promise<void>((resolve) => {
    release = resolve
  })
  await intercept(page, wait)
  await page.addInitScript(() => localStorage.setItem('cn_cookie_consent', 'all'))
  for (const url of [
    '**/api/landing/encuentra-tu-camper',
    'https://docs.niraagency.com/api/formulario/**',
  ])
    await page.route(url, (r) => r.fulfill({ json: { ok: true } }))
  await page.goto('/encuentra-tu-camper', { waitUntil: 'domcontentloaded' })
  await fill(page, 'encuentra-tu-camper')
  await page.locator('button[type=submit]').click()
  await expect(page.locator('#cn-done h3')).toHaveText('¡Recibido!')
  expect(await calls(page, 'Lead')).toHaveLength(0)
  release()
  await expect.poll(async () => (await calls(page, 'Lead')).length).toBe(1)
  expect(await calls(page, 'PageView')).toHaveLength(1)
})
test('explicit consent works with blocked localStorage and revocation stops Meta tracking', async ({
  page,
}) => {
  const requests = await intercept(page)
  await page.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw Error('blocked')
      },
    })
  )
  await page.goto('/encuentra-tu-camper')
  await expect(page.locator('#cn-cookies')).toBeVisible()
  expect(requests.gtm).toBe(0)
  await page.locator('[data-consent=si]').click()
  await expect.poll(async () => (await calls(page, 'PageView')).length).toBe(1)
  await page.evaluate(() => window.CNConsent!.set('essential'))
  expect(
    await page.evaluate(() =>
      window.CNConsent!.trackMeta('track', 'Contact', { content_name: 'qa' })
    )
  ).toBe(false)
  expect(await calls(page, 'Contact')).toHaveLength(0)
})
test('Next public pages use the same consent and GTM loader', async ({ page }) => {
  const requests = await intercept(page)
  await page.goto('/cookies')
  const banner = page.getByRole('dialog', { name: 'Aviso de cookies' })
  await expect(banner).toBeVisible()
  expect(requests).toEqual({ gtm: 0, meta: 0 })
  await page.getByRole('button', { name: 'Aceptar todas', exact: true }).click()
  await expect.poll(async () => (await calls(page, 'PageView')).length).toBe(1)
  expect(requests).toEqual({ gtm: 1, meta: 1 })
  await page.goto('/vende-tu-camper')
  await expect(page.locator('#cn-cookies')).toBeHidden()
  await expect.poll(async () => (await calls(page, 'PageView')).length).toBe(1)
  expect(requests).toEqual({ gtm: 2, meta: 2 })
})
