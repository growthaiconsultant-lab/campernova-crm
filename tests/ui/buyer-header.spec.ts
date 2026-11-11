import path from 'node:path'
import { test, expect } from '@playwright/test'

test('desde el listado filtrado conserva volver, buscar, crear y confirmar una pérdida', async ({
  page,
}) => {
  const list = '/compradores?view=todos&status=CONTACTADO&page=2'
  await page.route('http://localhost/compradores?**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="root"></div></body></html>',
    })
  )
  await page.goto('http://localhost' + list)
  await page.addStyleTag({ path: path.resolve('.artifacts/buyer-followup/style.css') })
  await page.addScriptTag({ path: path.resolve('.artifacts/buyer-followup/header.js') })
  await expect(page.getByRole('button', { name: 'Nuevo lead', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Abrir comprador de prueba' }).click()
  await expect(page.getByRole('link', { name: 'Compradores', exact: true })).toHaveAttribute(
    'href',
    list
  )
  await page.getByRole('button', { name: 'Buscar en el CRM', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Buscador global' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Crear un registro' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Nuevo lead' }).getByRole('link', { name: /Comprador/ })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Marcar como perdido' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Gestionar ficha' }).click()
  const manage = page.getByRole('dialog', { name: 'Gestionar ficha' })
  await expect(manage.getByText('Origen · Formulario web')).toBeVisible()
  await manage.getByRole('button', { name: 'Marcar como perdido' }).click()
  await page
    .getByRole('dialog', { name: 'Marcar comprador como perdido' })
    .getByRole('button', { name: 'Cancelar' })
    .click()
  await expect(manage).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(manage).toHaveCount(0)
})

test('Vendedores usa la cabecera compacta en listado y ficha y recuerda la vista y la página', async ({
  page,
}) => {
  const list = '/vendedores?view=stock&brand=Ford&page=2'
  await page.route('http://localhost/vendedores?**', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>',
    })
  )
  await page.goto('http://localhost' + list)
  await page.addStyleTag({ path: path.resolve('.artifacts/buyer-followup/style.css') })
  await page.addScriptTag({ path: path.resolve('.artifacts/buyer-followup/header.js') })
  await expect(page.getByRole('button', { name: 'Buscar en el CRM' })).toBeVisible()
  await page.getByRole('button', { name: 'Abrir vendedor de prueba' }).click()
  await expect(page.getByRole('link', { name: 'Vendedores', exact: true })).toHaveAttribute(
    'href',
    list
  )
  await page.getByRole('button', { name: 'Crear un registro' }).click()
  await expect(page.getByRole('dialog').getByRole('link', { name: /Vendedor/ })).toHaveAttribute(
    'href',
    '/vendedores/nuevo'
  )
})
