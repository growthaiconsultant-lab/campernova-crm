import { test, expect } from '@playwright/test'
import path from 'node:path'

test('registra el uso y edita el catálogo durante la llamada', async ({ page }) => {
  await page.setContent(
    '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>'
  )
  await page.addStyleTag({ path: path.resolve('.artifacts/buyer-followup/style.css') })
  await page.addScriptTag({ path: path.resolve('.artifacts/buyer-followup/usage.js') })
  await expect(page.getByLabel('Uso principal')).toHaveText('Por confirmar')
  await page.getByRole('button', { name: 'Vivir en ella' }).click()
  await page.getByLabel('¿Durante cuánto tiempo?').selectOption('VIVIENDA_TEMPORADAS')
  await page.evaluate(() => {
    window.usageFixture.fail = true
  })
  await page.getByRole('button', { name: 'Guardar uso' }).click()
  await expect(page.getByText('Error de prueba al guardar.')).toBeVisible()
  await page.evaluate(() => {
    window.usageFixture.fail = false
  })
  await page.getByRole('button', { name: 'Guardar uso' }).click()
  await expect(page.getByLabel('Uso principal')).toHaveText('Vivir en ella · Por temporadas')
  await expect(page.getByLabel('Zona de uso')).toHaveValue('Costa')
  await page.getByRole('button', { name: 'Viajes largos' }).click()
  await expect(page.getByLabel('¿Durante cuánto tiempo?')).toHaveCount(0)
  await page.getByRole('button', { name: 'Añadir característica' }).click()
  await page.getByRole('searchbox').fill('calefaccion')
  await page.getByRole('button', { name: 'Calefacción', exact: true }).click()
  await page.getByRole('combobox', { name: 'Calefacción', exact: true }).selectOption('Sí')
  await page.getByLabel('Prioridad').selectOption('required')
  await page.getByRole('button', { name: 'Guardar característica' }).click()
  await page.getByText('Editar características guardadas', { exact: true }).click()
  await expect(page.getByRole('button', { name: 'Calefacción · Sí' })).toBeVisible()
  await page.getByRole('button', { name: /Distribuciones de cama/ }).click()
  await expect(page.getByLabel('Necesito todas las opciones seleccionadas')).toBeChecked()
  await expect(page.getByLabel('Prioridad')).toHaveValue('required')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
