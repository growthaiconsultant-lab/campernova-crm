import { describe, it, expect } from 'vitest'
import { ROOT_TABLES, ROOT_TYPE_RANK, isLockRootType, normalizeRoots, rootKey } from './roots'
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
  it('sin raíces devuelve lista vacía', () => {
    expect(normalizeRoots([])).toEqual([])
  })

  it('una sola raíz se conserva', () => {
    expect(normalizeRoots([S('s1')])).toEqual([S('s1')])
  })

  it('recorta espacios del id', () => {
    expect(normalizeRoots([V('  v1  ')])).toEqual([V('v1')])
  })

  it('descarta ids vacíos: una raíz sin identificador no es una fila', () => {
    expect(normalizeRoots([V(''), V('   '), S('s1')])).toEqual([S('s1')])
  })

  it('descarta tipos que no pertenecen al conjunto cerrado', () => {
    const intruso = { type: 'workOrder', id: 'w1' } as unknown as LockRoot
    expect(normalizeRoots([intruso, V('v1')])).toEqual([V('v1')])
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
