import { describe, it, expect, vi } from 'vitest'
import {
  backfillVersionTx,
  rollbackVersionTx,
  computePlanHash,
  canResumeCheckpoint,
  DocumentBackfillConflictError,
  type BackfillPlanItem,
  type RollbackItem,
  type BackfillCheckpoint,
} from './backfill-core'

function fakeTx() {
  return {
    vehicleDocument: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    deliveryDocument: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    documentVersion: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'ver-new' }),
      findMany: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue({}),
    },
  }
}

const ITEM: BackfillPlanItem = {
  rootType: 'vehicle',
  rootId: 'root-1',
  bucket: 'vehicle-documents',
  objectPath: 'docs/v1/a.pdf',
  sourceClassification: 'VALID_PATH',
  legacyUrl: 'docs/v1/a.pdf',
}

describe('backfillVersionTx', () => {
  it('migra: CAS reclama la raíz legacy, crea versión 1 (metadata null) y sincroniza puntero+url', async () => {
    const tx = fakeTx()
    tx.documentVersion.create.mockResolvedValue({ id: 'ver-1' })
    const res = await backfillVersionTx(tx as never, ITEM)
    expect(res).toEqual({ status: 'migrated', versionId: 'ver-1' })

    expect(tx.vehicleDocument.updateMany).toHaveBeenCalledWith({
      where: { id: 'root-1', currentVersionId: null, versionSequence: 0 },
      data: { versionSequence: 1 },
    })
    const created = tx.documentVersion.create.mock.calls[0][0].data
    expect(created).toMatchObject({
      vehicleDocumentId: 'root-1',
      version: 1,
      bucket: 'vehicle-documents',
      objectPath: 'docs/v1/a.pdf',
      status: 'ACTIVE',
    })
    // Metadata NO inventada.
    expect(created.mimeType).toBeNull()
    expect(created.sizeBytes).toBeNull()
    expect(created.checksum).toBeNull()
    expect(created.uploadedById).toBeNull()
    expect(created.originalFilename).toBeNull()
    expect(tx.vehicleDocument.update).toHaveBeenCalledWith({
      where: { id: 'root-1' },
      data: { currentVersionId: 'ver-1', url: 'docs/v1/a.pdf' },
    })
  })

  it('idempotente: si el CAS no reclama (ya migrado o url cambiada) → skipped sin escribir', async () => {
    const tx = fakeTx()
    tx.vehicleDocument.updateMany.mockResolvedValue({ count: 0 })
    const res = await backfillVersionTx(tx as never, ITEM)
    expect(res).toEqual({ status: 'skipped', reason: 'no-longer-legacy-or-url-changed' })
    expect(tx.documentVersion.create).not.toHaveBeenCalled()
  })

  it('conflicto: si el objectPath ya existe → lanza y no crea versión', async () => {
    const tx = fakeTx()
    tx.documentVersion.findUnique.mockResolvedValue({ id: 'existing' })
    await expect(backfillVersionTx(tx as never, ITEM)).rejects.toBeInstanceOf(
      DocumentBackfillConflictError
    )
    expect(tx.documentVersion.create).not.toHaveBeenCalled()
  })

  it('conflicto por carrera: P2002 al crear (unique objectPath) se traduce a conflicto controlado', async () => {
    const tx = fakeTx()
    tx.documentVersion.findUnique.mockResolvedValue(null) // pre-check pasa (ambos ven null)
    tx.documentVersion.create.mockRejectedValue(
      Object.assign(new Error('unique'), { code: 'P2002' })
    )
    await expect(backfillVersionTx(tx as never, ITEM)).rejects.toBeInstanceOf(
      DocumentBackfillConflictError
    )
  })

  it('usa deliveryDocument para raíces de entrega', async () => {
    const tx = fakeTx()
    await backfillVersionTx(tx as never, { ...ITEM, rootType: 'delivery' })
    expect(tx.deliveryDocument.updateMany).toHaveBeenCalled()
    expect(tx.vehicleDocument.updateMany).not.toHaveBeenCalled()
  })
})

describe('rollbackVersionTx', () => {
  const R: RollbackItem = {
    rootType: 'vehicle',
    rootId: 'root-1',
    versionId: 'ver-1',
    objectPath: 'docs/v1/a.pdf',
    legacyUrl: 'docs/v1/a.pdf',
  }

  it('revierte una v1 intacta: restaura la url legacy EXACTA, anula puntero, secuencia 0 y borra la versión', async () => {
    const tx = fakeTx()
    tx.documentVersion.findMany.mockResolvedValue([
      { id: 'ver-1', version: 1, objectPath: 'docs/v1/a.pdf' },
    ])
    const res = await rollbackVersionTx(tx as never, R)
    expect(res).toEqual({ status: 'rolled_back' })
    expect(tx.vehicleDocument.updateMany).toHaveBeenCalledWith({
      where: { id: 'root-1', currentVersionId: 'ver-1', versionSequence: 1 },
      data: { currentVersionId: null, versionSequence: 0, url: 'docs/v1/a.pdf' },
    })
    expect(tx.documentVersion.delete).toHaveBeenCalledWith({ where: { id: 'ver-1' } })
  })

  it('BLOQUEA el rollback de una fila irreversible (legacyUrl null = URL firmada legacy) sin tocar nada', async () => {
    const tx = fakeTx()
    const res = await rollbackVersionTx(tx as never, { ...R, legacyUrl: null })
    expect(res.status).toBe('skipped')
    if (res.status === 'skipped') expect(res.reason).toMatch(/irreversible/)
    expect(tx.documentVersion.findMany).not.toHaveBeenCalled()
    expect(tx.vehicleDocument.updateMany).not.toHaveBeenCalled()
    expect(tx.documentVersion.delete).not.toHaveBeenCalled()
  })

  it('rechaza si existe una versión posterior (v2)', async () => {
    const tx = fakeTx()
    tx.documentVersion.findMany.mockResolvedValue([
      { id: 'ver-1', version: 1, objectPath: 'docs/v1/a.pdf' },
      { id: 'ver-2', version: 2, objectPath: 'docs/v1/b.pdf' },
    ])
    const res = await rollbackVersionTx(tx as never, R)
    expect(res.status).toBe('skipped')
    expect(tx.documentVersion.delete).not.toHaveBeenCalled()
  })

  it('rechaza si el puntero/secuencia cambiaron (CAS count 0)', async () => {
    const tx = fakeTx()
    tx.documentVersion.findMany.mockResolvedValue([
      { id: 'ver-1', version: 1, objectPath: 'docs/v1/a.pdf' },
    ])
    tx.vehicleDocument.updateMany.mockResolvedValue({ count: 0 })
    const res = await rollbackVersionTx(tx as never, R)
    expect(res.status).toBe('skipped')
    expect(tx.documentVersion.delete).not.toHaveBeenCalled()
  })

  it('rechaza si la versión no coincide con la del plan', async () => {
    const tx = fakeTx()
    tx.documentVersion.findMany.mockResolvedValue([
      { id: 'OTHER', version: 1, objectPath: 'docs/v1/a.pdf' },
    ])
    const res = await rollbackVersionTx(tx as never, R)
    expect(res.status).toBe('skipped')
  })
})

describe('computePlanHash', () => {
  it('es estable independientemente del orden de entrada', () => {
    const a: BackfillPlanItem = { ...ITEM, rootId: 'a' }
    const b: BackfillPlanItem = { ...ITEM, rootId: 'b', objectPath: 'docs/v2/b.pdf' }
    expect(computePlanHash([a, b])).toBe(computePlanHash([b, a]))
  })
  it('cambia si cambia un objectPath', () => {
    const a: BackfillPlanItem = { ...ITEM }
    const a2: BackfillPlanItem = { ...ITEM, objectPath: 'docs/v1/DIFFERENT.pdf' }
    expect(computePlanHash([a])).not.toBe(computePlanHash([a2]))
  })
})

describe('canResumeCheckpoint', () => {
  const cp: BackfillCheckpoint = {
    planHash: 'h1',
    env: 'local',
    lastIndex: 5,
    migrated: 5,
    skipped: 0,
    conflicts: 0,
    errors: 0,
    timestamp: '2026-07-13T00:00:00Z',
  }
  it('solo reanuda con el mismo plan hash y entorno', () => {
    expect(canResumeCheckpoint(cp, { planHash: 'h1', env: 'local' })).toBe(true)
    expect(canResumeCheckpoint(cp, { planHash: 'h2', env: 'local' })).toBe(false)
    expect(canResumeCheckpoint(cp, { planHash: 'h1', env: 'staging' })).toBe(false)
  })
})
