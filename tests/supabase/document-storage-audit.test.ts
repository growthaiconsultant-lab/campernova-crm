/**
 * Tests REALES de Supabase Storage (PR5B3) — auditoría de objetos (READ-ONLY).
 *
 * Ejercita el recorrido recursivo + paginado (`listAllObjectPaths`) y la clasificación
 * (`crossReferenceStorage`) contra un Supabase LOCAL efímero, con objetos reales creados por el
 * test. Confirma que el auditor NO borra ni firma. Las referencias DB se simulan con un Set (el
 * cruce con DB real se cubre en unit + integración); aquí lo importante es el Storage real.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { listAllObjectPaths, crossReferenceStorage } from '@/lib/documents/storage-audit-core'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const DOCS = 'vehicle-documents'
const LOCAL_URL = /^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])(:\d+)?/i

let admin: SupabaseClient
const runId = randomUUID().slice(0, 8)
const prefix = `docs/audit-${runId}`
const created: string[] = []

function pdf(): Buffer {
  return Buffer.from('%PDF-1.4\n%test\n')
}

beforeAll(async () => {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('faltan credenciales locales de Supabase')
  if (!LOCAL_URL.test(SUPABASE_URL)) throw new Error(`SUPABASE_URL no es local: ${SUPABASE_URL}`)
  admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  // 3 objetos: 2 "referenciados" + 1 "huérfano" (storage-only), bajo un subprefijo por entidad.
  for (const name of ['a.pdf', 'b.pdf', 'orphan.pdf']) {
    const path = `${prefix}/e1/${name}`
    const { error } = await admin.storage.from(DOCS).upload(path, pdf(), {
      contentType: 'application/pdf',
      upsert: false,
    })
    expect(error).toBeNull()
    created.push(path)
  }
})

afterAll(async () => {
  if (created.length)
    await admin.storage
      .from(DOCS)
      .remove(created)
      .catch(() => {})
})

describe('auditoría de Storage real', () => {
  it('lista recursivamente (con paginación) todos los objetos del bucket privado', async () => {
    const list = (p: string, opts: { limit: number; offset: number }) =>
      admin.storage.from(DOCS).list(p, opts)
    // pageSize pequeño para forzar paginación real.
    const { paths, limitations } = await listAllObjectPaths(list, { pageSize: 2 })
    const mine = paths.filter((p) => p.startsWith(prefix))
    expect(mine.sort()).toEqual(created.slice().sort())
    expect(limitations.truncatedAtMaxObjects).toBe(false)
  })

  it('cruza con referencias DB (simuladas): referenced / storage-only / db-only', async () => {
    const list = (p: string, opts: { limit: number; offset: number }) =>
      admin.storage.from(DOCS).list(p, opts)
    const { paths, limitations } = await listAllObjectPaths(list, { pageSize: 1000 })
    const mine = paths.filter((p) => p.startsWith(prefix))

    // Referencias DB: los 2 primeros existen; una referencia "rota" que no tiene objeto.
    const brokenRef = `${prefix}/e1/missing-in-storage.pdf`
    const referenced = new Set([created[0], created[1], brokenRef])

    const summary = crossReferenceStorage(mine, referenced, limitations)
    expect(summary.referenced).toBe(2)
    expect(summary.storageOnlyOrphans).toBe(1) // orphan.pdf
    expect(summary.dbOnlyBrokenReferences).toBe(1) // missing-in-storage.pdf
  })

  it('el auditor NO borra: los objetos siguen existiendo tras auditar', async () => {
    const list = (p: string, opts: { limit: number; offset: number }) =>
      admin.storage.from(DOCS).list(p, opts)
    await listAllObjectPaths(list, { pageSize: 1000 })
    // Todos los objetos creados siguen accesibles (firma solo para comprobar existencia).
    for (const path of created) {
      const { data, error } = await admin.storage.from(DOCS).createSignedUrl(path, 60)
      expect(error).toBeNull()
      expect(data?.signedUrl).toBeTruthy()
    }
  })
})
