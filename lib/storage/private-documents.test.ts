import { describe, it, expect } from 'vitest'
import {
  validateDocumentFile,
  safeDocumentObjectPath,
  normalizeDisplayName,
  DocumentValidationError,
  MAX_PRIVATE_DOCUMENT_BYTES,
  PRIVATE_DOC_SIGNED_URL_TTL_SECONDS,
} from './private-documents'

const ok = { mimeType: 'application/pdf', fileName: 'contrato.pdf', size: 1000 }

describe('validateDocumentFile · aceptados', () => {
  it('acepta un PDF válido y devuelve la extensión canónica', () => {
    expect(validateDocumentFile(ok)).toEqual({ ext: 'pdf' })
  })

  it('normaliza jpeg/jpg a la extensión canónica de la allowlist', () => {
    expect(
      validateDocumentFile({ mimeType: 'image/jpeg', fileName: 'foto.jpeg', size: 10 })
    ).toEqual({
      ext: 'jpg',
    })
    expect(
      validateDocumentFile({ mimeType: 'image/jpeg', fileName: 'foto.jpg', size: 10 })
    ).toEqual({
      ext: 'jpg',
    })
  })

  it('acepta docx/xlsx por MIME + extensión coherentes', () => {
    expect(
      validateDocumentFile({
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileName: 'x.docx',
        size: 10,
      })
    ).toEqual({ ext: 'docx' })
  })
})

describe('validateDocumentFile · rechazos', () => {
  it('rechaza archivo vacío', () => {
    const err = trap(() => validateDocumentFile({ ...ok, size: 0 }))
    expect(err.code).toBe('empty')
  })

  it('rechaza archivo por encima del límite', () => {
    const err = trap(() => validateDocumentFile({ ...ok, size: MAX_PRIVATE_DOCUMENT_BYTES + 1 }))
    expect(err.code).toBe('too_large')
  })

  it('rechaza MIME no permitido (svg/html/exe)', () => {
    for (const mimeType of ['image/svg+xml', 'text/html', 'application/x-msdownload']) {
      const err = trap(() => validateDocumentFile({ mimeType, fileName: 'x.pdf', size: 10 }))
      expect(err.code).toBe('mime_not_allowed')
    }
  })

  it('rechaza discordancia MIME↔extensión (truco de doble extensión)', () => {
    // MIME de PDF pero el nombre acaba en .exe / .html → extensión no coincide.
    expect(
      trap(() => validateDocumentFile({ mimeType: 'application/pdf', fileName: 'x.exe', size: 10 }))
        .code
    ).toBe('extension_mismatch')
    expect(
      trap(() =>
        validateDocumentFile({ mimeType: 'application/pdf', fileName: 'x.pdf.html', size: 10 })
      ).code
    ).toBe('extension_mismatch')
  })

  it('rechaza nombres con path traversal o separadores', () => {
    for (const fileName of ['../secret.pdf', 'a/b.pdf', 'a\\b.pdf', '..']) {
      const err = trap(() =>
        validateDocumentFile({ mimeType: 'application/pdf', fileName, size: 10 })
      )
      expect(err.code).toBe('invalid_name')
    }
  })

  it('rechaza nombre sin extensión', () => {
    expect(
      trap(() =>
        validateDocumentFile({ mimeType: 'application/pdf', fileName: 'contrato', size: 10 })
      ).code
    ).toBe('extension_mismatch')
  })
})

describe('safeDocumentObjectPath', () => {
  it('construye <prefix>/<entityId>/<documentId>.<ext> sin nombre de usuario ni PII', () => {
    const path = safeDocumentObjectPath({
      prefix: 'docs',
      entityId: 'veh123',
      documentId: 'a1b2c3d4-0000',
      ext: 'pdf',
    })
    expect(path).toBe('docs/veh123/a1b2c3d4-0000.pdf')
  })

  it('rechaza segmentos inseguros (traversal, barras, vacíos)', () => {
    expect(() =>
      safeDocumentObjectPath({ prefix: 'docs', entityId: '../x', documentId: 'd', ext: 'pdf' })
    ).toThrow(DocumentValidationError)
    expect(() =>
      safeDocumentObjectPath({ prefix: 'docs', entityId: 'v', documentId: 'a/b', ext: 'pdf' })
    ).toThrow(DocumentValidationError)
    expect(() =>
      safeDocumentObjectPath({ prefix: '', entityId: 'v', documentId: 'd', ext: 'pdf' })
    ).toThrow(DocumentValidationError)
  })
})

describe('normalizeDisplayName', () => {
  it('recorta, elimina control chars y aplica fallback', () => {
    expect(normalizeDisplayName('  Contrato \x00final  ')).toBe('Contrato final')
    expect(normalizeDisplayName('')).toBe('documento')
    expect(normalizeDisplayName(null)).toBe('documento')
    expect(normalizeDisplayName('x'.repeat(300)).length).toBe(200)
  })
})

describe('constantes de seguridad', () => {
  it('el TTL de las URLs firmadas es corto (≤ 5 min)', () => {
    expect(PRIVATE_DOC_SIGNED_URL_TTL_SECONDS).toBeLessThanOrEqual(300)
    expect(PRIVATE_DOC_SIGNED_URL_TTL_SECONDS).toBeGreaterThan(0)
  })
})

function trap(fn: () => unknown): DocumentValidationError {
  try {
    fn()
  } catch (e) {
    if (e instanceof DocumentValidationError) return e
    throw e
  }
  throw new Error('esperaba DocumentValidationError')
}
