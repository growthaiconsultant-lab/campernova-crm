import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'
async function load(page: Page, query = '') {
  await page.route('https://crm.example.test/comprador*', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>',
    })
  )
  await page.goto('https://crm.example.test/comprador' + query)
  await page.addStyleTag({ path: path.resolve('.artifacts/buyer-followup/style.css') })
  await page.addScriptTag({ path: path.resolve('.artifacts/buyer-followup/postventa.js') })
}
test('permite consultar la solución y la garantía ampliada desde la ficha', async ({ page }) => {
  await load(page)
  await expect(page.getByRole('heading', { name: 'Requiere atención (2)' })).toBeVisible()
  await expect(page.getByText('Correo de los 7 días · Envío fallido')).toBeVisible()
  const ticket = page.locator('summary').filter({ hasText: 'Pendiente de cierre' })
  await expect(ticket).toContainText('Plazo vencido')
  await ticket.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText(/Solución registrada · Cierre ajustado/)).toBeVisible()
  await page.locator('summary').filter({ hasText: 'Entrega y garantía' }).click()
  await expect(page.getByText(/Ampliada hasta el/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Abrir expediente de postventa' })).toHaveAttribute(
    'href',
    '/postventa/garantia-qa'
  )
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
test('todo al día con envío automático futuro y respuesta archivada', async ({ page }) => {
  await load(page, '?al-dia')
  await expect(page.getByRole('heading', { name: 'Todo al día' })).toBeVisible()
  await expect(page.getByText('Correo de los 30 días', { exact: true })).toBeVisible()
  await expect(page.getByText('Primer viaje completado')).toBeHidden()
  await page.locator('summary').filter({ hasText: 'Historial de postventa' }).click()
  await expect(page.getByText('Primer viaje completado')).toBeVisible()
  await expect(page.getByText('Correo de los 7 días · Enviado')).toBeVisible()
})
