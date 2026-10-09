import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { defaultNextActionData } from '@/lib/next-action'
import { KPI_EVENTS } from '@/lib/kpi/events'
import { landingAttributionSchema, landingAttributionLine } from './attribution'

export const LANDING_SOURCE = 'Landing vende-tu-camper'

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
  await client.$transaction(
    async (tx) => {
      // Serializes retries and the per-IP quota across serverless instances.
      const lockKey = `landing:${id}`
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`
      if (await tx.sellerLead.findUnique({ where: { id }, select: { id: true } })) return
      if (ip) {
        const quotaKey = `landing:ip:${ip}`
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${quotaKey}, 0))`
        const recent = await tx.sellerLead.count({
          where: {
            source: LANDING_SOURCE,
            gdprConsentIp: ip,
            createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
          },
        })
        if (recent >= 10) throw new LandingRateLimitError()
      }
      const answers = input.respuestas
      const lead = await tx.sellerLead.create({
        data: {
          id,
          name: input.nombre,
          phone: input.contacto,
          email: null,
          canal: 'PRO',
          intakeStatus: 'PENDIENTE',
          status: 'NUEVO',
          source: LANDING_SOURCE,
          agentId: null,
          gdprConsentAt: now,
          gdprConsentIp: ip,
          ...defaultNextActionData(now),
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
          metadata: { canal: 'PRO', campaign: 'vende-tu-camper' },
        },
      })
    },
    { maxWait: 5000, timeout: 10000 }
  )
}
