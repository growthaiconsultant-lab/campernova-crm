import { z } from 'zod'
import { VEHICLE_CATEGORY_VALUES, BED_LAYOUT_VALUES, LICENSE_TYPE_VALUES } from '@/lib/rv-taxonomy'

export const registerBuyerLeadSchema = z.object({
  nombre: z.string().min(2).describe('Nombre completo del comprador'),
  email: z.string().email().describe('Email de contacto'),
  telefono: z.string().min(7).describe('Teléfono de contacto'),
  necesidad: z
    .string()
    .describe('Resumen 1-2 frases de para qué quiere el vehículo y cuál es su situación'),
  tipo: z.enum(['CAMPER', 'AUTOCARAVANA']).optional().describe('Tipo de vehículo preferido'),
  plazas: z
    .number()
    .int()
    .min(2)
    .max(9)
    .optional()
    .describe(
      'Plazas de VIAJE requeridas (homologadas, con cinturón). Distinto de plazas para dormir.'
    ),
  equipamiento: z
    .object({
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

  // ── Taxonomía RV (Fase B) ──
  // PREFERENCIAS (puntúan el matching — infiérelas con libertad):
  categoria: z
    .enum(VEHICLE_CATEGORY_VALUES)
    .optional()
    .describe(
      'Distribución/carrocería preferida. CAPUCHINA (cama sobre cabina), PERFILADA (sin capuchina), INTEGRAL (cabina integrada), CAMPER/MINI_CAMPER (furgoneta), GRAN_VOLUMEN (furgón grande).'
    ),
  tipoCama: z
    .enum(BED_LAYOUT_VALUES)
    .optional()
    .describe(
      'Tipo de cama preferido (GEMELAS, ISLA, FRANCESA, LITERAS, BASCULANTE, TECHO_ELEVABLE…).'
    ),
  usoInvierno: z.boolean().optional().describe('Lo usará en invierno/frío → preparación invernal.'),
  garajeDeporte: z.boolean().optional().describe('Necesita garaje trasero para bicis/moto.'),
  viajaConNinos: z.boolean().optional().describe('Viaja con niños (→ literas / plazas extra).'),

  // EXCLUYENTES (FILTRAN duro el matching — fíjalos SOLO si el cliente es claro/firme):
  plazasDormir: z
    .number()
    .int()
    .min(1)
    .max(9)
    .optional()
    .describe('Plazas para DORMIR requeridas. Solo si el cliente lo exige ("que durmamos 4").'),
  banoObligatorio: z
    .boolean()
    .optional()
    .describe('El comprador EXIGE baño/aseo a bordo (imprescindible, no un simple deseo).'),
  carnet: z
    .enum(LICENSE_TYPE_VALUES)
    .optional()
    .describe(
      'Carnet del comprador: B (hasta 3.500 kg) o C1 (más). Si solo tiene el B, NO puede conducir vehículos > 3.500 kg. Fíjalo solo si lo dice claro.'
    ),
  largoMaxM: z
    .number()
    .optional()
    .describe('Largo máximo en metros por restricción de aparcamiento. Solo si lo concreta.'),
  altoMaxM: z
    .number()
    .optional()
    .describe('Alto máximo en metros por restricción de garaje/aparcamiento. Solo si lo concreta.'),
})

export type RegisterBuyerLeadArgs = z.infer<typeof registerBuyerLeadSchema>
