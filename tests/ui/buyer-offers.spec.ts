import { test, expect } from '@playwright/test'
import path from 'node:path'
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-10T12:00:00Z') })
  await page.setContent(
    '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>'
  )
  await page.addStyleTag({ path: path.resolve('.artifacts/buyer-followup/style.css') })
  await page.addScriptTag({ path: path.resolve('.artifacts/buyer-followup/offers.js') })
})
test('clasifica y abre reservas, ofertas e historial al seguir enlaces anteriores', async ({
  page,
}) => {
  const reserves = page.getByRole('region', { name: 'Reservas', exact: true })
  await expect(reserves.locator('article')).toHaveCount(3)
  await expect(reserves.locator('article').first()).toContainText('Plazo vencido · revisar')
  await expect(reserves.locator('article').nth(1)).toContainText('Vence hoy')
  await expect(reserves.locator('article').last()).toContainText('Sin fecha acordada')
  await expect(page.getByText('Aceptada sin señal', { exact: false })).toBeVisible()
  await expect(page.getByText('Condiciones originales')).toBeHidden()
  await page.getByRole('link', { name: 'Abrir operación anterior' }).click()
  await expect(page.getByText('Condiciones originales')).toBeVisible()
  await expect(page.locator('#oferta-closed')).toContainText('3 nov 2026')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
test('registra y acepta una oferta con céntimos, conservando la señal y el plazo tras un error', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Registrar oferta', exact: true }).click()
  await page.getByLabel('Vehículo', { exact: true }).selectOption('v')
  await page.getByLabel('Importe ofertado (€)').fill('42100.75')
  await page.getByLabel('Notas de la oferta').fill('Nota de prueba')
  await page.getByRole('button', { name: 'Registrar', exact: true }).click()
  const added = page.locator('#oferta-created')
  await expect(added).toContainText('42.100,75')
  await added.locator('summary').click()
  await expect(added.getByText('Nota de prueba')).toBeVisible()
  await added.getByRole('button', { name: 'Aceptada', exact: true }).click()
  await added.getByLabel('Señal (€)').fill('1')
  await added.getByLabel('Reservado hasta').fill('2026-12-03')
  await added.getByRole('button', { name: 'Aceptar', exact: true }).click()
  await expect(added.getByRole('alert')).toBeVisible()
  await expect(added.getByLabel('Reservado hasta')).toHaveValue('2026-12-03')
  await added.getByLabel('Señal (€)').fill('1500.50')
  await added.getByRole('button', { name: 'Aceptar', exact: true }).click()
  const reserved = page
    .getByRole('region', { name: 'Reservas', exact: true })
    .locator('#oferta-created')
  await expect(reserved).toContainText(/1\.?500,50/)
  await expect(reserved.locator('time').first()).toHaveAttribute(
    'datetime',
    '2026-12-03T00:00:00.000Z'
  )
  await expect(page.locator('#oferta-created')).toHaveCount(1)
})
