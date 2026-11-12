import { test, expect } from '@playwright/test'
import path from 'node:path'
test('registra equipamiento, avería y partida para el propietario y permite añadir otro elemento', async ({
  page,
}) => {
  await page.setContent(
    '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>'
  )
  await page.addStyleTag({ path: path.resolve('.artifacts/buyer-followup/style.css') })
  await page.addScriptTag({ path: path.resolve('.artifacts/buyer-followup/inspection.js') })
  await page.locator('summary').filter({ hasText: 'Camper' }).click()
  const row = page.getByRole('group', { name: 'Calefacción', exact: true })
  await row.getByLabel('¿Lo lleva?').selectOption('true')
  await row.getByLabel('Estado').selectOption('NECESITA_REPARACION')
  await row.getByLabel('Observaciones').fill('No arranca al encenderla')
  await row.getByLabel('Presupuestar al propietario').check()
  await row.getByRole('button', { name: 'Guardar elemento' }).click()
  const quote = page.getByRole('region', { name: 'Para presupuestar al propietario' })
  await expect(quote).toContainText('Calefacción · No arranca al encenderla')
  await page.getByLabel('Elemento', { exact: true }).fill('Antena exterior')
  await page.getByRole('button', { name: 'Añadir elemento', exact: true }).click()
  const extra = page.getByRole('group', { name: 'Antena exterior' })
  await expect(extra.getByLabel('¿Lo lleva?')).toHaveValue('')
  await extra.getByLabel('¿Lo lleva?').selectOption('false')
  await expect(extra.getByLabel('Estado')).toBeDisabled()
  await extra.getByRole('button', { name: 'Guardar elemento' }).click()
  await expect(extra.getByLabel('¿Lo lleva?')).toHaveValue('false')
  await expect(quote.getByRole('listitem')).toHaveCount(1)
  await quote.getByRole('button', { name: 'Preparar presupuesto' }).click()
  await quote.getByLabel('Trabajo para el propietario').fill('Reparar el encendido')
  await quote.getByLabel('Importe con IVA').fill('145,50')
  await quote.getByRole('button', { name: 'Guardar borrador' }).click()
  await expect(quote).toContainText('145,50')
  await quote.getByRole('button', { name: 'Revisar y enviar' }).click()
  await expect(quote).toContainText('propietario@example.test')
  await quote.getByRole('button', { name: 'Enviar al propietario' }).click()
  await expect(quote).toContainText('Pendiente de respuesta')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
