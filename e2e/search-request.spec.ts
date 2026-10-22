import { test, expect, type Page } from '@playwright/test'
import { randomInt } from 'node:crypto'
import { searchPayload } from '../tests/fixtures/search-request'
import { FORM_STEPS, QUESTION_SECTIONS } from '../lib/search-request/questions'
import {
  searchRequestId,
  searchRequestSummary,
  searchSnapshotId,
} from '../lib/search-request/intake'
import { createGuardedTestPrisma, uniqueSuffix } from '../tests/integration/db'
import type { SearchRequestInput } from '../lib/search-request/schema'

const db = createGuardedTestPrisma()
const prefix = `browser_${uniqueSuffix()}`
let agentIds: string[]
const leadIds = new Set<string>()
test.beforeAll(async () => {
  agentIds = (
    await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        db.user.create({
          data: {
            name: `Asesor navegador ${i}`,
            email: `${prefix}_${i}@example.invalid`,
            role: 'AGENTE',
          },
        })
      )
    )
  ).map((u) => u.id)
  await db.$executeRaw`DELETE FROM buyer_lead_assignment`
  await db.$executeRaw`INSERT INTO buyer_lead_assignment (id, enabled, agent_ids, next_index) VALUES (1, true, ${agentIds}::text[], 0)`
})
test.afterAll(async () => {
  await db.$executeRaw`DELETE FROM buyer_lead_assignment`
  await db.kpiEvent.deleteMany({ where: { entityId: { in: Array.from(leadIds) } } })
  await db.buyerLead.deleteMany({ where: { id: { in: Array.from(leadIds) } } })
  await db.user.deleteMany({ where: { id: { in: agentIds } } })
  await db.$disconnect()
})
test.beforeEach(async ({ page }) => {
  await page.goto('/busqueda-bajo-pedido')
  const cookies = page.getByRole('button', { name: 'Solo esenciales', exact: true })
  // Fresh contexts have no consent. Wait for hydration so a late banner cannot cover the form.
  await expect(cookies).toBeVisible({ timeout: 15000 })
  await cookies.click()
  await expect(page.getByRole('dialog', { name: 'Aviso de cookies' })).toBeHidden()
  await expect(page).toHaveURL(/\/busqueda-bajo-pedido$/)
  page.on('request', (req) => {
    if (req.url().endsWith('/api/landing/busqueda-bajo-pedido') && req.method() === 'POST')
      leadIds.add(searchRequestId(req.postDataJSON().requestId))
  })
})
async function fillStep(page: Page, input: SearchRequestInput, step: number) {
  for (const i of FORM_STEPS[step].sections)
    for (const q of QUESTION_SECTIONS[i].questions) {
      const value = input.answers[q.key]
      if (!value) continue
      if (q.kind === 'single') await page.locator(`#field-${q.key}`).check()
      else if (q.kind === 'multi') {
        for (const option of value as string[])
          await page.locator(`input[name="${q.key}"]`).nth(q.options!.indexOf(option)).check()
      } else await page.locator(`#field-${q.key}`).fill(String(value))
    }
}

test('complete revised questionnaire reaches real CRM with assignment and follow-up', async ({
  page,
}, info) => {
  const input = searchPayload(true)
  input.answers.phone = `6${randomInt(10000000, 99999999)}`
  input.answers.email = `${prefix}-${uniqueSuffix()}@example.invalid`
  await expect(page.getByRole('img', { name: 'CampersNova', exact: true })).toBeVisible()
  await expect(page.getByText('Permisos de conducir disponibles')).toHaveCount(0)
  await expect(page.getByText('Autonomía y lo que llevarás contigo')).toHaveCount(0)
  await page.screenshot({ path: `.artifacts/search-${info.project.name}.png`, fullPage: true })
  for (let step = 0; step < 4; step++) {
    await fillStep(page, input, step)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true)
    await page.getByRole('button', { name: 'Continuar', exact: false }).click()
  }
  await expect(page.getByRole('heading', { name: 'Revisar y enviar', exact: true })).toBeVisible()
  await expect(
    page.getByText('Respuesta de prueba: Enlaces, referencias o comentarios', { exact: true })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Enviar mi solicitud' }).click()
  await expect(page.locator('form').getByRole('alert')).toContainText('Acepta la política')
  await page.locator('#consent').check()
  const post = page.waitForRequest(
    (r) => r.url().endsWith('/api/landing/busqueda-bajo-pedido') && r.method() === 'POST'
  )
  const confirmation = page.waitForResponse(
    (r) => r.url().endsWith('/api/landing/busqueda-bajo-pedido') && r.request().method() === 'POST'
  )
  await page.getByRole('button', { name: 'Enviar mi solicitud' }).click()
  const actual = (await post).postDataJSON() as SearchRequestInput
  expect(actual.answers).toEqual(input.answers)
  expect((await confirmation).status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'Ya tenemos tu ficha.' })).toBeVisible()
  const id = searchRequestId(actual.requestId)
  const lead = await db.buyerLead.findUniqueOrThrow({ where: { id } })
  expect(agentIds).toContain(lead.agentId)
  expect(lead.nextActionType).toBe('LLAMAR')
  expect(lead.nextActionDueAt).not.toBeNull()
  expect(lead.source).toBe('WEB')
  expect(
    (await db.activity.findUniqueOrThrow({ where: { id: searchSnapshotId(id) } })).content
  ).toBe(searchRequestSummary(actual))
  expect(await db.kpiEvent.count({ where: { entityId: id } })).toBe(1)
  await page.screenshot({
    path: `.artifacts/search-success-${info.project.name}.png`,
    fullPage: true,
  })
})

test('validation, back navigation and lost confirmation retry preserve answers and create only once', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.locator('#field-name')).toBeFocused()
  await page.locator('#field-name').fill('Prueba de reintento')
  await page.locator('#field-phone').fill(`6${randomInt(10000000, 99999999)}`)
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Anterior' }).click()
  await expect(page.locator('#field-name')).toHaveValue('Prueba de reintento')
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Continuar' }).click()
  await page.locator('#consent').check()
  const requests: SearchRequestInput[] = []
  await page.route('**/api/landing/busqueda-bajo-pedido', async (route) => {
    requests.push(route.request().postDataJSON())
    if (requests.length === 1) {
      const response = await route.fetch()
      expect(response.status()).toBe(200)
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false}' })
    } else await route.continue()
  })
  await page.getByRole('button', { name: 'Enviar mi solicitud' }).click()
  await expect(page.locator('form').getByRole('alert')).toContainText('No hemos podido confirmar')
  await page.getByRole('button', { name: 'Enviar mi solicitud' }).click()
  await expect(page.getByRole('heading', { name: 'Ya tenemos tu ficha.' })).toBeVisible()
  expect(requests[0]).toEqual(requests[1])
  const id = searchRequestId(requests[0].requestId)
  expect(await db.activity.count({ where: { buyerLeadId: id } })).toBe(1)
  expect(await db.kpiEvent.count({ where: { entityId: id } })).toBe(1)
})
