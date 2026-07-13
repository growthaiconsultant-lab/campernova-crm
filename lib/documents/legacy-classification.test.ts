import { describe, it, expect } from 'vitest'
import {
  parseLegacyReference,
  classifyLegacyDocument,
  type LegacyDocumentInput,
} from './legacy-classification'

const BUCKET = 'vehicle-documents'

describe('parseLegacyReference', () => {
  it('path interno válido → path', () => {
    expect(parseLegacyReference('docs/v1/a.pdf')).toEqual({
      kind: 'path',
      bucket: BUCKET,
      objectPath: 'docs/v1/a.pdf',
    })
  })
  it('URL firmada legacy del bucket esperado → signed_url con path extraído (sin token)', () => {
    const r = parseLegacyReference(
      'https://p.supabase.co/storage/v1/object/sign/vehicle-documents/docs/v1/a.pdf?token=SECRET'
    )
    expect(r).toEqual({ kind: 'signed_url', bucket: BUCKET, objectPath: 'docs/v1/a.pdf' })
  })
  it('URL de otro bucket → wrong_bucket', () => {
    const r = parseLegacyReference(
      'https://p.supabase.co/storage/v1/object/sign/lead-documents/x/a.pdf?token=t'
    )
    expect(r).toEqual({ kind: 'wrong_bucket', bucket: 'lead-documents', objectPath: 'x/a.pdf' })
  })
  it('URL externa (no endpoint Storage) → external', () => {
    expect(parseLegacyReference('https://evil.com/a.pdf')).toEqual({ kind: 'external' })
  })
  it('path con traversal → invalid', () => {
    expect(parseLegacyReference('../secret').kind).toBe('invalid')
    expect(parseLegacyReference('/leading').kind).toBe('invalid')
  })
  it('vacío/nulo → missing', () => {
    expect(parseLegacyReference('').kind).toBe('missing')
    expect(parseLegacyReference(null).kind).toBe('missing')
  })
})

function base(overrides: Partial<LegacyDocumentInput> = {}): LegacyDocumentInput {
  return {
    rootType: 'vehicle',
    rootId: 'root-1',
    url: 'docs/v1/a.pdf',
    currentVersionId: null,
    versionSequence: 0,
    versionCount: 0,
    currentVersion: null,
    ...overrides,
  }
}

describe('classifyLegacyDocument', () => {
  it('STRUCTURED: ya versionado y coherente', () => {
    const r = classifyLegacyDocument(
      base({
        currentVersionId: 'ver-1',
        versionSequence: 1,
        versionCount: 1,
        url: 'docs/v1/a.pdf',
        currentVersion: {
          id: 'ver-1',
          version: 1,
          objectPath: 'docs/v1/a.pdf',
          ownerRootId: 'root-1',
          status: 'ACTIVE',
        },
      })
    )
    expect(r.classification).toBe('STRUCTURED')
    expect(r.migratable).toBe(false)
    expect(r.blocked).toBe(false)
  })

  it('VALID_PATH: legacy con object path → migrable', () => {
    const r = classifyLegacyDocument(base({ url: 'docs/v1/a.pdf' }))
    expect(r.classification).toBe('VALID_PATH')
    expect(r.migratable).toBe(true)
    expect(r.objectPath).toBe('docs/v1/a.pdf')
  })

  it('VALID_LEGACY_SIGNED_URL: legacy con URL firmada → migrable con path extraído', () => {
    const r = classifyLegacyDocument(
      base({
        url: 'https://p.supabase.co/storage/v1/object/sign/vehicle-documents/docs/v1/a.pdf?token=t',
      })
    )
    expect(r.classification).toBe('VALID_LEGACY_SIGNED_URL')
    expect(r.migratable).toBe(true)
    expect(r.objectPath).toBe('docs/v1/a.pdf')
  })

  it('WRONG_BUCKET: bloqueado', () => {
    const r = classifyLegacyDocument(
      base({ url: 'https://p.supabase.co/storage/v1/object/sign/lead-documents/x/a.pdf?token=t' })
    )
    expect(r.classification).toBe('WRONG_BUCKET')
    expect(r.blocked).toBe(true)
    expect(r.migratable).toBe(false)
  })

  it('EXTERNAL_URL / INVALID_REFERENCE / MISSING_REFERENCE: bloqueados, no migrables', () => {
    expect(classifyLegacyDocument(base({ url: 'https://evil.com/a.pdf' })).classification).toBe(
      'EXTERNAL_URL'
    )
    expect(classifyLegacyDocument(base({ url: '../x' })).classification).toBe('INVALID_REFERENCE')
    expect(classifyLegacyDocument(base({ url: null })).classification).toBe('MISSING_REFERENCE')
    for (const url of ['https://evil.com/a.pdf', '../x', null]) {
      expect(classifyLegacyDocument(base({ url })).migratable).toBe(false)
    }
  })

  it('ALREADY_VERSIONED_INCONSISTENT: puntero a versión inexistente', () => {
    const r = classifyLegacyDocument(
      base({ currentVersionId: 'ghost', versionSequence: 1, versionCount: 0, currentVersion: null })
    )
    expect(r.classification).toBe('ALREADY_VERSIONED_INCONSISTENT')
    expect(r.blocked).toBe(true)
  })

  it('ALREADY_VERSIONED_INCONSISTENT: versión actual de otra raíz', () => {
    const r = classifyLegacyDocument(
      base({
        currentVersionId: 'ver-1',
        versionSequence: 1,
        versionCount: 1,
        currentVersion: {
          id: 'ver-1',
          version: 1,
          objectPath: 'docs/v1/a.pdf',
          ownerRootId: 'OTHER-root',
          status: 'ACTIVE',
        },
      })
    )
    expect(r.classification).toBe('ALREADY_VERSIONED_INCONSISTENT')
  })

  it('ALREADY_VERSIONED_INCONSISTENT: versiones sin currentVersionId', () => {
    const r = classifyLegacyDocument(base({ versionCount: 2 }))
    expect(r.classification).toBe('ALREADY_VERSIONED_INCONSISTENT')
  })

  it('ALREADY_VERSIONED_INCONSISTENT: url desincronizada con la versión actual', () => {
    const r = classifyLegacyDocument(
      base({
        currentVersionId: 'ver-1',
        versionSequence: 1,
        versionCount: 1,
        url: 'docs/v1/OTHER.pdf',
        currentVersion: {
          id: 'ver-1',
          version: 1,
          objectPath: 'docs/v1/a.pdf',
          ownerRootId: 'root-1',
          status: 'ACTIVE',
        },
      })
    )
    expect(r.classification).toBe('ALREADY_VERSIONED_INCONSISTENT')
  })
})
