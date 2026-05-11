import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/lib/db', () => {
  const user = {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  }
  const sellerLead = { count: vi.fn() }
  const buyerLead = { count: vi.fn() }
  return { db: { user, sellerLead, buyerLead } }
})

import { createUser, updateUser, toggleUserActive } from './actions'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

const mockRequireAdmin = requireAdmin as ReturnType<typeof vi.fn>
const mockUser = db.user as unknown as {
  findUnique: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
}
const mockSellerLead = db.sellerLead as unknown as { count: ReturnType<typeof vi.fn> }
const mockBuyerLead = db.buyerLead as unknown as { count: ReturnType<typeof vi.fn> }

const ADMIN_ACTOR = {
  id: 'admin-1',
  role: 'ADMIN' as const,
  name: 'Joel',
  email: 'joel@test.com',
  active: true,
}
const OTHER_ID = 'user-other'

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireAdmin.mockResolvedValue(ADMIN_ACTOR)
})

// ─── createUser ───────────────────────────────────────────────────────────────

describe('createUser', () => {
  it('crea el usuario cuando los datos son válidos y el email es nuevo', async () => {
    mockUser.findUnique.mockResolvedValue(null)
    mockUser.create.mockResolvedValue({ id: 'new-1' })

    const result = await createUser({
      name: 'Desirée',
      email: 'desire@campersnova.com',
      role: 'AGENTE',
      active: true,
      notifyOnNewLead: true,
    })

    expect(result.ok).toBe(true)
    expect(mockUser.create).toHaveBeenCalledOnce()
  })

  it('devuelve error cuando el email ya está registrado', async () => {
    mockUser.findUnique.mockResolvedValue({ id: 'existing-1', email: 'desire@campersnova.com' })

    const result = await createUser({
      name: 'Desirée',
      email: 'desire@campersnova.com',
      role: 'AGENTE',
      active: true,
      notifyOnNewLead: true,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/ya existe/i)
      expect(result.fieldErrors?.email).toBeDefined()
    }
    expect(mockUser.create).not.toHaveBeenCalled()
  })

  it('devuelve fieldErrors cuando los datos son inválidos', async () => {
    const result = await createUser({
      name: 'X',
      email: 'no-es-un-email',
      role: 'AGENTE',
      active: true,
      notifyOnNewLead: true,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.fieldErrors).toBeDefined()
    }
    expect(mockUser.findUnique).not.toHaveBeenCalled()
  })
})

// ─── updateUser ───────────────────────────────────────────────────────────────

describe('updateUser', () => {
  it('actualiza correctamente cuando los datos son válidos', async () => {
    mockUser.update.mockResolvedValue({ id: OTHER_ID })

    const result = await updateUser(OTHER_ID, {
      name: 'Esteban García',
      role: 'ADMIN',
      active: true,
      notifyOnNewLead: true,
    })

    expect(result.ok).toBe(true)
    expect(mockUser.update).toHaveBeenCalledOnce()
  })

  it('impide que el admin se quite su propio rol ADMIN', async () => {
    const result = await updateUser(ADMIN_ACTOR.id, {
      name: 'Joel',
      role: 'AGENTE',
      active: true,
      notifyOnNewLead: true,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/rol admin/i)
    }
    expect(mockUser.update).not.toHaveBeenCalled()
  })

  it('permite que el admin actualice sus propios datos sin cambiar rol', async () => {
    mockUser.update.mockResolvedValue({ id: ADMIN_ACTOR.id })

    const result = await updateUser(ADMIN_ACTOR.id, {
      name: 'Joel Actualizado',
      role: 'ADMIN',
      active: true,
      notifyOnNewLead: false,
    })

    expect(result.ok).toBe(true)
  })
})

// ─── toggleUserActive ─────────────────────────────────────────────────────────

describe('toggleUserActive', () => {
  it('impide que el admin se desactive a sí mismo', async () => {
    const result = await toggleUserActive(ADMIN_ACTOR.id, false)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/ti mismo/i)
    }
    expect(mockUser.update).not.toHaveBeenCalled()
  })

  it('impide desactivar un usuario con leads activos', async () => {
    mockSellerLead.count.mockResolvedValue(2)
    mockBuyerLead.count.mockResolvedValue(1)

    const result = await toggleUserActive(OTHER_ID, false)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/3 leads activos/i)
    }
    expect(mockUser.update).not.toHaveBeenCalled()
  })

  it('desactiva el usuario cuando no tiene leads activos', async () => {
    mockSellerLead.count.mockResolvedValue(0)
    mockBuyerLead.count.mockResolvedValue(0)
    mockUser.update.mockResolvedValue({ id: OTHER_ID })

    const result = await toggleUserActive(OTHER_ID, false)

    expect(result.ok).toBe(true)
    expect(mockUser.update).toHaveBeenCalledWith({
      where: { id: OTHER_ID },
      data: { active: false },
    })
  })

  it('reactiva el usuario sin comprobar leads', async () => {
    mockUser.update.mockResolvedValue({ id: OTHER_ID })

    const result = await toggleUserActive(OTHER_ID, true)

    expect(result.ok).toBe(true)
    expect(mockSellerLead.count).not.toHaveBeenCalled()
    expect(mockBuyerLead.count).not.toHaveBeenCalled()
  })
})
