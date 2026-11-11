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

test('gestiona portada, orden y borrado desde la foto y muestra toda la galería pública', async ({
  page,
}, testInfo) => {
  await page.setContent(
    '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>'
  )
  await page.addStyleTag({ path: path.resolve('.artifacts/buyer-followup/style.css') })
  await page.addScriptTag({ path: path.resolve('.artifacts/buyer-followup/sellerPreparation.js') })
  const gallery = page.getByRole('region', { name: 'Fotos del vehículo' })
  await gallery.getByRole('button', { name: 'Ver foto 4 de 4' }).click()
  await expect(gallery.getByRole('img', { name: 'f3', exact: true })).toBeVisible()
  const trigger = page.getByRole('button', { name: /Abrir galería de Fiat/ })
  const sellerLink = page.getByRole('link', { name: 'Vendedor de prueba' })
  await expect(sellerLink).toHaveAttribute('href', '/vendedores/seller-qa')
  await expect(trigger.locator('xpath=ancestor::a')).toHaveCount(0)
  await page.getByRole('button', { name: /Abrir galería de Fiat/ }).click()
  const editor = page.getByRole('dialog')
  const items = editor.getByRole('listitem')
  await expect(items).toHaveCount(4)
  if (testInfo.project.name === 'chrome') await items.nth(1).dragTo(items.first())
  else await editor.getByRole('button', { name: 'Adelantar foto 2' }).click()
  await expect(items.first().getByRole('img')).toHaveAttribute('src', /muestra-1/)
  await expect(items.first()).toContainText('Portada')
  page.once('dialog', (d) => d.dismiss())
  await editor.getByRole('button', { name: 'Eliminar foto 1' }).click()
  await expect(items).toHaveCount(4)
  page.once('dialog', (d) => d.accept())
  await editor.getByRole('button', { name: 'Eliminar foto 1' }).click()
  await expect(items).toHaveCount(3)
  await page.keyboard.press('Escape')
  await expect(editor).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Abrir galería de Fiat.*3 fotos/ })).toBeVisible()
  await gallery.getByRole('button', { name: 'Ver foto 1 de 3' }).click()
  await expect(gallery.getByRole('img', { name: 'f0', exact: true })).toBeVisible()
})
