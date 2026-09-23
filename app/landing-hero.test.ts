import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Children, isValidElement } from 'react'
import Image, { getImageProps, type ImageProps } from 'next/image'
import { getImageSize } from 'next/dist/server/image-optimizer'
import { describe, expect, it } from 'vitest'
import { HeroSection } from '@/components/landing/hero'

function heroImageProps(): ImageProps {
  const image = Children.toArray(HeroSection().props.children).find(
    (child) => isValidElement(child) && child.type === Image
  )
  if (!isValidElement<ImageProps>(image)) throw new Error('Missing hero image')
  return image.props
}

describe('landing hero payload regression (OBS-1 / CRM-C)', () => {
  it('serves a genuine WebP source within the full-resolution byte budget', async () => {
    const { src } = heroImageProps()
    expect(typeof src).toBe('string')
    const asset = readFileSync(resolve('public', String(src).replace(/^\//, '')))
    expect(asset.subarray(0, 4).toString()).toBe('RIFF')
    expect(asset.subarray(8, 12).toString()).toBe('WEBP')
    expect(asset.length).toBeLessThanOrEqual(350 * 1024)
    expect(await getImageSize(asset, 'webp')).toMatchObject({ width: 1536, height: 1024 })
  })

  it('preserves responsive priority loading and uses the derivative in every generated URL', () => {
    const props = heroImageProps()
    expect(props).toMatchObject({
      fill: true,
      priority: true,
      sizes: '100vw',
      alt: 'Camper y autocaravana en la montaña — CampersNova',
    })
    const { props: generated } = getImageProps(props)
    expect(generated.sizes).toBe('100vw')
    expect(generated.loading).not.toBe('lazy')
    expect(generated.srcSet).toBeTruthy()
    for (const entry of generated.srcSet!.split(',')) {
      const url = new URL(entry.trim().split(' ')[0], 'https://preview.invalid')
      expect(url.searchParams.get('url')).toBe('/images/landing/hero-mountain.webp')
    }
  })

  it('keeps the original PNG available for rollback without changing its dimensions', async () => {
    const original = readFileSync(
      resolve('public/images/landing/ChatGPT Image 4 may 2026, 09_40_45.png')
    )
    expect(await getImageSize(original, 'png')).toMatchObject({ width: 1536, height: 1024 })
  })
})
