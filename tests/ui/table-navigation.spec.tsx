import { readFileSync } from 'node:fs'
import { test, expect, type Page, type Locator } from '@playwright/test'

const css = readFileSync('.artifacts/table-navigation/style.css', 'utf8')
const rows = [1, 2, 3].map((id) => ({ id: `test-${id}`, name: `Comprador ficticio ${id}` }))
type Row = (typeof rows)[number]
const href = (row: Row) => `/compradores/${row.id}`

async function mount(
  page: Page,
  options: { reverse?: boolean; mobileActions?: boolean; linked?: boolean } = {}
) {
  const markup = readFileSync(
    `.artifacts/table-navigation/${options.reverse ?? false}-${options.mobileActions ?? true}-${options.linked ?? true}.html`,
    'utf8'
  )
  await page.setContent(
    `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style>${markup}`
  )
  // Capture the actual DOM link hit by pointer/keyboard; prevent network navigation.
  await page.evaluate(() => {
    document.body.dataset.destinations = '[]'
    document.addEventListener('click', (event) => {
      const anchor = (event.target as Element).closest('a')
      if (!anchor) return
      event.preventDefault()
      const destinations = JSON.parse(document.body.dataset.destinations!) as string[]
      destinations.push(anchor.getAttribute('href')!)
      document.body.dataset.destinations = JSON.stringify(destinations)
    })
  })
}

async function tapCenter(page: Page, target: Locator) {
  const box = await target.boundingBox()
  expect(box).not.toBeNull()
  await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2)
}

async function destinations(page: Page) {
  return page.evaluate(() => JSON.parse(document.body.dataset.destinations!) as string[])
}

for (const width of [768, 1024, 1180, 1366]) {
  test(`cada comprador abre su ficha con pantalla de ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const reverse of [false, true]) {
      await mount(page, { reverse })
      const ordered = reverse ? [...rows].reverse() : rows
      const expected: string[] = []
      for (let index = 0; index < ordered.length; index++) {
        const row = ordered[index]
        if (width < 1024) {
          await tapCenter(page, page.locator(`a[href="${href(row)}"]:visible`))
          expected.push(href(row))
        } else {
          const cells = page.locator('tbody tr').nth(index).locator('td')
          await tapCenter(page, cells.nth(0))
          await tapCenter(page, cells.nth(1))
          // Padding at the row edge must also belong to this row.
          const box = (await cells.nth(0).boundingBox())!
          await page.touchscreen.tap(box.x + 2, box.y + 2)
          expected.push(href(row), href(row), href(row))
        }
        expect(await destinations(page)).toEqual(expected)
      }
      // The original WebKit overlay also intercepted clicks outside the table.
      await tapCenter(page, page.getByRole('button', { name: 'Fuera de la tabla' }))
      expect(await destinations(page)).toEqual(expected)
    }
  })
}

test('selectores, acciones independientes y teclado conservan su destino', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 900 })
  await mount(page)
  for (const row of rows) {
    const select = page.getByRole('combobox', { name: `Estado ${row.id}` })
    const box = (await select.boundingBox())!
    expect(
      await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
      })
    ).toBe('SELECT')
    await select.selectOption('contacted')
    await expect(select).toHaveValue('contacted')
  }
  expect(await destinations(page)).toEqual([])
  await page.getByRole('link', { name: 'Otra acción' }).nth(1).click()
  expect(await destinations(page)).toEqual(['/otra-ruta/test-2'])
  const name = page.locator('tbody tr').first().locator('td').first().getByRole('link')
  await name.focus()
  await page.keyboard.press('Enter')
  expect(await destinations(page)).toEqual(['/otra-ruta/test-2', href(rows[0])])
  await page.keyboard.press('Tab')
  await expect(page.getByRole('combobox', { name: 'Estado test-1' })).toBeFocused()
})

test('tarjetas móviles con y sin acciones; tablas sin enlace', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 })
  for (const mobileActions of [true, false]) {
    await mount(page, { mobileActions })
    if (mobileActions) {
      await page.getByRole('button', { name: 'Editar test-2' }).click()
      expect(await destinations(page)).toEqual([])
    }
    await page.locator(`a[href="${href(rows[1])}"]:visible`).click()
    expect(await destinations(page)).toEqual([href(rows[1])])
  }
  await page.setViewportSize({ width: 1180, height: 900 })
  await mount(page, { linked: false })
  await tapCenter(page, page.locator('tbody tr').first().locator('td').first())
  expect(await destinations(page)).toEqual([])
})
