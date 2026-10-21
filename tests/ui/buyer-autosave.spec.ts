import { test, expect } from '@playwright/test'
import path from 'node:path'

test.beforeEach(async ({ page }) => {
  await page.route('https://crm.test/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div></body></html>',
    })
  )
  await page.goto('https://crm.test/compradores/example')
  await page.addStyleTag({ path: path.resolve('.artifacts/buyer-followup/style.css') })
  await page.addStyleTag({
    content: ':root { --font-crm: Arial; --font-inter: Arial; --font-hanken: Arial; }',
  })
  await page.addScriptTag({ path: path.resolve('.artifacts/buyer-followup/autosave.js') })
})

test('guarda números, texto, casillas y desplegables automáticamente', async ({ page }) => {
  await expect(page.getByRole('status')).toHaveText('Los cambios se guardan automáticamente')
  expect(await page.evaluate(() => window.autosaveHarness.calls.length)).toBe(0)
  await page.getByLabel('Presupuesto máximo', { exact: true }).fill('65000')
  await page.getByLabel('Zona preferida', { exact: true }).fill('Costa')
  await page.getByLabel('Placas solares', { exact: true }).check({ force: true })
  await page.getByLabel('Tipo buscado', { exact: true }).click()
  await page.getByRole('option', { name: 'Autocaravana', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Guardado')
  expect(await page.evaluate(() => window.autosaveHarness.persisted)).toMatchObject({
    maxBudget: 65000,
    useZone: 'Costa',
    vehicleType: 'AUTOCARAVANA',
    criticalEquipment: { solar: true },
  })
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: test.info().outputPath('autosave.png'), fullPage: true })
})

test('activa aviso de salida sólo mientras hay cambios pendientes', async ({ page }) => {
  const guarded = () =>
    page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    })
  expect(await guarded()).toBe(false)
  await page.getByLabel('Zona preferida', { exact: true }).fill('Costa')
  expect(await guarded()).toBe(true)
  await expect(page.getByRole('status')).toHaveText('Guardado')
  expect(await guarded()).toBe(false)
})

test('no borra lo escrito durante una petición lenta', async ({ page }) => {
  await page.evaluate(() => {
    window.autosaveHarness.delay = 1400
  })
  const zone = page.getByLabel('Zona preferida', { exact: true })
  await zone.fill('Costa')
  await expect(page.getByRole('status')).toHaveText('Guardando…')
  await zone.fill('Montaña y costa')
  await expect(page.getByRole('status')).toHaveText('Guardado', { timeout: 7000 })
  await expect(zone).toHaveValue('Montaña y costa')
  expect(await page.evaluate(() => window.autosaveHarness.persisted.useZone)).toBe(
    'Montaña y costa'
  )
  expect(await page.evaluate(() => window.autosaveHarness.calls.length)).toBe(2)
})

test('conserva cambios ante error y reintenta', async ({ page }) => {
  await page.evaluate(() => {
    window.autosaveHarness.mode = 'throw'
  })
  await page.getByLabel('Zona preferida', { exact: true }).fill('Costa')
  await expect(page.getByRole('alert')).toContainText('Comprueba la conexión')
  await expect(page.getByLabel('Zona preferida', { exact: true })).toHaveValue('Costa')
  await page.evaluate(() => {
    window.autosaveHarness.mode = 'ok'
  })
  await page.getByRole('button', { name: 'Reintentar guardado' }).click()
  await expect(page.getByRole('status')).toHaveText('Guardado')
  expect(await page.evaluate(() => window.autosaveHarness.persisted.useZone)).toBe('Costa')
})

test('valida sin enviar datos incorrectos y guarda tras corregir', async ({ page }) => {
  await page.getByLabel('Presupuesto máximo', { exact: true }).fill('-1')
  await expect(page.getByRole('alert')).toContainText('Revisa los campos')
  expect(await page.evaluate(() => window.autosaveHarness.calls.length)).toBe(0)
  await page.getByLabel('Presupuesto máximo', { exact: true }).fill('60000')
  await expect(page.getByRole('status')).toHaveText('Guardado')
})

test('espera el guardado al salir por enlace y bloquea salida ante fallo', async ({ page }) => {
  await page.evaluate(() => {
    window.autosaveHarness.mode = 'error'
  })
  await page.getByLabel('Zona preferida', { exact: true }).fill('Costa')
  await page.getByRole('link', { name: 'Volver a compradores' }).click()
  await expect(page.getByRole('alert')).toContainText('Error de prueba')
  expect(await page.evaluate(() => window.autosaveHarness.destination)).toBeNull()
  await page.evaluate(() => {
    window.autosaveHarness.mode = 'ok'
  })
  await page.getByRole('link', { name: 'Volver a compradores' }).click()
  await expect
    .poll(() => page.evaluate(() => window.autosaveHarness.destination))
    .toBe('/compradores')
  expect(await page.evaluate(() => window.autosaveHarness.persisted.useZone)).toBe('Costa')
})
