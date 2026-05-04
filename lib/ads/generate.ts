import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { buildWallapopSystemPrompt } from './prompts/wallapop'
import { buildCochesnetSystemPrompt } from './prompts/cochesnet'
import type { VehicleWithRelations } from './build-context'
import { buildVehicleContext } from './build-context'

const KNOWLEDGE_FILES = [
  '01-equipment.md',
  '02-capacities.md',
  '03-models.md',
  '04-pricing.md',
  '05-structure.md',
  '06-marketplace-rules.md',
]

function loadKnowledge(): string {
  const knowledgeDir = path.join(process.cwd(), 'lib', 'ads', 'knowledge')
  return KNOWLEDGE_FILES.map((file) => {
    const content = fs.readFileSync(path.join(knowledgeDir, file), 'utf-8')
    return `## ${file}\n\n${content}`
  }).join('\n\n---\n\n')
}

function loadTemplate(filename: string): string {
  return fs.readFileSync(path.join(process.cwd(), 'lib', 'ads', 'templates', filename), 'utf-8')
}

export async function fetchImageAsBase64(
  url: string
): Promise<{ data: string; mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch image ${url}: ${res.status}`)
  const arrayBuffer = await res.arrayBuffer()
  const data = Buffer.from(arrayBuffer).toString('base64')
  const raw = res.headers.get('content-type') ?? 'image/jpeg'
  const mediaType = (raw.split(';')[0].trim() || 'image/jpeg') as
    | 'image/jpeg'
    | 'image/png'
    | 'image/gif'
    | 'image/webp'
  return { data, mediaType }
}

export type GenerateAdInput = {
  vehicle: VehicleWithRelations
  photoUrls: string[]
  channel: 'WALLAPOP' | 'COCHESNET'
}

export type GenerateAdOutput = {
  content: string
  tokensUsed: number
  model: string
}

function buildUrlImageBlocks(photoUrls: string[]): Anthropic.Messages.ContentBlockParam[] {
  return photoUrls.slice(0, 5).map(
    (url): Anthropic.Messages.ContentBlockParam => ({
      type: 'image',
      source: { type: 'url', url },
    })
  )
}

async function buildBase64ImageBlocks(
  photoUrls: string[]
): Promise<Anthropic.Messages.ContentBlockParam[]> {
  const results = await Promise.allSettled(photoUrls.slice(0, 5).map(fetchImageAsBase64))
  return results
    .filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchImageAsBase64>>> =>
        r.status === 'fulfilled'
    )
    .map(
      (r): Anthropic.Messages.ContentBlockParam => ({
        type: 'image',
        source: { type: 'base64', media_type: r.value.mediaType, data: r.value.data },
      })
    )
}

export async function generateAd({
  vehicle,
  photoUrls,
  channel,
}: GenerateAdInput): Promise<GenerateAdOutput> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const knowledge = loadKnowledge()
  const systemPrompt =
    channel === 'WALLAPOP'
      ? buildWallapopSystemPrompt(knowledge)
      : buildCochesnetSystemPrompt(
          knowledge,
          loadTemplate('cta.md'),
          loadTemplate('sales-conditions.md')
        )

  const userText = buildVehicleContext(vehicle)
  const textBlock: Anthropic.Messages.ContentBlockParam = { type: 'text', text: userText }

  async function callApi(
    imageBlocks: Anthropic.Messages.ContentBlockParam[]
  ): Promise<Anthropic.Messages.Message> {
    return client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
      max_tokens: channel === 'WALLAPOP' ? 800 : 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: [textBlock, ...imageBlocks] }],
    })
  }

  let response: Anthropic.Messages.Message
  try {
    response = await callApi(buildUrlImageBlocks(photoUrls))
  } catch (err) {
    // Fallback to base64 if URL sources are rejected by the model
    console.warn('[ads/generate] URL image source failed, retrying with base64:', err)
    const base64Blocks = await buildBase64ImageBlocks(photoUrls)
    response = await callApi(base64Blocks)
  }

  const block = response.content.find((c) => c.type === 'text')
  const content = block?.type === 'text' ? block.text : ''

  return {
    content,
    tokensUsed: (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0),
    model: response.model,
  }
}
