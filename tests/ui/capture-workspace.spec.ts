import { test, expect } from '@playwright/test'
import path from 'node:path'
test.beforeEach(async ({ page }) => {
  await page.route('http://capture.test/**', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>',
    })
  )
  await page.goto('http://capture.test/captaciones')
  await page.addStyleTag({ path: path.resolve('.artifacts/buyer-followup/style.css') })
  await page.addScriptTag({ path: path.resolve('.artifacts/buyer-followup/captures.js') })
})
test('separa los estados, filtra y muestra el siguiente paso correcto', async ({ page }) => {
  await expect(page.locator('header').getByText('Captaciones', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Abiertas 2' })).toHaveAttribute(
    'aria-current',
    'page'
  )
  const first = page.getByRole('article', { name: 'Ford prueba' })
  await expect(first.getByRole('link', { name: 'Contactar desde el anuncio' })).toHaveAttribute(
    'href',
    'https://example.test/anuncio'
  )
  await page.getByRole('combobox', { name: 'Responsable', exact: true }).selectOption('sin-asignar')
  await expect(first).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Portal', exact: true }).selectOption('COCHES_NET')
  const card = page.getByRole('article', { name: 'Camper en seguimiento' })
  await card.getByRole('button', { name: 'Agendar entrada' }).click()
  await card.getByLabel('Fecha y hora de entrada').fill('2027-01-15T12:00')
  await card.getByRole('button', { name: 'Agendar entrada' }).click()
  await expect(card.getByRole('button', { name: 'Crear ficha de vendedor' })).toBeVisible()
  await page.getByRole('button', { name: 'Limpiar filtros' }).click()
  await page.getByRole('link', { name: 'Convertidas 1' }).click()
  await expect(page.getByRole('article')).toHaveCount(1)
  await expect(page.getByRole('link', { name: 'Ver ficha del vendedor' })).toHaveAttribute(
    'href',
    '/vendedores/seller-demo'
  )
  await page.getByRole('link', { name: 'Rechazadas 1' }).click()
  await expect(page.getByText('Sin acción pendiente.')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
test('abre el alta bajo demanda y permite revisar una captación duplicada sin crear otra', async ({
  page,
}) => {
  await page.getByRole('link', { name: 'Rechazadas 1' }).click()
  await page.getByRole('button', { name: 'Nueva captación' }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel('Teléfono').fill('600111111')
  await form.getByRole('button', { name: 'Guardar captación' }).click()
  await form.getByRole('button', { name: 'Ver captación', exact: true }).click()
  await expect(form).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Abiertas 2' })).toHaveAttribute(
    'aria-current',
    'page'
  )
  await expect(page.getByRole('article', { name: 'Ford prueba' })).toBeVisible()
  await page.getByRole('button', { name: 'Nueva captación' }).click()
  await form.getByLabel('Modelo').fill('Alta de prueba')
  await form.getByRole('button', { name: 'Guardar captación' }).click()
  await expect(page.getByRole('article', { name: 'Alta de prueba' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Abiertas 3' })).toHaveAttribute(
    'aria-current',
    'page'
  )
})
