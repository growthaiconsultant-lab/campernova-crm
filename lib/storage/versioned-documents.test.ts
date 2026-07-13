import { describe, it, expect, vi } from 'vitest'
import {
  createFirstVersionTx,
  replaceVersionTx,
  replaceCurrentVersion,
  resolveCurrentObject,
  listVersions,
  collectVersionObjects,
  detachAndDeleteRootTx,
  markHistoricalVersionDeletedTx,
  DocumentVersionConflictError,
  type VersioningDb,
} from './versioned-documents'
import { StorageOperationError } from './store-document'

// Fakes mínimos: cada test observa las llamadas al "tx"/"db" sin Prisma ni Postgres reales.
function fakeTx() {
  return {
    documentVersion: {
      create: vi.fn().mockResolvedValue({ id: 'ver-new' }),
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    vehicleDocument: {
      create: vi.fn().mockResolvedValue({ id: 'root-1' }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      delete: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
    },
    deliveryDocument: {
      create: vi.fn().mockResolvedValue({ id: 'root-1' }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      delete: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
    },
  }
}

const META = {
  bucket: 'vehicle-documents',
  objectPath: 'docs/v-1/new.pdf',
  originalFilename: 'Contrato',
  mimeType: 'application/pdf',
  sizeBytes: 1234,
  uploadedById: 'agent-1',
}

// ─── createFirstVersionTx ──────────────────────────────────────────────────────

describe('createFirstVersionTx', () => {
  it('crea la versión 1 y fija currentVersionId, versionSequence=1 y url (vehículo)', async () => {
    const tx = fakeTx()
    tx.documentVersion.create.mockResolvedValue({ id: 'ver-1' })

    const res = await createFirstVersionTx(tx as never, 'vehicle', 'root-1', META)

    expect(res).toEqual({ versionId: 'ver-1', version: 1 })
    const created = tx.documentVersion.create.mock.calls[0][0].data
    expect(created).toMatchObject({
      vehicleDocumentId: 'root-1',
      version: 1,
      bucket: 'vehicle-documents',
      objectPath: 'docs/v-1/new.pdf',
      status: 'ACTIVE',
      uploadedById: 'agent-1',
    })
    expect(created.deliveryDocumentId).toBeUndefined()
    expect(tx.vehicleDocument.update).toHaveBeenCalledWith({
      where: { id: 'root-1' },
      data: { currentVersionId: 'ver-1', versionSequence: 1, url: 'docs/v-1/new.pdf' },
    })
  })

  it('usa deliveryDocumentId cuando la raíz es de entrega', async () => {
    const tx = fakeTx()
    tx.documentVersion.create.mockResolvedValue({ id: 'ver-1' })

    await createFirstVersionTx(tx as never, 'delivery', 'root-1', META)

    const created = tx.documentVersion.create.mock.calls[0][0].data
    expect(created.deliveryDocumentId).toBe('root-1')
    expect(created.vehicleDocumentId).toBeUndefined()
    expect(tx.deliveryDocument.update).toHaveBeenCalled()
    expect(tx.vehicleDocument.update).not.toHaveBeenCalled()
  })
})

// ─── replaceVersionTx (CAS) ────────────────────────────────────────────────────

describe('replaceVersionTx', () => {
  const now = new Date('2026-07-12T10:00:00Z')

  it('reclama la raíz por CAS, crea la versión siguiente, marca la anterior REPLACED y mueve el puntero', async () => {
    const tx = fakeTx()
    tx.documentVersion.create.mockResolvedValue({ id: 'ver-2' })

    const res = await replaceVersionTx(
      tx as never,
      'vehicle',
      'root-1',
      { versionSequence: 1, currentVersionId: 'ver-1' },
      { ...META, objectPath: 'docs/v-1/v2.pdf' },
      now
    )

    expect(res).toEqual({ versionId: 'ver-2', version: 2, previousVersionId: 'ver-1' })
    // CAS sobre (id, versionSequence, currentVersionId) → incrementa la secuencia.
    expect(tx.vehicleDocument.updateMany).toHaveBeenCalledWith({
      where: { id: 'root-1', versionSequence: 1, currentVersionId: 'ver-1' },
      data: { versionSequence: 2 },
    })
    // Nueva versión = 2.
    expect(tx.documentVersion.create.mock.calls[0][0].data).toMatchObject({ version: 2 })
    // La anterior queda marcada REPLACED con replacedAt.
    expect(tx.documentVersion.update).toHaveBeenCalledWith({
      where: { id: 'ver-1' },
      data: { status: 'REPLACED', replacedAt: now },
    })
    // Puntero → ganador + url sincronizada.
    expect(tx.vehicleDocument.update).toHaveBeenCalledWith({
      where: { id: 'root-1' },
      data: { currentVersionId: 'ver-2', url: 'docs/v-1/v2.pdf' },
    })
  })

  it('si el CAS afecta 0 filas lanza conflicto ANTES de crear metadata (no deja versión huérfana)', async () => {
    const tx = fakeTx()
    tx.vehicleDocument.updateMany.mockResolvedValue({ count: 0 })

    await expect(
      replaceVersionTx(
        tx as never,
        'vehicle',
        'root-1',
        { versionSequence: 1, currentVersionId: 'stale' },
        META,
        now
      )
    ).rejects.toBeInstanceOf(DocumentVersionConflictError)

    expect(tx.documentVersion.create).not.toHaveBeenCalled()
    expect(tx.vehicleDocument.update).not.toHaveBeenCalled()
  })

  it('invoca el hook beforeClaim antes del CAS (barrera de tests)', async () => {
    const tx = fakeTx()
    const order: string[] = []
    tx.vehicleDocument.updateMany.mockImplementation(async () => {
      order.push('claim')
      return { count: 1 }
    })
    await replaceVersionTx(
      tx as never,
      'vehicle',
      'root-1',
      { versionSequence: 1, currentVersionId: 'ver-1' },
      META,
      now,
      { beforeClaim: async () => void order.push('hook') }
    )
    expect(order).toEqual(['hook', 'claim'])
  })

  it('cuando no había versión previa (currentVersionId null) no intenta marcar REPLACED', async () => {
    const tx = fakeTx()
    await replaceVersionTx(
      tx as never,
      'delivery',
      'root-1',
      { versionSequence: 0, currentVersionId: null },
      META,
      now
    )
    expect(tx.documentVersion.update).not.toHaveBeenCalled()
    expect(tx.deliveryDocument.updateMany).toHaveBeenCalledWith({
      where: { id: 'root-1', versionSequence: 0, currentVersionId: null },
      data: { versionSequence: 1 },
    })
  })
})

// ─── replaceCurrentVersion (storage + compensación) ─────────────────────────────

describe('replaceCurrentVersion', () => {
  const now = new Date('2026-07-12T10:00:00Z')

  function fakeDb(txImpl: ReturnType<typeof fakeTx>) {
    const $transaction = vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(txImpl))
    return { $transaction } as unknown as VersioningDb & {
      $transaction: ReturnType<typeof vi.fn>
    }
  }

  it('sube el objeto y persiste la versión (camino feliz)', async () => {
    const tx = fakeTx()
    tx.documentVersion.create.mockResolvedValue({ id: 'ver-2' })
    const storage = {
      upload: vi.fn().mockResolvedValue({ error: null }),
      remove: vi.fn().mockResolvedValue({ error: null }),
    }
    const res = await replaceCurrentVersion(
      { db: fakeDb(tx), storage, now },
      {
        rootType: 'vehicle',
        rootId: 'root-1',
        expected: { versionSequence: 1, currentVersionId: 'ver-1' },
        upload: { bytes: new ArrayBuffer(8), contentType: 'application/pdf' },
        meta: { ...META, objectPath: 'docs/v-1/v2.pdf' },
      }
    )
    expect(res.version).toBe(2)
    expect(storage.upload).toHaveBeenCalledWith('docs/v-1/v2.pdf', expect.any(ArrayBuffer), {
      contentType: 'application/pdf',
      upsert: false,
    })
    // Camino feliz → NO se compensa (el objeto nuevo se conserva).
    expect(storage.remove).not.toHaveBeenCalled()
  })

  it('en conflicto: compensa (elimina SOLO el objeto nuevo) y propaga el conflicto', async () => {
    const tx = fakeTx()
    tx.vehicleDocument.updateMany.mockResolvedValue({ count: 0 }) // pierde el CAS
    const storage = {
      upload: vi.fn().mockResolvedValue({ error: null }),
      remove: vi.fn().mockResolvedValue({ error: null }),
    }
    await expect(
      replaceCurrentVersion(
        { db: fakeDb(tx), storage, now },
        {
          rootType: 'vehicle',
          rootId: 'root-1',
          expected: { versionSequence: 1, currentVersionId: 'stale' },
          upload: { bytes: new ArrayBuffer(8), contentType: 'application/pdf' },
          meta: { ...META, objectPath: 'docs/v-1/loser.pdf' },
        }
      )
    ).rejects.toBeInstanceOf(DocumentVersionConflictError)
    // Compensa exclusivamente el objeto recién subido (nunca el histórico).
    expect(storage.remove).toHaveBeenCalledWith(['docs/v-1/loser.pdf'])
  })

  it('si el upload falla lanza StorageOperationError y no abre transacción ni compensa', async () => {
    const tx = fakeTx()
    const db = fakeDb(tx)
    const storage = {
      upload: vi.fn().mockResolvedValue({ error: { message: 'down' } }),
      remove: vi.fn().mockResolvedValue({ error: null }),
    }
    await expect(
      replaceCurrentVersion(
        { db, storage, now },
        {
          rootType: 'vehicle',
          rootId: 'root-1',
          expected: { versionSequence: 1, currentVersionId: 'ver-1' },
          upload: { bytes: new ArrayBuffer(8), contentType: 'application/pdf' },
          meta: META,
        }
      )
    ).rejects.toBeInstanceOf(StorageOperationError)
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(storage.remove).not.toHaveBeenCalled()
  })

  it('si la compensación del objeto perdedor falla, sigue propagando el error original', async () => {
    const tx = fakeTx()
    tx.vehicleDocument.updateMany.mockResolvedValue({ count: 0 })
    const storage = {
      upload: vi.fn().mockResolvedValue({ error: null }),
      remove: vi.fn().mockRejectedValue(new Error('storage remove caído')),
    }
    // El error de compensación se traga (best-effort); se propaga el conflicto original.
    await expect(
      replaceCurrentVersion(
        { db: fakeDb(tx), storage, now },
        {
          rootType: 'vehicle',
          rootId: 'root-1',
          expected: { versionSequence: 1, currentVersionId: 'stale' },
          upload: { bytes: new ArrayBuffer(8), contentType: 'application/pdf' },
          meta: META,
        }
      )
    ).rejects.toBeInstanceOf(DocumentVersionConflictError)
  })
})

// ─── lectura / historial ────────────────────────────────────────────────────────

describe('resolveCurrentObject', () => {
  it('devuelve bucket+objectPath de la versión actual', async () => {
    const db = {
      vehicleDocument: {
        findUnique: vi.fn().mockResolvedValue({ currentVersion: { bucket: 'b', objectPath: 'p' } }),
      },
      deliveryDocument: { findUnique: vi.fn() },
      documentVersion: { findMany: vi.fn() },
    }
    const res = await resolveCurrentObject(db as never, 'vehicle', 'root-1')
    expect(res).toEqual({ bucket: 'b', objectPath: 'p' })
  })

  it('devuelve null si la raíz no tiene versión actual (fila legacy)', async () => {
    const db = {
      vehicleDocument: { findUnique: vi.fn().mockResolvedValue({ currentVersion: null }) },
      deliveryDocument: { findUnique: vi.fn() },
      documentVersion: { findMany: vi.fn() },
    }
    expect(await resolveCurrentObject(db as never, 'vehicle', 'root-1')).toBeNull()
  })

  it('devuelve null si la raíz no existe', async () => {
    const db = {
      vehicleDocument: { findUnique: vi.fn().mockResolvedValue(null) },
      deliveryDocument: { findUnique: vi.fn() },
      documentVersion: { findMany: vi.fn() },
    }
    expect(await resolveCurrentObject(db as never, 'vehicle', 'root-1')).toBeNull()
  })
})

describe('listVersions', () => {
  it('lista por versión descendente por defecto', async () => {
    const rows = [{ version: 2 }, { version: 1 }]
    const db = {
      vehicleDocument: { findUnique: vi.fn() },
      deliveryDocument: { findUnique: vi.fn() },
      documentVersion: { findMany: vi.fn().mockResolvedValue(rows) },
    }
    const res = await listVersions(db as never, 'vehicle', 'root-1')
    expect(res).toBe(rows)
    expect(db.documentVersion.findMany.mock.calls[0][0]).toMatchObject({
      where: { vehicleDocumentId: 'root-1' },
      orderBy: { version: 'desc' },
    })
  })
})

describe('collectVersionObjects', () => {
  it('mapea todos los objetos de las versiones de la raíz', async () => {
    const db = {
      vehicleDocument: { findUnique: vi.fn() },
      deliveryDocument: { findUnique: vi.fn() },
      documentVersion: {
        findMany: vi.fn().mockResolvedValue([
          { bucket: 'b', objectPath: 'p2' },
          { bucket: 'b', objectPath: 'p1' },
        ]),
      },
    }
    const res = await collectVersionObjects(db as never, 'delivery', 'root-1')
    expect(res).toEqual([
      { bucket: 'b', objectPath: 'p2' },
      { bucket: 'b', objectPath: 'p1' },
    ])
    expect(db.documentVersion.findMany.mock.calls[0][0].where).toEqual({
      deliveryDocumentId: 'root-1',
    })
  })
})

// ─── borrado / archivado ─────────────────────────────────────────────────────────

describe('detachAndDeleteRootTx', () => {
  it('anula el puntero antes de borrar la raíz (libera la FK compuesta NO ACTION)', async () => {
    const tx = fakeTx()
    await detachAndDeleteRootTx(tx as never, 'vehicle', 'root-1')
    expect(tx.vehicleDocument.update).toHaveBeenCalledWith({
      where: { id: 'root-1' },
      data: { currentVersionId: null },
    })
    expect(tx.vehicleDocument.delete).toHaveBeenCalledWith({ where: { id: 'root-1' } })
    // Orden: primero update (detach), luego delete.
    const updOrder = tx.vehicleDocument.update.mock.invocationCallOrder[0]
    const delOrder = tx.vehicleDocument.delete.mock.invocationCallOrder[0]
    expect(updOrder).toBeLessThan(delOrder)
  })
})

describe('markHistoricalVersionDeletedTx', () => {
  const now = new Date('2026-07-12T10:00:00Z')

  it('rechaza eliminar la versión ACTUAL', async () => {
    const tx = fakeTx()
    await expect(
      markHistoricalVersionDeletedTx(tx as never, {
        versionId: 'ver-1',
        currentVersionId: 'ver-1',
        now,
      })
    ).rejects.toBeInstanceOf(DocumentVersionConflictError)
    expect(tx.documentVersion.update).not.toHaveBeenCalled()
  })

  it('marca DELETED una versión histórica sin borrar físicamente', async () => {
    const tx = fakeTx()
    await markHistoricalVersionDeletedTx(tx as never, {
      versionId: 'ver-1',
      currentVersionId: 'ver-2',
      now,
    })
    expect(tx.documentVersion.update).toHaveBeenCalledWith({
      where: { id: 'ver-1' },
      data: { status: 'DELETED', deletedAt: now },
    })
  })
})
