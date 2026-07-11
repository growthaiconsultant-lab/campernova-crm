/**
 * Tests de integración con PostgreSQL REAL (PR5) — metadatos de documentos privados.
 *
 * PostgreSQL plano NO emula Supabase Storage, así que estos tests cubren la parte REAL que
 * sí vive en la base de datos: los metadatos de `VehicleDocument`/`DeliveryDocument`. Verifican
 * que los documentos nuevos guardan el OBJECT PATH (no una URL http), sus relaciones con la
 * entidad, la cascada de borrado (sin huérfanos) y la repetibilidad. La subida real a Storage y
 * las URLs firmadas se cubren con fakes controlados en los tests unitarios (ver informe).
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { createGuardedTestPrisma, uniqueSuffix } from './db'

let prisma: PrismaClient
const cleanups: Array<() => Promise<void>> = []

type Seeded = {
  userId: string
  sellerId: string
  vehicleId: string
  buyerId: string
  deliveryId: string
}

async function seed(): Promise<Seeded> {
  const s = uniqueSuffix()
  const user = await prisma.user.create({
    data: { email: `agent_${s}@integ.test`, name: `Agent ${s}`, role: 'AGENTE' },
  })
  const seller = await prisma.sellerLead.create({
    data: { name: `Seller ${s}`, email: `seller_${s}@integ.test`, phone: `p_${s}` },
  })
  const vehicle = await prisma.vehicle.create({
    data: {
      sellerLeadId: seller.id,
      brand: 'Adria',
      model: 'Coral',
      year: 2020,
      km: 1000,
      seats: 4,
      type: 'AUTOCARAVANA',
    },
  })
  const buyer = await prisma.buyerLead.create({
    data: { name: `Buyer ${s}`, email: `buyer_${s}@integ.test`, phone: `b_${s}` },
  })
  const delivery = await prisma.delivery.create({
    data: {
      vehicleId: vehicle.id,
      buyerLeadId: buyer.id,
      scheduledAt: new Date('2026-06-01T09:00:00Z'),
    },
  })

  cleanups.push(async () => {
    await prisma.deliveryDocument.deleteMany({ where: { deliveryId: delivery.id } })
    await prisma.vehicleDocument.deleteMany({ where: { vehicleId: vehicle.id } })
    await prisma.delivery.deleteMany({ where: { id: delivery.id } })
    await prisma.vehicle.deleteMany({ where: { id: vehicle.id } })
    await prisma.buyerLead.deleteMany({ where: { id: buyer.id } })
    await prisma.sellerLead.deleteMany({ where: { id: seller.id } })
    await prisma.user.deleteMany({ where: { id: user.id } })
  })

  return {
    userId: user.id,
    sellerId: seller.id,
    vehicleId: vehicle.id,
    buyerId: buyer.id,
    deliveryId: delivery.id,
  }
}

beforeAll(() => {
  prisma = createGuardedTestPrisma()
})
afterEach(async () => {
  for (const clean of cleanups.splice(0).reverse()) await clean()
})
afterAll(async () => {
  await prisma?.$disconnect()
})

describe('integración · metadatos de VehicleDocument', () => {
  it('persiste el OBJECT PATH (no una URL http), con relación y autor', async () => {
    const seeded = await seed()
    const path = `docs/${seeded.vehicleId}/${uniqueSuffix()}.pdf`

    const doc = await prisma.vehicleDocument.create({
      data: {
        vehicleId: seeded.vehicleId,
        category: 'CONTRATO_COMPRAVENTA',
        name: 'Contrato',
        url: path,
        fileSize: 1234,
        mimeType: 'application/pdf',
        uploadedById: seeded.userId,
      },
      include: { vehicle: true, uploadedBy: true },
    })

    expect(doc.url).toBe(path)
    expect(doc.url.startsWith('http')).toBe(false)
    expect(doc.vehicle.id).toBe(seeded.vehicleId)
    expect(doc.uploadedBy?.id).toBe(seeded.userId)
  })

  it('el borrado del vehículo cascadea sus documentos (sin huérfanos)', async () => {
    const seeded = await seed()
    await prisma.vehicleDocument.create({
      data: {
        vehicleId: seeded.vehicleId,
        category: 'DNI_VENDEDOR',
        name: 'DNI',
        url: `docs/${seeded.vehicleId}/${uniqueSuffix()}.pdf`,
      },
    })
    expect(await prisma.vehicleDocument.count({ where: { vehicleId: seeded.vehicleId } })).toBe(1)

    // Cascada: al borrar el vendedor se borra el vehículo y, con él, sus documentos.
    await prisma.sellerLead.delete({ where: { id: seeded.sellerId } })
    expect(await prisma.vehicleDocument.count({ where: { vehicleId: seeded.vehicleId } })).toBe(0)
  })
})

describe('integración · metadatos de DeliveryDocument', () => {
  it('persiste el path de la entrega y cascadea al borrar la entrega', async () => {
    const seeded = await seed()
    const path = `deliveries/${seeded.deliveryId}/${uniqueSuffix()}.pdf`

    const doc = await prisma.deliveryDocument.create({
      data: {
        deliveryId: seeded.deliveryId,
        category: 'CONTRATO_FINAL',
        name: 'Contrato final',
        url: path,
        uploadedById: seeded.userId,
      },
      include: { delivery: true },
    })
    expect(doc.url).toBe(path)
    expect(doc.url.startsWith('http')).toBe(false)
    expect(doc.delivery.id).toBe(seeded.deliveryId)

    await prisma.delivery.delete({ where: { id: seeded.deliveryId } })
    expect(await prisma.deliveryDocument.count({ where: { deliveryId: seeded.deliveryId } })).toBe(
      0
    )
  })
})
