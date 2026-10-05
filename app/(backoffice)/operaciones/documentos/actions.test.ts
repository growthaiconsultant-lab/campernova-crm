import { beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
const mock = vi.hoisted(() => ({
  requireRole: vi.fn(),
  persist: vi.fn(),
  lock: vi.fn(),
  admin: vi.fn(),
  doc: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  vehicle: { count: vi.fn() },
  buyerLead: { count: vi.fn() },
  sellerLead: { count: vi.fn() },
  bucket: { upload: vi.fn(), remove: vi.fn(), createSignedUrl: vi.fn() },
}))
vi.mock('@/lib/db', () => ({
  db: {
    vehicleDocument: mock.doc,
    vehicle: mock.vehicle,
    buyerLead: mock.buyerLead,
    sellerLead: mock.sellerLead,
  },
}))
vi.mock('@/lib/auth', () => ({ requireRole: mock.requireRole }))
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdminClient: mock.admin }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/locking', () => ({ withLockedRoots: mock.lock, isLockError: () => false }))
vi.mock('@/lib/operational-documents', async (original) => ({
  ...(await original<typeof import('@/lib/operational-documents')>()),
  createOperationalDocumentTx: mock.persist,
}))
import {
  listOperationalDocuments,
  openOperationalDocument,
  uploadOperationalDocument,
} from './actions'
import { OPERATIONAL_DOCUMENT_ROLES } from '@/lib/operations-policy'
function request() {
  return {
    operationId: randomUUID(),
    target: { type: 'vehicle', id: 'qa-vehicle' },
    category: 'PRESUPUESTO',
    name: 'QA.pdf',
  }
}
function file(content = '%PDF-1.4 QA', name = 'QA.pdf', type = 'application/pdf') {
  const data = new FormData()
  data.set('file', new File([content], name, { type }))
  return data
}
beforeEach(() => {
  vi.resetAllMocks()
  mock.requireRole.mockResolvedValue({ id: 'qa-user', role: 'TALLER', active: true })
  mock.doc.findUnique.mockResolvedValue(null)
  mock.doc.findFirst.mockResolvedValue(null)
  mock.doc.findMany.mockResolvedValue([])
  for (const target of [mock.vehicle, mock.buyerLead, mock.sellerLead])
    target.count.mockResolvedValue(1)
  mock.admin.mockReturnValue({ storage: { from: vi.fn(() => mock.bucket) } })
  mock.bucket.upload.mockResolvedValue({ error: null })
  mock.bucket.remove.mockResolvedValue({ error: null })
  mock.bucket.createSignedUrl.mockResolvedValue({
    data: { signedUrl: 'https://storage.example.test/download' },
    error: null,
  })
  mock.lock.mockImplementation(async (_roots, cb) => cb({}))
  mock.persist.mockImplementation(async (_tx, _input, _actor, f) => ({
    id: 'qa-doc',
    path: f.path,
  }))
})
describe('OPS-1 actions: autorización y archivos privados', () => {
  it('contingencia pausa subidas antes de Storage y conserva lectura', async () => {
    vi.stubEnv('OPS1_PAUSE_WRITES', 'true')
    try {
      expect((await uploadOperationalDocument(request(), file())).ok).toBe(false)
      expect(mock.admin).not.toHaveBeenCalled()
      expect((await listOperationalDocuments(request().target)).ok).toBe(true)
    } finally {
      vi.unstubAllEnvs()
    }
  })
  it.each(['list', 'open', 'upload'] as const)(
    '%s no toca DB/Storage si falla el guard',
    async (action) => {
      mock.requireRole.mockRejectedValue(new Error('forbidden'))
      const call =
        action === 'list'
          ? listOperationalDocuments(request().target)
          : action === 'open'
            ? openOperationalDocument('qa-doc', request().target)
            : uploadOperationalDocument(request(), file())
      await expect(call).rejects.toThrow('forbidden')
      expect(mock.requireRole).toHaveBeenCalledWith(OPERATIONAL_DOCUMENT_ROLES)
      expect(mock.admin).not.toHaveBeenCalled()
      expect(mock.doc.findUnique).not.toHaveBeenCalled()
      expect(mock.doc.findMany).not.toHaveBeenCalled()
      expect(mock.doc.findFirst).not.toHaveBeenCalled()
    }
  )
  it.each(['vehicle', 'buyerLead', 'sellerLead'])(
    'sube a %s con path generado, versión privada y lock exacto',
    async (type) => {
      const input = { ...request(), target: { type, id: 'qa-target' } }
      expect(await uploadOperationalDocument(input, file())).toEqual({ ok: true, id: 'qa-doc' })
      expect(mock.lock).toHaveBeenCalledWith([input.target], expect.any(Function))
      expect(mock.bucket.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^operational\/qa-target\/[a-f0-9-]+\.pdf$/),
        expect.any(ArrayBuffer),
        { contentType: 'application/pdf', upsert: false }
      )
      expect(mock.persist).toHaveBeenCalledWith(
        {},
        input,
        'qa-user',
        expect.objectContaining({
          mime: 'application/pdf',
          checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
        })
      )
    }
  )
  it('filtra destino exacto y sólo las dos categorías operativas', async () => {
    await listOperationalDocuments({ type: 'buyerLead', id: 'buyer-qa' })
    expect(mock.doc.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          vehicleId: null,
          buyerLeadId: 'buyer-qa',
          sellerLeadId: null,
          category: { in: ['PRESUPUESTO', 'OPERATIVO'] },
        },
        take: 21,
        skip: 0,
      })
    )
    expect(mock.admin).not.toHaveBeenCalled()
  })
  it('no firma documentos de otro destino, inexistentes ni comerciales', async () => {
    expect(await openOperationalDocument('qa-doc', { type: 'vehicle', id: 'other' })).toEqual({
      ok: false,
      error: expect.any(String),
    })
    expect(mock.doc.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'qa-doc',
          vehicleId: 'other',
          buyerLeadId: null,
          sellerLeadId: null,
          category: { in: ['PRESUPUESTO', 'OPERATIVO'] },
        },
      })
    )
    expect(mock.admin).not.toHaveBeenCalled()
  })
  it('firma sólo versión activa del bucket privado durante 300 s', async () => {
    mock.doc.findFirst.mockResolvedValue({
      currentVersion: {
        bucket: 'vehicle-documents',
        objectPath: 'operational/qa/doc.pdf',
        status: 'ACTIVE',
      },
    })
    expect((await openOperationalDocument('qa-doc', request().target)).ok).toBe(true)
    expect(mock.bucket.createSignedUrl).toHaveBeenCalledWith('operational/qa/doc.pdf', 300, {
      download: true,
    })
    mock.doc.findFirst.mockResolvedValue({
      currentVersion: { bucket: 'vehicle-photos', objectPath: 'qa', status: 'ACTIVE' },
    })
    await openOperationalDocument('qa-doc', request().target)
    expect(mock.bucket.createSignedUrl).toHaveBeenCalledTimes(1)
  })
  it('rechaza formato falsificado, destino no existente y exceso antes de Storage', async () => {
    expect((await uploadOperationalDocument(request(), file('<html>fake'))).ok).toBe(false)
    mock.vehicle.count.mockResolvedValue(0)
    expect((await uploadOperationalDocument(request(), file())).ok).toBe(false)
    expect(
      (await uploadOperationalDocument(request(), file('%PDF-' + 'x'.repeat(3 * 1024 * 1024)))).ok
    ).toBe(false)
    expect(mock.admin).not.toHaveBeenCalled()
  })
  it('reconoce repetición confirmada sin subir otro objeto', async () => {
    const input = request()
    await uploadOperationalDocument(input, file())
    const persisted = mock.persist.mock.calls[0][3]
    mock.doc.findUnique.mockResolvedValue({
      id: 'qa-doc',
      creationFingerprint: persisted.fingerprint,
    })
    expect(await uploadOperationalDocument(input, file())).toEqual({ ok: true, id: 'qa-doc' })
    expect(mock.bucket.upload).toHaveBeenCalledTimes(1)
    expect((await uploadOperationalDocument({ ...input, name: 'otro' }, file())).ok).toBe(false)
  })
  it('fallo DB compensa únicamente el objeto de este intento', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      mock.persist.mockRejectedValue(new Error('DB failure with secret'))
      expect((await uploadOperationalDocument(request(), file())).ok).toBe(false)
      expect(mock.bucket.remove).toHaveBeenCalledWith([mock.bucket.upload.mock.calls[0][0]])
      expect(log).toHaveBeenCalledWith('[OPS1] document_upload_failed')
    } finally {
      log.mockRestore()
    }
  })
  it('no borra un objeto si DB no permite reconciliar el commit incierto', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      mock.persist.mockRejectedValue(new Error('commit uncertain'))
      mock.doc.findUnique
        .mockResolvedValueOnce(null)
        .mockRejectedValueOnce(new Error('DB unavailable'))
      expect((await uploadOperationalDocument(request(), file())).ok).toBe(false)
      expect(mock.bucket.remove).not.toHaveBeenCalled()
    } finally {
      log.mockRestore()
    }
  })
  it('perdedor concurrente conserva objeto ganador y elimina sólo su intento', async () => {
    mock.persist.mockResolvedValue({ id: 'winner', path: 'operational/qa/winner.pdf' })
    expect(await uploadOperationalDocument(request(), file())).toEqual({ ok: true, id: 'winner' })
    expect(mock.bucket.remove).toHaveBeenCalledWith([mock.bucket.upload.mock.calls[0][0]])
    expect(mock.bucket.remove.mock.calls[0][0]).not.toContain('operational/qa/winner.pdf')
  })
})
