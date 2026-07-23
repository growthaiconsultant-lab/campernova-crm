import { describe, it, expect } from 'vitest'
import {
  ROOT_TABLES,
  ROOT_TYPE_RANK,
  assertLockRoot,
  isLockRootType,
  normalizeRoots,
  rootKey,
} from './roots'
import { LockError } from './errors'
import type { LockRoot } from './types'

const V = (id: string): LockRoot => ({ type: 'vehicle', id })
const S = (id: string): LockRoot => ({ type: 'sellerLead', id })
const B = (id: string): LockRoot => ({ type: 'buyerLead', id })

describe('orden global por tipo', () => {
  it('Vehicle se bloquea antes que SellerLead', () => {
    expect(ROOT_TYPE_RANK.vehicle).toBeLessThan(ROOT_TYPE_RANK.sellerLead)
  })

  it('SellerLead se bloquea antes que BuyerLead', () => {
    expect(ROOT_TYPE_RANK.sellerLead).toBeLessThan(ROOT_TYPE_RANK.buyerLead)
  })

  it('ordena los tres tipos aunque lleguen al revés', () => {
    expect(normalizeRoots([B('b1'), S('s1'), V('v1')])).toEqual([V('v1'), S('s1'), B('b1')])
  })
})

describe('orden dentro del mismo tipo', () => {
  it('ordena por id ascendente', () => {
    expect(normalizeRoots([V('v3'), V('v1'), V('v2')])).toEqual([V('v1'), V('v2'), V('v3')])
  })

  it('agrupa por tipo y luego por id', () => {
    expect(normalizeRoots([B('b2'), V('v2'), B('b1'), V('v1')])).toEqual([
      V('v1'),
      V('v2'),
      B('b1'),
      B('b2'),
    ])
  })
})

describe('determinismo', () => {
  // La propiedad que evita deadlocks: dos llamantes con las mismas raíces en distinto orden
  // adquieren los locks en la misma secuencia.
  it('el resultado no depende del orden de entrada', () => {
    const a = normalizeRoots([V('v1'), S('s1'), B('b1')])
    const b = normalizeRoots([B('b1'), V('v1'), S('s1')])
    const c = normalizeRoots([S('s1'), B('b1'), V('v1')])
    expect(a).toEqual(b)
    expect(b).toEqual(c)
  })

  it('sigue siendo determinista con duplicados intercalados', () => {
    const a = normalizeRoots([V('v2'), B('b1'), V('v1'), B('b1'), V('v2')])
    const b = normalizeRoots([B('b1'), V('v1'), V('v2')])
    expect(a).toEqual(b)
  })
})

describe('deduplicación', () => {
  it('adquiere una única vez la misma fila', () => {
    expect(normalizeRoots([V('v1'), V('v1'), V('v1')])).toEqual([V('v1')])
  })

  it('no confunde el mismo id en tipos distintos', () => {
    expect(normalizeRoots([V('x'), S('x'), B('x')])).toEqual([V('x'), S('x'), B('x')])
  })

  it('rootKey distingue tipo e id', () => {
    expect(rootKey(V('x'))).toBe('vehicle:x')
    expect(rootKey(S('x'))).not.toBe(rootKey(V('x')))
  })
})

describe('entradas límite', () => {
  it('lista vacía explícita devuelve lista vacía', () => {
    expect(normalizeRoots([])).toEqual([])
  })

  it('una sola raíz se conserva', () => {
    expect(normalizeRoots([S('s1')])).toEqual([S('s1')])
  })

  it('recorta espacios del id sin alterar el identificador', () => {
    expect(normalizeRoots([V('  v1  ')])).toEqual([V('v1')])
  })
})

describe('fail-closed ante raíces inválidas', () => {
  // Descartarlas dejaría al llamante creyendo que pidió N locks con solo N-1 adquiridos.
  const invalidas: Array<[string, unknown]> = [
    ['id vacío', { type: 'vehicle', id: '' }],
    ['id solo espacios', { type: 'vehicle', id: '   ' }],
    ['id undefined', { type: 'vehicle', id: undefined }],
    ['id no string', { type: 'vehicle', id: 123 }],
    ['tipo ajeno', { type: 'workOrder', id: 'w1' }],
    ['tipo ausente', { id: 'x' }],
    ['null', null],
    ['undefined', undefined],
    ['string suelto', 'vehicle:v1'],
  ]

  it.each(invalidas)('rechaza %s con INVALID_LOCK_ROOT', (_label, entrada) => {
    expect(() => normalizeRoots([entrada as LockRoot])).toThrow(LockError)
    try {
      normalizeRoots([entrada as LockRoot])
    } catch (err) {
      expect((err as LockError).code).toBe('INVALID_LOCK_ROOT')
    }
  })

  it('una raíz inválida invalida TODA la llamada, no solo esa entrada', () => {
    expect(() => normalizeRoots([V('v-valido'), { type: 'vehicle', id: '' } as LockRoot])).toThrow(
      LockError
    )
  })

  it('una lista no vacía nunca se convierte en vacía en silencio', () => {
    const soloInvalidas = [{ type: 'vehicle', id: '' }, null] as unknown as LockRoot[]
    expect(() => normalizeRoots(soloInvalidas)).toThrow(LockError)
  })

  it('rechaza un argumento que no es lista', () => {
    expect(() => normalizeRoots(null as unknown as LockRoot[])).toThrow(LockError)
  })

  it('el mensaje no revela id, tipo ni objeto original', () => {
    try {
      normalizeRoots([{ type: 'workOrder', id: 'secreto-123' } as unknown as LockRoot])
    } catch (err) {
      const message = (err as LockError).message
      expect(message).not.toContain('secreto-123')
      expect(message).not.toContain('workOrder')
      expect(message).not.toMatch(/\{|\}|at\s/)
    }
  })

  it('assertLockRoot devuelve la forma normalizada cuando es válida', () => {
    expect(assertLockRoot({ type: 'sellerLead', id: ' s1 ' })).toEqual(S('s1'))
  })
})

describe('orden independiente del locale', () => {
  // `localeCompare` dependería de ICU y del locale del proceso: dos instancias podrían ordenar
  // distinto las mismas raíces, que es la condición exacta que produce deadlocks.
  const ids = ['a1', 'A1', '_x', '0z', 'zz', 'Zz', 'ábc', 'abc']

  it('ordena por unidades de código, no por reglas de idioma', () => {
    const ordenado = normalizeRoots(ids.map(V)).map((r) => r.id)
    const esperado = [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    expect(ordenado).toEqual(esperado)
  })

  it('el mismo conjunto en distinto orden de entrada produce la misma secuencia', () => {
    const a = normalizeRoots(ids.map(V)).map((r) => r.id)
    const b = normalizeRoots([...ids].reverse().map(V)).map((r) => r.id)
    const c = normalizeRoots([...ids].sort().map(V)).map((r) => r.id)
    expect(a).toEqual(b)
    expect(b).toEqual(c)
  })

  it('separa mayúsculas y minúsculas de forma estable', () => {
    expect(normalizeRoots([V('a'), V('A')]).map((r) => r.id)).toEqual(['A', 'a'])
  })
})

describe('mapping cerrado de tablas', () => {
  it('cubre exactamente los tres tipos', () => {
    expect(Object.keys(ROOT_TABLES).sort()).toEqual(['buyerLead', 'sellerLead', 'vehicle'])
  })

  it('usa identificadores entrecomillados y sin espacios', () => {
    for (const table of Object.values(ROOT_TABLES)) {
      expect(table).toMatch(/^"[a-z_]+"$/)
    }
  })

  it('isLockRootType rechaza cualquier valor fuera del conjunto', () => {
    expect(isLockRootType('vehicle')).toBe(true)
    expect(isLockRootType('workOrder')).toBe(false)
    expect(isLockRootType('')).toBe(false)
    expect(isLockRootType(null)).toBe(false)
    expect(isLockRootType(42)).toBe(false)
  })
})
