import { expect, test } from '@playwright/test'
import path from 'node:path'

test('aplica todos los campos juntos y sincroniza controles, chips y navegación', async ({
  page,
}) => {
  await page.route('http://inventory.test/**', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>',
    })
  )
  await page.goto('http://inventory.test/vehiculos?page=2')
  await page.addStyleTag({ path: path.resolve('.artifacts/buyer-followup/style.css') })
  await page.addScriptTag({ path: path.resolve('.artifacts/buyer-followup/vehicleInventory.js') })
  const search = page.getByRole('searchbox', { name: 'Buscar vehículo' })
  const apply = page.getByRole('button', { name: 'Aplicar filtros' })
  await search.fill('Volkswagen Crafter')
  await page.getByRole('combobox', { name: 'Tipo', exact: true }).selectOption('CAMPER')
  await page
    .getByRole('combobox', { name: 'Estado del vehículo', exact: true })
    .selectOption('PUBLICADO')
  await page.getByLabel('Precio de venta máx. (€)', { exact: true }).fill('60000')
  await expect(page).toHaveURL(/page=2$/)
  await expect(page.getByRole('status')).toHaveText('Cambios pendientes de aplicar')
  await apply.click()
  await expect(page).toHaveURL(
    /brand=Volkswagen\+Crafter&type=CAMPER&status=PUBLICADO&priceMax=60000$/
  )
  const remove = page.getByRole('button', { name: 'Quitar Camper', exact: true })
  await remove.click()
  await expect(page.getByRole('combobox', { name: 'Tipo', exact: true })).toHaveValue('')
  await expect(search).toHaveValue('Volkswagen Crafter')
  await page.goBack()
  await expect(remove).toBeVisible()
  await page.getByText('Más filtros', { exact: true }).click()
  await page.getByLabel('Año desde').fill('2024')
  await page.getByLabel('Año hasta').fill('2021')
  await apply.click()
  await expect(page.getByRole('alert')).toContainText('año final')
  await page.getByRole('button', { name: 'Limpiar todo' }).click()
  await expect(page).toHaveURL('http://inventory.test/vehiculos')
  await expect(search).toHaveValue('')
  await expect(page.getByRole('button', { name: /^Quitar / })).toHaveCount(0)
  await search.fill('Todavía sin aplicar')
  await page
    .getByRole('combobox', { name: 'Ordenar por', exact: true })
    .selectOption('salePrice:asc')
  await expect(page).toHaveURL(/sort=salePrice&dir=asc$/)
  await expect(search).toHaveValue('Todavía sin aplicar')
  await page.getByRole('button', { name: 'Limpiar todo' }).click()
  await expect(search).toHaveValue('')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('filtra sin precio, cancela y guarda desde la tarjeta y lo encuentra con precio', async ({
  page,
}) => {
  await page.route('http://inventory.test/**', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>',
    })
  )
  await page.goto('http://inventory.test/vehiculos?priceMax=60000')
  await page.addStyleTag({ path: path.resolve('.artifacts/buyer-followup/style.css') })
  await page.addScriptTag({ path: path.resolve('.artifacts/buyer-followup/vehicleInventory.js') })
  const presence = page.getByRole('combobox', { name: 'Precio de venta', exact: true })
  const max = page.getByRole('spinbutton', { name: 'Precio de venta máx. (€)' })
  const apply = page.getByRole('button', { name: 'Aplicar filtros' })
  await presence.selectOption('missing')
  await expect(max).toBeDisabled()
  await expect(max).toHaveValue('')
  await apply.click()
  await expect(page).toHaveURL(/priceState=missing$/)
  const card = page.getByRole('article', { name: 'Camper de prueba' })
  await card.getByRole('button', { name: 'Añadir precio' }).click()
  await card.getByRole('spinbutton').fill('46000')
  await card.getByRole('button', { name: 'Cancelar' }).click()
  await card.getByRole('button', { name: 'Añadir precio' }).click()
  await expect(card.getByRole('spinbutton')).toHaveValue('')
  await card.getByRole('spinbutton').fill('46500.25')
  await card.getByRole('button', { name: 'Guardar precio' }).click()
  await expect(page.getByText(/Camper de prueba · Precio de venta guardado/)).toBeVisible()
  await expect(card).toHaveCount(0)
  await presence.selectOption('priced')
  await apply.click()
  await expect(card).toContainText('46.500,25')
  await expect(card.getByRole('link')).toHaveAttribute('href', '/vendedores/qa')
  await expect(card.getByRole('button', { name: 'Añadir precio' })).toHaveCount(0)
})
