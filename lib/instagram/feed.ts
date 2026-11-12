import { z } from 'zod'

const graph = 'https://graph.instagram.com/v25.0/'
export const profileUrl = 'https://www.instagram.com/campersnova/'

const media = z.object({
  id: z.string(),
  media_type: z.enum(['IMAGE', 'CAROUSEL_ALBUM', 'VIDEO']),
  media_product_type: z.string().optional(),
  media_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
  caption: z.string().optional(),
  permalink: z.string().url(),
  timestamp: z.string(),
})
export type InstagramPost = {
  id: string
  url: string
  cover: string | null
  caption: string
  type: string
  timestamp: string
}

function safeCover(raw?: string) {
  if (!raw) return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      /(?:^|\.)(?:cdninstagram\.com|fbcdn\.net|fbsbx\.com|facebook\.com)$/.test(url.hostname)
      ? url.href
      : null
  } catch {
    return null
  }
}

export function latestPosts(payload: unknown): InstagramPost[] {
  const { data } = z.object({ data: z.array(z.unknown()) }).parse(payload)
  const items = new Map<string, InstagramPost>()
  for (const raw of data) {
    const result = media.safeParse(raw)
    if (!result.success) continue
    const m = result.data
    const link = new URL(m.permalink)
    if (
      !['instagram.com', 'www.instagram.com'].includes(link.host) ||
      link.protocol !== 'https:' ||
      link.username ||
      link.password ||
      !/^\/(?:p|reel|tv)\/[\w-]+\/?$/.test(link.pathname) ||
      !Number.isFinite(Date.parse(m.timestamp))
    )
      continue
    const type =
      m.media_product_type === 'REELS'
        ? 'Reel'
        : m.media_type === 'VIDEO'
          ? 'Vídeo'
          : m.media_type === 'CAROUSEL_ALBUM'
            ? 'Carrusel'
            : 'Foto'
    items.set(m.id, {
      id: m.id,
      url: link.origin + link.pathname,
      cover: safeCover(m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url),
      caption: m.caption?.trim() || '',
      timestamp: m.timestamp,
      type,
    })
  }
  if (data.length && !items.size) throw new Error('Instagram devolvió publicaciones ilegibles')
  return [...items.values()]
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 5)
}

export async function readInstagramFeed(token: string): Promise<InstagramPost[]> {
  async function get(path: string, fields: string, limit?: string) {
    const url = new URL(path, graph)
    url.searchParams.set('fields', fields)
    if (limit) url.searchParams.set('limit', limit)
    const response = await fetch(url, {
      headers: { Authorization: 'Bearer ' + token },
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error('Instagram no disponible (HTTP ' + response.status + ')')
    return response.json() as Promise<unknown>
  }
  const account = z
    .object({ user_id: z.string().regex(/^\d+$/), username: z.string() })
    .parse(await get('me', 'user_id,username'))
  if (account.username.toLowerCase() !== 'campersnova')
    throw new Error('La cuenta autorizada no coincide con @campersnova')
  return latestPosts(
    await get(
      account.user_id + '/media',
      'id,media_type,media_product_type,media_url,thumbnail_url,permalink,caption,timestamp',
      '25'
    )
  )
}
