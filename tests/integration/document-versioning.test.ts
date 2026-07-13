/**
 * Tests de integración con PostgreSQL REAL (PR5B1) — modelo documental versionado.
 *
 * Demuestran, sobre una base efímera migrada, que:
 *  - la primera versión y el reemplazo por compare-and-swap dejan un estado coherente
 *    (una sola versión actual mediante el puntero `currentVersionId`, `url` sincronizada,
 *    historial conservado, objeto físico anterior intacto);
 *  - dos reemplazos concurrentes producen exactamente 1 éxito + 1 conflicto controlado,
 *    2 versiones totales y una sola actual (barrera determinista `beforeClaim`, sin timers);
 *  - las invariantes del esquema las garantiza PostgreSQL: FK compuesta (la versión actual
 *    pertenece a su misma raíz), XOR de raíz, unicidad de versión y de objectPath, y las
 *    constraints numéricas y de coherencia de estado;
 *  - las filas legacy (sin versiones) siguen siendo válidas y el borrado con historial no
 *    deja objetos huérfanos.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import {
  createFirstVersionTx,
  replaceVersionTx,
  detachAndDeleteRootTx,
  collectVersionObjects,
  resolveCurrentObject,
  markHistoricalVersionDeletedTx,
  DocumentVersionConflictError,
  type DocRootType,
} from '@/lib/storage/versioned-documents'
import { createGuardedTestPrisma, uniqueSuffix } from './db'

let prisma: PrismaClient

// Transacciones interactivas con margen amplio para la barrera + bloqueo de fila en CI.
const TX_OPTS = { timeout: 20_000, maxWait: 15_000 }
const BUCKET = 'vehicle-documents'

const cleanups: Array<() => Promise<void>> = []

type VehicleGraph = { agentId: string; sellerId: string; vehicleId: string }
type DeliveryGraph = VehicleGraph & { buyerId: string; deliveryId: string }

async function seedVehicle(): Promise<VehicleGraph> {
  const s = uniqueSuffix()
  const agent = await prisma.user.create({
    data: { email: `agent_${s}@integ.test`, name: `Agent ${s}`, role: 'AGENTE' },
  })
  const seller = await prisma.sellerLead.create({
    data: { name: `Seller ${s}`, email: `seller_${s}@integ.test`, phone: '600000000' },
  })
  const vehicle = await prisma.vehicle.create({
    data: {
      sellerLeadId: seller.id,
      brand: 'Adria',
      model: 'Coral',
      year: 2020,
      km: 50_000,
      seats: 4,
      type: 'AUTOCARAVANA',
      status: 'PUBLICADO',
    },
  })
  cleanups.push(async () => {
    // Detach + borrado: los documentos cascadean sus versiones; se anula el puntero antes.
    await prisma.vehicleDocument.updateMany({
      where: { vehicleId: vehicle.id },
      data: { currentVersionId: null },
    })
    await prisma.vehicleDocument.deleteMany({ where: { vehicleId: vehicle.id } })
    await prisma.vehicle.deleteMany({ where: { id: vehicle.id } })
    await prisma.sellerLead.deleteMany({ where: { id: seller.id } })
    await prisma.user.deleteMany({ where: { id: agent.id } })
  })
  return { agentId: agent.id, sellerId: seller.id, vehicleId: vehicle.id }
}

async function seedDelivery(): Promise<DeliveryGraph> {
  const base = await seedVehicle()
  const s = uniqueSuffix()
  const buyer = await prisma.buyerLead.create({
    data: { name: `Buyer ${s}`, email: `buyer_${s}@integ.test`, phone: '600000001' },
  })
  const delivery = await prisma.delivery.create({
    data: { vehicleId: base.vehicleId, buyerLeadId: buyer.id, scheduledAt: new Date() },
  })
  cleanups.push(async () => {
    await prisma.deliveryDocument.updateMany({
      where: { deliveryId: delivery.id },
      data: { currentVersionId: null },
    })
    await prisma.deliveryDocument.deleteMany({ where: { deliveryId: delivery.id } })
    await prisma.delivery.deleteMany({ where: { id: delivery.id } })
    await prisma.buyerLead.deleteMany({ where: { id: buyer.id } })
  })
  return { ...base, buyerId: buyer.id, deliveryId: delivery.id }
}

/** Crea la raíz lógica + su versión 1 (replica el flujo de la Server Action de subida). */
async function createRootWithFirstVersion(
  rootType: DocRootType,
  ownerId: string,
  objectPath: string
): Promise<{ rootId: string; versionId: string }> {
  return prisma.$transaction(async (tx) => {
    const root =
      rootType === 'vehicle'
        ? await tx.vehicleDocument.create({
            data: {
              vehicleId: ownerId,
              category: 'CONTRATO_COMPRAVENTA',
              name: 'Contrato',
              url: objectPath,
            },
          })
        : await tx.deliveryDocument.create({
            data: {
              deliveryId: ownerId,
              category: 'CONTRATO_FINAL',
              name: 'Contrato',
              url: objectPath,
            },
          })
    const v = await createFirstVersionTx(tx, rootType, root.id, {
      bucket: BUCKET,
      objectPath,
      originalFilename: 'Contrato',
      mimeType: 'application/pdf',
      sizeBytes: 1000,
      uploadedById: null,
    })
    return { rootId: root.id, versionId: v.versionId }
  }, TX_OPTS)
}

async function readVehicleRoot(rootId: string) {
  return prisma.vehicleDocument.findUniqueOrThrow({ where: { id: rootId } })
}

/** Barrera de dos partes: ambas transacciones se esperan antes del CAS de reclamación. */
function twoPartyBarrier() {
  let arriveA!: () => void
  let arriveB!: () => void
  const aArrived = new Promise<void>((r) => (arriveA = r))
  const bArrived = new Promise<void>((r) => (arriveB = r))
  return {
    hookA: {
      beforeClaim: async () => {
        arriveA()
        await bArrived
      },
    },
    hookB: {
      beforeClaim: async () => {
        arriveB()
        await aArrived
      },
    },
  }
}

beforeAll(() => {
  prisma = createGuardedTestPrisma()
})

afterEach(async () => {
  for (const clean of cleanups.splice(0).reverse()) {
    await clean()
  }
})

afterAll(async () => {
  await prisma?.$disconnect()
})

// ─── Primera versión ─────────────────────────────────────────────────────────────

describe('integración · primera versión', () => {
  it('vehículo: versión 1, secuencia 1, currentVersionId correcto, url sincronizada', async () => {
    const { vehicleId } = await seedVehicle()
    const path = `docs/${vehicleId}/v1.pdf`
    const { rootId, versionId } = await createRootWithFirstVersion('vehicle', vehicleId, path)

    const root = await readVehicleRoot(rootId)
    expect(root.currentVersionId).toBe(versionId)
    expect(root.versionSequence).toBe(1)
    expect(root.url).toBe(path)

    const version = await prisma.documentVersion.findUniqueOrThrow({ where: { id: versionId } })
    expect(version.version).toBe(1)
    expect(version.status).toBe('ACTIVE')
    expect(version.objectPath).toBe(path)
    expect(version.vehicleDocumentId).toBe(rootId)
    expect(version.deliveryDocumentId).toBeNull()

    const resolved = await resolveCurrentObject(prisma, 'vehicle', rootId)
    expect(resolved).toEqual({ bucket: BUCKET, objectPath: path })
  })

  it('entrega: versión 1, secuencia 1, pertenece a la raíz de entrega (XOR)', async () => {
    const { deliveryId } = await seedDelivery()
    const path = `deliveries/${deliveryId}/v1.pdf`
    const { rootId, versionId } = await createRootWithFirstVersion('delivery', deliveryId, path)

    const version = await prisma.documentVersion.findUniqueOrThrow({ where: { id: versionId } })
    expect(version.deliveryDocumentId).toBe(rootId)
    expect(version.vehicleDocumentId).toBeNull()

    const root = await prisma.deliveryDocument.findUniqueOrThrow({ where: { id: rootId } })
    expect(root.currentVersionId).toBe(versionId)
    expect(root.versionSequence).toBe(1)
  })
})

// ─── Reemplazo ───────────────────────────────────────────────────────────────────

describe('integración · reemplazo', () => {
  it('crea la versión 2, conserva la 1 como REPLACED, mueve el puntero y sincroniza url', async () => {
    const { vehicleId } = await seedVehicle()
    const p1 = `docs/${vehicleId}/v1.pdf`
    const p2 = `docs/${vehicleId}/v2.pdf`
    const { rootId, versionId: v1 } = await createRootWithFirstVersion('vehicle', vehicleId, p1)

    const res = await prisma.$transaction(
      (tx) =>
        replaceVersionTx(
          tx,
          'vehicle',
          rootId,
          { versionSequence: 1, currentVersionId: v1 },
          { bucket: BUCKET, objectPath: p2, sizeBytes: 2000, uploadedById: null },
          new Date()
        ),
      TX_OPTS
    )

    expect(res.version).toBe(2)
    expect(res.previousVersionId).toBe(v1)

    const root = await readVehicleRoot(rootId)
    expect(root.currentVersionId).toBe(res.versionId)
    expect(root.versionSequence).toBe(2)
    expect(root.url).toBe(p2) // url → ganador

    // La versión anterior se conserva (no se borra) y queda marcada REPLACED.
    const old = await prisma.documentVersion.findUniqueOrThrow({ where: { id: v1 } })
    expect(old.status).toBe('REPLACED')
    expect(old.replacedAt).not.toBeNull()
    expect(old.objectPath).toBe(p1) // objeto histórico intacto, path distinto del nuevo

    const versions = await prisma.documentVersion.count({ where: { vehicleDocumentId: rootId } })
    expect(versions).toBe(2)
  })

  it('dos reemplazos concurrentes → 1 éxito, 1 conflicto, 2 versiones totales, una sola actual', async () => {
    const { vehicleId } = await seedVehicle()
    const p1 = `docs/${vehicleId}/v1.pdf`
    const { rootId, versionId: v1 } = await createRootWithFirstVersion('vehicle', vehicleId, p1)
    const { hookA, hookB } = twoPartyBarrier()
    const expected = { versionSequence: 1, currentVersionId: v1 }

    const pA = prisma.$transaction(
      (tx) =>
        replaceVersionTx(
          tx,
          'vehicle',
          rootId,
          expected,
          { bucket: BUCKET, objectPath: `docs/${vehicleId}/A.pdf`, uploadedById: null },
          new Date(),
          hookA
        ),
      TX_OPTS
    )
    const pB = prisma.$transaction(
      (tx) =>
        replaceVersionTx(
          tx,
          'vehicle',
          rootId,
          expected,
          { bucket: BUCKET, objectPath: `docs/${vehicleId}/B.pdf`, uploadedById: null },
          new Date(),
          hookB
        ),
      TX_OPTS
    )

    const settled = await Promise.allSettled([pA, pB])
    const fulfilled = settled.filter((r) => r.status === 'fulfilled')
    const rejected = settled.filter((r) => r.status === 'rejected')

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      DocumentVersionConflictError
    )

    // Exactamente 2 versiones (v1 + la del ganador); el perdedor no insertó metadata.
    const versions = await prisma.documentVersion.findMany({
      where: { vehicleDocumentId: rootId },
      orderBy: { version: 'asc' },
    })
    expect(versions).toHaveLength(2)
    expect(versions.map((v) => v.version)).toEqual([1, 2])

    // Una sola versión actual, vía el puntero de la raíz; url apunta al ganador.
    const winnerVersionId = (fulfilled[0] as PromiseFulfilledResult<{ versionId: string }>).value
      .versionId
    const root = await readVehicleRoot(rootId)
    expect(root.currentVersionId).toBe(winnerVersionId)
    expect(root.versionSequence).toBe(2)
    const winner = versions.find((v) => v.id === winnerVersionId)!
    expect(root.url).toBe(winner.objectPath)
    // v1 es histórica; la versión 2 es la actual.
    expect(versions.find((v) => v.version === 1)!.id).toBe(v1)
  })
})

// ─── Invariantes garantizadas por PostgreSQL ─────────────────────────────────────

describe('integración · invariantes del esquema (PostgreSQL)', () => {
  it('rechaza asignar como actual una versión de OTRA raíz (FK compuesta)', async () => {
    const { vehicleId } = await seedVehicle()
    const a = await createRootWithFirstVersion('vehicle', vehicleId, `docs/${vehicleId}/a.pdf`)
    const b = await createRootWithFirstVersion('vehicle', vehicleId, `docs/${vehicleId}/b.pdf`)

    // Intentar que la raíz A apunte a la versión 1 de B → la FK (id,currentVersionId)→
    // (vehicleDocumentId,id) exige que la versión pertenezca a A. Debe fallar.
    await expect(
      prisma.$executeRaw`UPDATE "vehicle_documents" SET "current_version_id" = ${b.versionId} WHERE "id" = ${a.rootId}`
    ).rejects.toThrow()
  })

  it('rechaza una versión con AMBAS raíces (XOR)', async () => {
    const { vehicleId, deliveryId } = await seedDelivery()
    const vroot = await createRootWithFirstVersion('vehicle', vehicleId, `docs/${vehicleId}/x.pdf`)
    const droot = await createRootWithFirstVersion(
      'delivery',
      deliveryId,
      `deliveries/${deliveryId}/x.pdf`
    )
    await expect(
      prisma.$executeRaw`
        INSERT INTO "document_versions" ("id","vehicle_document_id","delivery_document_id","version","bucket","object_path","status","created_at")
        VALUES (${randomUUID()}, ${vroot.rootId}, ${droot.rootId}, 9, ${BUCKET}, ${`p_${randomUUID()}`}, 'ACTIVE', now())`
    ).rejects.toThrow()
  })

  it('rechaza una versión SIN raíz (XOR)', async () => {
    await expect(
      prisma.$executeRaw`
        INSERT INTO "document_versions" ("id","version","bucket","object_path","status","created_at")
        VALUES (${randomUUID()}, 1, ${BUCKET}, ${`p_${randomUUID()}`}, 'ACTIVE', now())`
    ).rejects.toThrow()
  })

  it('rechaza dos versiones con el mismo número en la misma raíz', async () => {
    const { vehicleId } = await seedVehicle()
    const { rootId } = await createRootWithFirstVersion(
      'vehicle',
      vehicleId,
      `docs/${vehicleId}/v1.pdf`
    )
    // Ya existe version=1 para rootId → duplicar debe violar el unique (vehicleDocumentId,version).
    await expect(
      prisma.$executeRaw`
        INSERT INTO "document_versions" ("id","vehicle_document_id","version","bucket","object_path","status","created_at")
        VALUES (${randomUUID()}, ${rootId}, 1, ${BUCKET}, ${`p_${randomUUID()}`}, 'ACTIVE', now())`
    ).rejects.toThrow()
  })

  it('rechaza un objectPath duplicado', async () => {
    const { vehicleId } = await seedVehicle()
    const path = `docs/${vehicleId}/dup.pdf`
    const { rootId } = await createRootWithFirstVersion('vehicle', vehicleId, path)
    await expect(
      prisma.$executeRaw`
        INSERT INTO "document_versions" ("id","vehicle_document_id","version","bucket","object_path","status","created_at")
        VALUES (${randomUUID()}, ${rootId}, 2, ${BUCKET}, ${path}, 'ACTIVE', now())`
    ).rejects.toThrow()
  })

  it('rechaza version <= 0 y sizeBytes < 0 (constraints numéricas)', async () => {
    const { vehicleId } = await seedVehicle()
    const { rootId } = await createRootWithFirstVersion(
      'vehicle',
      vehicleId,
      `docs/${vehicleId}/n.pdf`
    )
    await expect(
      prisma.$executeRaw`
        INSERT INTO "document_versions" ("id","vehicle_document_id","version","bucket","object_path","status","created_at")
        VALUES (${randomUUID()}, ${rootId}, 0, ${BUCKET}, ${`p_${randomUUID()}`}, 'ACTIVE', now())`
    ).rejects.toThrow()
    await expect(
      prisma.$executeRaw`
        INSERT INTO "document_versions" ("id","vehicle_document_id","version","bucket","object_path","size_bytes","status","created_at")
        VALUES (${randomUUID()}, ${rootId}, 5, ${BUCKET}, ${`p_${randomUUID()}`}, -1, 'ACTIVE', now())`
    ).rejects.toThrow()
  })

  it('rechaza DELETED sin deletedAt (coherencia estado↔deletedAt)', async () => {
    const { vehicleId } = await seedVehicle()
    const { rootId } = await createRootWithFirstVersion(
      'vehicle',
      vehicleId,
      `docs/${vehicleId}/c.pdf`
    )
    await expect(
      prisma.$executeRaw`
        INSERT INTO "document_versions" ("id","vehicle_document_id","version","bucket","object_path","status","created_at")
        VALUES (${randomUUID()}, ${rootId}, 7, ${BUCKET}, ${`p_${randomUUID()}`}, 'DELETED', now())`
    ).rejects.toThrow()
  })
})

// ─── Legacy, historial y borrado ─────────────────────────────────────────────────

describe('integración · legacy, historial y borrado', () => {
  it('una fila legacy (sin versiones) es válida y resolveCurrentObject devuelve null', async () => {
    const { vehicleId } = await seedVehicle()
    const legacy = await prisma.vehicleDocument.create({
      data: {
        vehicleId,
        category: 'FICHA_TECNICA',
        name: 'Legacy',
        url: `docs/${vehicleId}/legacy.pdf`,
      },
    })
    expect(legacy.currentVersionId).toBeNull()
    expect(legacy.versionSequence).toBe(0)
    expect(await resolveCurrentObject(prisma, 'vehicle', legacy.id)).toBeNull()
    expect(await collectVersionObjects(prisma, 'vehicle', legacy.id)).toEqual([])
  })

  it('collectVersionObjects lista los objetos de todas las versiones; el borrado cascada limpia todo', async () => {
    const { vehicleId } = await seedVehicle()
    const p1 = `docs/${vehicleId}/h1.pdf`
    const p2 = `docs/${vehicleId}/h2.pdf`
    const { rootId, versionId: v1 } = await createRootWithFirstVersion('vehicle', vehicleId, p1)
    await prisma.$transaction(
      (tx) =>
        replaceVersionTx(
          tx,
          'vehicle',
          rootId,
          { versionSequence: 1, currentVersionId: v1 },
          { bucket: BUCKET, objectPath: p2, uploadedById: null },
          new Date()
        ),
      TX_OPTS
    )

    const objects = await collectVersionObjects(prisma, 'vehicle', rootId)
    expect(objects.map((o) => o.objectPath).sort()).toEqual([p1, p2].sort())

    // Borrado de la raíz: detach + delete → versiones cascadean.
    await prisma.$transaction((tx) => detachAndDeleteRootTx(tx, 'vehicle', rootId), TX_OPTS)
    expect(await prisma.vehicleDocument.findUnique({ where: { id: rootId } })).toBeNull()
    expect(await prisma.documentVersion.count({ where: { vehicleDocumentId: rootId } })).toBe(0)
  })

  it('no permite eliminar la versión actual; sí marca DELETED una histórica', async () => {
    const { vehicleId } = await seedVehicle()
    const p1 = `docs/${vehicleId}/d1.pdf`
    const p2 = `docs/${vehicleId}/d2.pdf`
    const { rootId, versionId: v1 } = await createRootWithFirstVersion('vehicle', vehicleId, p1)
    const rep = await prisma.$transaction(
      (tx) =>
        replaceVersionTx(
          tx,
          'vehicle',
          rootId,
          { versionSequence: 1, currentVersionId: v1 },
          { bucket: BUCKET, objectPath: p2, uploadedById: null },
          new Date()
        ),
      TX_OPTS
    )
    const currentId = rep.versionId

    // Intentar eliminar la ACTUAL → conflicto de dominio (sin promoción automática).
    await expect(
      prisma.$transaction((tx) =>
        markHistoricalVersionDeletedTx(tx, {
          versionId: currentId,
          currentVersionId: currentId,
          now: new Date(),
        })
      )
    ).rejects.toBeInstanceOf(DocumentVersionConflictError)

    // La histórica (v1) sí puede marcarse DELETED (con deletedAt, satisface la coherencia).
    await prisma.$transaction((tx) =>
      markHistoricalVersionDeletedTx(tx, {
        versionId: v1,
        currentVersionId: currentId,
        now: new Date(),
      })
    )
    const old = await prisma.documentVersion.findUniqueOrThrow({ where: { id: v1 } })
    expect(old.status).toBe('DELETED')
    expect(old.deletedAt).not.toBeNull()

    // La raíz sigue apuntando a la actual (sin cambios de puntero).
    expect((await readVehicleRoot(rootId)).currentVersionId).toBe(currentId)
  })
})
