import { unstable_cache } from 'next/cache'
import { readInstagramFeed } from './feed'

const cachedFeed = unstable_cache(
  async () => {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN
    if (!token) throw new Error('Instagram pendiente de autorización')
    return readInstagramFeed(token)
  },
  ['instagram-campersnova-v1', process.env.VERCEL_ENV ?? 'local'],
  { revalidate: 3600 }
)

export async function getInstagramFeed() {
  if (!process.env.INSTAGRAM_ACCESS_TOKEN) return null
  try {
    return await cachedFeed()
  } catch {
    console.warn('[instagram] Sin instantánea disponible para el mosaico')
    return null
  }
}
