/**
 * PERM-3 sobre PostgreSQL real: locks, CAS, unicidad e idempotencia contable.
 * La base efímera está protegida por createGuardedTestPrisma; nunca usa producción.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { withLockedRoots, type LockRoot } from '@/lib/locking'
import { transitionTicketTx } from '@/lib/postventa/transition-ticket'
import { transitionWorkOrderTx } from '@/lib/taller/transition-work-order'
import { createGuardedTestPrisma, uniqueSuffix } from './db'

let prismaA: PrismaClient
let prismaB: PrismaClient
const cleanups: Array<() => Promise<void>> = []

type Fixture = {
  userId: string
  sellerId: string
  vehicleId: string
  buyerId: string
  warrantyId: string
}

async function seed(): Promise<Fixture> {
  const suffix = uniqueSuffix()
  const user = await prismaA.user.create({
    data: { name: `Admin ${suffix}`, email: `admin_${suffix}@integ.test`, role: 'ADMIN' },
  })
  const seller = await prismaA.sellerLead.create({
    data: { name: `Seller ${suffix}`, email: `seller_${suffix}@integ.test`, phone: '600000000' },
  })
  const vehicle = await prismaA.vehicle.create({
    data: {
      sellerLeadId: seller.id,
      brand: 'Adria',
      model: 'Coral',
      year: 2021,
      km: 25_000,
      seats: 4,
      type: 'AUTOCARAVANA',
      status: 'RESERVADO',
    },
  })
  const buyer = await prismaA.buyerLead.create({
    data: { name: `Buyer ${suffix}`, email: `buyer_${suffix}@integ.test`, phone: '600000001' },
  })
  const offer = await prismaA.offer.create({
    data: {
      vehicleId: vehicle.id,
      buyerLeadId: buyer.id,
      amount: 30_000,
      createdById: user.id,
      status: 'CONVERTIDA',
    },
  })
  const delivery = await prismaA.delivery.create({
    data: {
      vehicleId: vehicle.id,
      buyerLeadId: buyer.id,
      offerId: offer.id,
      status: 'COMPLETADA',
      scheduledAt: new Date('2026-08-01T09:00:00Z'),
      completedAt: new Date('2026-08-01T12:00:00Z'),
    },
  })
  const warranty = await prismaA.warranty.create({
    data: {
      vehicleId: vehicle.id,
      deliveryId: delivery.id,
      buyerLeadId: buyer.id,
      startDate: new Date('2026-08-01T00:00:00Z'),
      endDate: new Date('2027-08-01T00:00:00Z'),
    },
  })

  cleanups.push(async () => {
    await prismaA.activity.deleteMany({
      where: { OR: [{ sellerLeadId: seller.id }, { buyerLeadId: buyer.id }] },
    })
    await prismaA.vehicleCost.deleteMany({ where: { vehicleId: vehicle.id } })
    await prismaA.postventaTicket.deleteMany({ where: { warrantyId: warranty.id } })
    await prismaA.warranty.deleteMany({ where: { id: warranty.id } })
    await prismaA.delivery.deleteMany({ where: { id: delivery.id } })
    await prismaA.offer.deleteMany({ where: { id: offer.id } })
    await prismaA.workOrder.deleteMany({ where: { vehicleId: vehicle.id } })
    await prismaA.vehicle.deleteMany({ where: { id: vehicle.id } })
    await prismaA.buyerLead.deleteMany({ where: { id: buyer.id } })
    await prismaA.sellerLead.deleteMany({ where: { id: seller.id } })
    await prismaA.user.deleteMany({ where: { id: user.id } })
  })

  return {
    userId: user.id,
    sellerId: seller.id,
    vehicleId: vehicle.id,
    buyerId: buyer.id,
    warrantyId: warranty.id,
  }
}

function workshopRoots(fixture: Fixture): LockRoot[] {
  return [
    { type: 'vehicle', id: fixture.vehicleId },
    { type: 'sellerLead', id: fixture.sellerId },
  ]
}

function ticketRoots(fixture: Fixture): LockRoot[] {
  return [
    { type: 'vehicle', id: fixture.vehicleId },
    { type: 'buyerLead', id: fixture.buyerId },
  ]
}

beforeAll(() => {
  prismaA = createGuardedTestPrisma()
  prismaB = createGuardedTestPrisma()
})

afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!()
})

afterAll(async () => {
  await Promise.all([prismaA.$disconnect(), prismaB.$disconnect()])
})

describe('PERM-3 workshop accounting', () => {
  it('serializa dos compleciones y crea una sola proyección por categoría', async () => {
    const fixture = await seed()
    const order = await prismaA.workOrder.create({
      data: {
        vehicleId: fixture.vehicleId,
        status: 'EN_CURSO',
        kind: 'REPARACION',
        description: 'Reparación concurrente',
        startedAt: new Date('2026-08-02T09:00:00Z'),
        timeEntries: {
          create: {
            workerId: fixture.userId,
            hours: 2,
            hourlyRate: 30,
            description: 'Mecánica',
            workDate: new Date('2026-08-02T00:00:00Z'),
          },
        },
        parts: { create: { name: 'Filtro', quantity: 2, unitCost: 20 } },
      },
    })

    const complete = (client: PrismaClient) =>
      withLockedRoots(
        workshopRoots(fixture),
        (tx) =>
          transitionWorkOrderTx(tx, {
            workOrderId: order.id,
            expectedCurrentStatus: 'EN_CURSO',
            target: 'COMPLETADA',
            kind: 'forward',
            actorId: fixture.userId,
          }),
        { client, lockTimeoutMs: 8_000 }
      )

    const results = await Promise.all([complete(prismaA), complete(prismaB)])
    expect(results.map((result) => result.changed).sort()).toEqual([false, true])

    const [costs, activities] = await Promise.all([
      prismaA.vehicleCost.findMany({
        where: { workOrderId: order.id },
        orderBy: { category: 'asc' },
      }),
      prismaA.activity.count({
        where: { sellerLeadId: fixture.sellerId, type: 'ORDEN_TALLER_COMPLETADA' },
      }),
    ])
    expect(costs).toHaveLength(2)
    expect(costs.map((cost) => Number(cost.amount)).sort((a, b) => a - b)).toEqual([40, 60])
    expect(activities).toBe(1)
  })

  it('reabre conservando costes y la siguiente compleción los reconcilia sin duplicar', async () => {
    const fixture = await seed()
    const order = await prismaA.workOrder.create({
      data: {
        vehicleId: fixture.vehicleId,
        status: 'EN_CURSO',
        kind: 'REPARACION',
        description: 'Reparación revisable',
        timeEntries: {
          create: {
            workerId: fixture.userId,
            hours: 1,
            hourlyRate: 30,
            description: 'Primera intervención',
            workDate: new Date('2026-08-02T00:00:00Z'),
          },
        },
      },
    })
    const transition = (target: 'COMPLETADA' | 'EN_CURSO', kind: 'forward' | 'reopen') =>
      withLockedRoots(workshopRoots(fixture), (tx) =>
        transitionWorkOrderTx(tx, {
          workOrderId: order.id,
          expectedCurrentStatus: kind === 'reopen' ? 'COMPLETADA' : 'EN_CURSO',
          target,
          kind,
          actorId: fixture.userId,
          reason: kind === 'reopen' ? 'Trabajo adicional detectado' : undefined,
        })
      )

    await transition('COMPLETADA', 'forward')
    const first = await prismaA.vehicleCost.findUniqueOrThrow({
      where: { workOrderId_category: { workOrderId: order.id, category: 'MANO_OBRA_TALLER' } },
    })
    await transition('EN_CURSO', 'reopen')
    expect(await prismaA.vehicleCost.count({ where: { workOrderId: order.id } })).toBe(1)

    await prismaA.workOrderTimeEntry.create({
      data: {
        workOrderId: order.id,
        workerId: fixture.userId,
        hours: 2,
        hourlyRate: 30,
        description: 'Trabajo adicional',
        workDate: new Date('2026-08-03T00:00:00Z'),
      },
    })
    await transition('COMPLETADA', 'forward')

    const reconciled = await prismaA.vehicleCost.findUniqueOrThrow({
      where: { workOrderId_category: { workOrderId: order.id, category: 'MANO_OBRA_TALLER' } },
    })
    expect(reconciled.id).toBe(first.id)
    expect(Number(reconciled.amount)).toBe(90)
    expect(await prismaA.vehicleCost.count({ where: { workOrderId: order.id } })).toBe(1)
  })

  it('revierte estado y postings si falla un efecto dentro de la transacción', async () => {
    const fixture = await seed()
    const order = await prismaA.workOrder.create({
      data: {
        vehicleId: fixture.vehicleId,
        status: 'EN_CURSO',
        kind: 'REPARACION',
        description: 'Rollback taller',
        timeEntries: {
          create: {
            workerId: fixture.userId,
            hours: 1,
            hourlyRate: 30,
            description: 'Trabajo',
            workDate: new Date('2026-08-02T00:00:00Z'),
          },
        },
      },
    })

    await expect(
      withLockedRoots(workshopRoots(fixture), (tx) =>
        transitionWorkOrderTx(tx, {
          workOrderId: order.id,
          expectedCurrentStatus: 'EN_CURSO',
          target: 'COMPLETADA',
          kind: 'forward',
          actorId: 'actor-inexistente',
        })
      )
    ).rejects.toBeDefined()

    expect((await prismaA.workOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      'EN_CURSO'
    )
    expect(await prismaA.vehicleCost.count({ where: { workOrderId: order.id } })).toBe(0)
  })
})

describe('PERM-3 post-sales accounting', () => {
  it('serializa dos cierres, conserva el coste al reabrir y lo actualiza al recerrar', async () => {
    const fixture = await seed()
    const ticket = await prismaA.postventaTicket.create({
      data: {
        warrantyId: fixture.warrantyId,
        status: 'RESUELTO',
        title: 'Boiler',
        description: 'Fuga',
        costReal: 150,
        resolvedAt: new Date('2026-08-02T10:00:00Z'),
      },
    })
    const close = (client: PrismaClient) =>
      withLockedRoots(
        ticketRoots(fixture),
        (tx) =>
          transitionTicketTx(tx, {
            ticketId: ticket.id,
            expectedCurrentStatus: 'RESUELTO',
            target: 'CERRADO',
            kind: 'forward',
            actorId: fixture.userId,
          }),
        { client, lockTimeoutMs: 8_000 }
      )

    const results = await Promise.all([close(prismaA), close(prismaB)])
    expect(results.map((result) => result.changed).sort()).toEqual([false, true])
    const first = await prismaA.vehicleCost.findUniqueOrThrow({
      where: { postventaTicketId: ticket.id },
    })
    expect(Number(first.amount)).toBe(150)
    expect(await prismaA.vehicleCost.count({ where: { postventaTicketId: ticket.id } })).toBe(1)

    await withLockedRoots(ticketRoots(fixture), (tx) =>
      transitionTicketTx(tx, {
        ticketId: ticket.id,
        expectedCurrentStatus: 'CERRADO',
        target: 'RESUELTO',
        kind: 'reopen',
        actorId: fixture.userId,
        reason: 'Incidencia reproducida',
      })
    )
    expect(await prismaA.vehicleCost.count({ where: { postventaTicketId: ticket.id } })).toBe(1)

    await prismaA.postventaTicket.update({ where: { id: ticket.id }, data: { costReal: 225 } })
    await close(prismaA)
    const reconciled = await prismaA.vehicleCost.findUniqueOrThrow({
      where: { postventaTicketId: ticket.id },
    })
    expect(reconciled.id).toBe(first.id)
    expect(Number(reconciled.amount)).toBe(225)
    expect(await prismaA.activity.count({ where: { buyerLeadId: fixture.buyerId } })).toBe(3)
  })

  it('revierte el cierre completo si falla el posting o la Activity', async () => {
    const fixture = await seed()
    const ticket = await prismaA.postventaTicket.create({
      data: {
        warrantyId: fixture.warrantyId,
        status: 'RESUELTO',
        title: 'Rollback',
        description: 'Prueba atómica',
        costReal: 80,
        resolvedAt: new Date('2026-08-02T10:00:00Z'),
      },
    })

    await expect(
      withLockedRoots(ticketRoots(fixture), (tx) =>
        transitionTicketTx(tx, {
          ticketId: ticket.id,
          expectedCurrentStatus: 'RESUELTO',
          target: 'CERRADO',
          kind: 'forward',
          actorId: 'actor-inexistente',
        })
      )
    ).rejects.toBeDefined()

    expect(
      (await prismaA.postventaTicket.findUniqueOrThrow({ where: { id: ticket.id } })).status
    ).toBe('RESUELTO')
    expect(await prismaA.vehicleCost.count({ where: { postventaTicketId: ticket.id } })).toBe(0)
  })
})
