import { afterEach, describe, expect, it, vi } from 'vitest'
import { latestPosts, readInstagramFeed } from './feed'
const photo = (n: number) => ({
  id: String(n),
  media_type: 'IMAGE',
  media_url: 'https://scontent.cdninstagram.com/photo.jpg',
  permalink: 'https://www.instagram.com/p/post' + n + '/',
  timestamp: '2026-11-' + String(n).padStart(2, '0') + 'T09:00:00Z',
})
afterEach(() => vi.unstubAllGlobals())
describe('mosaico de Instagram', () => {
  it('ordena las publicaciones, elimina duplicados y limita a cinco', () => {
    expect(latestPosts({ data: [4, 1, 6, 3, 5, 2, 4].map(photo) }).map((p) => p.id)).toEqual([
      '6',
      '5',
      '4',
      '3',
      '2',
    ])
  })
  it('usa las imágenes y las portadas de los reels y carruseles', () => {
    const result = latestPosts({
      data: [
        {
          ...photo(2),
          media_type: 'VIDEO',
          media_product_type: 'REELS',
          thumbnail_url: 'https://scontent.fbcdn.net/cover.jpg',
        },
        { ...photo(1), media_type: 'CAROUSEL_ALBUM' },
      ],
    })
    expect(result.map((p) => [p.type, p.cover])).toEqual([
      ['Reel', 'https://scontent.fbcdn.net/cover.jpg'],
      ['Carrusel', photo(1).media_url],
    ])
  })
  it('permite una cuenta vacía y descarta medios y enlaces no válidos', () => {
    expect(latestPosts({ data: [] })).toEqual([])
    expect(
      latestPosts({
        data: [
          { ...photo(1), permalink: 'https://example.com/p/other' },
          { ...photo(2), media_url: 'https://example.com/foo.jpg' },
        ],
      })
    ).toMatchObject([{ id: '2', cover: null }])
    expect(() => latestPosts({ error: { message: 'token expirado' } })).toThrow()
  })
  it('verifica la cuenta con autorización de servidor antes de leer sus medios', async () => {
    const api = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: '17841473663135583', username: 'campersnova' }))
      .mockResolvedValueOnce(Response.json({ data: [photo(1)] }))
    vi.stubGlobal('fetch', api)
    expect((await readInstagramFeed('test-only'))[0]?.id).toBe('1')
    expect(api.mock.calls.map((c) => c[0].href.split('?')[0])).toEqual([
      'https://graph.facebook.com/v25.0/17841473663135583',
      'https://graph.facebook.com/v25.0/17841473663135583/media',
    ])
    for (const [url, init] of api.mock.calls) {
      expect(url.href).not.toContain('test-only')
      expect(init.headers.Authorization).toBe('Bearer test-only')
    }
  })
  it('no lee medios de otra cuenta y propaga fallos para conservar la caché', async () => {
    const api = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: '17841473663135583', username: 'otra' }))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
    vi.stubGlobal('fetch', api)
    await expect(readInstagramFeed('test-only')).rejects.toThrow('no coincide')
    await expect(readInstagramFeed('test-only')).rejects.toThrow('429')
    expect(api).toHaveBeenCalledTimes(2)
  })
})
