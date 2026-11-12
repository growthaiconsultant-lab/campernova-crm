import type { Prisma, UserRole } from '@prisma/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, expect, it, vi } from 'vitest'
import Page from '@/app/(backoffice)/dashboard/page'
import { CommercialHome } from '@/app/(backoffice)/dashboard/commercial-home'
import { createGuardedTestPrisma, uniqueSuffix, withRollbackTransaction } from './db'

const client = createGuardedTestPrisma()
let connection: Prisma.TransactionClient
let actor: { id: string; role: UserRole }
vi.mock('@/lib/db', () => ({
  get db() {
    return connection
  },
}))
vi.mock('@/lib/auth', () => ({ requireAuth: async () => actor }))
vi.mock('next/navigation', async (original) => ({
  ...(await original<typeof import('next/navigation')>()),
  useRouter: () => ({}),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}))
afterAll(() => client.$disconnect())

it('aísla las dos listas por responsable y cambia el ámbito de administración en la ruta real', async () => {
  const now = new Date('2026-11-12T10:00:00Z')
  vi.setSystemTime(now)
  try {
    await withRollbackTransaction(client, async (tx) => {
      connection = tx
      const user = (name: string, role: UserRole) =>
        tx.user.create({ data: { name, role, email: uniqueSuffix() + '@integ.test' } })
      const a = await user('Agente A', 'AGENTE'),
        b = await user('Agente B', 'AGENTE'),
        admin = await user('Administrador', 'ADMIN')
      const buyer = await tx.buyerLead.create({
        data: {
          name: 'Cliente Alfa',
          phone: '600000000',
          agentId: a.id,
          nextActionType: 'LLAMAR',
          nextActionDueAt: now,
        },
      })
      const seller = await tx.sellerLead.create({
        data: {
          name: 'Vendedor Beta',
          agentId: b.id,
          nextActionType: 'PEDIR_DOCS',
          nextActionDueAt: new Date('2026-11-09T12:00:00Z'),
        },
      })
      const vehicle = await tx.vehicle.create({
        data: { sellerLeadId: seller.id, brand: 'Ford', model: 'Transit', type: 'CAMPER' },
      })
      const offer = await tx.offer.create({
        data: {
          amount: 40000,
          depositAmount: 700,
          status: 'ACEPTADA',
          reservedUntil: now,
          buyerLeadId: buyer.id,
          vehicleId: vehicle.id,
          createdById: b.id,
        },
      })
      await tx.vehicleCapture.createMany({
        data: [
          { title: 'Captación libre', createdById: a.id },
          {
            title: 'Entrada Beta',
            assignedToId: b.id,
            createdById: a.id,
            status: 'ENTRADA_AGENDADA',
            entradaScheduledAt: new Date('2026-11-12T15:00:00Z'),
          },
          {
            title: 'Captación histórica convertida',
            assignedToId: a.id,
            createdById: a.id,
            sellerLeadId: seller.id,
          },
        ],
      })
      const delivery = await tx.delivery.create({
        data: {
          vehicleId: vehicle.id,
          buyerLeadId: buyer.id,
          offerId: offer.id,
          responsableId: admin.id,
          scheduledAt: now,
        },
      })
      const order = await tx.workOrder.create({
        data: {
          vehicleId: vehicle.id,
          assignedToId: b.id,
          description: 'Revisión de prueba',
          scheduledStart: now,
        },
      })
      const event = {
        createdById: b.id,
        startAt: new Date('2026-11-12T12:00:00Z'),
        type: 'CITA' as const,
      }
      await tx.calendarEvent.createMany({
        data: [
          { ...event, assignedToId: a.id, title: 'Visita Alfa' },
          { ...event, assignedToId: b.id, title: 'Visita Beta' },
          { ...event, assignedToId: admin.id, title: 'Visita propia' },
          {
            ...event,
            assignedToId: admin.id,
            title: 'Llamada propia',
            type: 'LLAMADA',
            startAt: new Date('2026-11-11T09:00:00Z'),
          },
          { ...event, assignedToId: a.id, title: 'Visita cancelada', status: 'CANCELADO' },
          {
            ...event,
            assignedToId: a.id,
            title: 'Cita de mañana',
            startAt: new Date('2026-11-12T23:00:00Z'),
          },
        ],
      })
      async function view(user: typeof actor, query: { vista?: string; agent?: string } = {}) {
        actor = user
        const page = await Page({ searchParams: query })
        expect(page.type).toBe(CommercialHome)
        return renderToStaticMarkup(await CommercialHome(page.props))
      }
      const mine = await view(a, { vista: 'equipo', agent: b.id })
      expect(mine).toContain('Por hacer')
      expect(mine).toContain('Agenda de hoy')
      expect(mine).toContain('Visita Alfa')
      expect(mine).toContain('Cliente Alfa')
      expect(mine).toContain('#oferta-' + offer.id)
      expect(mine).not.toContain('/entregas/' + delivery.id)
      expect(mine).not.toContain('/taller/' + order.id)
      for (const other of [
        'Beta',
        'Visita propia',
        'Captación libre',
        'Captación histórica convertida',
        'Visita cancelada',
        'Cita de mañana',
        'El día del equipo',
      ])
        expect(mine).not.toContain(other)
      const second = await view(b)
      expect(second).toContain('Vendedor Beta')
      expect(second).toContain('Entrada Beta')
      expect(second).toContain('Visita Beta')
      expect(second).toContain('/taller/' + order.id)
      expect(second).not.toContain('Alfa')
      expect(second).not.toContain(offer.id)
      const team = await view(admin)
      for (const label of [
        'El día del equipo',
        'Cliente Alfa',
        'Vendedor Beta',
        'Captación libre',
        'Sin asignar',
        'Visita Alfa',
        'Visita Beta',
        'Visita propia',
        'Llamada propia',
      ])
        expect(team).toContain(label)
      const personal = await view(admin, { vista: 'mi-trabajo', agent: b.id })
      expect(personal).toContain('Visita propia')
      expect(personal).toContain('/entregas/' + delivery.id)
      expect(personal).not.toContain('/taller/' + order.id)
      expect(personal).toContain('Llamada propia')
      for (const other of ['Visita Alfa', 'Vendedor Beta', 'Captación libre', offer.id])
        expect(personal).not.toContain(other)
      expect(await view(admin, { agent: a.id })).not.toContain('Visita propia')
      expect(await view(await user('Sin trabajo', 'AGENTE'))).toContain(
        'Sin citas programadas para hoy.'
      )
    })
  } finally {
    vi.useRealTimers()
  }
})
