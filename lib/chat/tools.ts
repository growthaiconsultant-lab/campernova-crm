import { z } from 'zod'

export const registerBuyerLeadSchema = z.object({
  nombre: z.string().min(2).describe('Nombre completo del comprador'),
  email: z.string().email().describe('Email de contacto'),
  telefono: z.string().min(7).describe('Teléfono de contacto'),
  necesidad: z
    .string()
    .describe('Resumen 1-2 frases de para qué quiere el vehículo y cuál es su situación'),
  tipo: z.enum(['CAMPER', 'AUTOCARAVANA']).optional().describe('Tipo de vehículo preferido'),
  plazas: z.number().int().min(2).max(9).optional().describe('Número mínimo de plazas requeridas'),
  equipamiento: z
    .object({
      bathroom: z.boolean().optional().describe('Baño independiente'),
      shower: z.boolean().optional().describe('Ducha'),
      kitchen: z.boolean().optional().describe('Cocina equipada'),
      heating: z.boolean().optional().describe('Calefacción'),
      solar: z.boolean().optional().describe('Panel solar'),
    })
    .optional()
    .describe('Equipamiento crítico que el comprador requiere'),
  zona: z.string().optional().describe('Zona o región de preferencia'),
  presupuestoMin: z.number().optional().describe('Presupuesto mínimo en euros'),
  presupuestoMax: z.number().optional().describe('Presupuesto máximo en euros'),
  plazos: z
    .enum(['menos_1_mes', '1_3_meses', '3_6_meses', 'mas_6_meses', 'sin_prisa'])
    .optional()
    .describe('Plazo de compra previsto'),
})

export type RegisterBuyerLeadArgs = z.infer<typeof registerBuyerLeadSchema>
