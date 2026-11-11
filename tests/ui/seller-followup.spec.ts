import { test, expect } from '@playwright/test'
import path from 'node:path'
test('registra una llamada y el siguiente paso desde la misma vista, incluso tras un fallo', async ({
  page,
}) => {
  await page.route('https://crm.example.test/vendedores/qa', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>',
    })
  )
  await page.goto('https://crm.example.test/vendedores/qa')
  await page.addStyleTag({ path: path.resolve('.artifacts/buyer-followup/style.css') })
  await page.addScriptTag({ path: path.resolve('.artifacts/buyer-followup/sellerFollowup.js') })
  await page.getByRole('button', { name: 'Registrar llamada' }).click()
  await page.getByLabel('¿Qué habéis hablado?').fill('Comentar precio con la vendedora.')
  await page.getByLabel('Siguiente paso (opcional)').fill('Confirmar oferta')
  await page.getByLabel('Fecha y hora del siguiente paso').fill('2030-03-14T11:30')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Guardar seguimiento' }).click()
  await expect(page.getByRole('alert')).toHaveText('Reintenta el guardado')
  await page.getByRole('button', { name: 'Guardar seguimiento' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Llamada registrada y siguiente paso programado'
  )
  await expect(page.getByRole('link', { name: 'Ver en el calendario' })).toHaveAttribute(
    'href',
    '/calendario/qa'
  )
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
