import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import {
  LOCK_ERROR_MESSAGES,
  LockError,
  extractPostgresCode,
  isLockError,
  toLockError,
} from './errors'

function prismaRawError(pgCode: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Raw query failed', {
    code: 'P2010',
    clientVersion: 'test',
    meta: { code: pgCode, message: 'detalle del driver' },
  })
}

describe('extractPostgresCode', () => {
  it('lo lee de meta.code', () => {
    expect(extractPostgresCode(prismaRawError('55P03'))).toBe('55P03')
  })

  it('lo recupera del mensaje si Prisma no lo pone en meta', () => {
    expect(extractPostgresCode(new Error('ERROR: canceling statement (55P03)'))).toBe('55P03')
    expect(extractPostgresCode(new Error('deadlock detected 40P01'))).toBe('40P01')
  })

  it('devuelve null cuando no hay código reconocible', () => {
    expect(extractPostgresCode(new Error('algo raro'))).toBeNull()
    expect(extractPostgresCode('no es un error')).toBeNull()
    expect(extractPostgresCode(undefined)).toBeNull()
  })
})

describe('toLockError', () => {
  it('55P03 → LOCK_TIMEOUT', () => {
    const err = toLockError(prismaRawError('55P03'))
    expect(err.code).toBe('LOCK_TIMEOUT')
  })

  it('40P01 → DEADLOCK', () => {
    const err = toLockError(prismaRawError('40P01'))
    expect(err.code).toBe('DEADLOCK')
  })

  it('un error desconocido de la fase de bloqueo → INFRA_ERROR', () => {
    const err = toLockError(new Error('conexión perdida'))
    expect(err.code).toBe('INFRA_ERROR')
  })

  it('un LockError ya traducido se devuelve tal cual', () => {
    const original = new LockError('ROOT_NOT_FOUND')
    expect(toLockError(original)).toBe(original)
  })

  it('conserva el error original en cause para observabilidad', () => {
    const original = prismaRawError('55P03')
    expect(toLockError(original).cause).toBe(original)
  })
})

describe('mensajes visibles', () => {
  const CODES = ['LOCK_TIMEOUT', 'DEADLOCK', 'ROOT_NOT_FOUND', 'INFRA_ERROR'] as const

  it('no filtran SQL, credenciales ni detalle técnico', () => {
    for (const code of CODES) {
      const message = LOCK_ERROR_MESSAGES[code]
      expect(message).not.toMatch(
        /select|update|insert|from where|postgres|prisma|password|@db\.|55P03|40P01|P2010|stack|\bhost\b/i
      )
    }
  })

  it('están en castellano y son accionables', () => {
    for (const code of CODES) {
      expect(LOCK_ERROR_MESSAGES[code].length).toBeGreaterThan(20)
    }
    expect(LOCK_ERROR_MESSAGES.LOCK_TIMEOUT).toContain('Inténtalo de nuevo')
  })

  it('el mensaje del error traducido nunca expone el detalle del driver', () => {
    const err = toLockError(prismaRawError('55P03'))
    expect(err.message).toBe(LOCK_ERROR_MESSAGES.LOCK_TIMEOUT)
    expect(err.message).not.toContain('detalle del driver')
    expect(err.message).not.toContain('Raw query failed')
  })

  it('ROOT_NOT_FOUND no revela el identificador buscado', () => {
    expect(new LockError('ROOT_NOT_FOUND').message).not.toMatch(/[0-9a-f]{20,}|\bid\b/i)
  })
})

describe('LockError', () => {
  it('es reconocible por instancia y por guard', () => {
    const err = new LockError('DEADLOCK')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('LockError')
    expect(isLockError(err)).toBe(true)
    expect(isLockError(new Error('otro'))).toBe(false)
  })
})
