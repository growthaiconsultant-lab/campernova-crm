import { expect, test } from '@playwright/test'
import path from 'node:path'

test('reabre un checklist incompleto con datos previos, ausencia explícita y campos pendientes', async ({
  page,
}) => {
  await page.setContent(
    '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>'
  )
  await page.addStyleTag({ path: path.resolve('.artifacts/buyer-followup/style.css') })
  await page.addScriptTag({ path: path.resolve('.artifacts/buyer-followup/checklist.js') })
  const group = page
    .getByText('Autonomía y equipamiento', { exact: false })
    .locator('xpath=ancestor-or-self::summary')
  await group.click()
  const solar = page.getByLabel('Placas solares', { exact: true })
  const winter = page.getByLabel('Preparada invierno', { exact: true })
  await expect(solar).toHaveValue('Sí')
  await expect(winter).toHaveValue('')
  await winter.selectOption('no')
  await page.getByRole('button', { name: 'Guardar checklist' }).click()
  await expect(winter).toBeHidden()
  await group.click()
  await expect(solar).toHaveValue('Sí')
  await expect(winter).toHaveValue('no')
  await expect(page.getByLabel('Autonomía off-grid', { exact: true })).toHaveValue('')
  await winter.selectOption('')
  await page.getByRole('button', { name: 'Guardar checklist' }).click()
  await expect(winter).toBeHidden()
  await group.click()
  await expect(winter).toHaveValue('')
})
