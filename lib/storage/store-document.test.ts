import { describe, it, expect, vi } from 'vitest'
import {
  uploadPrivateDocumentWithCompensation,
  StorageOperationError,
  type BucketScopedStorage,
} from './store-document'

function makeStorage(opts: { uploadError?: unknown } = {}): BucketScopedStorage {
  return {
    upload: vi.fn().mockResolvedValue({ error: opts.uploadError ?? null }),
    remove: vi.fn().mockResolvedValue({ error: null }),
  }
}

const bytes = new ArrayBuffer(8)

describe('uploadPrivateDocumentWithCompensation', () => {
  it('sube (upsert:false) y persiste cuando todo va bien', async () => {
    const storage = makeStorage()
    const persist = vi.fn().mockResolvedValue(undefined)
    await uploadPrivateDocumentWithCompensation({
      storage,
      path: 'docs/v1/abc.pdf',
      bytes,
      contentType: 'application/pdf',
      persist,
    })
    expect(storage.upload).toHaveBeenCalledWith('docs/v1/abc.pdf', bytes, {
      contentType: 'application/pdf',
      upsert: false,
    })
    expect(persist).toHaveBeenCalledOnce()
    expect(storage.remove).not.toHaveBeenCalled()
  })

  it('si el upload falla lanza StorageOperationError y NO persiste', async () => {
    const storage = makeStorage({ uploadError: { message: 'boom' } })
    const persist = vi.fn()
    await expect(
      uploadPrivateDocumentWithCompensation({
        storage,
        path: 'docs/v1/abc.pdf',
        bytes,
        contentType: 'application/pdf',
        persist,
      })
    ).rejects.toBeInstanceOf(StorageOperationError)
    expect(persist).not.toHaveBeenCalled()
    expect(storage.remove).not.toHaveBeenCalled()
  })

  it('si la persistencia falla, COMPENSA (elimina el objeto) y propaga el error ORIGINAL', async () => {
    const storage = makeStorage()
    const dbError = new Error('db down')
    const persist = vi.fn().mockRejectedValue(dbError)
    const err = await uploadPrivateDocumentWithCompensation({
      storage,
      path: 'docs/v1/abc.pdf',
      bytes,
      contentType: 'application/pdf',
      persist,
    }).catch((e) => e)

    expect(err).toBe(dbError) // el error original, no uno de storage
    expect(err).not.toBeInstanceOf(StorageOperationError)
    expect(storage.remove).toHaveBeenCalledWith(['docs/v1/abc.pdf'])
  })

  it('la compensación no oculta el error original aunque el remove también falle', async () => {
    const storage: BucketScopedStorage = {
      upload: vi.fn().mockResolvedValue({ error: null }),
      remove: vi.fn().mockRejectedValue(new Error('remove failed')),
    }
    const dbError = new Error('db down')
    const err = await uploadPrivateDocumentWithCompensation({
      storage,
      path: 'docs/v1/abc.pdf',
      bytes,
      contentType: 'application/pdf',
      persist: vi.fn().mockRejectedValue(dbError),
    }).catch((e) => e)
    expect(err).toBe(dbError)
  })
})
