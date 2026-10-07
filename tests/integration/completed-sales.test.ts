import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { createGuardedTestPrisma, withRollbackTransaction, uniqueSuffix } from './db'
import { completedSalesQuery } from '@/lib/completed-sales'

let db: PrismaClient
beforeAll(() => {
  db = createGuardedTestPrisma()
})
afterAll(() => db.$disconnect())

describe('COM-3 relaciones históricas de venta — PostgreSQL real', () => {
  it('recupera compra desde ambas fichas sin oferta/match, incluso cerradas y archivadas', async () => {
    await withRollbackTransaction(db, async (tx) => {
      const seller = await tx.sellerLead.create({
        data: { name: 'QA vendedor', archivedAt: new Date() },
      })
      const buyer = await tx.buyerLead.create({
        data: {
          name: 'QA comprador',
          email: `${uniqueSuffix()}@example.test`,
          phone: '600000000',
          status: 'CERRADO',
          archivedAt: new Date(),
        },
      })
      const vehicle = await tx.vehicle.create({
        data: {
          sellerLeadId: seller.id,
          status: 'VENDIDO',
          soldAt: new Date(),
          plate: `QA${uniqueSuffix()}`,
        },
      })
      const completedAt = new Date('2026-10-07T12:00:00Z')
      const sale = await tx.delivery.create({
        data: {
          vehicleId: vehicle.id,
          buyerLeadId: buyer.id,
          kind: 'VENTA',
          status: 'COMPLETADA',
          scheduledAt: completedAt,
          completedAt,
        },
      })
      const b = await tx.buyerLead.findUniqueOrThrow({
        where: { id: buyer.id },
        include: { deliveries: completedSalesQuery },
      })
      const s = await tx.sellerLead.findUniqueOrThrow({
        where: { id: seller.id },
        include: { vehicle: { include: { deliveries: completedSalesQuery } } },
      })
      expect(b.deliveries.map((d) => d.id)).toEqual([sale.id])
      expect(s.vehicle?.deliveries.map((d) => d.id)).toEqual([sale.id])
      expect(b.deliveries[0].vehicle.sellerLead.id).toBe(seller.id)
      expect(s.vehicle?.deliveries[0].buyerLead?.id).toBe(buyer.id)
      expect(b.deliveries[0].completedAt).toEqual(completedAt)
      expect(b.deliveries[0].vehicle.plate).toBe(vehicle.plate)
      expect(await tx.match.count({ where: { vehicleId: vehicle.id } })).toBe(0)
      expect(await tx.offer.count({ where: { vehicleId: vehicle.id } })).toBe(0)
    })
  })
  it('filtra tipos/estados antes de ordenar, mantiene campos nulos y aísla las fichas', async () => {
    await withRollbackTransaction(db, async (tx) => {
      const seller = await tx.sellerLead.create({ data: { name: 'QA seller' } })
      const otherSeller = await tx.sellerLead.create({ data: { name: 'QA seller' } })
      const buyer = await tx.buyerLead.create({
        data: { name: 'QA buyer', email: `${uniqueSuffix()}@example.test`, phone: '600000000' },
      })
      const otherBuyer = await tx.buyerLead.create({
        data: { name: 'QA buyer', email: `${uniqueSuffix()}@example.test`, phone: '600000000' },
      })
      const vehicle = await tx.vehicle.create({ data: { sellerLeadId: seller.id } })
      const otherVehicle = await tx.vehicle.create({ data: { sellerLeadId: otherSeller.id } })
      const base = { vehicleId: vehicle.id, buyerLeadId: buyer.id, scheduledAt: new Date() }
      const older = await tx.delivery.create({
        data: { ...base, status: 'COMPLETADA', completedAt: new Date('2026-01-01') },
      })
      const newer = await tx.delivery.create({
        data: { ...base, status: 'COMPLETADA', completedAt: new Date('2026-02-01') },
      })
      const missingDate = await tx.delivery.create({ data: { ...base, status: 'COMPLETADA' } })
      await tx.delivery.create({
        data: { ...base, status: 'CANCELADA', completedAt: new Date('2026-03-01') },
      })
      await tx.delivery.create({ data: { ...base, status: 'EN_CURSO' } })
      await tx.delivery.create({
        data: {
          vehicleId: otherVehicle.id,
          buyerLeadId: buyer.id,
          scheduledAt: new Date(),
          status: 'PROGRAMADA',
        },
      })
      await tx.delivery.create({
        data: {
          ...base,
          kind: 'DEVOLUCION_VENDEDOR',
          buyerLeadId: null,
          recipientSellerLeadId: seller.id,
          status: 'COMPLETADA',
          completedAt: new Date('2026-04-01'),
        },
      })
      await tx.delivery.create({
        data: {
          ...base,
          kind: 'ENTREGA_TALLER',
          status: 'COMPLETADA',
          completedAt: new Date('2026-04-02'),
        },
      })
      await tx.delivery.create({
        data: {
          ...base,
          vehicleId: otherVehicle.id,
          buyerLeadId: otherBuyer.id,
          status: 'COMPLETADA',
          completedAt: new Date('2026-05-01'),
        },
      })
      const b = await tx.buyerLead.findUniqueOrThrow({
        where: { id: buyer.id },
        include: { deliveries: completedSalesQuery },
      })
      const s = await tx.sellerLead.findUniqueOrThrow({
        where: { id: seller.id },
        include: { vehicle: { include: { deliveries: completedSalesQuery } } },
      })
      expect(b.deliveries.map((d) => d.id)).toEqual([newer.id, older.id, missingDate.id])
      expect(s.vehicle?.deliveries.map((d) => d.id)).toEqual([newer.id, older.id, missingDate.id])
      expect(b.deliveries[2].completedAt).toBeNull()
      expect(b.deliveries[2].vehicle.plate).toBeNull()
      expect(
        b.deliveries.every(
          (d) => d.buyerLead?.id === buyer.id && d.vehicle.sellerLead.id === seller.id
        )
      ).toBe(true)
    })
  })
})
