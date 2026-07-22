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
// `withLockedRoots` se mockea para inspeccionar raíces y ejecutar el callback con mockDb; el núcleo
// `createDeliveryTx` corre REAL contra mockDb (flujo end-to-end).
vi.mock('@/lib/locking', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/locking')>()
  return { ...actual, withLockedRoots: vi.fn() }
})

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    delivery: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    deliveryDocument: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn(), update: vi.fn() },
    documentVersion: { create: vi.fn(), findMany: vi.fn() },
    vehicle: { findUnique: vi.fn() },
    offer: { findUnique: vi.fn() },
    sellerLead: { findUnique: vi.fn() },
    buyerLead: { findUnique: vi.fn() },
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
import {
  completeDeliveryTx,
  DeliveryConflictError,
  DeliveryCompletionError,
} from '@/lib/delivery-completion'
import { withLockedRoots, LockError } from '@/lib/locking'
import { Prisma } from '@prisma/client'
import { DELIVERY_CREATION_ERROR_MESSAGES } from '@/lib/delivery-creation'
import {
  createDelivery,
  updateDeliveryStatus,
  cancelDelivery,
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
  // withLockedRoots ejecuta el callback (núcleo real) con mockDb como TransactionClient.
  vi.mocked(withLockedRoots).mockImplementation(async (_roots, operation) =>
    operation(mockDb as never)
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

  // I3C3: la validación de estado, checklist y firma se hace BAJO el lock dentro de
  // `completeDeliveryTx` (unit-tested en delivery-completion.test.ts). La action solo delega y
  // traduce el error de dominio a un mensaje de UI.
  it('traduce DeliveryCompletionError (checklist/firma/estado) a { ok:false } y NO revalida', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ ...signedComplete })
    vi.mocked(completeDeliveryTx).mockRejectedValue(
      new DeliveryCompletionError('CHECKLIST_INCOMPLETE')
    )
    const res = await updateDeliveryStatus('d1', 'COMPLETADA')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/checklist/i)
    expect(revalidatePath).not.toHaveBeenCalled()
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
      resolvedSellerLeadId: 'seller-1',
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

describe('I3C2 · transiciones coordinadas (EN_CURSO / CANCELADA)', () => {
  // El núcleo real corre contra mockDb dentro del withLockedRoots mockeado.
  const coordinatedShape = {
    status: 'PROGRAMADA' as const,
    vehicleId: 'veh-1',
    buyerLeadId: 'buyer-1',
    vehicle: { sellerLeadId: 'seller-1' },
  }
  function primeCoordinated(status: 'PROGRAMADA' | 'EN_CURSO' = 'PROGRAMADA') {
    mockDb.delivery.findUnique.mockResolvedValue({ ...coordinatedShape, status })
    mockDb.vehicle.findUnique.mockResolvedValue({ sellerLeadId: 'seller-1' })
    mockDb.sellerLead.findUnique.mockResolvedValue({ archivedAt: null })
    mockDb.buyerLead.findUnique.mockResolvedValue({ archivedAt: null })
    mockDb.delivery.updateMany.mockResolvedValue({ count: 1 })
    mockDb.activity.create.mockResolvedValue({})
  }

  it('EN_CURSO pasa por el núcleo coordinado (CAS) y no invoca la finalización', async () => {
    primeCoordinated('PROGRAMADA')
    const res = await updateDeliveryStatus('d1', 'EN_CURSO', 'PROGRAMADA')
    expect(res).toEqual({ ok: true })
    expect(completeDeliveryTx).not.toHaveBeenCalled()
    const cas = mockDb.delivery.updateMany.mock.calls[0][0]
    expect(cas.where).toEqual({ id: 'd1', status: 'PROGRAMADA' })
    expect(cas.data.status).toBe('EN_CURSO')
  })

  it('updateDeliveryStatus(CANCELADA) exige motivo → se enruta por cancelDelivery', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ ...coordinatedShape })
    const res = await updateDeliveryStatus('d1', 'CANCELADA')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/motivo/i)
    expect(mockDb.delivery.updateMany).not.toHaveBeenCalled()
  })

  it('cancelDelivery escribe estado + motivo + Activity de forma atómica (una sola tx)', async () => {
    primeCoordinated('PROGRAMADA')
    const res = await cancelDelivery('d1', 'el comprador aplaza', 'PROGRAMADA')
    expect(res).toEqual({ ok: true })
    const cas = mockDb.delivery.updateMany.mock.calls[0][0]
    expect(cas.data.status).toBe('CANCELADA')
    expect(cas.data.cancellationReason).toBe('el comprador aplaza')
    const types = mockDb.activity.create.mock.calls.map((c) => c[0].data.type)
    expect(types).toContain('ENTREGA_CANCELADA')
  })

  it('cancelDelivery sin motivo → CANCELLATION_REASON_REQUIRED, sin escribir', async () => {
    primeCoordinated('PROGRAMADA')
    const res = await cancelDelivery('d1', '   ', 'PROGRAMADA')
    expect(res.ok).toBe(false)
    expect(mockDb.delivery.updateMany).not.toHaveBeenCalled()
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

// ─── createDelivery coordinada (I3C1A) ────────────────────────────────────────

describe('createDelivery · coordinación y contrato (I3C1A)', () => {
  const validInput = {
    vehicleId: 'veh-1',
    buyerLeadId: 'buyer-1',
    offerId: 'offer-1',
    scheduledAt: '2026-08-01T10:00',
    responsableId: null,
    notes: null,
  }

  /** Configura mockDb para el camino feliz; los tests sobreescriben lo que necesiten. */
  function happyPath() {
    mockDb.vehicle.findUnique.mockResolvedValue({ status: 'RESERVADO', sellerLeadId: 'seller-1' })
    mockDb.sellerLead.findUnique.mockResolvedValue({ archivedAt: null })
    mockDb.buyerLead.findUnique.mockResolvedValue({ archivedAt: null })
    mockDb.offer.findUnique.mockResolvedValue({
      status: 'CONVERTIDA',
      vehicleId: 'veh-1',
      buyerLeadId: 'buyer-1',
    })
    mockDb.delivery.count.mockResolvedValue(0)
    mockDb.delivery.create.mockResolvedValue({ id: 'del-new' })
    mockDb.delivery.findUnique.mockResolvedValue({
      buyerLead: { name: 'C', email: 'c@x.com' },
      vehicle: { brand: 'Adria', model: 'Coral' },
    })
  }

  it('exige permiso de EDICIÓN (no de lectura)', async () => {
    // Si requireCanEditEntregas rechaza, la acción no llega a tocar la BD.
    vi.mocked(requireCanEditEntregas).mockRejectedValue(new Error('forbidden'))
    await expect(createDelivery(validInput)).rejects.toThrow('forbidden')
    expect(withLockedRoots).not.toHaveBeenCalled()
  })

  it('rechaza input sin offerId', async () => {
    const res = await createDelivery({ ...validInput, offerId: '' })
    expect(res).toEqual({ ok: false, error: 'Datos inválidos' })
    expect(withLockedRoots).not.toHaveBeenCalled()
  })

  it('vehículo inexistente en la preliminar: no abre transacción', async () => {
    mockDb.vehicle.findUnique.mockResolvedValue(null)
    const res = await createDelivery(validInput)
    expect(res).toEqual({ ok: false, error: DELIVERY_CREATION_ERROR_MESSAGES.VEHICLE_NOT_FOUND })
    expect(withLockedRoots).not.toHaveBeenCalled()
  })

  it('bloquea Vehicle → SellerLead → BuyerLead con las raíces exactas', async () => {
    happyPath()
    await createDelivery(validInput)
    const roots = vi.mocked(withLockedRoots).mock.calls[0][0]
    expect(roots).toEqual([
      { type: 'vehicle', id: 'veh-1' },
      { type: 'sellerLead', id: 'seller-1' },
      { type: 'buyerLead', id: 'buyer-1' },
    ])
  })

  it('sin vendedor: raíces = vehículo + comprador, sin raíz vacía', async () => {
    happyPath()
    mockDb.vehicle.findUnique.mockResolvedValue({ status: 'RESERVADO', sellerLeadId: null })
    await createDelivery(validInput)
    const roots = vi.mocked(withLockedRoots).mock.calls[0][0]
    expect(roots).toEqual([
      { type: 'vehicle', id: 'veh-1' },
      { type: 'buyerLead', id: 'buyer-1' },
    ])
    expect(mockDb.sellerLead.findUnique).not.toHaveBeenCalled()
  })

  it('camino feliz: crea Delivery con offerId + Activity y devuelve el id', async () => {
    happyPath()
    const res = await createDelivery(validInput)
    expect(res).toEqual({ ok: true, data: { id: 'del-new' } })
    const createArg = mockDb.delivery.create.mock.calls[0][0]
    expect(createArg.data.offerId).toBe('offer-1')
    expect(mockDb.activity.create).toHaveBeenCalledTimes(1)
    expect(mockDb.activity.create.mock.calls[0][0].data.type).toBe('ENTREGA_PROGRAMADA')
    expect(revalidatePath).toHaveBeenCalledWith('/entregas')
  })

  it.each([
    [
      'OFFER_NOT_CONVERTED',
      () =>
        mockDb.offer.findUnique.mockResolvedValue({
          status: 'ACEPTADA',
          vehicleId: 'veh-1',
          buyerLeadId: 'buyer-1',
        }),
    ],
    ['OFFER_NOT_FOUND', () => mockDb.offer.findUnique.mockResolvedValue(null)],
    [
      'OFFER_MISMATCH',
      () =>
        mockDb.offer.findUnique.mockResolvedValue({
          status: 'CONVERTIDA',
          vehicleId: 'otro',
          buyerLeadId: 'buyer-1',
        }),
    ],
    [
      'VEHICLE_NOT_READY_FOR_DELIVERY',
      () =>
        mockDb.vehicle.findUnique.mockResolvedValue({
          status: 'PUBLICADO',
          sellerLeadId: 'seller-1',
        }),
    ],
    [
      'LEAD_ARCHIVED',
      () => mockDb.buyerLead.findUnique.mockResolvedValue({ archivedAt: new Date() }),
    ],
    ['BUYER_LEAD_NOT_FOUND', () => mockDb.buyerLead.findUnique.mockResolvedValue(null)],
    ['SELLER_LEAD_NOT_FOUND', () => mockDb.sellerLead.findUnique.mockResolvedValue(null)],
    [
      'DELIVERY_ROOT_CHANGED',
      () =>
        mockDb.vehicle.findUnique
          .mockResolvedValueOnce({ status: 'RESERVADO', sellerLeadId: 'seller-1' })
          .mockResolvedValueOnce({ status: 'RESERVADO', sellerLeadId: 'seller-2' }),
    ],
  ] as const)('rechaza %s sin escribir Delivery ni Activity', async (code, setup) => {
    happyPath()
    setup()
    const res = await createDelivery(validInput)
    expect(res).toEqual({ ok: false, error: DELIVERY_CREATION_ERROR_MESSAGES[code] })
    expect(mockDb.delivery.create).not.toHaveBeenCalled()
    expect(mockDb.activity.create).not.toHaveBeenCalled()
  })

  it('rechaza si ya existe una Delivery activa', async () => {
    happyPath()
    mockDb.delivery.count.mockImplementation(async (args: { where: { status: unknown } }) => {
      // primera llamada: activas; segunda: completadas
      const st = JSON.stringify(args.where.status)
      return st.includes('PROGRAMADA') ? 1 : 0
    })
    const res = await createDelivery(validInput)
    expect(res).toEqual({
      ok: false,
      error: DELIVERY_CREATION_ERROR_MESSAGES.DELIVERY_ALREADY_ACTIVE,
    })
    expect(mockDb.delivery.create).not.toHaveBeenCalled()
  })

  it('rechaza recrear tras una Delivery COMPLETADA', async () => {
    happyPath()
    mockDb.delivery.count.mockImplementation(async (args: { where: { status: unknown } }) => {
      const st = JSON.stringify(args.where.status)
      return st.includes('COMPLETADA') ? 1 : 0
    })
    const res = await createDelivery(validInput)
    expect(res).toEqual({
      ok: false,
      error: DELIVERY_CREATION_ERROR_MESSAGES.VEHICLE_ALREADY_DELIVERED,
    })
    expect(mockDb.delivery.create).not.toHaveBeenCalled()
  })

  // La metadata real de Prisma para el índice parcial: modelName='Delivery', target=['vehicle_id'].
  function realPartialIndexP2002() {
    return new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002',
      clientVersion: 'x',
      meta: { modelName: 'Delivery', target: ['vehicle_id'] },
    })
  }

  it('P2002 candidato + confirmación encuentra una activa → DELIVERY_ALREADY_ACTIVE', async () => {
    happyPath()
    mockDb.delivery.create.mockRejectedValue(realPartialIndexP2002())
    // count dentro del núcleo: activa=0, completada=0 (pasa al create); confirmación post-rollback=1.
    mockDb.delivery.count.mockReset()
    mockDb.delivery.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValue(1)
    const res = await createDelivery(validInput)
    expect(res).toEqual({
      ok: false,
      error: DELIVERY_CREATION_ERROR_MESSAGES.DELIVERY_ALREADY_ACTIVE,
    })
    // La confirmación consultó por el vehículo y estados activos, fuera de la transacción.
    const confirmCall = mockDb.delivery.count.mock.calls.at(-1)?.[0]
    expect(confirmCall.where.vehicleId).toBe('veh-1')
  })

  it('P2002 candidato pero la confirmación NO encuentra activa → propaga error técnico', async () => {
    happyPath()
    mockDb.delivery.create.mockRejectedValue(realPartialIndexP2002())
    // Caso futuro ambiguo: otro unique sobre vehicle_id sin Delivery activa real → no traducir.
    mockDb.delivery.count.mockResolvedValue(0)
    await expect(createDelivery(validInput)).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError
    )
  })

  it('propaga un P2002 de OTRO modelo como error técnico (ni siquiera candidato)', async () => {
    happyPath()
    mockDb.delivery.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'x',
        meta: { modelName: 'User', target: ['email'] },
      })
    )
    await expect(createDelivery(validInput)).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError
    )
  })

  it('traduce un LockError a mensaje seguro sin crear nada', async () => {
    happyPath()
    vi.mocked(withLockedRoots).mockRejectedValue(new LockError('LOCK_TIMEOUT'))
    const res = await createDelivery(validInput)
    expect(res.ok).toBe(false)
    expect(mockDb.delivery.create).not.toHaveBeenCalled()
  })

  it('los mensajes de error de dominio no filtran ids, SQL ni Prisma', () => {
    for (const msg of Object.values(DELIVERY_CREATION_ERROR_MESSAGES)) {
      expect(msg).not.toMatch(/prisma|select|update |veh-1|offer-1|[0-9a-f]{20,}/i)
    }
  })
})
