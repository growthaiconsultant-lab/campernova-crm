import { z } from 'zod'
import { createBuyerLeadSchema } from './validators/buyer-lead'
import { normalizePhone } from './phone'

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
export const newDeliveryBuyerSchema = createBuyerLeadSchema
  .pick({ name: true, email: true, phone: true })
  .extend({
    name: z.string().trim().min(1).max(150),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    phone: z
      .string()
      .trim()
      .min(6)
      .max(40)
      .regex(/^[+()0-9.\s-]+$/)
      .refine((value) => normalizePhone(value).length >= 6),
  })
const deliveryRecipientSchema = z.discriminatedUnion('type', [
  z.object({ type: z.enum(['buyerLead', 'sellerLead']), id }),
  newDeliveryBuyerSchema.extend({ type: z.literal('newBuyer') }),
])
export const manualDeliverySchema = z
  .object({
    operationId: z.uuid(),
    vehicleId: id,
    kind: z.enum(['VENTA', 'DEVOLUCION_VENDEDOR', 'ENTREGA_TALLER']),
    recipient: deliveryRecipientSchema,
    scheduledAt: z.iso.datetime({ offset: true }),
    responsableId: id.nullable().default(null),
    notes: z.string().trim().max(2000).nullable().default(null),
  })
  .superRefine((v, ctx) => {
    if (
      (v.kind === 'VENTA' && v.recipient.type === 'sellerLead') ||
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
/** Mensajes iguales en el formulario y en la validación del servidor. */
export function manualDeliveryValidationMessage(error: z.ZodError): string {
  const issue = error.issues[0]
  switch (issue?.path[0]) {
    case 'vehicleId':
      return 'Selecciona un vehículo de los resultados de búsqueda.'
    case 'kind':
      return 'Selecciona el tipo de entrega.'
    case 'scheduledAt':
      return 'Introduce una fecha y hora válidas para la entrega.'
    case 'recipient':
      switch (issue.path[1]) {
        case 'name':
          return 'Introduce el nombre completo del nuevo comprador (máximo 150 caracteres).'
        case 'email':
          return 'Introduce un email válido para el nuevo comprador.'
        case 'phone':
          return 'Introduce un teléfono válido para el nuevo comprador.'
        case 'id':
          return 'Selecciona al destinatario en los resultados. Si es un comprador sin ficha, elige «Nuevo comprador».'
        default:
          return issue.code === 'custom'
            ? 'El destinatario no corresponde al tipo de entrega seleccionado.'
            : 'Selecciona un destinatario existente o elige «Nuevo comprador».'
      }
    case 'responsableId':
      return 'Selecciona un responsable válido o deja la entrega sin asignar.'
    case 'notes':
      return 'Las notas no pueden superar los 2000 caracteres.'
    default:
      return 'La solicitud no es válida. Recarga el formulario e inténtalo de nuevo.'
  }
}
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
