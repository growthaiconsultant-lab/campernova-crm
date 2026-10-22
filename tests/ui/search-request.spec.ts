import { test, expect } from '@playwright/test'
import path from 'node:path'

test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div></body></html>'
  )
  await page.addStyleTag({ path: path.resolve('.artifacts/buyer-followup/style.css') })
  await page.addStyleTag({
    content: ':root { --font-crm: Arial; --font-inter: Arial; --font-hanken: Arial; }',
  })
})

test('identifica la solicitud y presenta importes, fechas y respuestas por apartados', async ({
  page,
}) => {
  await page.addScriptTag({ path: path.resolve('.artifacts/buyer-followup/searchRequest.js') })
  await expect(page.getByText('Solicitud bajo pedido', { exact: true })).toHaveCount(1)
  await expect(page.getByLabel('Otro comprador')).toBeEmpty()
  await expect(page.getByRole('heading', { name: 'Ficha de búsqueda bajo pedido' })).toBeVisible()
  await expect(page.getByText('25.000 €', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('35.000 €', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('24/12/2026', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Cama fija sin montar el salón', { exact: true })).toBeVisible()
  await expect(page.getByText('1,95 m', { exact: true })).toBeVisible()
  await expect(page.getByText('0', { exact: true })).toBeVisible()
  await expect(page.getByText('Sin indicar', { exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  )
  await page.screenshot({ path: test.info().outputPath('ficha-bajo-pedido.png'), fullPage: true })
})

test('permite desplegar vacíos y el original completo con teclado', async ({ page }) => {
  await page.addScriptTag({ path: path.resolve('.artifacts/buyer-followup/searchRequest.js') })
  const empty = page.locator('summary').filter({ hasText: /^Apartados sin respuestas/ })
  await empty.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Calefacción en la vivienda', { exact: true })).toBeVisible()
  const original = page.getByText('Ver ficha original completa', { exact: true })
  await original.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('FICHA DE BÚSQUEDA WEB ·', { exact: false })).toBeVisible()
})

test('conserva el texto original ante formatos no reconocidos y escapa HTML', async ({ page }) => {
  await page.locator('html').evaluate((el) => {
    el.dataset.snapshotMode = 'legacy'
  })
  await page.addScriptTag({ path: path.resolve('.artifacts/buyer-followup/searchRequest.js') })
  await expect(page.getByText('Formato antiguo', { exact: false })).toBeVisible()
  await expect(page.getByText('<img src=x', { exact: false })).toBeVisible()
  await expect(page.locator('img')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'snapshotExecuted'))).toBeUndefined()
})
