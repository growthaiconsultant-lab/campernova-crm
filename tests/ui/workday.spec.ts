import { test, expect } from '@playwright/test'
import path from 'node:path'

test.beforeEach(async ({ page }) => {
  await page.route('http://inicio.test/dashboard**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/workday.js"></script>',
    })
  )
  for (const asset of ['style.css', 'workday.js'])
    await page.route('http://inicio.test/' + asset, (route) =>
      route.fulfill({ path: path.resolve('.artifacts/buyer-followup', asset) })
    )
})

test('alterna los bloques de administración y abre el resto de pendientes en la misma pantalla', async ({
  page,
}) => {
  await page.goto('http://inicio.test/dashboard')
  const tasks = page.getByRole('region', { name: /Por hacer/ })
  await expect(tasks.getByRole('link')).toHaveCount(6)
  await tasks.getByText('Ver 2 más').click()
  await expect(tasks.getByRole('link')).toHaveCount(8)
  await expect(tasks.getByRole('link').last()).toHaveAttribute(
    'href',
    '/compradores/b7?tab=ficha#seguimiento'
  )
  await expect(page.getByRole('link', { name: /Visita a la exposición/ })).toHaveAttribute(
    'href',
    '/calendario/cita'
  )
  await page.getByRole('link', { name: 'Mi trabajo', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Mi trabajo' })).toBeVisible()
  await expect(tasks.getByRole('link')).toHaveCount(1)
  await expect(page.getByText('Sin citas programadas para hoy.')).toBeVisible()
  await expect(page.getByRole('link', { name: /Abrir calendario/ })).toHaveAttribute(
    'href',
    '/calendario?view=day&assignee=actor'
  )
  await page.getByRole('link', { name: 'El día del equipo' }).click()
  await expect(page.getByRole('heading', { name: 'El día del equipo' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('el comercial entra en Mi día y solo tiene controles personales', async ({ page }) => {
  await page.goto('http://inicio.test/dashboard?comercial=1')
  await expect(page.getByRole('heading', { name: 'Mi día' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Ámbito del inicio' })).toHaveCount(0)
  await expect(page.getByRole('combobox')).toHaveCount(0)
})

test('Responsable mantiene el tema del CRM al abrir y permite seleccionar con teclado', async ({
  page,
}) => {
  await page.goto('http://inicio.test/dashboard')
  const field = page.getByRole('combobox', { name: 'Responsable' })
  await field.focus()
  await field.press('Enter')
  const popup = page.getByRole('listbox')
  await expect(popup).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  const selected = popup.getByRole('option', { name: 'Todo el equipo' })
  await expect(selected).toHaveCSS('color', 'rgb(11, 95, 82)')
  await page.keyboard.press('ArrowDown')
  await expect(popup.getByRole('option', { name: 'Admin', exact: true })).toBeFocused()
  await expect(selected).toHaveAttribute('data-state', 'checked')
  await page.keyboard.press('End')
  await expect(popup.getByRole('option', { name: 'Vera', exact: true })).toBeFocused()
  await expect(popup.getByRole('option', { name: 'Vera', exact: true })).toBeInViewport()
  await page.keyboard.press('Escape')
  await expect(field).toBeFocused()
  await field.click()
  await popup.getByRole('option', { name: 'Admin', exact: true }).click()
  await expect(page).toHaveURL(/agent=actor/)
  await expect(field).toHaveText('Admin')
})
