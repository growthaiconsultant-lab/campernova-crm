import { describe, it, expect } from 'vitest'
import { userHasRole } from './auth'
import type { User } from '@prisma/client'

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
