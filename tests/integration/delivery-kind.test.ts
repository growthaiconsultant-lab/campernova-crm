import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DeliveryKind, Prisma, PrismaClient } from '@prisma/client'
import { createGuardedTestPrisma, uniqueSuffix, withRollbackTransaction } from './db'
import { createWarrantyForDelivery } from '@/lib/postventa'

let db: PrismaClient
beforeAll(() => {
  db = createGuardedTestPrisma()
})
afterAll(async () => {
  await db?.$disconnect()
})

async function fixture(tx: Prisma.TransactionClient) {
  const suffix = uniqueSuffix()
  const seller = await tx.sellerLead.create({ data: { name: `OPS QA ${suffix}` } })
  const buyer = await tx.buyerLead.create({
    data: { name: `OPS QA ${suffix}`, email: `ops-${suffix}@example.test`, phone: '600000000' },
  })
  const vehicle = await tx.vehicle.create({ data: { sellerLeadId: seller.id } })
  return { seller, buyer, vehicle }
}

describe('OPS-1A: esquema expandido, PostgreSQL real', () => {
  it.each(['VENTA', 'DEVOLUCION_VENDEDOR', 'ENTREGA_TALLER'] as const)(
    'persiste y lee %s sin oferta, conservando tipo y destinatario',
    async (kind) => {
      await withRollbackTransaction(db, async (tx) => {
        const f = await fixture(tx)
        const delivery = await tx.delivery.create({
          data: {
            kind,
            vehicleId: f.vehicle.id,
            scheduledAt: new Date('2026-10-01T10:00:00Z'),
            buyerLeadId: kind === 'VENTA' ? f.buyer.id : null,
            recipientSellerLeadId: kind === 'VENTA' ? null : f.seller.id,
          },
          include: { buyerLead: true, recipientSellerLead: true, offer: true },
        })
        expect(delivery.kind).toBe(kind)
        expect(delivery.offer).toBeNull()
        expect(delivery.buyerLeadId).toBe(kind === 'VENTA' ? f.buyer.id : null)
        expect(delivery.recipientSellerLeadId).toBe(kind === 'VENTA' ? null : f.seller.id)
        expect(
          (await tx.vehicle.findUniqueOrThrow({ where: { id: f.vehicle.id } })).soldAt
        ).toBeNull()
        expect(await tx.warranty.count({ where: { vehicleId: f.vehicle.id } })).toBe(0)
      })
    }
  )

  it.each([
    ['VENTA', false, false],
    ['VENTA', true, true],
    ['DEVOLUCION_VENDEDOR', true, false],
    ['ENTREGA_TALLER', false, false],
    ['ENTREGA_TALLER', true, true],
  ] as const)('CHECK rechaza %s con buyer=%s y seller=%s', async (kind, buyer, seller) => {
    await expect(
      withRollbackTransaction(db, async (tx) => {
        const f = await fixture(tx)
        await tx.delivery.create({
          data: {
            kind: kind as DeliveryKind,
            vehicleId: f.vehicle.id,
            scheduledAt: new Date(),
            buyerLeadId: buyer ? f.buyer.id : null,
            recipientSellerLeadId: seller ? f.seller.id : null,
          },
        })
      })
    ).rejects.toThrow('deliveries_kind_recipient_check')
  })

  it('la FK impide un destinatario vendedor inexistente', async () => {
    await expect(
      withRollbackTransaction(db, async (tx) => {
        const f = await fixture(tx)
        await tx.delivery.create({
          data: {
            kind: 'DEVOLUCION_VENDEDOR',
            vehicleId: f.vehicle.id,
            scheduledAt: new Date(),
            recipientSellerLeadId: `missing_${uniqueSuffix()}`,
          },
        })
      })
    ).rejects.toMatchObject({ code: 'P2003' })
  })

  it('el índice parcial impide dos entregas activas aunque sean de tipos distintos', async () => {
    await expect(
      withRollbackTransaction(db, async (tx) => {
        const f = await fixture(tx)
        await tx.delivery.create({
          data: {
            kind: 'VENTA',
            vehicleId: f.vehicle.id,
            buyerLeadId: f.buyer.id,
            scheduledAt: new Date(),
          },
        })
        await tx.delivery.create({
          data: {
            kind: 'ENTREGA_TALLER',
            vehicleId: f.vehicle.id,
            buyerLeadId: f.buyer.id,
            scheduledAt: new Date(),
          },
        })
      })
    ).rejects.toMatchObject({ code: 'P2002' })
  })

  it.each(['DEVOLUCION_VENDEDOR', 'ENTREGA_TALLER'] as const)(
    '%s completada no puede originar garantía ni seguimientos',
    async (kind) => {
      await withRollbackTransaction(db, async (tx) => {
        const f = await fixture(tx)
        const delivery = await tx.delivery.create({
          data: {
            kind,
            vehicleId: f.vehicle.id,
            recipientSellerLeadId: f.seller.id,
            status: 'COMPLETADA',
            scheduledAt: new Date(),
            completedAt: new Date(),
          },
        })
        await expect(createWarrantyForDelivery(delivery.id, tx)).rejects.toThrow(
          'Warranty requires a sale'
        )
        expect(await tx.warranty.count({ where: { deliveryId: delivery.id } })).toBe(0)
        expect(
          await tx.postventaFollowup.count({ where: { warranty: { deliveryId: delivery.id } } })
        ).toBe(0)
        expect(
          (await tx.vehicle.findUniqueOrThrow({ where: { id: f.vehicle.id } })).soldAt
        ).toBeNull()
      })
    }
  )
})
