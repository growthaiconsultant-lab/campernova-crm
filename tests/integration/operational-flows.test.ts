import { randomUUID, randomInt } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { DeliveryKind, PrismaClient, UserRole } from '@prisma/client'
import { createGuardedTestPrisma, uniqueSuffix, withRollbackTransaction } from './db'
import { withLockedRoots, type LockRoot } from '@/lib/locking'
import {
  createOperationalDeliveryTx,
  changeOperationalDeliveryTx,
  type DeliveryRootsSnapshot,
} from '@/lib/operational-deliveries'
import { createOperationalDocumentTx } from '@/lib/operational-documents'
import type { ManualDeliveryInput, OperationalTarget } from '@/lib/operations-input'
import { buildDeliveryCreationRoots } from '@/lib/delivery-creation'

let db: PrismaClient, other: PrismaClient, observer: PrismaClient
const cleanup: Array<() => Promise<void>> = []
beforeAll(() => {
  db = createGuardedTestPrisma()
  other = createGuardedTestPrisma()
  observer = createGuardedTestPrisma()
})
afterEach(async () => {
  for (const fn of cleanup.splice(0).reverse()) await fn()
})
afterAll(async () => {
  await Promise.all([db, other, observer].map((c) => c.$disconnect()))
})
async function fixture(role: UserRole = 'TALLER') {
  const suffix = uniqueSuffix()
  const actor = await db.user.create({
    data: { name: `QA OPS ${suffix}`, email: `${suffix}@example.test`, role, active: true },
  })
  const seller = await db.sellerLead.create({
    data: { name: `QA OPS ${suffix}`, archivedAt: new Date() },
  })
  const buyer = await db.buyerLead.create({
    data: {
      name: `QA OPS ${suffix}`,
      email: `${suffix}@example.test`,
      phone: '600000000',
      archivedAt: new Date(),
    },
  })
  const vehicle = await db.vehicle.create({ data: { sellerLeadId: seller.id } })
  cleanup.push(async () => {
    const linked = await db.delivery.findMany({
      where: { vehicleId: vehicle.id },
      select: { buyerLeadId: true },
    })
    const buyerIds = Array.from(
      new Set([buyer.id, ...linked.flatMap((d) => (d.buyerLeadId ? [d.buyerLeadId] : []))])
    )
    await db.vehicleDocument.deleteMany({
      where: {
        OR: [{ vehicleId: vehicle.id }, { buyerLeadId: buyer.id }, { sellerLeadId: seller.id }],
      },
    })
    await db.activity.deleteMany({ where: { agentId: actor.id } })
    await db.warranty.deleteMany({ where: { vehicleId: vehicle.id } })
    await db.vehicle.delete({ where: { id: vehicle.id } })
    await db.kpiEvent.deleteMany({ where: { entityType: 'buyer', entityId: { in: buyerIds } } })
    await db.buyerLead.deleteMany({ where: { id: { in: buyerIds } } })
    await db.sellerLead.delete({ where: { id: seller.id } })
    await db.user.delete({ where: { id: actor.id } })
  })
  const roots: LockRoot[] = [
    { type: 'vehicle', id: vehicle.id },
    { type: 'buyerLead', id: buyer.id },
    { type: 'sellerLead', id: seller.id },
  ]
  return { actor, seller, buyer, vehicle, roots }
}
type Fixture = Awaited<ReturnType<typeof fixture>>
function input(f: Fixture, kind: DeliveryKind = 'VENTA'): ManualDeliveryInput {
  return {
    operationId: randomUUID(),
    vehicleId: f.vehicle.id,
    kind,
    recipient: {
      type: kind === 'VENTA' ? 'buyerLead' : 'sellerLead',
      id: kind === 'VENTA' ? f.buyer.id : f.seller.id,
    },
    scheduledAt: '2026-10-01T10:00:00Z',
    responsableId: null,
    notes: null,
  }
}
function create(f: Fixture, data: ManualDeliveryInput, client = db) {
  return withLockedRoots(
    buildDeliveryCreationRoots({
      vehicleId: data.vehicleId,
      sellerLeadId: f.seller.id,
      buyerLeadId: data.recipient.type === 'buyerLead' ? data.recipient.id : null,
      recipientSellerLeadId: data.recipient.type === 'sellerLead' ? data.recipient.id : null,
    }),
    (tx) => createOperationalDeliveryTx(tx, data, f.actor.id, f.seller.id),
    { client }
  )
}
async function snapshot(id: string): Promise<DeliveryRootsSnapshot> {
  const d = await db.delivery.findUniqueOrThrow({ where: { id }, include: { vehicle: true } })
  return {
    id,
    vehicleId: d.vehicleId,
    buyerLeadId: d.buyerLeadId,
    recipientSellerLeadId: d.recipientSellerLeadId,
    sellerLeadId: d.vehicle.sellerLeadId,
  }
}
async function change(
  f: Fixture,
  id: string,
  target: 'EN_CURSO' | 'COMPLETADA' | 'CANCELADA',
  client = db
) {
  const s = await snapshot(id)
  return withLockedRoots(
    buildDeliveryCreationRoots({ ...s, sellerLeadId: f.seller.id }),
    (tx) =>
      changeOperationalDeliveryTx(
        tx,
        s,
        f.actor.id,
        target,
        new Date('2026-10-01T11:00:00Z'),
        'QA cancelación'
      ),
    { client }
  )
}
function barrier() {
  let open!: () => void
  const wait = new Promise<void>((resolve) => {
    open = resolve
  })
  return { open, wait }
}
async function blocked() {
  const deadline = Date.now() + 7000
  while (Date.now() < deadline) {
    const rows = await observer.$queryRaw<
      Array<{ n: number }>
    >`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'`
    if (rows[0].n > 0) return
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error('No se demostró contención de locks')
}

describe('OPS-1 entregas independientes — PostgreSQL real', () => {
  function newBuyerInput(f: Fixture): ManualDeliveryInput {
    const suffix = uniqueSuffix()
    return {
      ...input(f),
      recipient: {
        type: 'newBuyer',
        name: `QA entrega ${suffix}`,
        email: `${suffix}@example.test`,
        phone: `6${randomInt(10000000, 99999999)}`,
        source: 'WALLAPOP',
      },
    }
  }
  it('nuevo comprador y entrega se guardan juntos; replay conserva una sola ficha y KPI', async () => {
    const f = await fixture(),
      request = newBuyerInput(f)
    const [first, replay] = await Promise.all([create(f, request), create(f, request, other)])
    expect(first.id).toBe(replay.id)
    const delivery = await db.delivery.findUniqueOrThrow({ where: { id: first.id } })
    const buyer = await db.buyerLead.findUniqueOrThrow({ where: { id: delivery.buyerLeadId! } })
    expect(buyer.status).toBe('NUEVO')
    expect(buyer.source).toBe('WALLAPOP')
    expect(await db.buyerLead.count({ where: { email: buyer.email } })).toBe(1)
    expect(
      await db.kpiEvent.count({ where: { eventName: 'buyer_created', entityId: buyer.id } })
    ).toBe(1)
    expect((await db.vehicle.findUniqueOrThrow({ where: { id: f.vehicle.id } })).soldAt).toBeNull()
    await expect(create(f, { ...request, notes: 'otros datos' })).rejects.toThrow('otros datos')
    if (request.recipient.type !== 'newBuyer') throw new Error('fixture')
    await expect(
      create(f, {
        ...request,
        recipient: { ...request.recipient, source: 'INSTAGRAM' },
      })
    ).rejects.toThrow('otros datos')
    await change(f, first.id, 'CANCELADA')
    expect(await db.buyerLead.findUnique({ where: { id: buyer.id } })).not.toBeNull()
    expect((await db.buyerLead.findUniqueOrThrow({ where: { id: buyer.id } })).source).toBe(
      'WALLAPOP'
    )
    await create(f, { ...input(f), recipient: { type: 'buyerLead', id: buyer.id } })
  })
  it('una venta bloqueada revierte también el comprador nuevo y su KPI', async () => {
    const f = await fixture(),
      request = newBuyerInput(f)
    await db.vehicle.update({
      where: { id: f.vehicle.id },
      data: { status: 'VENDIDO', soldAt: new Date() },
    })
    const buyersBefore = await db.buyerLead.count(),
      kpisBefore = await db.kpiEvent.count()
    await expect(create(f, request)).rejects.toThrow('venta registrada')
    expect(await db.buyerLead.count()).toBe(buyersBefore)
    expect(await db.kpiEvent.count()).toBe(kpisBefore)
    expect(await db.delivery.count({ where: { vehicleId: f.vehicle.id } })).toBe(0)
  })
  it.each(['email', 'phone'] as const)(
    'dos vehículos con el mismo %s no crean compradores duplicados',
    async (field) => {
      const f = await fixture(),
        g = await fixture(),
        request = newBuyerInput(f),
        rival = newBuyerInput(g)
      if (request.recipient.type !== 'newBuyer' || rival.recipient.type !== 'newBuyer')
        throw new Error('fixture')
      rival.recipient[field] = request.recipient[field]
      if (field === 'phone') rival.recipient.phone = `+34 ${request.recipient.phone}`
      const inserted = barrier(),
        release = barrier()
      const winner = withLockedRoots(
        buildDeliveryCreationRoots({
          vehicleId: f.vehicle.id,
          sellerLeadId: f.seller.id,
          buyerLeadId: null,
        }),
        (tx) =>
          createOperationalDeliveryTx(tx, request, f.actor.id, f.seller.id, {
            afterNewBuyerCreated: async () => {
              inserted.open()
              await release.wait
            },
          }),
        { client: db }
      )
      await inserted.wait
      const loser = create(g, rival, other)
      const resultsPromise = Promise.allSettled([winner, loser])
      try {
        await blocked()
      } finally {
        release.open()
      }
      const results = await resultsPromise
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
      expect(failed.reason.message).toContain('Ya existe una ficha')
    }
  )
  it('detecta email existente sin distinguir mayúsculas y no duplica ni vincula a otra persona', async () => {
    const f = await fixture(),
      request = newBuyerInput(f)
    if (request.recipient.type !== 'newBuyer') throw new Error('fixture')
    request.recipient.email = f.buyer.email.toUpperCase()
    await expect(create(f, request)).rejects.toThrow('Ya existe una ficha')
    expect(await db.delivery.count({ where: { vehicleId: f.vehicle.id } })).toBe(0)
  })
  it('completar con un comprador nuevo registra la venta y vincula su garantía', async () => {
    const f = await fixture(),
      result = await create(f, newBuyerInput(f))
    await change(f, result.id, 'COMPLETADA')
    const delivery = await db.delivery.findUniqueOrThrow({ where: { id: result.id } })
    expect(
      (await db.buyerLead.findUniqueOrThrow({ where: { id: delivery.buyerLeadId! } })).status
    ).toBe('CERRADO')
    expect(
      await db.warranty.count({
        where: { deliveryId: result.id, buyerLeadId: delivery.buyerLeadId! },
      })
    ).toBe(1)
  })
  it('un usuario revocado no crea una ficha de comprador desde la entrega', async () => {
    const f = await fixture(),
      buyersBefore = await db.buyerLead.count()
    await db.user.update({ where: { id: f.actor.id }, data: { active: false } })
    await expect(create(f, newBuyerInput(f))).rejects.toThrow('permiso')
    expect(await db.buyerLead.count()).toBe(buyersBefore)
  })
  it.each(['AGENTE', 'MARKETING'] as const)(
    'nuevo comprador no concede permisos de alta a %s',
    async (role) => {
      const f = await fixture(role),
        buyersBefore = await db.buyerLead.count()
      await expect(create(f, newBuyerInput(f))).rejects.toThrow('permiso')
      expect(await db.buyerLead.count()).toBe(buyersBefore)
    }
  )
  it.each(['VENTA', 'DEVOLUCION_VENDEDOR', 'ENTREGA_TALLER'] as const)(
    '%s completa sin oferta, match, firma ni checklist obligatorio',
    async (kind) => {
      const f = await fixture(),
        request = input(f, kind),
        created = await create(f, request)
      expect(await create(f, request)).toEqual({ id: created.id, replayed: true })
      const before = await db.delivery.findUniqueOrThrow({
        where: { id: created.id },
        include: { checklist: true },
      })
      expect(before.offerId).toBeNull()
      expect(before.signatureUrl).toBeNull()
      expect(before.checklist.every((c) => c.result === 'PENDIENTE')).toBe(true)
      await change(f, created.id, 'COMPLETADA')
      expect((await change(f, created.id, 'COMPLETADA')).replayed).toBe(true)
      expect(await db.warranty.count({ where: { vehicleId: f.vehicle.id } })).toBe(
        kind === 'VENTA' ? 1 : 0
      )
      expect(
        await db.postventaFollowup.count({ where: { warranty: { vehicleId: f.vehicle.id } } })
      ).toBe(kind === 'VENTA' ? 2 : 0)
      expect(
        (await db.vehicle.findUniqueOrThrow({ where: { id: f.vehicle.id } })).soldAt !== null
      ).toBe(kind === 'VENTA')
      expect(
        await db.activity.count({ where: { agentId: f.actor.id, type: 'ENTREGA_COMPLETADA' } })
      ).toBe(1)
    }
  )
  it('permite otra entrega de taller después de una venta sin duplicar garantía', async () => {
    const f = await fixture()
    await change(f, (await create(f, input(f))).id, 'COMPLETADA')
    const service = await create(f, input(f, 'ENTREGA_TALLER'))
    await change(f, service.id, 'EN_CURSO')
    await change(f, service.id, 'COMPLETADA')
    expect(await db.warranty.count({ where: { vehicleId: f.vehicle.id } })).toBe(1)
    await expect(create(f, input(f))).rejects.toThrow('venta registrada')
  })
  it('no reutiliza la solicitud con otro contenido y no duplica una entrega activa', async () => {
    const f = await fixture(),
      request = input(f)
    await create(f, request)
    await expect(create(f, { ...request, notes: 'otro' })).rejects.toThrow('otros datos')
    await expect(create(f, input(f, 'ENTREGA_TALLER'))).rejects.toThrow('entrega activa')
  })
  it.each(['AGENTE', 'MARKETING'] as const)(
    'rechaza %s sin conceder permisos de entrega',
    async (role) => {
      const f = await fixture(role)
      await expect(create(f, input(f))).rejects.toThrow('permiso')
      expect(await db.delivery.count({ where: { vehicleId: f.vehicle.id } })).toBe(0)
    }
  )
  it('revocar el usuario impide la mutación aunque el formulario ya estuviera abierto', async () => {
    const f = await fixture(),
      d = await create(f, input(f))
    await db.user.update({ where: { id: f.actor.id }, data: { active: false } })
    await expect(change(f, d.id, 'COMPLETADA')).rejects.toThrow('permiso')
  })
  it.each(['beforeWarranty', 'beforeFollowups'] as const)(
    'rollback integral al fallar %s',
    async (hook) => {
      const f = await fixture(),
        d = await create(f, input(f)),
        s = await snapshot(d.id)
      await expect(
        withLockedRoots(
          f.roots,
          (tx) =>
            changeOperationalDeliveryTx(tx, s, f.actor.id, 'COMPLETADA', new Date(), undefined, {
              [hook]: async () => {
                throw new Error('QA fallo')
              },
            }),
          { client: db }
        )
      ).rejects.toThrow('QA fallo')
      expect((await db.delivery.findUniqueOrThrow({ where: { id: d.id } })).status).toBe(
        'PROGRAMADA'
      )
      expect(
        (await db.vehicle.findUniqueOrThrow({ where: { id: f.vehicle.id } })).soldAt
      ).toBeNull()
      expect(
        await db.activity.count({ where: { agentId: f.actor.id, type: 'ENTREGA_COMPLETADA' } })
      ).toBe(0)
      expect(await db.warranty.count({ where: { vehicleId: f.vehicle.id } })).toBe(0)
    }
  )
  it('relee el compromiso económico antes de completar una venta', async () => {
    const f = await fixture(),
      competitor = await fixture(),
      d = await create(f, input(f))
    const offer = await db.offer.create({
      data: {
        vehicleId: f.vehicle.id,
        buyerLeadId: competitor.buyer.id,
        createdById: f.actor.id,
        amount: 1000,
        depositAmount: 100,
        status: 'ACEPTADA',
      },
    })
    cleanup.push(async () => {
      await db.offer.deleteMany({ where: { id: offer.id } })
    })
    await expect(change(f, d.id, 'COMPLETADA')).rejects.toThrow('compromiso económico')
    expect((await db.delivery.findUniqueOrThrow({ where: { id: d.id } })).status).toBe('PROGRAMADA')
    expect(await db.warranty.count({ where: { vehicleId: f.vehicle.id } })).toBe(0)
  })
  it('no completa si la raíz cambió entre lectura y adquisición de locks', async () => {
    const f = await fixture(),
      d = await create(f, input(f)),
      s = await snapshot(d.id)
    await expect(
      withLockedRoots(
        f.roots,
        (tx) =>
          changeOperationalDeliveryTx(
            tx,
            { ...s, sellerLeadId: 'otro' },
            f.actor.id,
            'COMPLETADA',
            new Date()
          ),
        { client: db }
      )
    ).rejects.toThrow('han cambiado')
    expect((await db.vehicle.findUniqueOrThrow({ where: { id: f.vehicle.id } })).soldAt).toBeNull()
  })
  it('doble creación concurrente devuelve una sola entrega con contención real', async () => {
    const f = await fixture(),
      request = input(f),
      entered = barrier(),
      release = barrier()
    const a = withLockedRoots(
      f.roots,
      async (tx) => {
        entered.open()
        await release.wait
        return createOperationalDeliveryTx(tx, request, f.actor.id, f.seller.id)
      },
      { client: db }
    )
    await entered.wait
    const b = create(f, request, other)
    const both = Promise.all([a, b])
    try {
      await blocked()
    } finally {
      release.open()
    }
    const results = await both
    expect(results[0].id).toBe(results[1].id)
    expect(await db.delivery.count({ where: { vehicleId: f.vehicle.id } })).toBe(1)
  })
  it.each(['COMPLETADA', 'CANCELADA'] as const)(
    'completar frente a %s conserva un único resultado terminal',
    async (competing) => {
      const f = await fixture(),
        d = await create(f, input(f)),
        s = await snapshot(d.id),
        entered = barrier(),
        release = barrier()
      const a = withLockedRoots(
        f.roots,
        async (tx) => {
          entered.open()
          await release.wait
          return changeOperationalDeliveryTx(tx, s, f.actor.id, 'COMPLETADA', new Date())
        },
        { client: db }
      )
      await entered.wait
      const b = change(f, d.id, competing, other)
      const both = Promise.allSettled([a, b])
      try {
        await blocked()
      } finally {
        release.open()
      }
      const results = await both
      expect(results[0].status).toBe('fulfilled')
      expect(results[1].status).toBe(competing === 'COMPLETADA' ? 'fulfilled' : 'rejected')
      expect(await db.warranty.count({ where: { vehicleId: f.vehicle.id } })).toBe(1)
      expect(
        await db.postventaFollowup.count({ where: { warranty: { vehicleId: f.vehicle.id } } })
      ).toBe(2)
    }
  )
  it('cancelar es idempotente y no permite completar después', async () => {
    const f = await fixture(),
      d = await create(f, input(f))
    await change(f, d.id, 'CANCELADA')
    expect((await change(f, d.id, 'CANCELADA')).replayed).toBe(true)
    await expect(change(f, d.id, 'COMPLETADA')).rejects.toThrow('cerrada')
    expect(await db.warranty.count({ where: { vehicleId: f.vehicle.id } })).toBe(0)
  })
})

describe('OPS-1 documentos versionados por destino — PostgreSQL real', () => {
  it.each(['vehicle', 'buyerLead', 'sellerLead'] as const)(
    'adjunta a %s sin dependencias comerciales y conserva versión privada',
    async (type) => {
      const f = await fixture(),
        target: OperationalTarget = {
          type,
          id: type === 'vehicle' ? f.vehicle.id : type === 'buyerLead' ? f.buyer.id : f.seller.id,
        }
      const request = {
        target,
        operationId: randomUUID(),
        category: 'PRESUPUESTO' as const,
        name: 'QA presupuesto.pdf',
      }
      const file = {
        path: `operational/qa/${randomUUID()}.pdf`,
        mime: 'application/pdf',
        size: 10,
        checksum: 'qa-checksum',
        fingerprint: 'qa-hash',
      }
      const createDoc = (client = db) =>
        withLockedRoots(
          [target],
          (tx) => createOperationalDocumentTx(tx, request, f.actor.id, file),
          { client }
        )
      const result = await createDoc()
      expect(await createDoc()).toEqual(result)
      const stored = await db.vehicleDocument.findUniqueOrThrow({
        where: { id: result.id },
        include: { currentVersion: true, versions: true },
      })
      expect([stored.vehicleId, stored.buyerLeadId, stored.sellerLeadId].filter(Boolean)).toEqual([
        target.id,
      ])
      expect(stored.currentVersion?.bucket).toBe('vehicle-documents')
      expect(stored.versions).toHaveLength(1)
      expect(stored.currentVersion?.checksum).toBe(file.checksum)
      await expect(
        withLockedRoots(
          [target],
          (tx) =>
            createOperationalDocumentTx(tx, request, f.actor.id, {
              ...file,
              fingerprint: 'different',
            }),
          { client: db }
        )
      ).rejects.toThrow('otro archivo')
    }
  )
  it('doble subida concurrente no duplica metadatos ni versiones', async () => {
    const f = await fixture(),
      target = { type: 'buyerLead' as const, id: f.buyer.id },
      request = {
        target,
        operationId: randomUUID(),
        category: 'OPERATIVO' as const,
        name: 'QA.pdf',
      }
    const file = {
      path: 'operational/qa/a.pdf',
      mime: 'application/pdf',
      size: 9,
      checksum: 'qa',
      fingerprint: 'same',
    }
    const entered = barrier(),
      release = barrier()
    const a = withLockedRoots(
      [target],
      async (tx) => {
        entered.open()
        await release.wait
        return createOperationalDocumentTx(tx, request, f.actor.id, file)
      },
      { client: db }
    )
    await entered.wait
    const b = withLockedRoots(
      [target],
      (tx) =>
        createOperationalDocumentTx(tx, request, f.actor.id, {
          ...file,
          path: 'operational/qa/b.pdf',
        }),
      { client: other }
    )
    const both = Promise.all([a, b])
    try {
      await blocked()
    } finally {
      release.open()
    }
    const results = await both
    expect(results[0]).toEqual(results[1])
    expect(await db.vehicleDocument.count({ where: { buyerLeadId: f.buyer.id } })).toBe(1)
    expect(await db.documentVersion.count({ where: { vehicleDocumentId: results[0].id } })).toBe(1)
  })
  it('CHECK rechaza doble destino y documento legal en un comprador', async () => {
    const f = await fixture()
    await expect(
      withRollbackTransaction(db, (tx) =>
        tx.vehicleDocument.create({
          data: {
            vehicleId: f.vehicle.id,
            buyerLeadId: f.buyer.id,
            category: 'PRESUPUESTO',
            name: 'QA',
            url: 'qa',
          },
        })
      )
    ).rejects.toThrow('vehicle_documents_target_check')
    await expect(
      withRollbackTransaction(db, (tx) =>
        tx.vehicleDocument.create({
          data: { buyerLeadId: f.buyer.id, category: 'DNI_VENDEDOR', name: 'QA', url: 'qa' },
        })
      )
    ).rejects.toThrow('vehicle_documents_target_check')
  })
  it.each(['ENTREGAS', 'MARKETING'] as const)('rechaza documentos para rol %s', async (role) => {
    const f = await fixture(role),
      target = { type: 'vehicle' as const, id: f.vehicle.id }
    await expect(
      withLockedRoots(
        [target],
        (tx) =>
          createOperationalDocumentTx(
            tx,
            { target, operationId: randomUUID(), category: 'PRESUPUESTO', name: 'QA' },
            f.actor.id,
            { path: 'qa', size: 5, mime: 'application/pdf', checksum: 'qa', fingerprint: 'qa' }
          ),
        { client: db }
      )
    ).rejects.toThrow('permiso')
  })
})
