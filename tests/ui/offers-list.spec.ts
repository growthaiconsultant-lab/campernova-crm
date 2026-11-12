import { test, expect } from '@playwright/test'
import path from 'node:path'

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-12T22:59:40Z') })
  const origin = 'http://ofertas.test'
  await page.route(origin + '/ofertas**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/estilos.css"><div id="root"></div><script src="/lista.js"></script>',
    })
  )
  await page.route(origin + '/estilos.css', (route) =>
    route.fulfill({ path: path.resolve('.artifacts/buyer-followup/style.css') })
  )
  await page.route(origin + '/lista.js', (route) =>
    route.fulfill({ path: path.resolve('.artifacts/buyer-followup/offersList.js') })
  )
  await page.goto(origin + '/ofertas')
})

test('prioriza plazos en Madrid, conserva importes y enlaza cada operación una sola vez', async ({
  page,
}) => {
  const urgent = page.getByRole('region', { name: 'Revisar primero' })
  const links = page.locator('section li a')
  await expect(links).toHaveCount(7)
  await expect(urgent.getByRole('link').first()).toHaveAttribute(
    'href',
    '/compradores/comprador?tab=vehiculos#oferta-ayer'
  )
  await expect(urgent.getByRole('link').last()).toHaveText('Confirmar continuidad')
  await expect(urgent.getByRole('listitem').last()).toContainText('Vence hoy')
  await expect(urgent.getByRole('listitem').first()).toContainText(/1\.?500,75/)
  await expect(urgent.getByRole('listitem').first()).toContainText('42.300,25')
  await expect(page.getByRole('region', { name: 'Ofertas en curso' })).toContainText(
    'Aceptada sin señal'
  )
  await expect(
    page.getByRole('region', { name: 'Otras reservas' }).getByRole('listitem').last()
  ).toContainText('Sin fecha acordada')
  const pending = await links.evaluateAll((els) => els.map((el) => el.getAttribute('href')))
  await page.getByRole('link', { name: /Historial/ }).click()
  await expect(links).toHaveCount(5)
  await expect(page.getByRole('region', { name: 'Operaciones cerradas' })).toContainText(
    'Motivo · Precio'
  )
  const closedRow = page
    .getByRole('region', { name: 'Operaciones cerradas' })
    .getByRole('listitem')
    .first()
  await expect(closedRow).toContainText('3 nov 2025')
  await expect(closedRow).toContainText(/1\.?500,75/)
  const closed = await links.evaluateAll((els) => els.map((el) => el.getAttribute('href')))
  expect(new Set([...pending, ...closed]).size).toBe(12)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('link', { name: /Pendientes/ }).click()
  await expect(links).toHaveCount(7)
  await page.getByText('Indicadores comerciales').click()
  await expect(page.getByText(/4 reservas con señal/)).toBeVisible()
})

test('al pasar medianoche la reserva sigue pendiente y se actualiza su aviso', async ({ page }) => {
  await expect(page.getByRole('region', { name: 'Revisar primero' }).getByRole('link')).toHaveCount(
    2
  )
  await page.clock.fastForward(61000)
  const urgent = page.getByRole('region', { name: 'Revisar primero' })
  await expect(urgent.getByRole('link')).toHaveCount(3)
  await expect(urgent.getByRole('link', { name: 'Confirmar continuidad' })).toHaveAttribute(
    'href',
    /#oferta-manana$/
  )
  await expect(page.getByRole('link', { name: /Pendientes/ })).toContainText('7')
})

test('ambas vistas tienen un estado vacío', async ({ page }) => {
  await page.goto('http://ofertas.test/ofertas?vacio=1')
  await expect(page.getByText(/No hay operaciones pendientes/)).toBeVisible()
  await page.goto('http://ofertas.test/ofertas?vista=historial&vacio=1')
  await expect(page.getByText('Todavía no hay operaciones cerradas.')).toBeVisible()
})
