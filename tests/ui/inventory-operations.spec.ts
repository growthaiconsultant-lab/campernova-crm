import { test, expect } from '@playwright/test'
import path from 'node:path'
test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>'
  )
  await page.addStyleTag({ path: path.resolve('.artifacts/buyer-followup/style.css') })
  await page.addScriptTag({
    path: path.resolve('.artifacts/buyer-followup/inventoryOperations.js'),
  })
})
test('reservar escoge la oferta y confirma la señal y el plazo en la propia tarjeta', async ({
  page,
}) => {
  const card = page.getByRole('article', { name: 'En venta' })
  await card.getByRole('button', { name: 'Reservar vehículo' }).click()
  await card.getByRole('combobox').selectOption('of-2')
  await card.getByLabel('Señal recibida (€), si la hay').fill('1000.50')
  await card.getByLabel('Reservado hasta (opcional)').fill('2027-01-15')
  await card.getByRole('button', { name: 'Confirmar reserva' }).click()
  await expect(page.getByText('v1 / of-2 / ACEPTADA / 1000.5 / 2027-01-15')).toBeVisible()
})
test('sin oferta permite ir a Venta y cancelar; descartar pide confirmación y conserva el motivo', async ({
  page,
}) => {
  const card = page.getByRole('article', { name: 'Sin ofertas' })
  await card.getByRole('button', { name: 'Reservar vehículo' }).click()
  await expect(card.getByRole('link', { name: 'Crear oferta en Venta' })).toHaveAttribute(
    'href',
    /venta-ofertas$/
  )
  await expect(card.getByRole('button', { name: 'Confirmar reserva' })).toHaveCount(0)
  await card.getByRole('button', { name: 'Cancelar' }).click()
  await card.getByRole('button', { name: 'Descartar vehículo' }).click()
  await expect(card.getByText(/se retirará de la web/)).toBeVisible()
  await card.getByLabel('Motivo (opcional)').fill('Coste de preparación')
  await card.getByRole('button', { name: 'Confirmar descarte' }).click()
  await expect(page.getByText('v2 / PUBLICADO / Coste de preparación')).toBeVisible()
})

test('administración puede consultar los pendientes, guardar el precio y decidir después si publica', async ({
  page,
}) => {
  const card = page.getByRole('article', { name: 'Administración' })
  await card.getByRole('button', { name: 'Publicar en la web' }).click()
  await expect(card.getByText('El anuncio saldrá sin precio de venta.')).toBeVisible()
  await card.getByText('Ver 1 pendiente').click()
  await expect(card.getByText('Precio de venta al público')).toBeVisible()
  await card.getByRole('button', { name: 'Añadir precio' }).click()
  await card.getByLabel('Precio de venta (€)').fill('42000')
  await card.getByRole('button', { name: 'Guardar precio' }).click()
  await expect(card.getByText('El vehículo está listo para publicar.')).toBeVisible()
  await expect(card.getByText('Publicar de todas formas')).toHaveCount(0)
  await card.getByRole('button', { name: 'Confirmar publicación' }).click()
  await expect(page.getByText('Publicado 42000')).toBeVisible()
})
test('el agente puede cancelar o confirmar expresamente la publicación con pendientes', async ({
  page,
}) => {
  const card = page.getByRole('article', { name: 'Agente' })
  const open = card.getByRole('button', { name: 'Publicar en la web' })
  await open.click()
  await expect(card.getByText(/En la web aparecerá «Precio a consultar»/)).toBeVisible()
  await card.getByText('Ver 2 pendientes').click()
  await expect(card.getByText('Número de bastidor')).toBeVisible()
  await expect(card.getByRole('button', { name: 'Añadir precio' })).toHaveCount(0)
  await card.getByRole('button', { name: 'Cancelar' }).click()
  await open.click()
  await card.getByRole('button', { name: 'Publicar de todas formas' }).click()
  await expect(page.getByText('Publicado sin precio')).toBeVisible()
})
