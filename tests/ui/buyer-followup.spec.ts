import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'

test.beforeEach(async ({ page }) => {
  await page.route('http://localhost/seguimiento', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div></body></html>',
    })
  )
  await page.goto('http://localhost/seguimiento')
  await page.addStyleTag({ path: path.resolve('.artifacts/buyer-followup/style.css') })
  await page.addStyleTag({
    content: ':root { --font-crm: Arial; --font-inter: Arial; --font-hanken: Arial; }',
  })
  await page.addScriptTag({ path: path.resolve('.artifacts/buyer-followup/app.js') })
})

test('guarda el resultado y el siguiente paso desde el mismo formulario y permite reintentar', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Registrar llamada' }).click()
  const outcome = page.getByLabel('¿Qué ha pasado en la llamada?')
  await outcome.fill('Ha pedido dos opciones.')
  await page.getByLabel('Siguiente paso', { exact: true }).selectOption('ENVIAR_VEHICULOS')
  await page.getByLabel('Fecha y hora').fill('2027-01-15T16:30')
  await page.evaluate(() => {
    window.followupHarness.mode = 'error'
  })
  const save = page.getByRole('button', { name: 'Guardar seguimiento' })
  await save.click()
  await expect(page.getByRole('alert')).toContainText('Error de conexión')
  await expect(outcome).toHaveValue('Ha pedido dos opciones.')
  await page.evaluate(() => {
    window.followupHarness.mode = 'ok'
  })
  await save.click()
  await expect(page.getByRole('status')).toContainText('siguiente paso programado')
  const calls = await page.evaluate(() => window.followupHarness.calls)
  expect(calls).toHaveLength(2)
  expect(calls[0]).toEqual(calls[1])
  expect(calls[1].next).toEqual({ action: 'ENVIAR_VEHICULOS', startAt: '2027-01-15T15:30:00.000Z' })
})

async function fillAction(page: Page, type = 'LLAMAR', date = '2026-10-22') {
  await page.getByRole('button', { name: 'Programar acción' }).click()
  await page.getByLabel('Tipo de acción').selectOption(type)
  await page.getByLabel('Día', { exact: true }).fill(date)
  await page.getByLabel('Hora', { exact: true }).fill('17:30')
  await page.getByLabel('Nota para esta acción').fill('Hablar sobre la financiación')
}

test('anota una conversación y conserva autor e historial humano', async ({ page }) => {
  await expect(page.getByText('Marta (ejemplo)')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Guardar nota' })).toBeDisabled()
  await page
    .getByLabel('Añadir una nota')
    .fill('Hoy hemos hablado; le encaja la camper azul.\nLlamar después de las cinco.')
  await page.getByRole('button', { name: 'Guardar nota' }).click()
  await expect(page.getByRole('status')).toContainText('Nota guardada')
  await expect(page.getByText('Hoy hemos hablado;', { exact: false })).toBeVisible()
  await expect(page.getByText('Comercial de prueba')).toBeVisible()
  await expect(page.getByLabel('Añadir una nota')).toHaveValue('')
  await expect(page.getByText('Marta (ejemplo)')).toBeVisible()
})

test('permite escribir y guardar una nota sólo con el teclado', async ({ page }) => {
  await page.getByLabel('Añadir una nota').focus()
  await page.keyboard.insertText('Seguimiento registrado con teclado')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Guardar nota' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status')).toContainText('Nota guardada')
  await expect(page.getByText('Seguimiento registrado con teclado')).toBeVisible()
})

test('programa dos acciones sin reemplazar la primera y guarda hora y notas', async ({ page }) => {
  await fillAction(page)
  await page.screenshot({
    path: test.info().outputPath('form.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Guardar acción' }).click()
  await expect(page.getByRole('status')).toContainText('Acción programada')
  await fillAction(page, 'WHATSAPP', '2026-10-23')
  await page.getByRole('button', { name: 'Guardar acción' }).click()
  await expect(page.getByRole('link', { name: 'Ver / gestionar' })).toHaveCount(2)
  const calls = await page.evaluate(() => window.followupHarness.actionCalls)
  expect(calls[0]).toMatchObject({
    type: 'LLAMADA',
    buyerLeadId: 'buyer-1',
    description: 'Hablar sobre la financiación',
    startAt: '2026-10-22T15:30:00.000Z',
  })
  expect(calls[1]).toMatchObject({ type: 'OTRO', specificData: { buyer_action_type: 'WHATSAPP' } })
  await page.screenshot({
    path: test.info().outputPath('saved.png'),
    fullPage: true,
  })
})

test('conserva datos ante error de servidor o de red y permite reintentar', async ({ page }) => {
  await page.evaluate(() => {
    window.followupHarness.mode = 'error'
  })
  await fillAction(page)
  await page.getByRole('button', { name: 'Guardar acción' }).click()
  await expect(page.getByRole('alert')).toContainText('archivado')
  await expect(page.getByLabel('Día', { exact: true })).toHaveValue('2026-10-22')
  await page.evaluate(() => {
    window.followupHarness.mode = 'throw'
  })
  await page.getByLabel('Añadir una nota').fill('No perder este texto')
  await page.getByRole('button', { name: 'Guardar nota' }).click()
  await expect(page.getByText('No se ha podido guardar la nota.', { exact: false })).toBeVisible()
  await expect(page.getByLabel('Añadir una nota')).toHaveValue('No perder este texto')
  await page.evaluate(() => {
    window.followupHarness.mode = 'ok'
  })
  await page.getByRole('button', { name: 'Guardar nota' }).click()
  await expect(page.getByRole('status')).toContainText('Nota guardada')
})

test('obliga a indicar día y hora; bloquea doble envío y no desborda en móvil', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Programar acción' }).click()
  await page.getByRole('button', { name: 'Guardar acción' }).click()
  expect(await page.evaluate(() => window.followupHarness.actionCalls.length)).toBe(0)
  await page.getByLabel('Día', { exact: true }).fill('2026-10-22')
  await page.getByLabel('Hora', { exact: true }).fill('10:00')
  await page
    .getByRole('button', { name: 'Guardar acción' })
    .evaluate((button: HTMLButtonElement) => {
      button.click()
      button.click()
    })
  await expect(page.getByRole('status')).toContainText('Acción programada')
  expect(await page.evaluate(() => window.followupHarness.actionCalls.length)).toBe(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  )
})
