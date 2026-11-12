import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createGuardedTestPrisma } from './db'
import { saveQuoteAction, sendQuoteAction } from '@/app/(backoffice)/taller/owner-quote-actions'
import { POST, GET } from '@/app/presupuesto-propietario/route'
import { quoteLines } from '@/lib/entry/owner-quote'
import { randomBytes } from 'node:crypto'
import { renderToStaticMarkup } from 'react-dom/server'
import WorkOrderPage from '@/app/(backoffice)/taller/[id]/page'

const client = createGuardedTestPrisma()
const { send, authorize } = vi.hoisted(() => ({ send: vi.fn(), authorize: vi.fn() }))
vi.mock('@/lib/db', () => ({
  get db() {
    return client
  },
}))
vi.mock('@/lib/auth', () => ({ requireCanEditTaller: authorize, requireCanViewTaller: authorize }))
vi.mock('next/navigation', async (original) => ({
  ...(await original<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh() {} }),
}))
vi.mock('@/lib/email/client', () => ({ getResend: () => ({ emails: { send } }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const email = 'propietario@example.test'
let orderId: string, sellerId: string, itemId: string
const getQuote = () =>
  client.inspectionOwnerQuote.findFirstOrThrow({
    where: { workOrderId: orderId },
    orderBy: { version: 'desc' },
  })
const line = () => ({ itemId, description: 'Sustituir bomba <interior>', cents: 14550 })
const save = (version = 0, revision = 0) =>
  saveQuoteAction(orderId, { version, revision, lines: [line()] })
async function emailLatest() {
  const q = await getQuote()
  return sendQuoteAction(orderId, { version: q.version, revision: q.revision, email })
}
function link() {
  return (send.mock.lastCall?.[0].text as string)
    .split('/presupuesto-propietario#')[1]
    .split('\n')[0]
}
function visit(token: string, decision?: string, reason?: string) {
  const body = new URLSearchParams({ token })
  if (decision) body.set('decision', decision)
  if (reason) body.set('reason', reason)
  return POST(
    new Request('https://crm.example.test/presupuesto-propietario', { method: 'POST', body })
  )
}

beforeEach(async () => {
  vi.stubEnv('OWNER_QUOTE_LINK_SECRET', randomBytes(32).toString('hex'))
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://crm.example.test')
  vi.stubEnv('RESEND_API_KEY', 'local-test')
  vi.stubEnv('EMAIL_FROM', 'taller@example.test')
  send.mockReset().mockResolvedValue({ data: { id: 'test-delivery' } })
  authorize.mockReset().mockResolvedValue({ role: 'TALLER' })
  const seller = await client.sellerLead.create({ data: { email, name: 'Propietaria' } })
  sellerId = seller.id
  const vehicle = await client.vehicle.create({
    data: { sellerLeadId: seller.id, brand: 'Ford', model: 'Transit' },
  })
  const wo = await client.workOrder.create({
    data: {
      vehicleId: vehicle.id,
      description: 'Entrada',
      kind: 'INSPECCION_ENTRADA',
      checklist: {
        create: [
          { item: 'Bomba', category: 'CAMPER', notes: 'Observación privada', ownerQuote: true },
          { item: 'Radio', category: 'CAMPER', ownerQuote: false },
        ],
      },
    },
    include: { checklist: true },
  })
  orderId = wo.id
  itemId = wo.checklist.find((i) => i.ownerQuote)!.id
})
afterEach(async () => {
  await client.inspectionOwnerQuote.deleteMany({ where: { workOrderId: orderId } })
  await client.vehicle.deleteMany({ where: { sellerLeadId: sellerId } })
  await client.sellerLead.delete({ where: { id: sellerId } })
  vi.unstubAllEnvs()
})
afterAll(() => client.$disconnect())

it.each([
  ['ACEPTADO', 'Aceptado', 'Has aceptado el presupuesto de'],
  ['RECHAZADO', 'Rechazado', 'Has rechazado el presupuesto'],
])(
  'muestra la respuesta %s en la página del propietario y en la inspección',
  async (decision, label, receipt) => {
    await save()
    await emailLatest()
    const token = link()
    const pending = await visit(token)
    const summary = await pending.text()
    expect(summary).toContain('src="/cn-landing/img/logo-cn-crema.png"')
    expect(pending.headers.get('Content-Security-Policy')).toContain("img-src 'self'")
    expect(summary).toContain('Ford Transit')
    expect(summary).toContain('Total con IVA')
    const answered = await (await visit(token, decision, 'Revisar en diciembre')).text()
    expect(answered).toContain(receipt)
    expect(answered).toContain('Respuesta registrada el')
    expect(answered).not.toContain('name="decision"')
    const inspection = renderToStaticMarkup(await WorkOrderPage({ params: { id: orderId } }))
    expect(inspection).toContain(label + ' desde el enlace de')
    if (decision === 'RECHAZADO') {
      expect(answered).toContain('Motivo · Revisar en diciembre')
      expect(inspection).toContain('Motivo del rechazo · Revisar en diciembre')
    }
  }
)

it('guarda borradores parciales y rechaza permisos insuficientes, correos o marcas cambiados', async () => {
  authorize.mockRejectedValueOnce(new Error('denegado'))
  await expect(save()).rejects.toThrow('denegado')
  const partial = { version: 0, revision: 0, lines: [{ ...line(), cents: null }] }
  expect(await saveQuoteAction(orderId, partial)).toEqual({ ok: true })
  expect((await emailLatest()).error).toContain('Completa el trabajo')
  await save(1, 1)
  const q = await getQuote()
  expect(
    (
      await sendQuoteAction(orderId, {
        version: 1,
        revision: q.revision,
        email: 'otro@example.test',
      })
    ).error
  ).toContain('correo')
  await client.workOrderChecklist.updateMany({
    where: { workOrderId: orderId },
    data: { ownerQuote: true },
  })
  expect((await emailLatest()).error).toContain('reparaciones')
  expect(send).not.toHaveBeenCalled()
  expect(await getQuote()).toMatchObject({ status: 'BORRADOR', sentAt: null })
})
it('entrega una versión inmutable, reintenta con el mismo enlace y conserva la primera respuesta', async () => {
  const results = await Promise.all([save(), save()])
  expect(results.filter((r) => r.ok)).toHaveLength(1)
  send.mockResolvedValueOnce({ error: { message: 'provider error' } })
  expect((await emailLatest()).error).toContain('no ha confirmado')
  expect(await getQuote()).toMatchObject({ status: 'EN_ENVIO', sentAt: null })
  const token = link(),
    firstArgs = send.mock.lastCall
  const message = firstArgs?.[0]
  expect(message.html).toContain(`href="https://crm.example.test/presupuesto-propietario#${token}"`)
  expect(message.html).toContain('cid:' + message.attachments[0].contentId)
  expect(message.html).toContain('Ford Transit')
  expect(message.html).toContain('145,50')
  expect(message.html).not.toContain('Observación privada')
  expect(await emailLatest()).toEqual({ ok: true })
  expect(send.mock.lastCall?.[0]).toEqual(firstArgs?.[0])
  expect(send.mock.lastCall?.[1].idempotencyKey).toEqual(firstArgs?.[1].idempotencyKey)
  expect(send.mock.lastCall?.[0].to).toBe(email)
  expect(await getQuote()).toMatchObject({ status: 'PENDIENTE' })
  const opened = await visit(token)
  expect(opened.headers.get('Cache-Control')).toContain('no-store')
  const html = await opened.text()
  expect(html).toContain('145,50')
  expect(html).toContain('bomba &lt;interior&gt;')
  expect(html).not.toContain('Observación privada')
  expect(await getQuote()).toMatchObject({ status: 'PENDIENTE', answeredAt: null })
  const invalid = token.slice(0, -1) + (token.endsWith('X') ? 'Y' : 'X')
  expect((await visit(invalid, 'ACEPTADO')).status).toBe(404)
  await Promise.all([visit(token, 'ACEPTADO'), visit(token, 'RECHAZADO', 'Esperar')])
  const final = await getQuote()
  expect(['ACEPTADO', 'RECHAZADO']).toContain(final.status)
  expect(final.answeredAt).toBeInstanceOf(Date)
  await visit(token, final.status === 'ACEPTADO' ? 'RECHAZADO' : 'ACEPTADO')
  expect(await getQuote()).toEqual(final)
  expect(await GET().text()).not.toContain(token)
})
it('una nueva versión mantiene el anterior hasta su envío y archiva el motivo de rechazo', async () => {
  await save()
  await emailLatest()
  const v1 = await getQuote(),
    t1 = link()
  const input = { version: v1.version, revision: v1.revision, lines: [{ ...line(), cents: 19999 }] }
  expect(await saveQuoteAction(orderId, input)).toEqual({ ok: true })
  expect(await (await visit(t1)).text()).toContain('Pendiente de respuesta')
  await emailLatest()
  expect(await (await visit(t1, 'ACEPTADO')).text()).toContain('se ha sustituido')
  const old = await client.inspectionOwnerQuote.findUniqueOrThrow({ where: { id: v1.id } })
  expect(old.status).toBe('SUSTITUIDO')
  expect(quoteLines.parse(old.lines)[0].cents).toBe(14550)
  await visit(link(), 'RECHAZADO', 'Más adelante')
  expect(await getQuote()).toMatchObject({
    version: 2,
    status: 'RECHAZADO',
    reason: 'Más adelante',
  })
})
