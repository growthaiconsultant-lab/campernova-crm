import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createGuardedTestPrisma } from './db'
import { saveQuoteAction, sendQuoteAction } from '@/app/(backoffice)/taller/owner-quote-actions'
import { POST, GET } from '@/app/presupuesto-propietario/route'
import { quoteLines } from '@/lib/entry/owner-quote'
import { randomBytes } from 'node:crypto'
import { renderToStaticMarkup } from 'react-dom/server'
import WorkOrderPage from '@/app/(backoffice)/taller/[id]/page'
import TallerAgendaPage from '@/app/(backoffice)/taller/agenda/page'
import { approvedRepairQueue } from '@/lib/dashboard/approved-repairs'
import { scheduleApprovedRepair } from '@/app/(backoffice)/taller/owner-quote-actions'
import { scheduleWorkOrder } from '@/app/(backoffice)/taller/actions'
import { CommercialHome } from '@/app/(backoffice)/dashboard/commercial-home'
import DashboardPage from '@/app/(backoffice)/dashboard/page'

const client = createGuardedTestPrisma()
const { send, authorize } = vi.hoisted(() => ({ send: vi.fn(), authorize: vi.fn() }))
vi.mock('@/lib/db', () => ({
  get db() {
    return client
  },
}))
vi.mock('@/lib/auth', () => ({
  requireCanEditTaller: authorize,
  requireCanViewTaller: authorize,
  requireAuth: authorize,
}))
vi.mock('next/navigation', async (original) => ({
  ...(await original<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh() {} }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/lib/email/client', () => ({ getResend: () => ({ emails: { send } }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const email = 'propietario@example.test'
const testUsers: string[] = []
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
  await client.user.deleteMany({ where: { id: { in: testUsers.splice(0) } } })
  vi.useRealTimers()
  vi.unstubAllEnvs()
})
afterAll(() => client.$disconnect())

it('agrupa las partidas aceptadas para coordinación y refleja la planificación y sus cambios en la inspección cerrada', async () => {
  const makeUser = async (name: string, entryInspectionCoordinator = false) => {
    const u = await client.user.create({
      data: {
        name,
        role: 'TALLER',
        email: crypto.randomUUID() + '@example.test',
        entryInspectionCoordinator,
      },
    })
    testUsers.push(u.id)
    return u
  }
  const coordinator =
    (await client.user.findFirst({ where: { entryInspectionCoordinator: true, active: true } })) ??
    (await makeUser('Nerea de prueba', true))
  const worker = await makeUser('Técnico de prueba')
  const extra = await client.workOrderChecklist.create({
    data: { workOrderId: orderId, category: 'CAMPER', item: 'Calefacción', ownerQuote: true },
  })
  const lines = [line(), { itemId: extra.id, description: 'Cambiar la bujía', cents: 18000 }]
  await saveQuoteAction(orderId, { version: 0, revision: 0, lines })
  await emailLatest()
  const q = await getQuote(),
    token = link()
  const queue = () => approvedRepairQueue(client, coordinator.id)
  const pending = async () => (await queue())?.tasks.filter((t) => t.inspectionId === orderId)
  expect(await pending()).toEqual([])
  await client.workOrder.update({ where: { id: orderId }, data: { status: 'COMPLETADA' } })
  await Promise.all([visit(token, 'ACEPTADO'), visit(token, 'ACEPTADO')])
  expect(await pending()).toHaveLength(1)
  const task = (await pending())![0]
  expect(task.lines).toHaveLength(2)
  expect(task.lines.map((l) => l.item).sort()).toEqual(['Bomba', 'Calefacción'])
  authorize.mockResolvedValue(coordinator)
  const home = await DashboardPage({ searchParams: {} })
  const markup = renderToStaticMarkup(
    home.type === CommercialHome ? await CommercialHome(home.props) : home
  )
  expect(markup).toContain('Programar en taller')
  expect(markup).toContain('Cambiar la bujía')
  expect(await approvedRepairQueue(client, worker.id)).toBeNull()
  const booking = {
    assignedToId: worker.id,
    scheduledStart: '2026-11-16',
    scheduledEnd: '2026-11-17',
    estimatedHours: 3,
  }
  authorize.mockResolvedValue(worker)
  expect(await scheduleApprovedRepair(q.id, booking)).toMatchObject({ ok: false })
  authorize.mockResolvedValue(coordinator)
  expect(
    await scheduleApprovedRepair(q.id, { ...booking, scheduledEnd: '2026-11-15' })
  ).toMatchObject({ ok: false })
  const booked = await Promise.all([
    scheduleApprovedRepair(q.id, booking),
    scheduleApprovedRepair(q.id, booking),
  ])
  expect(booked.filter((r) => r.ok)).toHaveLength(1)
  const repairId = (await getQuote()).repairOrderId!
  const repair = await client.workOrder.findUniqueOrThrow({ where: { id: repairId } })
  expect(repair).toMatchObject({
    kind: 'REPARACION',
    assignedToId: worker.id,
    vehicleId: (await client.workOrder.findUniqueOrThrow({ where: { id: orderId } })).vehicleId,
  })
  expect(repair.description).toContain('Cambiar la bujía')
  expect(repair.description).not.toContain('Observación privada')
  expect(
    await client.workOrder.count({ where: { vehicleId: repair.vehicleId, kind: 'REPARACION' } })
  ).toBe(1)
  expect(await pending()).toEqual([])
  vi.setSystemTime(new Date('2026-11-16T09:00:00Z'))
  expect(renderToStaticMarkup(await TallerAgendaPage({ searchParams: {} }))).toContain(
    '/taller/' + repairId
  )
  const inspection = () => WorkOrderPage({ params: { id: orderId } }).then(renderToStaticMarkup)
  const initial = await inspection()
  expect(initial).toContain('16/11/2026')
  expect(initial).toContain('17/11/2026')
  expect(initial).toContain(worker.name)
  expect(
    await scheduleWorkOrder(repairId, {
      ...booking,
      assignedToId: coordinator.id,
      scheduledStart: '2026-11-19T12:00:00Z',
      scheduledEnd: '2026-11-20T12:00:00Z',
    })
  ).toMatchObject({ ok: true })
  const revised = await inspection()
  expect(revised).toContain('19/11/2026')
  expect(revised).toContain('20/11/2026')
  expect(revised).toContain('Responsable del trabajo · ' + coordinator.name)
})

it('mantiene solo la última aceptación pendiente y bloquea un formulario de una versión anterior', async () => {
  await save()
  await emailLatest()
  await visit(link(), 'ACEPTADO')
  const old = await getQuote()
  await save(old.version, old.revision)
  await emailLatest()
  const mine = async () =>
    (await approvedRepairQueue(client))!.tasks.filter((t) => t.inspectionId === orderId)
  expect((await mine()).map((t) => t.version)).toEqual([1])
  await visit(link(), 'RECHAZADO')
  expect((await mine()).map((t) => t.version)).toEqual([1])
  const rejected = await getQuote()
  await save(rejected.version, rejected.revision)
  await emailLatest()
  await visit(link(), 'ACEPTADO')
  expect((await mine()).map((t) => t.version)).toEqual([3])
  authorize.mockResolvedValue({ role: 'ADMIN', id: 'admin' })
  expect(
    await scheduleApprovedRepair(old.id, {
      assignedToId: 'worker',
      scheduledStart: '2026-11-16',
      scheduledEnd: '2026-11-17',
      estimatedHours: 3,
    })
  ).toMatchObject({ ok: false, error: expect.stringContaining('última versión') })
})

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
