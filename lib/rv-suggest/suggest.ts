import Anthropic from '@anthropic-ai/sdk'
import {
  VEHICLE_CATEGORY_VALUES,
  BED_LAYOUT_VALUES,
  BATHROOM_TYPE_VALUES,
  HEATING_TYPE_VALUES,
} from '@/lib/rv-taxonomy'
import { fetchImageAsBase64 } from '@/lib/ads/generate'
import { normalizeRvSuggestion, type RvSuggestion } from './normalize'

export type RvSuggestVehicle = {
  brand: string
  model: string
  year: number
  km: number
  type: 'CAMPER' | 'AUTOCARAVANA'
  seats: number
  conservationState?: string | null
  length?: number | null
}

export type RvSuggestResult = {
  suggestion: RvSuggestion
  model: string
  tokensUsed: number
}

const SYSTEM_PROMPT = `Eres un perito experto en autocaravanas y campers del mercado español. A partir de las FOTOS del vehículo y de los datos conocidos (marca, modelo, año, tipo), deduces su ficha técnica para un CRM de compraventa.

Reglas:
- Usa tu conocimiento del modelo concreto cuando lo identifiques con seguridad (p. ej. un Pilote integral, un Benimar capuchina con literas), combinado con lo que se ve en las fotos.
- Rellena solo lo que puedas inferir con criterio profesional. Si NO estás razonablemente seguro de un campo, devuélvelo null. NO inventes.
- maxMassKg: usa la MMA típica homologada del modelo solo si la conoces con seguridad; si dudas, null. Recuerda: > 3.500 kg exige carnet C1.
- category (distribución): capuchina = cama sobre la cabina; perfilada = sin capuchina, techo perfilado; integral = cabina integrada; camper/mini = furgoneta camperizada.
- equipment: marca true solo lo que se aprecie o sea seguro (placas solares en el techo, cocina, ducha, calefacción).
- Sé conservador: más vale null que un dato equivocado. Un perito que duda, deja el campo vacío.
- Invoca SIEMPRE la herramienta propose_rv_taxonomy con tu propuesta. En "notes" resume en 1-2 frases en qué te has basado.`

/** Texto de usuario con los datos conocidos del vehículo. Puro (testeable). */
export function buildRvSuggestUserText(v: RvSuggestVehicle): string {
  const lines = [
    `Vehículo a peritar:`,
    `- Marca: ${v.brand}`,
    `- Modelo: ${v.model}`,
    `- Año: ${v.year}`,
    `- Tipo: ${v.type}`,
    `- Kilómetros: ${v.km}`,
    `- Plazas homologadas (viaje): ${v.seats}`,
  ]
  if (v.length != null) lines.push(`- Longitud conocida: ${v.length} m`)
  if (v.conservationState) lines.push(`- Estado de conservación: ${v.conservationState}`)
  lines.push('', 'Analiza las fotos adjuntas y propón la ficha técnica RV.')
  return lines.join('\n')
}

const nullableEnum = (values: readonly string[]) => ({
  type: ['string', 'null'],
  enum: [...values, null],
})

const TOOL: Anthropic.Messages.Tool = {
  name: 'propose_rv_taxonomy',
  description: 'Propone la ficha técnica RV del vehículo a partir de fotos y datos conocidos.',
  input_schema: {
    type: 'object',
    properties: {
      category: nullableEnum(VEHICLE_CATEGORY_VALUES),
      bedLayout: nullableEnum(BED_LAYOUT_VALUES),
      bathroomType: nullableEnum(BATHROOM_TYPE_VALUES),
      heatingType: nullableEnum(HEATING_TYPE_VALUES),
      sleepingPlaces: { type: ['integer', 'null'] },
      maxMassKg: { type: ['integer', 'null'] },
      heightM: { type: ['number', 'null'] },
      length: { type: ['number', 'null'] },
      winterized: { type: ['boolean', 'null'] },
      hasGarage: { type: ['boolean', 'null'] },
      offGrid: { type: ['boolean', 'null'] },
      equipment: {
        type: 'object',
        properties: {
          solar: { type: 'boolean' },
          kitchen: { type: 'boolean' },
          shower: { type: 'boolean' },
          heating: { type: 'boolean' },
        },
      },
      notes: { type: 'string' },
    },
    required: ['notes'],
  },
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

function extractToolInput(message: Anthropic.Messages.Message): unknown {
  const block = message.content.find((c) => c.type === 'tool_use')
  return block?.type === 'tool_use' ? block.input : null
}

/**
 * Pide a Claude (visión) que proponga la ficha técnica RV del vehículo.
 * Devuelve una sugerencia ya normalizada (nunca lanza por datos inválidos del modelo).
 */
export async function suggestRvTaxonomy(
  vehicle: RvSuggestVehicle,
  photoUrls: string[]
): Promise<RvSuggestResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const userText = buildRvSuggestUserText(vehicle)
  const textBlock: Anthropic.Messages.ContentBlockParam = { type: 'text', text: userText }

  async function callApi(
    imageBlocks: Anthropic.Messages.ContentBlockParam[]
  ): Promise<Anthropic.Messages.Message> {
    return client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: 'propose_rv_taxonomy' },
      messages: [{ role: 'user', content: [textBlock, ...imageBlocks] }],
    })
  }

  let response: Anthropic.Messages.Message
  try {
    response = await callApi(buildUrlImageBlocks(photoUrls))
  } catch (err) {
    console.warn('[rv-suggest] URL image source failed, retrying with base64:', err)
    response = await callApi(await buildBase64ImageBlocks(photoUrls))
  }

  return {
    suggestion: normalizeRvSuggestion(extractToolInput(response)),
    model: response.model,
    tokensUsed: (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0),
  }
}
