import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'
async function load(page: Page, scenario = 'normal') {
  await page.route('https://crm.example.test/comprador*', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>',
    })
  )
  await page.goto('https://crm.example.test/comprador?scenario=' + scenario)
  await page.addStyleTag({ path: path.resolve('.artifacts/buyer-followup/style.css') })
  await page.addScriptTag({ path: path.resolve('.artifacts/buyer-followup/documents.js') })
}

test('recupera un presupuesto antiguo y descarga el archivo desde su fila', async ({ page }) => {
  await load(page)
  const budgets = page.getByRole('region', { name: 'Presupuestos', exact: true }),
    other = page.getByRole('region', { name: 'Otros documentos operativos' })
  await expect(budgets.getByRole('listitem').first()).toContainText('Presupuesto 22.pdf')
  await expect(other.getByText('Plano anterior.pdf')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Guardar documento' })).toBeHidden()
  await expect(other.getByRole('navigation')).toHaveCount(0)
  await budgets.getByRole('button', { name: 'Siguiente' }).click()
  await expect(budgets.getByText('Presupuesto 1.pdf')).toBeVisible()
  await expect(other.getByText('Plano anterior.pdf')).toBeVisible()
  await page.route('https://crm.example.test/download/b1', (r) =>
    r.fulfill({
      contentType: 'application/pdf',
      headers: { 'Content-Disposition': 'attachment; filename="presupuesto.pdf"' },
      body: '%PDF-1.4 QA',
    })
  )
  const request = page.waitForRequest('https://crm.example.test/download/b1')
  await budgets.getByRole('button', { name: 'Descargar Presupuesto 1.pdf', exact: true }).click()
  await request
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
test('estado vacío, subida desplegable y reintento con el mismo archivo', async ({ page }) => {
  await load(page, 'empty')
  await expect(page.getByText('Aún no hay documentos para este comprador.')).toBeVisible()
  await expect(page.getByRole('navigation')).toHaveCount(0)
  await page.getByRole('button', { name: 'Subir documento' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText(/No adjuntes aquí DNI ni contratos comerciales/)).toBeVisible()
  await page.getByLabel(/Archivo \(PDF/).setInputFiles({
    name: 'plano.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 QA'),
  })
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('plano.pdf')
  await page.getByLabel('Nombre', { exact: true }).fill('Plano interior')
  await page.getByLabel('Categoría').selectOption('OPERATIVO')
  await page.getByRole('button', { name: 'Guardar documento' }).click()
  await expect(page.getByRole('alert')).toContainText('Subida pendiente')
  await page.getByRole('button', { name: 'Guardar documento' }).click()
  await expect(page.getByRole('status')).toContainText('Documento guardado.')
  await expect(page.getByRole('button', { name: 'Subir documento' })).toHaveAttribute(
    'aria-expanded',
    'false'
  )
  await expect(
    page.getByRole('region', { name: 'Otros documentos operativos' }).getByText('Plano interior')
  ).toBeVisible()
})
test('una lectura fallida se recupera sin ocultar los presupuestos', async ({ page }) => {
  await load(page, 'error')
  await expect(page.getByRole('alert')).toContainText('Fallo de lectura')
  await expect(page.getByText('Presupuesto 22.pdf', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.getByText('Plano anterior.pdf')).toBeVisible()
})
