import { test, expect } from '@playwright/test'
import path from 'node:path'
test('adjunta el permiso y la foto a sus destinos y conserva el inventario anterior y el aviso', async ({
  page,
}) => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGPMqyhmwAaYsIoOWgkAEegBaf7tR40AAAAASUVORK5CYII=',
    'base64'
  )
  await page.route('https://crm.example.test/**', (r) =>
    r.request().resourceType() === 'document'
      ? r.fulfill({
          contentType: 'text/html',
          body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>',
        })
      : r.fulfill({ contentType: 'image/png', body: png })
  )
  await page.goto('https://crm.example.test/vendedores/qa')
  await page.addStyleTag({ path: path.resolve('.artifacts/buyer-followup/style.css') })
  await page.addScriptTag({ path: path.resolve('.artifacts/buyer-followup/sellerPreparation.js') })
  await expect(
    page.getByRole('heading', { name: 'Quedan 2 pendientes para publicar' })
  ).toBeVisible()
  const permitChooser = page.waitForEvent('filechooser')
  await page.getByRole('link', { name: 'Adjuntar permiso' }).press('Enter')
  await (
    await permitChooser
  ).setFiles({
    name: 'permiso.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 Ejemplo'),
  })
  await expect(page.getByText('Archivo anterior FICHA_TECNICA.pdf')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Queda 1 pendiente para publicar' })).toBeVisible()
  const photoChooser = page.waitForEvent('filechooser')
  await page.getByRole('link', { name: 'Añadir fotos' }).click()
  await (await photoChooser).setFiles({ name: 'galeria.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByRole('heading', { name: 'Listo para publicar' })).toBeVisible()
  await expect(page.locator('#prep-gallery li')).toHaveCount(5)
  await expect(page.getByText(/La ITV vence el/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
