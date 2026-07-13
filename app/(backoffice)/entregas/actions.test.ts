import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── mocks ───────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
  requireCanViewEntregas: vi.fn(),
  requireCanEditEntregas: vi.fn(),
}))
vi.mock('@/lib/email/send', () => ({ sendDeliveryConfirmation: vi.fn(() => Promise.resolve()) }))
// PR5B2: los documentos privados se operan con el cliente service_role (server-only).
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdminClient: vi.fn() }))

// El servicio transaccional se mockea para controlar éxito/conflicto/error inesperado.
// DeliveryConflictError se mantiene REAL (importOriginal) para que instanceof funcione.
vi.mock('@/lib/delivery-completion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/delivery-completion')>()
  return { ...actual, completeDeliveryTx: vi.fn() }
})

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    delivery: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    deliveryDocument: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn(), update: vi.fn() },
    documentVersion: { create: vi.fn(), findMany: vi.fn() },
    activity: { create: vi.fn() },
    $transaction: vi.fn(),
  }
  return { mockDb }
})
vi.mock('@/lib/db', () => ({ db: mockDb }))

import type { User } from '@prisma/client'
import { requireCanEditEntregas, requireAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { completeDeliveryTx, DeliveryConflictError } from '@/lib/delivery-completion'
import {
  updateDeliveryStatus,
  signDelivery,
  uploadDeliveryDocument,
  deleteDeliveryDocument,
} from './actions'

const storageBucket = {
  upload: vi.fn().mockResolvedValue({ error: null }),
  remove: vi.fn().mockResolvedValue({ error: null }),
}
const mockSupabase = { storage: { from: vi.fn(() => storageBucket) } }

function docFormData(
  opts: { name?: string; type?: string; category?: string; bytes?: number } = {}
) {
  const fd = new FormData()
  const file = new File([new Uint8Array(opts.bytes ?? 100)], opts.name ?? 'contrato.pdf', {
    type: opts.type ?? 'application/pdf',
  })
  fd.set('file', file)
  fd.set('category', opts.category ?? 'CONTRATO_FINAL')
  fd.set('name', 'Contrato')
  return fd
}

const editor = { id: 'user-1', role: 'ENTREGAS' } as User
const admin = { id: 'admin-1', role: 'ADMIN' } as User

const signedComplete = {
  status: 'EN_CURSO' as const,
  vehicleId: 'veh-1',
  buyerLeadId: 'buyer-1',
  signedByName: 'Cliente',
  signedByDni: '12345678Z',
  signatureUrl: 'sig.png',
  vehicle: { sellerLeadId: 'seller-1' },
  checklist: [{ result: 'OK' }, { result: 'NO_APLICA' }],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCanEditEntregas).mockResolvedValue(editor)
  mockDb.delivery.update.mockResolvedValue({})
  mockDb.activity.create.mockResolvedValue({})
  mockDb.$transaction.mockImplementation(async (fn: (tx: typeof mockDb) => Promise<unknown>) =>
    fn(mockDb)
  )
  vi.mocked(completeDeliveryTx).mockResolvedValue({ warrantyId: 'war-1' })
  vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as never)
  mockDb.deliveryDocument.create.mockResolvedValue({ id: 'ddoc-1' })
  mockDb.deliveryDocument.delete.mockResolvedValue({})
  mockDb.deliveryDocument.update.mockResolvedValue({})
  // Por defecto: sin versiones (fila legacy) → el borrado cae al `url` legacy.
  mockDb.documentVersion.findMany.mockResolvedValue([])
  mockDb.documentVersion.create.mockResolvedValue({ id: 'dver-1' })
  storageBucket.upload.mockResolvedValue({ error: null })
  storageBucket.remove.mockResolvedValue({ error: null })
})

describe('uploadDeliveryDocument · subida server-side', () => {
  it('sube server-side y guarda el PATH interno seguro (no un path del cliente)', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ status: 'EN_CURSO' })
    const res = await uploadDeliveryDocument('del-1', docFormData())
    expect(res).toEqual({ ok: true })

    const stored = mockDb.deliveryDocument.create.mock.calls[0][0].data.url as string
    // Path interno seguro deliveries/<id>/<uuid>.pdf: segmento medio UUID de servidor, no el
    // nombre de fichero del cliente, y nunca una URL http.
    expect(stored).toMatch(/^deliveries\/del-1\/[0-9a-f-]{36}\.pdf$/)
    expect(stored.startsWith('http')).toBe(false)
    expect(stored).not.toContain('contrato')
    expect(revalidatePath).toHaveBeenCalledWith('/entregas/del-1')
  })

  it('rechaza un archivo de tipo no permitido (validación server-side) sin crear metadatos', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ status: 'EN_CURSO' })
    const res = await uploadDeliveryDocument(
      'del-1',
      docFormData({ name: 'x.svg', type: 'image/svg+xml' })
    )
    expect(res.ok).toBe(false)
    expect(mockDb.deliveryDocument.create).not.toHaveBeenCalled()
  })

  it('rechaza una categoría no válida', async () => {
    const res = await uploadDeliveryDocument('del-1', docFormData({ category: 'INVENTADA' }))
    expect(res.ok).toBe(false)
    expect(mockDb.deliveryDocument.create).not.toHaveBeenCalled()
  })

  it('rechaza subir a una entrega ya cerrada', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ status: 'COMPLETADA' })
    const res = await uploadDeliveryDocument('del-1', docFormData())
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('cerrada')
    expect(mockDb.deliveryDocument.create).not.toHaveBeenCalled()
  })

  it('error si la entrega no existe', async () => {
    mockDb.delivery.findUnique.mockResolvedValue(null)
    const res = await uploadDeliveryDocument('nope', docFormData())
    expect(res.ok).toBe(false)
    expect(mockDb.deliveryDocument.create).not.toHaveBeenCalled()
  })
})

describe('deleteDeliveryDocument · borrado estricto (Storage primero)', () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockResolvedValue(admin)
  })

  it('borra el objeto y luego el registro cuando Storage confirma', async () => {
    mockDb.deliveryDocument.findUnique.mockResolvedValue({
      url: 'deliveries/del-1/abc.pdf',
      deliveryId: 'del-1',
    })
    const res = await deleteDeliveryDocument('ddoc-1')
    expect(res).toEqual({ ok: true })
    expect(storageBucket.remove).toHaveBeenCalledWith(['deliveries/del-1/abc.pdf'])
    expect(mockDb.deliveryDocument.delete).toHaveBeenCalledWith({ where: { id: 'ddoc-1' } })
  })

  it('NO elimina el registro si el borrado en Storage falla', async () => {
    mockDb.deliveryDocument.findUnique.mockResolvedValue({
      url: 'deliveries/del-1/abc.pdf',
      deliveryId: 'del-1',
    })
    storageBucket.remove.mockResolvedValue({ error: { message: 'down' } })

    const res = await deleteDeliveryDocument('ddoc-1')
    expect(res.ok).toBe(false)
    expect(mockDb.deliveryDocument.delete).not.toHaveBeenCalled()
  })

  it('error si el documento no existe', async () => {
    mockDb.deliveryDocument.findUnique.mockResolvedValue(null)
    const res = await deleteDeliveryDocument('nope')
    expect(res.ok).toBe(false)
    expect(mockDb.deliveryDocument.delete).not.toHaveBeenCalled()
  })
})

describe('updateDeliveryStatus · validaciones previas', () => {
  it('error si la entrega no existe', async () => {
    mockDb.delivery.findUnique.mockResolvedValue(null)
    const res = await updateDeliveryStatus('x', 'EN_CURSO')
    expect(res).toEqual({ ok: false, error: 'Entrega no encontrada' })
    expect(completeDeliveryTx).not.toHaveBeenCalled()
  })

  it('rechaza transición inválida (PROGRAMADA → COMPLETADA)', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ ...signedComplete, status: 'PROGRAMADA' })
    const res = await updateDeliveryStatus('d1', 'COMPLETADA')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('no permitida')
    expect(completeDeliveryTx).not.toHaveBeenCalled()
  })

  it('bloquea COMPLETADA si hay ítems de checklist pendientes', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({
      ...signedComplete,
      checklist: [{ result: 'OK' }, { result: 'PENDIENTE' }],
    })
    const res = await updateDeliveryStatus('d1', 'COMPLETADA')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('pendientes')
    expect(completeDeliveryTx).not.toHaveBeenCalled()
  })

  it('bloquea COMPLETADA si falta la firma', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ ...signedComplete, signedByName: null })
    const res = await updateDeliveryStatus('d1', 'COMPLETADA')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('firma')
    expect(completeDeliveryTx).not.toHaveBeenCalled()
  })
})

describe('updateDeliveryStatus · finalización atómica (COMPLETADA)', () => {
  it('invoca el servicio transaccional con el contexto correcto y revalida tras el commit', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ ...signedComplete })
    const res = await updateDeliveryStatus('d1', 'COMPLETADA')
    expect(res).toEqual({ ok: true })

    expect(completeDeliveryTx).toHaveBeenCalledOnce()
    const [, params] = vi.mocked(completeDeliveryTx).mock.calls[0]
    expect(params).toMatchObject({
      deliveryId: 'd1',
      vehicleId: 'veh-1',
      buyerLeadId: 'buyer-1',
      sellerLeadId: 'seller-1',
      actorId: 'user-1',
    })
    expect(params.now).toBeInstanceOf(Date)
    expect(revalidatePath).toHaveBeenCalledWith('/entregas')
    expect(revalidatePath).toHaveBeenCalledWith('/entregas/d1')
  })

  it('traduce DeliveryConflictError a { ok:false, error } y NO revalida', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ ...signedComplete })
    vi.mocked(completeDeliveryTx).mockRejectedValue(new DeliveryConflictError('delivery'))

    const res = await updateDeliveryStatus('d1', 'COMPLETADA')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('ya no está disponible')
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('traduce un conflicto de vehículo incompatible a { ok:false, error }', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ ...signedComplete })
    vi.mocked(completeDeliveryTx).mockRejectedValue(new DeliveryConflictError('vehicle'))

    const res = await updateDeliveryStatus('d1', 'COMPLETADA')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('vehículo ya no está disponible')
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('propaga un error técnico inesperado (no lo oculta como conflicto) y NO revalida', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ ...signedComplete })
    vi.mocked(completeDeliveryTx).mockRejectedValue(new Error('DB caída'))

    await expect(updateDeliveryStatus('d1', 'COMPLETADA')).rejects.toThrow('DB caída')
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('updateDeliveryStatus · transiciones sin garantía (EN_CURSO / CANCELADA)', () => {
  it('EN_CURSO actualiza la entrega y no invoca el servicio de finalización', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ ...signedComplete, status: 'PROGRAMADA' })
    const res = await updateDeliveryStatus('d1', 'EN_CURSO')
    expect(res).toEqual({ ok: true })
    expect(completeDeliveryTx).not.toHaveBeenCalled()
    expect(mockDb.delivery.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'd1' } })
    )
  })

  it('CANCELADA registra la actividad de cancelación sin garantía', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ ...signedComplete })
    const res = await updateDeliveryStatus('d1', 'CANCELADA')
    expect(res).toEqual({ ok: true })
    expect(completeDeliveryTx).not.toHaveBeenCalled()
    const types = mockDb.activity.create.mock.calls.map((c) => c[0].data.type)
    expect(types).toContain('ENTREGA_CANCELADA')
  })
})

describe('signDelivery', () => {
  const validSign = { signedByName: 'Cliente', signedByDni: '12345678Z', signatureUrl: 'sig.png' }

  it('rechaza datos de firma inválidos', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ status: 'EN_CURSO', responsableId: 'user-1' })
    const res = await signDelivery('d1', { signedByName: '', signedByDni: '', signatureUrl: '' })
    expect(res.ok).toBe(false)
  })

  it('no permite firmar una entrega ya cerrada', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ status: 'COMPLETADA', responsableId: 'user-1' })
    const res = await signDelivery('d1', validSign)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('cerrada')
  })

  it('bloquea a quien no es responsable ni admin', async () => {
    vi.mocked(requireCanEditEntregas).mockResolvedValue(editor) // user-1
    mockDb.delivery.findUnique.mockResolvedValue({ status: 'EN_CURSO', responsableId: 'otro' })
    const res = await signDelivery('d1', validSign)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('responsable')
  })

  it('permite al admin firmar cualquier entrega', async () => {
    vi.mocked(requireCanEditEntregas).mockResolvedValue(admin)
    mockDb.delivery.findUnique.mockResolvedValue({ status: 'EN_CURSO', responsableId: 'otro' })
    const res = await signDelivery('d1', validSign)
    expect(res).toEqual({ ok: true })
    expect(mockDb.delivery.update).toHaveBeenCalled()
  })
})
