import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { Prisma, PrismaClient } from '@prisma/client'
import { defaultNextActionData } from '@/lib/next-action'
import { KPI_EVENTS } from '@/lib/kpi/events'
import { landingAttributionSchema, landingAttributionLine } from './attribution'

export const LANDING_SOURCE = 'Landing vende-tu-camper'
export const META_SELLER_SOURCE = 'Meta Lead Ads · Vende tu camper'

const text = (max: number) => z.string().trim().min(1).max(max)
const phone = text(32)
  .regex(/^\+?[\d\s().-]+$/)
  .refine((v) => /^\d{9,15}$/.test(v.replace(/\D/g, '')))
const kilometers = text(20)
  .regex(/^(?:\d+|\d{1,3}(?:[. ,]\d{3})+)$/)
  .transform((v) => Number(v.replace(/[. ,]/g, '')))
  .pipe(z.number().int().min(0).max(2_000_000))

export const landingSellerSchema = z
  .object({
    nombre: text(120),
    contacto: phone,
    gdpr_consent: z.literal(true),
    web_url: z.literal(''),
    respuestas: z
      .object({
        event_id: text(100).regex(/^[A-Za-z0-9_-]+$/),
        tipo: z.enum(['Camper / furgoneta camperizada', 'Autocaravana']),
        modelo: text(160),
        anio: z
          .string()
          .regex(/^\d{4}$/)
          .transform(Number)
          .pipe(
            z
              .number()
              .int()
              .min(1980)
              .max(new Date().getFullYear() + 1)
          ),
        km: kilometers,
        prioridad: z.enum([
          'Venderla pronto',
          'Sacar el mejor precio',
          'Que se la compren ya',
          'Venderla en depósito por el mejor precio',
          'Solo saber cuánto vale',
        ]),
        busca_otra: z.enum(['Sí, buscadme otra', 'Quizá', 'No']).optional(),
        nombre: text(120),
        telefono: phone,
        zona: text(160).optional(),
        origen: text(1500),
        atribucion: landingAttributionSchema.optional(),
        pagina: z.literal('/vende-tu-camper.html'),
      })
      .strict(),
  })
  .strict()
  .refine((v) => v.nombre === v.respuestas.nombre && v.contacto === v.respuestas.telefono)

export type LandingSellerInput = z.infer<typeof landingSellerSchema>

export const metaSellerSchema = z
  .object({
    form_id: z.literal('29053317371003989'),
    lead_id: z.string().regex(/^\d{1,40}$/),
    nombre: text(120),
    telefono: phone,
    zona: text(160).optional(),
    tipo: z.enum(['CAMPER', 'AUTOCARAVANA']).optional(),
    modelo: text(160).optional(),
    km: text(100).optional(),
    precio_esperado: text(160).optional(),
    cuando: text(300).optional(),
    busca_otra: text(300).optional(),
    gdpr_consent: z.boolean().optional(),
    created_time: z.string().datetime({ offset: true }).optional(),
  })
  .strict()

export type MetaSellerInput = z.infer<typeof metaSellerSchema>

export function metaSellerLeadId(input: Pick<MetaSellerInput, 'form_id' | 'lead_id'>): string {
  return `meta_seller_${input.form_id}_${input.lead_id}`
}

function expectedPrice(answer: string | undefined): string | null {
  if (!answer) return null
  const value = answer.replace(/\s*(?:€|EUR)$/i, '').trim()
  if (!/^(?:\d+|\d{1,3}(?:[. ]\d{3})+)(?:,\d{1,2})?$/.test(value)) return null
  const decimal = value.replace(/[. ]/g, '').replace(',', '.')
  const amount = Number(decimal)
  return amount <= 99_999_999.99 ? decimal : null
}

// Bind the request key to its payload: an altered request cannot read/overwrite another lead.
export function landingLeadId(input: LandingSellerInput): string {
  return 'landing_' + createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 40)
}

export class LandingRateLimitError extends Error {}

export async function saveLandingSeller(
  client: PrismaClient,
  input: LandingSellerInput,
  ip: string | null,
  now = new Date()
): Promise<void> {
  const id = landingLeadId(input)
  const answers = input.respuestas
  return savePendingSeller(
    client,
    {
      id,
      name: input.nombre,
      phone: input.contacto,
      source: LANDING_SOURCE,
      gdprConsentAt: now,
      gdprConsentIp: ip,
      vehicle: {
        create: {
          type: answers.tipo === 'Autocaravana' ? 'AUTOCARAVANA' : 'CAMPER',
          brand: null,
          model: answers.modelo,
          year: answers.anio,
          km: answers.km,
          location: answers.zona ?? null,
          status: 'NUEVO',
        },
      },
      activities: {
        create: {
          type: 'NOTA',
          content: [
            landingAttributionLine(answers.pagina, answers.atribucion, answers.origen),
            `Prioridad indicada: ${answers.prioridad}`,
            answers.busca_otra ? `Busca otro vehículo: ${answers.busca_otra}` : null,
          ]
            .filter(Boolean)
            .join('\n'),
        },
      },
    },
    now,
    ip
      ? {
          key: `landing:ip:${ip}`,
          where: { source: LANDING_SOURCE, gdprConsentIp: ip },
          limit: 10,
        }
      : null
  )
}

export function saveMetaSeller(client: PrismaClient, input: MetaSellerInput, now = new Date()) {
  const mileage = kilometers.safeParse(input.km)
  const price = expectedPrice(input.precio_esperado)
  return savePendingSeller(
    client,
    {
      id: metaSellerLeadId(input),
      name: input.nombre,
      phone: input.telefono,
      source: META_SELLER_SOURCE,
      gdprConsentAt: input.gdpr_consent && input.created_time ? new Date(input.created_time) : null,
      vehicle: {
        create: {
          type: input.tipo ?? null,
          model: input.modelo ?? null,
          km: mileage.success ? mileage.data : null,
          location: input.zona ?? null,
          desiredPrice: price,
          status: 'NUEVO',
        },
      },
      activities: {
        create: {
          type: 'NOTA',
          content: [
            META_SELLER_SOURCE,
            input.km && !mileage.success ? `Kilometraje indicado: ${input.km}` : null,
            input.precio_esperado && price === null
              ? `Precio esperado: ${input.precio_esperado}`
              : null,
            input.cuando ? `Plazo de venta: ${input.cuando}` : null,
            input.busca_otra ? `Quiere cambiarla por otro vehículo: ${input.busca_otra}` : null,
          ]
            .filter(Boolean)
            .join('\n'),
        },
      },
    },
    now,
    {
      key: 'landing:meta-seller',
      where: { source: META_SELLER_SOURCE },
      limit: 300,
    }
  )
}

async function savePendingSeller(
  client: PrismaClient,
  data: Prisma.SellerLeadCreateInput & { id: string },
  now: Date,
  quota: { key: string; where: Prisma.SellerLeadWhereInput; limit: number } | null
): Promise<void> {
  await client.$transaction(
    async (tx) => {
      const lockKey = `landing:${data.id}`
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`
      if (await tx.sellerLead.findUnique({ where: { id: data.id }, select: { id: true } })) return
      if (quota) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${quota.key}, 0))`
        const recent = await tx.sellerLead.count({
          where: {
            ...quota.where,
            createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
          },
        })
        if (recent >= quota.limit) throw new LandingRateLimitError()
      }
      const lead = await tx.sellerLead.create({
        data: {
          ...data,
          canal: 'PRO',
          intakeStatus: 'PENDIENTE',
          status: 'NUEVO',
          ...defaultNextActionData(now),
        },
        include: { vehicle: { select: { id: true } } },
      })
      await tx.kpiEvent.create({
        data: {
          eventName: KPI_EVENTS.SELLER_CREATED,
          entityType: 'seller',
          entityId: lead.id,
          relatedEntityType: 'vehicle',
          relatedEntityId: lead.vehicle!.id,
          source: 'system',
          metadata:
            data.source === META_SELLER_SOURCE
              ? { canal: 'PRO', campaign: 'vende-tu-camper', integration: 'meta_lead_ads' }
              : { canal: 'PRO', campaign: 'vende-tu-camper' },
        },
      })
    },
    { maxWait: 5000, timeout: 10000 }
  )
}
