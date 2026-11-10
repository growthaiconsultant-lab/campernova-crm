import { test, expect } from '@playwright/test'
import path from 'node:path'

test('compara criterios, conserva la selección y permite retomar un vehículo fuera de presupuesto', async ({
  page,
}) => {
  await page.setContent(
    '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>'
  )
  await page.addStyleTag({ path: path.resolve('.artifacts/buyer-followup/style.css') })
  await page.addScriptTag({ path: path.resolve('.artifacts/buyer-followup/stock.js') })
  const fits = page.getByRole('button', { name: /Encajan.*2/ })
  await expect(fits).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('listitem').first()).toContainText('Camper Preferida')
  await page.getByRole('listitem').first().getByText('Ver criterios').click()
  await expect(page.getByRole('listitem').first().getByText('Zona · Madrid')).toBeVisible()
  await page.getByRole('button', { name: /Falta comprobar.*1/ }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Falta confirmar: Plazas para viajar ≥ 4.')).toBeVisible()
  await page.getByRole('button', { name: 'Añadir a vehículos de interés' }).click()
  await expect(page.getByRole('link', { name: 'Ver seguimiento' })).toHaveAttribute(
    'href',
    '#interes-pendiente'
  )
  await page.getByRole('button', { name: /Fuera de criterios.*1/ }).click()
  await expect(page.getByText(/Supera el presupuesto en 3\.?500/)).toBeVisible()
  const tracked = page.getByRole('link', { name: 'Ver seguimiento' })
  await expect(tracked).toHaveAttribute('href', '#interes-cara')
  await tracked.click()
  await expect(page).toHaveURL(/#interes-cara$/)
  await page
    .locator('#interes-cara')
    .getByRole('link', { name: /^Reserva/ })
    .click()
  await expect(page).toHaveURL(/#oferta-reserve$/)
  await expect(page.locator('#oferta-reserve')).toContainText('Señal registrada')
  await expect(page.locator('#oferta-reserve')).toContainText('reserva hasta')
  await expect(page.getByRole('button', { name: 'Añadir a vehículos de interés' })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  )
})
for (const [scenario, message] of [
  ['sin-stock', 'Todavía no hay vehículos disponibles para comparar.'],
  ['sin-criterios', 'Añade criterios en Qué busca'],
]) {
  test(`mantiene el seguimiento con ${scenario}`, async ({ page }) => {
    await page.setContent(`<body data-scenario="${scenario}"><div id="root"></div></body>`)
    await page.addScriptTag({ path: path.resolve('.artifacts/buyer-followup/stock.js') })
    await expect(page.getByText(message)).toBeVisible()
    await expect(page.getByRole('group', { name: 'Filtrar por encaje' })).toHaveCount(0)
    await expect(
      page.locator('#interes-cara').getByRole('link', { name: /^Reserva/ })
    ).toBeVisible()
  })
}
