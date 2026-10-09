import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { defaultNextActionData } from '@/lib/next-action'
import { KPI_EVENTS } from '@/lib/kpi/events'
import { LandingRateLimitError } from './seller-intake'

const text = (max: number) => z.string().trim().min(1).max(max)
const phone = text(32)
  .regex(/^\+?[\d\s().-]+$/)
  .refine((v) => /^\d{9,15}$/.test(v.replace(/\D/g, '')))
export const landingBuyerSchema = z
  .object({
    nombre: text(120),
    contacto: phone,
    gdpr_consent: z.literal(true),
    web_url: z.literal(''),
    respuestas: z
      .object({
        event_id: text(100).regex(/^[A-Za-z0-9_-]+$/),
        tipo: z.enum(['Camper / furgoneta camperizada', 'Autocaravana', 'Aún no lo sé']),
        plazas: text(20)
          .transform((v) => v.replace(/\u00a0/g, ' '))
          .pipe(z.enum(['1 o 2', '3 o 4', '5 o más'])),
        presupuesto: z.enum([
          'Menos de 50.000 €',
          '50.000–65.000 €',
          '65.000–80.000 €',
          'Más de 80.000 €',
        ]),
        cuando: z.enum(['Lo antes posible', 'En 1 a 3 meses', 'Más adelante']),
        nombre: text(120),
        telefono: phone,
        zona: text(160).optional(),
        financiacion: z.enum(['Sí', 'No', 'Quiero que me lo expliquéis']).optional(),
        entrega: z.enum(['Sí, quiero entregarla a cuenta', 'No']).optional(),
        detalle: text(2000).optional(),
        origen: text(1500),
        pagina: z.literal('/encuentra-tu-camper.html'),
      })
      .strict(),
  })
  .strict()
  .refine((v) => v.nombre === v.respuestas.nombre && v.contacto === v.respuestas.telefono)

export type LandingBuyerInput = z.infer<typeof landingBuyerSchema>
export function landingBuyerId(input: LandingBuyerInput): string {
  return (
    'landing_buyer_' + createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 40)
  )
}

export async function saveLandingBuyer(
  client: PrismaClient,
  input: LandingBuyerInput,
  ip: string | null,
  now = new Date()
): Promise<void> {
  const id = landingBuyerId(input)
  await client.$transaction(
    async (tx) => {
      const lockKey = `landing:${id}`
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`
      if (await tx.buyerLead.findUnique({ where: { id }, select: { id: true } })) return
      if (ip) {
        const quotaKey = `landing:buyer:ip:${ip}`
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${quotaKey}, 0))`
        const recent = await tx.buyerLead.count({
          where: {
            source: 'PRO',
            gdprConsentIp: ip,
            createdAt: { gte: new Date(now.getTime() - 3600000) },
          },
        })
        if (recent >= 10) throw new LandingRateLimitError()
      }
      const a = input.respuestas
      const maxBudget =
        a.presupuesto === 'Menos de 50.000 €'
          ? 50000
          : a.presupuesto === '50.000–65.000 €'
            ? 65000
            : a.presupuesto === '65.000–80.000 €'
              ? 80000
              : null
      await tx.buyerLead.create({
        data: {
          id,
          name: input.nombre,
          phone: input.contacto,
          email: null,
          agentId: null,
          source: 'PRO',
          status: 'NUEVO',
          gdprConsentAt: now,
          gdprConsentIp: ip,
          vehicleType:
            a.tipo === 'Autocaravana'
              ? 'AUTOCARAVANA'
              : a.tipo === 'Camper / furgoneta camperizada'
                ? 'CAMPER'
                : null,
          maxBudget,
          // Sleeping ranges do not establish exact sleeping or homologated travelling seats.
          minSeats: null,
          sleepingPlacesRequired: null,
          useZone: null,
          purchaseTimeline:
            a.cuando === 'Lo antes posible'
              ? 'menos_1_mes'
              : a.cuando === 'En 1 a 3 meses'
                ? '1_3_meses'
                : null,
          financingNeeded: a.financiacion === 'Sí' ? true : a.financiacion === 'No' ? false : null,
          hasTradeIn:
            a.entrega === 'Sí, quiero entregarla a cuenta'
              ? true
              : a.entrega === 'No'
                ? false
                : null,
          ...defaultNextActionData(now),
          activities: {
            create: {
              type: 'NOTA',
              content: [
                'Formulario de campaña: /encuentra-tu-camper.html',
                `Rango de plazas para dormir indicado: ${a.plazas}`,
                `Rango de presupuesto indicado: ${a.presupuesto}`,
                a.cuando === 'Más adelante' ? 'Plazo indicado: Más adelante' : null,
                a.zona ? `Población de contacto (no zona de uso): ${a.zona}` : null,
                a.financiacion === 'Quiero que me lo expliquéis'
                  ? 'Solicita información sobre financiación'
                  : null,
                a.detalle ? `Descripción de la búsqueda: ${a.detalle}` : null,
                `Atribución del formulario: ${a.origen}`,
              ]
                .filter(Boolean)
                .join('\n'),
            },
          },
        },
      })
      await tx.kpiEvent.create({
        data: {
          eventName: KPI_EVENTS.BUYER_CREATED,
          entityType: 'buyer',
          entityId: id,
          source: 'system',
          metadata: { campaign: 'encuentra-tu-camper', buyerSource: 'PRO' },
        },
      })
    },
    { maxWait: 5000, timeout: 10000 }
  )
}
