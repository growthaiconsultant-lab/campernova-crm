import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { User } from '@prisma/client'
import { uniqueSuffix } from './db'

vi.mock('@/lib/db', async () => {
  const { createGuardedTestPrisma } = await import('./db')
  return { db: createGuardedTestPrisma() }
})
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAgente: vi.fn() }))
vi.mock('@/lib/matching', () => ({ recalculateMatchesForBuyer: vi.fn() }))
vi.mock('@/lib/email/send', () => ({ sendCalendarEventAssigned: vi.fn() }))

import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { addBuyerLeadNote } from '@/app/(backoffice)/compradores/[id]/actions'
import {
  createCalendarEvent,
  updateCalendarEventStatus,
} from '@/app/(backoffice)/calendario/actions'
import {
  buyerActionInput,
  buyerCommercialNotesWhere,
  FOLLOWUP_PAGE_SIZE,
} from '@/lib/buyer-followup'
import { getCalendarItems } from '@/lib/calendar/aggregate'
import { prismaCalendarDeps } from '@/lib/calendar/prisma-deps'

let actor: User
const ids: string[] = []
beforeAll(async () => {
  actor = await db.user.create({
    data: {
      authId: uniqueSuffix(),
      email: `${uniqueSuffix()}@example.test`,
      name: 'Comercial de prueba',
      role: 'AGENTE',
    },
  })
  vi.mocked(requireAgente).mockResolvedValue(actor)
})
afterEach(async () => {
  await db.buyerLead.deleteMany({ where: { id: { in: ids.splice(0) } } })
})
afterAll(async () => {
  if (actor) await db.user.delete({ where: { id: actor.id } })
  await db.$disconnect()
})
async function buyer() {
  const lead = await db.buyerLead.create({
    data: {
      name: 'Comprador de prueba',
      phone: '600000000',
      agentId: actor.id,
      nextActionType: 'LLAMAR',
    },
  })
  ids.push(lead.id)
  return lead
}

describe('COM-10 seguimiento desde ficha — PostgreSQL', () => {
  it('las notas humanas sobreviven a 60 actividades recientes; excluye origen, reparto y sistema', async () => {
    const lead = await buyer()
    expect(await addBuyerLeadNote(lead.id, 'Conversación con el comprador')).toEqual({ ok: true })
    await db.activity.updateMany({
      where: { buyerLeadId: lead.id },
      data: { createdAt: new Date('2020-01-01') },
    })
    await db.activity.createMany({
      data: [
        ...Array.from({ length: 60 }, () => ({
          buyerLeadId: lead.id,
          agentId: actor.id,
          type: 'CAMBIO_ESTADO' as const,
          content: 'Actualización automática',
        })),
        {
          buyerLeadId: lead.id,
          agentId: actor.id,
          type: 'NOTA' as const,
          content: 'Origen cambiado: Web → Meta',
        },
        {
          buyerLeadId: lead.id,
          agentId: actor.id,
          type: 'NOTA' as const,
          content: 'COM-9: asignación automática inicial por turno rotativo.',
        },
        {
          buyerLeadId: lead.id,
          agentId: null,
          type: 'NOTA' as const,
          content: 'Datos del formulario',
        },
      ],
    })
    const notes = await db.activity.findMany({
      where: buyerCommercialNotesWhere(lead.id),
      include: { agent: true },
    })
    expect(notes).toHaveLength(1)
    expect(notes[0]).toMatchObject({
      content: 'Conversación con el comprador',
      agent: { id: actor.id },
    })
    expect(await db.activity.count({ where: { buyerLeadId: lead.id } })).toBe(64)
    await db.activity.createMany({
      data: Array.from({ length: 12 }, (_, i) => ({
        buyerLeadId: lead.id,
        agentId: actor.id,
        type: 'NOTA' as const,
        content: `Nota ${i}`,
      })),
    })
    const all = await db.activity.findMany({
      where: buyerCommercialNotesWhere(lead.id),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    const secondPage = await db.activity.findMany({
      where: buyerCommercialNotesWhere(lead.id),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: FOLLOWUP_PAGE_SIZE,
      take: FOLLOWUP_PAGE_SIZE,
    })
    expect(secondPage.map((note) => note.id)).toEqual(all.slice(10).map((note) => note.id))
  })

  it('persiste varias acciones, conserva la destacada, aparece en calendario y permite completar', async () => {
    const lead = await buyer()
    const start = new Date(Date.now() + 3 * 86400000)
    const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
    const base = {
      buyerLeadId: lead.id,
      actorId: actor.id,
      title: '',
      date,
      time: '17:30',
      notes: 'Hablar de financiación',
      commitment: 'EXTERNO' as const,
    }
    const first = await createCalendarEvent(buyerActionInput({ ...base, action: 'LLAMAR' }))
    const second = await createCalendarEvent(
      buyerActionInput({ ...base, action: 'WHATSAPP', time: '18:30' })
    )
    expect(first.id).toBeTruthy()
    expect(second.id).toBeTruthy()
    expect(first.id).not.toBe(second.id)
    expect(await db.calendarEvent.count({ where: { buyerLeadId: lead.id } })).toBe(2)
    expect((await db.buyerLead.findUniqueOrThrow({ where: { id: lead.id } })).nextActionType).toBe(
      'LLAMAR'
    )
    const events = await getCalendarItems(
      prismaCalendarDeps(db),
      { from: new Date(Date.now() + 86400000), to: new Date(Date.now() + 5 * 86400000) },
      { assigneeId: actor.id }
    )
    expect(events.filter((event) => event.source === 'event')).toHaveLength(2)
    expect(await db.calendarEvent.findUnique({ where: { id: first.id } })).toMatchObject({
      description: base.notes,
      commitment: 'EXTERNO',
      assignedToId: actor.id,
    })
    await updateCalendarEventStatus(first.id!, 'COMPLETADO', { resultNotes: 'Hemos hablado' })
    expect(
      await db.calendarEvent.count({
        where: { buyerLeadId: lead.id, status: { notIn: ['COMPLETADO', 'CANCELADO', 'NO_SHOW'] } },
      })
    ).toBe(1)
  })

  it('la ruta reutilizada rechaza comprador archivado y acceso no autorizado', async () => {
    const lead = await buyer()
    await db.buyerLead.update({ where: { id: lead.id }, data: { archivedAt: new Date() } })
    const result = await createCalendarEvent({
      type: 'LLAMADA',
      title: 'Llamar',
      startAt: new Date(Date.now() + 86400000).toISOString(),
      buyerLeadId: lead.id,
      assignedToId: actor.id,
    })
    expect(result.error).toContain('archivado')
    expect(await db.calendarEvent.count({ where: { buyerLeadId: lead.id } })).toBe(0)
    vi.mocked(requireAgente).mockRejectedValueOnce(new Error('FORBIDDEN'))
    await expect(addBuyerLeadNote(lead.id, 'No guardar')).rejects.toThrow('FORBIDDEN')
    expect(await db.activity.count({ where: { buyerLeadId: lead.id } })).toBe(0)
  })
})
