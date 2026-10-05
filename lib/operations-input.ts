import { z } from 'zod'

const id = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/)
export const operationalTargetSchema = z.object({
  type: z.enum(['vehicle', 'buyerLead', 'sellerLead']),
  id,
})
export type OperationalTarget = z.infer<typeof operationalTargetSchema>
export const manualDeliverySchema = z
  .object({
    operationId: z.uuid(),
    vehicleId: id,
    kind: z.enum(['VENTA', 'DEVOLUCION_VENDEDOR', 'ENTREGA_TALLER']),
    recipient: operationalTargetSchema.refine((t) => t.type !== 'vehicle', 'Selecciona un cliente'),
    scheduledAt: z.iso.datetime({ offset: true }),
    responsableId: id.nullable().default(null),
    notes: z.string().trim().max(2000).nullable().default(null),
  })
  .superRefine((v, ctx) => {
    if (
      (v.kind === 'VENTA' && v.recipient.type !== 'buyerLead') ||
      (v.kind === 'DEVOLUCION_VENDEDOR' && v.recipient.type !== 'sellerLead')
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['recipient'],
        message: 'Destinatario incompatible con el tipo de entrega',
      })
    }
  })
export type ManualDeliveryInput = z.infer<typeof manualDeliverySchema>
export const operationalSearchSchema = z.object({
  type: z.enum(['vehicle', 'buyerLead', 'sellerLead']),
  query: z.string().trim().max(100),
  page: z.number().int().min(0).max(10000).default(0),
})
export function documentTargetWhere(target: OperationalTarget) {
  return {
    vehicleId: target.type === 'vehicle' ? target.id : null,
    buyerLeadId: target.type === 'buyerLead' ? target.id : null,
    sellerLeadId: target.type === 'sellerLead' ? target.id : null,
  }
}
