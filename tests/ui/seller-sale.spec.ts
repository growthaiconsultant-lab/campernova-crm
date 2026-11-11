import { expect, test } from '@playwright/test'
import path from 'node:path'
test('registra la fecha y el enlace en su portal, conserva la reserva y permite corregir y retirar', async ({
  page,
}) => {
  await page.setContent(
    '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>'
  )
  await page.addStyleTag({ path: path.resolve('.artifacts/buyer-followup/style.css') })
  await page.addScriptTag({ path: path.resolve('.artifacts/buyer-followup/sellerSale.js') })
  const channels = page.getByRole('region', { name: 'Dónde está anunciado' })
  await expect(channels.getByText('Fuera del catálogo público')).toBeVisible()
  await expect(channels.getByText(/Texto preparado/)).toBeVisible()
  await channels.getByRole('button', { name: 'Registrar publicación' }).first().click()
  const form = page.getByRole('form', { name: 'Publicación en Wallapop' })
  await form.getByLabel(/Enlace del anuncio/).fill('https://www.coches.net/camper')
  await form.getByLabel('Fecha de publicación').fill('2025-02-11')
  await form.getByRole('button', { name: 'Guardar publicación' }).click()
  await expect(channels.getByRole('alert')).toContainText('Wallapop')
  await form.getByLabel(/Enlace del anuncio/).fill('https://es.wallapop.com/item/camper-qa')
  await form.getByRole('button', { name: 'Guardar publicación' }).click()
  await expect(channels.getByRole('link', { name: 'Ver anuncio' })).toHaveAttribute(
    'href',
    'https://es.wallapop.com/item/camper-qa'
  )
  await channels.getByRole('button', { name: 'Editar anuncio' }).click()
  await form.getByLabel('Fecha de publicación').fill('2025-02-10')
  await form.getByRole('button', { name: 'Guardar publicación' }).click()
  await expect(channels.getByText(/Publicado el 10/)).toBeVisible()
  await channels.getByRole('button', { name: 'Editar anuncio' }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await form.getByRole('button', { name: 'Marcar como retirado' }).click()
  await expect(channels.getByText('Retirado según el equipo')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Reserva con señal' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Compradores con interés · 1' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('un texto preparado y guardado sigue sin confirmar hasta registrar la publicación', async ({
  page,
}) => {
  await page.setContent(
    '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>'
  )
  await page.addStyleTag({ path: path.resolve('.artifacts/buyer-followup/style.css') })
  await page.addScriptTag({ path: path.resolve('.artifacts/buyer-followup/sellerSale.js') })
  await page.evaluate(() =>
    (
      window as unknown as { portalFixture: { openPublication(): void } }
    ).portalFixture.openPublication()
  )
  const coches = page.getByRole('region', { name: 'Coches.net', exact: true })
  await coches.getByRole('button', { name: 'Preparar texto' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox').fill('Texto de prueba de Coches.net')
  await dialog.getByRole('button', { name: 'Guardar texto' }).click()
  await expect(dialog.getByRole('status')).toHaveText('Texto guardado.')
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(coches.getByText('Texto preparado', { exact: true })).toBeVisible()
  await expect(page.getByText('Publicado en 0 de 3')).toBeVisible()
  await coches.getByRole('button', { name: 'Ver texto' }).click()
  await expect(dialog.getByRole('textbox')).toHaveValue('Texto de prueba de Coches.net')
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await page
    .getByRole('region', { name: 'Wallapop', exact: true })
    .getByRole('button', { name: 'Ver texto' })
    .click()
  await expect(dialog.getByRole('textbox')).toHaveValue('Texto original de Wallapop')
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await page
    .getByRole('region', { name: 'Wallapop', exact: true })
    .getByRole('button', { name: 'Registrar publicación' })
    .click()
  const form = page.getByRole('form', { name: 'Publicación en Wallapop' })
  await form.getByLabel(/Enlace del anuncio/).fill('https://es.wallapop.com/item/camper-qa')
  await form.getByLabel('Fecha de publicación').fill('2025-02-11')
  await form.getByRole('button', { name: 'Guardar publicación' }).click()
  await expect(page.getByText('Publicado en 1 de 3')).toBeVisible()
  await expect(coches.getByText('Sin confirmar', { exact: true })).toBeVisible()
})
