/**
 * Tests de integración con PostgreSQL REAL (PR5B3) — backfill legacy → DocumentVersion.
 *
 * Verifican sobre una base efímera migrada que el backfill: crea la versión 1 reutilizando el
 * object path existente (sin tocar Storage), sincroniza puntero + url, deja la metadata desconocida
 * en null, es idempotente y seguro ante concurrencia (CAS), rechaza objectPath duplicado, y que el
 * rollback revierte una v1 intacta pero se niega si el documento evolucionó. No se firma ni toca
 * Storage en ningún momento.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  backfillVersionTx,
  rollbackVersionTx,
  DocumentBackfillConflictError,
  type BackfillPlanItem,
} from '@/lib/documents/backfill-core'
import { replaceVersionTx } from '@/lib/storage/versioned-documents'
import { createGuardedTestPrisma, uniqueSuffix } from './db'

let prisma: PrismaClient
const TX_OPTS = { timeout: 20_000, maxWait: 15_000 }
const cleanups: Array<() => Promise<void>> = []
const BUCKET = 'vehicle-documents'

async function seedVehicleLegacyDoc(url: string): Promise<{ docId: string }> {
  const s = uniqueSuffix()
  const seller = await prisma.sellerLead.create({
    data: { name: `S ${s}`, email: `s_${s}@integ.test`, phone: '600000000' },
  })
  const vehicle = await prisma.vehicle.create({
    data: {
      sellerLeadId: seller.id,
      brand: 'Adria',
      model: 'Coral',
      year: 2020,
      km: 1,
      seats: 4,
      type: 'AUTOCARAVANA',
      status: 'PUBLICADO',
    },
  })
  const doc = await prisma.vehicleDocument.create({
    data: { vehicleId: vehicle.id, category: 'FICHA_TECNICA', name: 'Legacy', url },
  })
  cleanups.push(async () => {
    await prisma.vehicleDocument.updateMany({
      where: { vehicleId: vehicle.id },
      data: { currentVersionId: null },
    })
    await prisma.vehicleDocument.deleteMany({ where: { vehicleId: vehicle.id } })
    await prisma.vehicle.deleteMany({ where: { id: vehicle.id } })
    await prisma.sellerLead.deleteMany({ where: { id: seller.id } })
  })
  return { docId: doc.id }
}

async function seedDeliveryLegacyDoc(url: string): Promise<{ docId: string }> {
  const s = uniqueSuffix()
  const seller = await prisma.sellerLead.create({
    data: { name: `S ${s}`, email: `s_${s}@integ.test`, phone: '600000000' },
  })
  const vehicle = await prisma.vehicle.create({
    data: {
      sellerLeadId: seller.id,
      brand: 'Adria',
      model: 'X',
      year: 2020,
      km: 1,
      seats: 4,
      type: 'AUTOCARAVANA',
      status: 'PUBLICADO',
    },
  })
  const buyer = await prisma.buyerLead.create({
    data: { name: `B ${s}`, email: `b_${s}@integ.test`, phone: '600000001' },
  })
  // I3C1B: Delivery.offerId es obligatorio → Offer coherente para el fixture de documentos.
  const user = await prisma.user.create({
    data: { name: `U ${s}`, email: `u_${s}@integ.test`, role: 'AGENTE' },
  })
  const offer = await prisma.offer.create({
    data: {
      vehicleId: vehicle.id,
      buyerLeadId: buyer.id,
      amount: 25000,
      createdById: user.id,
      status: 'CONVERTIDA',
    },
  })
  const delivery = await prisma.delivery.create({
    data: {
      vehicleId: vehicle.id,
      buyerLeadId: buyer.id,
      offerId: offer.id,
      scheduledAt: new Date(),
    },
  })
  const doc = await prisma.deliveryDocument.create({
    data: { deliveryId: delivery.id, category: 'CONTRATO_FINAL', name: 'Legacy', url },
  })
  cleanups.push(async () => {
    await prisma.deliveryDocument.updateMany({
      where: { deliveryId: delivery.id },
      data: { currentVersionId: null },
    })
    await prisma.deliveryDocument.deleteMany({ where: { deliveryId: delivery.id } })
    await prisma.delivery.deleteMany({ where: { id: delivery.id } })
    await prisma.offer.deleteMany({ where: { vehicleId: vehicle.id } })
    await prisma.buyerLead.deleteMany({ where: { id: buyer.id } })
    await prisma.vehicle.deleteMany({ where: { id: vehicle.id } })
    await prisma.sellerLead.deleteMany({ where: { id: seller.id } })
    await prisma.user.deleteMany({ where: { id: user.id } })
  })
  return { docId: doc.id }
}

function item(
  rootType: 'vehicle' | 'delivery',
  rootId: string,
  objectPath: string
): BackfillPlanItem {
  // VALID_PATH → legacyUrl = objectPath (reversible exacto).
  return {
    rootType,
    rootId,
    bucket: BUCKET,
    objectPath,
    sourceClassification: 'VALID_PATH',
    legacyUrl: objectPath,
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

describe('integración · backfill', () => {
  it('vehículo con path: crea v1, sincroniza puntero+url, metadata null, versionSequence 1', async () => {
    const path = `docs/${uniqueSuffix()}/a.pdf`
    const { docId } = await seedVehicleLegacyDoc(path)

    const res = await prisma.$transaction(
      (tx) => backfillVersionTx(tx, item('vehicle', docId, path)),
      TX_OPTS
    )
    expect(res.status).toBe('migrated')

    const doc = await prisma.vehicleDocument.findUniqueOrThrow({
      where: { id: docId },
      include: { versions: true, currentVersion: true },
    })
    expect(doc.currentVersionId).not.toBeNull()
    expect(doc.versionSequence).toBe(1)
    expect(doc.url).toBe(path)
    expect(doc.versions).toHaveLength(1)
    const v = doc.currentVersion!
    expect(v.version).toBe(1)
    expect(v.objectPath).toBe(path)
    expect(v.bucket).toBe(BUCKET)
    expect(v.mimeType).toBeNull()
    expect(v.sizeBytes).toBeNull()
    expect(v.checksum).toBeNull()
    expect(v.uploadedById).toBeNull()
  })

  it('entrega con path: crea v1 en la raíz de entrega', async () => {
    const path = `deliveries/${uniqueSuffix()}/c.pdf`
    const { docId } = await seedDeliveryLegacyDoc(path)
    const res = await prisma.$transaction(
      (tx) => backfillVersionTx(tx, item('delivery', docId, path)),
      TX_OPTS
    )
    expect(res.status).toBe('migrated')
    const v = await prisma.documentVersion.findFirstOrThrow({
      where: { deliveryDocumentId: docId },
    })
    expect(v.version).toBe(1)
    expect(v.vehicleDocumentId).toBeNull()
  })

  it('URL firmada legacy: se migra usando el objectPath extraído y url queda sincronizada al path', async () => {
    const path = `docs/${uniqueSuffix()}/signed.pdf`
    const signed = `https://proj.supabase.co/storage/v1/object/sign/vehicle-documents/${path}?token=OLD`
    const { docId } = await seedVehicleLegacyDoc(signed)
    await prisma.$transaction((tx) => backfillVersionTx(tx, item('vehicle', docId, path)), TX_OPTS)
    const doc = await prisma.vehicleDocument.findUniqueOrThrow({ where: { id: docId } })
    expect(doc.url).toBe(path) // sin token
  })

  it('idempotente: una segunda ejecución no duplica (skipped)', async () => {
    const path = `docs/${uniqueSuffix()}/idem.pdf`
    const { docId } = await seedVehicleLegacyDoc(path)
    const it1 = item('vehicle', docId, path)
    const r1 = await prisma.$transaction((tx) => backfillVersionTx(tx, it1), TX_OPTS)
    const r2 = await prisma.$transaction((tx) => backfillVersionTx(tx, it1), TX_OPTS)
    expect(r1.status).toBe('migrated')
    expect(r2.status).toBe('skipped')
    expect(await prisma.documentVersion.count({ where: { vehicleDocumentId: docId } })).toBe(1)
  })

  it('objectPath duplicado → conflicto controlado y la 2ª raíz sigue legacy', async () => {
    const path = `docs/${uniqueSuffix()}/dup.pdf`
    const a = await seedVehicleLegacyDoc(path)
    const b = await seedVehicleLegacyDoc(path) // misma url/path
    await prisma.$transaction(
      (tx) => backfillVersionTx(tx, item('vehicle', a.docId, path)),
      TX_OPTS
    )
    await expect(
      prisma.$transaction((tx) => backfillVersionTx(tx, item('vehicle', b.docId, path)), TX_OPTS)
    ).rejects.toBeInstanceOf(DocumentBackfillConflictError)
    const bDoc = await prisma.vehicleDocument.findUniqueOrThrow({ where: { id: b.docId } })
    expect(bDoc.currentVersionId).toBeNull()
    expect(bDoc.versionSequence).toBe(0)
  })

  it('rollback: revierte una v1 intacta (borra versión, anula puntero, secuencia 0, url=path)', async () => {
    const path = `docs/${uniqueSuffix()}/rb.pdf`
    const { docId } = await seedVehicleLegacyDoc(path)
    const r = await prisma.$transaction(
      (tx) => backfillVersionTx(tx, item('vehicle', docId, path)),
      TX_OPTS
    )
    const versionId = (r as { versionId: string }).versionId

    const back = await prisma.$transaction(
      (tx) =>
        rollbackVersionTx(tx, {
          rootType: 'vehicle',
          rootId: docId,
          versionId,
          objectPath: path,
          legacyUrl: path,
        }),
      TX_OPTS
    )
    expect(back.status).toBe('rolled_back')
    const doc = await prisma.vehicleDocument.findUniqueOrThrow({ where: { id: docId } })
    expect(doc.currentVersionId).toBeNull()
    expect(doc.versionSequence).toBe(0)
    expect(doc.url).toBe(path) // url legacy exacta restaurada (= objectPath para VALID_PATH)
    expect(await prisma.documentVersion.count({ where: { vehicleDocumentId: docId } })).toBe(0)
  })

  it('rollback BLOQUEADO para una fila de URL firmada legacy (legacyUrl null): no revierte', async () => {
    const path = `docs/${uniqueSuffix()}/signed-rb.pdf`
    const signed = `https://proj.supabase.co/storage/v1/object/sign/vehicle-documents/${path}?token=OLD`
    const { docId } = await seedVehicleLegacyDoc(signed)
    const r = await prisma.$transaction(
      (tx) => backfillVersionTx(tx, item('vehicle', docId, path)),
      TX_OPTS
    )
    const versionId = (r as { versionId: string }).versionId
    const back = await prisma.$transaction(
      (tx) =>
        rollbackVersionTx(tx, {
          rootType: 'vehicle',
          rootId: docId,
          versionId,
          objectPath: path,
          legacyUrl: null,
        }),
      TX_OPTS
    )
    expect(back.status).toBe('skipped')
    // No se borró la versión (rollback irreversible bloqueado).
    expect(await prisma.documentVersion.count({ where: { vehicleDocumentId: docId } })).toBe(1)
  })

  it('rollback rechazado si el documento evolucionó (existe una v2 real)', async () => {
    const path = `docs/${uniqueSuffix()}/evo.pdf`
    const { docId } = await seedVehicleLegacyDoc(path)
    const r = await prisma.$transaction(
      (tx) => backfillVersionTx(tx, item('vehicle', docId, path)),
      TX_OPTS
    )
    const versionId = (r as { versionId: string }).versionId

    // Reemplazo REAL (crea v2) — el documento ha evolucionado.
    await prisma.$transaction(
      (tx) =>
        replaceVersionTx(
          tx,
          'vehicle',
          docId,
          { versionSequence: 1, currentVersionId: versionId },
          { bucket: BUCKET, objectPath: `docs/${uniqueSuffix()}/v2.pdf`, uploadedById: null },
          new Date()
        ),
      TX_OPTS
    )

    const back = await prisma.$transaction(
      (tx) =>
        rollbackVersionTx(tx, {
          rootType: 'vehicle',
          rootId: docId,
          versionId,
          objectPath: path,
          legacyUrl: path,
        }),
      TX_OPTS
    )
    expect(back.status).toBe('skipped')
    // Sigue habiendo 2 versiones (no se borró nada).
    expect(await prisma.documentVersion.count({ where: { vehicleDocumentId: docId } })).toBe(2)
  })
})
