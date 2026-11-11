import { pendingSellerCalendarEvents, sellerSteps } from '@/lib/seller-agenda'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import type { User } from '@prisma/client'
import { saveSellerFollowup } from '@/app/(backoffice)/vendedores/[id]/followup-action'
import { getCalendarItems } from '@/lib/calendar/aggregate'
import { prismaCalendarDeps } from '@/lib/calendar/prisma-deps'
import { uniqueSuffix } from './db'

vi.mock('@/lib/db', async () => ({ db: (await import('./db')).createGuardedTestPrisma() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAgente: vi.fn() }))
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
let actor: User, owner: User
const ids: string[] = []
beforeAll(async () => {
  const create = () =>
    db.user.create({
      data: {
        name: 'Comercial de prueba',
        role: 'AGENTE',
        email: uniqueSuffix() + '@example.test',
      },
    })
  actor = await create()
  owner = await create()
  vi.mocked(requireAgente).mockResolvedValue(actor)
})
afterAll(async () => {
  await db.calendarEvent.deleteMany({ where: { sellerLeadId: { in: ids } } })
  await db.activity.deleteMany({ where: { sellerLeadId: { in: ids } } })
  await db.sellerLead.deleteMany({ where: { id: { in: ids } } })
  await db.user.deleteMany({ where: { id: { in: [actor.id, owner.id] } } })
  await db.$disconnect()
})
async function seed() {
  const seller = await db.sellerLead.create({
    data: { name: 'Prueba', agentId: owner.id, nextActionType: 'LLAMAR' },
  })
  ids.push(seller.id)
  return seller
}
function input() {
  return {
    requestId: randomUUID(),
    outcome: 'Comentar oferta',
    next: {
      title: 'Confirmar con el vendedor',
      startAt: new Date(Date.now() + 86400000).toISOString(),
    },
    finishReminder: null,
  }
}
describe('seguimiento del vendedor', () => {
  it('guarda una sola llamada y cita en dos envíos simultáneos y respeta el responsable y el recordatorio anterior', async () => {
    const seller = await seed(),
      data = input()
    const result = await Promise.all([
      saveSellerFollowup(seller.id, data),
      saveSellerFollowup(seller.id, data),
    ])
    expect(result[0]).toMatchObject({ ok: true })
    expect(result[0]).toEqual(result[1])
    const row = await db.sellerLead.findUniqueOrThrow({
      where: { id: seller.id },
      include: { calendarEvents: { ...pendingSellerCalendarEvents, take: 1 }, agent: true },
    })
    expect(
      sellerSteps(
        row.calendarEvents,
        row.nextActionType,
        row.nextActionDueAt,
        row.agent?.name ?? null
      )[0]
    ).toMatchObject({ title: data.next.title, owner: owner.name })
    const items = await getCalendarItems(
      prismaCalendarDeps(db),
      { from: new Date(), to: new Date(Date.now() + 2 * 86400000) },
      { assigneeId: owner.id }
    )
    expect(items.filter((item) => item.source === 'event').map((item) => item.title)).toContain(
      data.next.title
    )

    expect(await db.calendarEvent.findMany({ where: { sellerLeadId: seller.id } })).toMatchObject([
      { title: data.next.title, assignedToId: owner.id, createdById: actor.id },
    ])
    expect(await db.activity.findMany({ where: { sellerLeadId: seller.id } })).toMatchObject([
      { type: 'LLAMADA', agentId: actor.id, content: data.outcome },
    ])
    expect(
      (await db.sellerLead.findUniqueOrThrow({ where: { id: seller.id } })).nextActionType
    ).toBe('LLAMAR')
    expect(
      await saveSellerFollowup(seller.id, { ...data, outcome: 'Otra llamada' })
    ).toHaveProperty('error')
  })
  it('completa sólo el recordatorio elegido y rechaza un recordatorio modificado sin guardar una llamada parcial', async () => {
    const seller = await seed(),
      data = { ...input(), next: null, finishReminder: { dueAt: null } }
    expect(
      await saveSellerFollowup(seller.id, {
        ...data,
        finishReminder: { dueAt: new Date().toISOString() },
      })
    ).toHaveProperty('error')
    expect(await db.activity.count({ where: { sellerLeadId: seller.id } })).toBe(0)
    expect(await saveSellerFollowup(seller.id, data)).toMatchObject({ ok: true })
    expect(
      (await db.sellerLead.findUniqueOrThrow({ where: { id: seller.id } })).nextActionType
    ).toBeNull()
  })
  it('permite programar sin llamada y protege admisión y archivado', async () => {
    const seller = await seed(),
      data = { ...input(), outcome: null }
    expect(await saveSellerFollowup(seller.id, data)).toMatchObject({ ok: true })
    expect(await db.activity.count({ where: { sellerLeadId: seller.id, type: 'LLAMADA' } })).toBe(0)
    for (const intakeStatus of ['PENDIENTE', 'RECHAZADO'] as const) {
      await db.sellerLead.update({ where: { id: seller.id }, data: { intakeStatus } })
      expect(await saveSellerFollowup(seller.id, input())).toHaveProperty('error')
    }
    await db.sellerLead.update({
      where: { id: seller.id },
      data: { intakeStatus: 'ADMITIDO', archivedAt: new Date() },
    })
    expect(await saveSellerFollowup(seller.id, input())).toHaveProperty('error')
    expect(await saveSellerFollowup(seller.id, { ...input(), next: null })).toMatchObject({
      ok: true,
    })
  })
})
