import { describe, it, expect, vi } from 'vitest'
import {
  listAllObjectPaths,
  classifyStorageObject,
  crossReferenceStorage,
  type SupabaseListFn,
} from './storage-audit-core'

/** Fake list() sobre un árbol en memoria: mapa prefijo → entradas (folders id:null, files id:string). */
function fakeList(
  tree: Record<string, Array<{ name: string; id: string | null }>>
): SupabaseListFn {
  return async (prefix, { limit, offset }) => {
    const entries = tree[prefix] ?? []
    return { data: entries.slice(offset, offset + limit), error: null }
  }
}

describe('listAllObjectPaths', () => {
  it('recorre recursivamente (BFS) y devuelve todos los archivos', async () => {
    const tree = {
      '': [
        { name: 'docs', id: null },
        { name: 'deliveries', id: null },
      ],
      docs: [{ name: 'veh1', id: null }],
      'docs/veh1': [
        { name: 'a.pdf', id: 'f1' },
        { name: 'b.pdf', id: 'f2' },
      ],
      deliveries: [{ name: 'del1', id: null }],
      'deliveries/del1': [{ name: 'c.pdf', id: 'f3' }],
    }
    const { paths, limitations } = await listAllObjectPaths(fakeList(tree), { pageSize: 100 })
    expect(paths.sort()).toEqual(['deliveries/del1/c.pdf', 'docs/veh1/a.pdf', 'docs/veh1/b.pdf'])
    expect(limitations.truncatedAtMaxObjects).toBe(false)
    expect(limitations.maxDepthReached).toBe(false)
  })

  it('pagina cada prefijo (varias páginas)', async () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ name: `f${i}.pdf`, id: `id${i}` }))
    const tree = { '': [{ name: 'docs', id: null }], docs: many }
    const { paths } = await listAllObjectPaths(fakeList(tree), { pageSize: 2 })
    expect(paths).toHaveLength(5)
  })

  it('marca truncado si supera maxObjects', async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ name: `f${i}.pdf`, id: `id${i}` }))
    const tree = { '': many }
    const { paths, limitations } = await listAllObjectPaths(fakeList(tree), {
      pageSize: 100,
      maxObjects: 3,
    })
    expect(paths).toHaveLength(3)
    expect(limitations.truncatedAtMaxObjects).toBe(true)
  })

  it('propaga error del list', async () => {
    const list = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(listAllObjectPaths(list as never)).rejects.toThrow()
  })
})

describe('classifyStorageObject', () => {
  const ref = new Set(['docs/v/a.pdf'])
  it('referenced / storage-only / wrong-prefix', () => {
    expect(classifyStorageObject('docs/v/a.pdf', ref)).toBe('referenced')
    expect(classifyStorageObject('docs/v/orphan.pdf', ref)).toBe('storage-only')
    expect(classifyStorageObject('random/x.pdf', ref)).toBe('wrong-prefix')
  })
})

describe('crossReferenceStorage', () => {
  it('cuenta referenced, storage-only (huérfano), wrong-prefix y db-only (referencia rota)', () => {
    const storage = ['docs/v/a.pdf', 'docs/v/orphan.pdf', 'weird/x.pdf']
    const referenced = new Set(['docs/v/a.pdf', 'deliveries/d/missing.pdf'])
    const s = crossReferenceStorage(storage, referenced, {
      truncatedAtMaxObjects: false,
      maxDepthReached: false,
    })
    expect(s.totalStorageObjects).toBe(3)
    expect(s.referenced).toBe(1)
    expect(s.storageOnlyOrphans).toBe(1) // docs/v/orphan.pdf
    expect(s.wrongPrefix).toBe(1) // weird/x.pdf
    expect(s.dbOnlyBrokenReferences).toBe(1) // deliveries/d/missing.pdf sin objeto
  })
})
