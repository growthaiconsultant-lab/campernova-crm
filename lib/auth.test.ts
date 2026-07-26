import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { User } from '@prisma/client'

// ─── mocks para las guards que consultan sesión + BD ─────────────────────────
// `redirect` lanza (como el NEXT_REDIRECT real) para cortar el flujo; el mensaje
// transporta la URL destino para poder asertar sobre ella.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

const { mockAuth, mockDb } = vi.hoisted(() => ({
  mockAuth: { getUser: vi.fn() },
  mockDb: { user: { findUnique: vi.fn() } },
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: () => ({ auth: mockAuth }) }))
vi.mock('@/lib/db', () => ({ db: mockDb }))

import {
  userHasRole,
  requireAgente,
  requireAdmin,
  requireCanViewVehiculos,
  requireCanViewCalendario,
} from './auth'

function makeUser(role: User['role']): User {
  return {
    id: 'u1',
    authId: null,
    name: 'Test',
    email: 'test@example.com',
    role,
    active: true,
    notifyOnNewLead: true,
    lastMatchEmailAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('userHasRole', () => {
  it('returns true when user role is in the allowed list', () => {
    expect(userHasRole(makeUser('ADMIN'), ['ADMIN', 'AGENTE'])).toBe(true)
    expect(userHasRole(makeUser('AGENTE'), ['ADMIN', 'AGENTE'])).toBe(true)
    expect(userHasRole(makeUser('TALLER'), ['ADMIN', 'AGENTE', 'TALLER'])).toBe(true)
    expect(userHasRole(makeUser('ENTREGAS'), ['ADMIN', 'ENTREGAS'])).toBe(true)
    expect(userHasRole(makeUser('MARKETING'), ['ADMIN', 'AGENTE', 'MARKETING'])).toBe(true)
  })

  it('returns false when user role is not in the allowed list', () => {
    expect(userHasRole(makeUser('TALLER'), ['ADMIN', 'AGENTE'])).toBe(false)
    expect(userHasRole(makeUser('ENTREGAS'), ['ADMIN', 'AGENTE'])).toBe(false)
    expect(userHasRole(makeUser('MARKETING'), ['ADMIN', 'AGENTE'])).toBe(false)
    expect(userHasRole(makeUser('AGENTE'), ['ADMIN'])).toBe(false)
  })

  it('returns false for empty allowed list', () => {
    expect(userHasRole(makeUser('ADMIN'), [])).toBe(false)
  })

  it('ADMIN always passes single-role guard', () => {
    expect(userHasRole(makeUser('ADMIN'), ['ADMIN'])).toBe(true)
  })

  // Role-specific access rules
  it('TALLER can view taller and vehicles but not commercial modules', () => {
    const taller = makeUser('TALLER')
    expect(userHasRole(taller, ['ADMIN', 'AGENTE', 'TALLER'])).toBe(true) // taller view
    expect(userHasRole(taller, ['ADMIN', 'TALLER'])).toBe(true) // taller edit
    expect(userHasRole(taller, ['ADMIN', 'AGENTE'])).toBe(false) // commercial
    expect(userHasRole(taller, ['ADMIN', 'ENTREGAS'])).toBe(false) // entregas
  })

  it('ENTREGAS can view/edit entregas and postventa but not commercial', () => {
    const entregas = makeUser('ENTREGAS')
    expect(userHasRole(entregas, ['ADMIN', 'AGENTE', 'ENTREGAS'])).toBe(true) // view
    expect(userHasRole(entregas, ['ADMIN', 'ENTREGAS'])).toBe(true) // edit
    expect(userHasRole(entregas, ['ADMIN', 'AGENTE'])).toBe(false) // commercial
    expect(userHasRole(entregas, ['ADMIN', 'TALLER'])).toBe(false) // taller edit
  })

  it('MARKETING can generate ads but not edit deliveries or work orders', () => {
    const marketing = makeUser('MARKETING')
    expect(userHasRole(marketing, ['ADMIN', 'AGENTE', 'MARKETING'])).toBe(true) // ads
    expect(userHasRole(marketing, ['ADMIN', 'AGENTE'])).toBe(false) // commercial
    expect(userHasRole(marketing, ['ADMIN', 'ENTREGAS'])).toBe(false) // entregas
    expect(userHasRole(marketing, ['ADMIN', 'TALLER'])).toBe(false) // taller
  })
})

// ─── Guards server-side por rol (PERM-1) ─────────────────────────────────────

const ALL_ROLES: User['role'][] = ['ADMIN', 'AGENTE', 'TALLER', 'ENTREGAS', 'MARKETING']

function loginAs(role: User['role']) {
  mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'auth-1' } } })
  mockDb.user.findUnique.mockResolvedValue(makeUser(role))
}

async function expectAllowed(guard: () => Promise<User>, role: User['role']) {
  loginAs(role)
  const user = await guard()
  expect(user.role).toBe(role)
}

async function expectForbidden(guard: () => Promise<User>, role: User['role']) {
  loginAs(role)
  await expect(guard()).rejects.toThrow('REDIRECT:/dashboard?error=forbidden')
}

describe('require* server-side guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('requireCanViewVehiculos (inventario comercial → ADMIN + AGENTE)', () => {
    it.each(['ADMIN', 'AGENTE'] as const)('permite a %s', async (role) => {
      await expectAllowed(requireCanViewVehiculos, role)
    })
    it.each(['TALLER', 'ENTREGAS', 'MARKETING'] as const)('deniega a %s', async (role) => {
      await expectForbidden(requireCanViewVehiculos, role)
    })
  })

  describe('requireAgente (vendedores/compradores/ofertas → ADMIN + AGENTE)', () => {
    it.each(['ADMIN', 'AGENTE'] as const)('permite a %s', async (role) => {
      await expectAllowed(requireAgente, role)
    })
    it.each(['TALLER', 'ENTREGAS', 'MARKETING'] as const)('deniega a %s', async (role) => {
      await expectForbidden(requireAgente, role)
    })
  })

  describe('requireCanViewCalendario (agenda operativa → ADMIN + AGENTE + TALLER + ENTREGAS)', () => {
    it.each(['ADMIN', 'AGENTE', 'TALLER', 'ENTREGAS'] as const)('permite a %s', async (role) => {
      await expectAllowed(requireCanViewCalendario, role)
    })
    it('deniega a MARKETING', async () => {
      await expectForbidden(requireCanViewCalendario, 'MARKETING')
    })
  })

  describe('requireAdmin (ajustes / configuración → solo ADMIN)', () => {
    it('permite a ADMIN', async () => {
      await expectAllowed(requireAdmin, 'ADMIN')
    })
    it.each(['AGENTE', 'TALLER', 'ENTREGAS', 'MARKETING'] as const)('deniega a %s', async (role) => {
      await expectForbidden(requireAdmin, role)
    })
  })

  describe('sesión ausente o inactiva → /login', () => {
    it('sin usuario autenticado redirige a /login', async () => {
      mockAuth.getUser.mockResolvedValue({ data: { user: null } })
      await expect(requireCanViewVehiculos()).rejects.toThrow('REDIRECT:/login')
    })

    it('usuario inactivo redirige a /login (no cuenta como acceso)', async () => {
      mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'auth-1' } } })
      mockDb.user.findUnique.mockResolvedValue({ ...makeUser('ADMIN'), active: false })
      await expect(requireCanViewVehiculos()).rejects.toThrow('REDIRECT:/login')
    })

    it('cubre los 5 roles del sistema', () => {
      expect(ALL_ROLES).toHaveLength(5)
    })
  })
})
