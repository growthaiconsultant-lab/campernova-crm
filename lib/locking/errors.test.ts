import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import {
  LOCK_ERROR_MESSAGES,
  LockError,
  extractPostgresCode,
  isLockError,
  toLockError,
  translateConcurrencyError,
} from './errors'

function prismaRawError(pgCode: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Raw query failed', {
    code: 'P2010',
    clientVersion: 'test',
    meta: { code: pgCode, message: 'detalle del driver' },
  })
}

describe('extractPostgresCode — código estructurado', () => {
  it('lo lee de meta.code', () => {
    expect(extractPostgresCode(prismaRawError('55P03'))).toBe('55P03')
  })

  it('lo lee de un error del driver con `code` directo', () => {
    const driverError = Object.assign(new Error('lock not available'), { code: '55P03' })
    expect(extractPostgresCode(driverError)).toBe('55P03')
  })

  it('lo encuentra anidado en la cadena de cause', () => {
    const anidado = new Error('fallo de capa superior', { cause: prismaRawError('40P01') })
    expect(extractPostgresCode(anidado)).toBe('40P01')
  })

  it('devuelve null cuando no hay código reconocible', () => {
    expect(extractPostgresCode(new Error('algo raro'))).toBeNull()
    expect(extractPostgresCode('no es un error')).toBeNull()
    expect(extractPostgresCode(undefined)).toBeNull()
  })

  it('ignora SQLSTATE que no pertenecen al conjunto reconocido', () => {
    expect(extractPostgresCode(prismaRawError('23505'))).toBeNull()
  })
})

describe('extractPostgresCode — adversarial: no clasificar por coincidencia de texto', () => {
  // El defecto que corregimos: un mensaje comercial con un código dentro NO es un fallo de
  // concurrencia. Solo se analiza el texto de errores emitidos por Prisma.
  it('un Error de negocio con "40P01" en el mensaje NO es un deadlock', () => {
    const negocio = new Error('La oferta 40P01 ya no está disponible')
    expect(extractPostgresCode(negocio)).toBeNull()
    expect(translateConcurrencyError(negocio)).toBe(negocio)
  })

  it('un Error de negocio con "55P03" en el mensaje NO es un lock timeout', () => {
    const negocio = new Error('Vehículo 55P03 no disponible')
    expect(extractPostgresCode(negocio)).toBeNull()
    expect(translateConcurrencyError(negocio)).toBe(negocio)
  })

  it('un texto con la palabra "deadlock" sin código no se clasifica', () => {
    const negocio = new Error('deadlock en la negociación con el cliente')
    expect(extractPostgresCode(negocio)).toBeNull()
  })

  it('sí admite el respaldo por texto cuando el error SÍ es de Prisma', () => {
    // Algunas versiones dejan el código del driver solo dentro del mensaje.
    const prismaSinMeta = new Prisma.PrismaClientUnknownRequestError(
      'Raw query failed. Code: 55P03',
      { clientVersion: 'test' }
    )
    expect(extractPostgresCode(prismaSinMeta)).toBe('55P03')
  })

  it('un PrismaClientKnownRequestError sin meta.code no rompe la extracción', () => {
    const sinMeta = new Prisma.PrismaClientKnownRequestError('Raw query failed', {
      code: 'P2010',
      clientVersion: 'test',
    })
    expect(extractPostgresCode(sinMeta)).toBeNull()
  })

  it('un ciclo en cause no provoca recursión infinita', () => {
    const a = new Error('a') as Error & { cause?: unknown }
    const b = new Error('b') as Error & { cause?: unknown }
    a.cause = b
    b.cause = a
    expect(() => extractPostgresCode(a)).not.toThrow()
    expect(extractPostgresCode(a)).toBeNull()
  })

  it('una cadena de cause muy larga se corta sin colgarse', () => {
    let err: Error = prismaRawError('40P01')
    for (let i = 0; i < 50; i++) err = new Error(`capa ${i}`, { cause: err })
    expect(() => extractPostgresCode(err)).not.toThrow()
  })

  it('un error de red no se clasifica como concurrencia', () => {
    const red = Object.assign(new Error('ECONNRESET'), { code: 'ECONNRESET' })
    expect(extractPostgresCode(red)).toBeNull()
    expect(translateConcurrencyError(red)).toBe(red)
  })
})

describe('translateConcurrencyError — frontera del contrato', () => {
  it('traduce 55P03 ocurra donde ocurra', () => {
    expect((translateConcurrencyError(prismaRawError('55P03')) as LockError).code).toBe(
      'LOCK_TIMEOUT'
    )
  })

  it('traduce 40P01 ocurra donde ocurra', () => {
    expect((translateConcurrencyError(prismaRawError('40P01')) as LockError).code).toBe('DEADLOCK')
  })

  it('traduce P2028 como TRANSACTION_TIMEOUT, no como lock timeout', () => {
    const p2028 = new Prisma.PrismaClientKnownRequestError(
      'Transaction already closed: timeout exceeded',
      { code: 'P2028', clientVersion: 'test' }
    )
    expect((translateConcurrencyError(p2028) as LockError).code).toBe('TRANSACTION_TIMEOUT')
  })

  it('deja intactos los errores de negocio conocidos', () => {
    class OfferConflictError extends Error {}
    const conflicto = new OfferConflictError('La oferta ya no está disponible.')
    expect(translateConcurrencyError(conflicto)).toBe(conflicto)
  })

  it('deja intacto cualquier error no relacionado con concurrencia', () => {
    const validacion = new Error('Datos inválidos')
    expect(translateConcurrencyError(validacion)).toBe(validacion)
  })

  it('no convierte un error desconocido en INFRA_ERROR', () => {
    const desconocido = new Error('vaya')
    expect(translateConcurrencyError(desconocido)).toBe(desconocido)
    expect(isLockError(translateConcurrencyError(desconocido))).toBe(false)
  })

  it('un LockError previo se devuelve tal cual', () => {
    const original = new LockError('ROOT_NOT_FOUND')
    expect(translateConcurrencyError(original)).toBe(original)
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

describe('serialización segura', () => {
  it('JSON.stringify no incluye cause', () => {
    const interno = new Error('conexión a db.HOST-INTERNO fallida para el usuario postgres.abc')
    const err = new LockError('INFRA_ERROR', interno)
    const json = JSON.stringify(err)

    expect(json).not.toContain('cause')
    expect(json).not.toContain('HOST-INTERNO')
    expect(json).not.toContain('postgres.abc')
    expect(json).not.toMatch(/select|update|55P03|40P01|P2010/i)
  })

  it('code sigue siendo enumerable para que el llamante pueda discriminar', () => {
    const err = new LockError('DEADLOCK')
    expect(Object.keys(err)).toContain('code')
    expect(Object.keys(err)).not.toContain('cause')
    expect(JSON.parse(JSON.stringify(err)).code).toBe('DEADLOCK')
  })

  it('cause sigue accesible en servidor para observabilidad', () => {
    const interno = new Error('detalle técnico')
    const err = new LockError('INFRA_ERROR', interno)
    expect((err as { cause?: unknown }).cause).toBe(interno)
  })

  it('la forma que deben devolver los llamantes es segura', () => {
    const err = new LockError('LOCK_TIMEOUT', new Error('db.HOST-INTERNO'))
    const seguro = { code: err.code, message: err.message }
    expect(JSON.stringify(seguro)).not.toContain('HOST-INTERNO')
  })
})

describe('mensajes visibles', () => {
  const CODES = [
    'INVALID_LOCK_ROOT',
    'LOCK_TIMEOUT',
    'DEADLOCK',
    'TRANSACTION_TIMEOUT',
    'ROOT_NOT_FOUND',
    'INFRA_ERROR',
  ] as const

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
