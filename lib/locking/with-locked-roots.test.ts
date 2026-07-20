import { describe, it, expect, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { LockError } from './errors'
import {
  DEFAULT_LOCK_TIMEOUT_MS,
  DEFAULT_STATEMENT_TIMEOUT_MS,
  withLockedRoots,
} from './with-locked-roots'
import type { LockCapableClient, LockRoot } from './types'

const V = (id: string): LockRoot => ({ type: 'vehicle', id })
const S = (id: string): LockRoot => ({ type: 'sellerLead', id })
const B = (id: string): LockRoot => ({ type: 'buyerLead', id })

type Recorded = { sql: string; values: unknown[] }

/**
 * Doble de cliente Prisma que registra el SQL emitido. Permite comprobar el ORDEN y la
 * PARAMETRIZACIÓN sin base de datos; la semántica real del lock se prueba en integración.
 */
function fakeClient(options: { foundIds?: Set<string>; failOn?: (sql: string) => unknown } = {}) {
  const recorded: Recorded[] = []
  const found = options.foundIds

  const tx = {
    $executeRaw: vi.fn(async (query: Prisma.Sql) => {
      recorded.push({ sql: query.sql, values: query.values })
      const boom = options.failOn?.(query.sql)
      if (boom) throw boom
      return 0
    }),
    $queryRaw: vi.fn(async (query: Prisma.Sql) => {
      recorded.push({ sql: query.sql, values: query.values })
      const boom = options.failOn?.(query.sql)
      if (boom) throw boom
      const id = query.values[0] as string
      if (found && !found.has(id)) return []
      return [{ id }]
    }),
  }

  const client: LockCapableClient = {
    $transaction: vi.fn(async (fn) => fn(tx as unknown as Prisma.TransactionClient)),
  }

  return { client, tx, recorded }
}

const lockQueries = (recorded: Recorded[]) => recorded.filter((r) => /FOR UPDATE/.test(r.sql))
const setLocals = (recorded: Recorded[]) => recorded.filter((r) => /SET LOCAL/.test(r.sql))

describe('orden de adquisición', () => {
  it('bloquea en el orden global sea cual sea el orden de entrada', async () => {
    const { client, recorded } = fakeClient()
    await withLockedRoots([B('b1'), S('s1'), V('v1')], async () => 'ok', { client })

    const tables = lockQueries(recorded).map((r) => r.sql.match(/FROM "(\w+)"/)?.[1])
    expect(tables).toEqual(['vehicles', 'seller_leads', 'buyer_leads'])
  })

  it('adquiere una sola vez las raíces duplicadas', async () => {
    const { client, recorded } = fakeClient()
    await withLockedRoots([V('v1'), V('v1'), V('v1')], async () => 'ok', { client })
    expect(lockQueries(recorded)).toHaveLength(1)
  })

  it('fija los timeouts ANTES de bloquear nada', async () => {
    const { client, recorded } = fakeClient()
    await withLockedRoots([V('v1')], async () => 'ok', { client })

    const firstLock = recorded.findIndex((r) => /FOR UPDATE/.test(r.sql))
    const lastSetLocal = recorded.map((r) => /SET LOCAL/.test(r.sql)).lastIndexOf(true)
    expect(lastSetLocal).toBeLessThan(firstLock)
  })
})

describe('SQL seguro', () => {
  it('parametriza el identificador y nunca lo interpola', async () => {
    const { client, recorded } = fakeClient()
    await withLockedRoots([V('v-123')], async () => 'ok', { client })

    const [lock] = lockQueries(recorded)
    expect(lock.values).toEqual(['v-123'])
    expect(lock.sql).not.toContain('v-123')
    // El marcador lo decide Prisma (`?` en `.sql`, `$1` en `.text`); lo relevante es que el
    // identificador viaje como valor y no dentro del texto de la consulta.
    expect(lock.sql).toMatch(/^SELECT id FROM "vehicles" WHERE id = (\?|\$1) FOR UPDATE$/)
  })

  it('un id malicioso viaja como valor, no como SQL', async () => {
    const { client, recorded } = fakeClient({ foundIds: new Set(["x'; DROP TABLE vehicles; --"]) })
    await withLockedRoots([V("x'; DROP TABLE vehicles; --")], async () => 'ok', { client })

    const [lock] = lockQueries(recorded)
    expect(lock.sql).not.toMatch(/DROP/i)
    expect(lock.values[0]).toBe("x'; DROP TABLE vehicles; --")
  })

  it('la tabla solo puede salir del mapping cerrado', async () => {
    const { client, recorded } = fakeClient()
    const intruso = { type: 'workOrder', id: 'w1' } as unknown as LockRoot
    await withLockedRoots([intruso, V('v1')], async () => 'ok', { client })

    const tables = lockQueries(recorded).map((r) => r.sql.match(/FROM "(\w+)"/)?.[1])
    expect(tables).toEqual(['vehicles'])
  })
})

describe('timeouts', () => {
  it('aplica los valores por defecto con SET LOCAL', async () => {
    const { client, recorded } = fakeClient()
    await withLockedRoots([], async () => 'ok', { client })

    const locals = setLocals(recorded).map((r) => r.sql)
    expect(locals[0]).toContain(`lock_timeout = ${DEFAULT_LOCK_TIMEOUT_MS}`)
    expect(locals[1]).toContain(`statement_timeout = ${DEFAULT_STATEMENT_TIMEOUT_MS}`)
  })

  it('respeta valores explícitos', async () => {
    const { client, recorded } = fakeClient()
    await withLockedRoots([], async () => 'ok', {
      client,
      lockTimeoutMs: 1500,
      statementTimeoutMs: 4000,
    })
    const locals = setLocals(recorded).map((r) => r.sql)
    expect(locals[0]).toContain('lock_timeout = 1500')
    expect(locals[1]).toContain('statement_timeout = 4000')
  })

  it.each([0, -1, 1.5, 60_001, Number.NaN])('rechaza el timeout inválido %s', async (value) => {
    const { client } = fakeClient()
    await expect(
      withLockedRoots([], async () => 'ok', { client, lockTimeoutMs: value as number })
    ).rejects.toThrow(TypeError)
  })
})

describe('sin raíces', () => {
  it('ejecuta la operación dentro de transacción sin emitir SQL de bloqueo', async () => {
    const { client, recorded } = fakeClient()
    const operation = vi.fn(async () => 'resultado')

    await expect(withLockedRoots([], operation, { client })).resolves.toBe('resultado')
    expect(operation).toHaveBeenCalledTimes(1)
    expect(lockQueries(recorded)).toHaveLength(0)
    expect(client.$transaction).toHaveBeenCalledTimes(1)
  })
})

describe('resultado y errores', () => {
  it('propaga el resultado tipado de la operación', async () => {
    const { client } = fakeClient()
    const res = await withLockedRoots([V('v1')], async () => ({ n: 42 }), { client })
    expect(res).toEqual({ n: 42 })
  })

  it('recibe el cliente transaccional, no el global', async () => {
    const { client, tx } = fakeClient()
    const operation = vi.fn(async () => 'ok')
    await withLockedRoots([V('v1')], operation, { client })
    expect(operation).toHaveBeenCalledWith(tx)
  })

  it('raíz inexistente → ROOT_NOT_FOUND y la operación NO se ejecuta', async () => {
    const { client } = fakeClient({ foundIds: new Set(['existe']) })
    const operation = vi.fn(async () => 'ok')

    await expect(withLockedRoots([V('no-existe')], operation, { client })).rejects.toMatchObject({
      code: 'ROOT_NOT_FOUND',
    })
    expect(operation).not.toHaveBeenCalled()
  })

  it('lock ocupado → LOCK_TIMEOUT y la operación NO se ejecuta', async () => {
    const boom = new Prisma.PrismaClientKnownRequestError('Raw query failed', {
      code: 'P2010',
      clientVersion: 'test',
      meta: { code: '55P03' },
    })
    const { client } = fakeClient({ failOn: (sql) => (/FOR UPDATE/.test(sql) ? boom : null) })
    const operation = vi.fn(async () => 'ok')

    await expect(withLockedRoots([V('v1')], operation, { client })).rejects.toMatchObject({
      code: 'LOCK_TIMEOUT',
    })
    expect(operation).not.toHaveBeenCalled()
  })

  it('deadlock → DEADLOCK', async () => {
    const boom = new Prisma.PrismaClientKnownRequestError('Raw query failed', {
      code: 'P2010',
      clientVersion: 'test',
      meta: { code: '40P01' },
    })
    const { client } = fakeClient({ failOn: (sql) => (/FOR UPDATE/.test(sql) ? boom : null) })
    await expect(withLockedRoots([V('v1')], async () => 'ok', { client })).rejects.toMatchObject({
      code: 'DEADLOCK',
    })
  })

  it('fallo desconocido en la fase de bloqueo → INFRA_ERROR', async () => {
    const { client } = fakeClient({
      failOn: (sql) => (/SET LOCAL/.test(sql) ? new Error('conexión perdida') : null),
    })
    await expect(withLockedRoots([V('v1')], async () => 'ok', { client })).rejects.toMatchObject({
      code: 'INFRA_ERROR',
    })
  })

  it('el error de la OPERACIÓN se propaga intacto, sin envolverlo como LockError', async () => {
    // Si se envolviera, un conflicto de negocio legítimo quedaría oculto tras un error de infra.
    class ConflictoDeNegocio extends Error {}
    const { client } = fakeClient()

    await expect(
      withLockedRoots(
        [V('v1')],
        async () => {
          throw new ConflictoDeNegocio('la oferta ya no está disponible')
        },
        { client }
      )
    ).rejects.toBeInstanceOf(ConflictoDeNegocio)
  })

  it('un fallo en la operación no se convierte nunca en éxito', async () => {
    const { client } = fakeClient()
    await expect(
      withLockedRoots(
        [V('v1')],
        async () => {
          throw new LockError('INFRA_ERROR')
        },
        { client }
      )
    ).rejects.toBeInstanceOf(LockError)
  })
})
