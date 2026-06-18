import { z } from 'zod'
import { VEHICLE_CATEGORY_VALUES, BED_LAYOUT_VALUES, LICENSE_TYPE_VALUES } from '@/lib/rv-taxonomy'

export const criticalEquipmentSchema = z.object({
  solar: z.boolean().default(false),
  kitchen: z.boolean().default(false),
  bathroom: z.boolean().default(false),
  shower: z.boolean().default(false),
  heating: z.boolean().default(false),
})

export const PURCHASE_TIMELINE_OPTIONS = [
  { value: 'menos_1_mes', label: 'Menos de 1 mes' },
  { value: '1_3_meses', label: '1-3 meses' },
  { value: '3_6_meses', label: '3-6 meses' },
  { value: 'mas_6_meses', label: 'Más de 6 meses' },
  { value: 'sin_prisa', label: 'Sin prisa' },
] as const

export const createBuyerLeadSchema = z.object({
  // Contacto
  name: z.string().min(1, 'El nombre es obligatorio'),
  email: z.string().email('Email no válido'),
  phone: z.string().min(6, 'Teléfono demasiado corto'),

  // Preferencias de búsqueda
  vehicleType: z.enum(['CAMPER', 'AUTOCARAVANA']).optional().nullable(),
  minSeats: z
    .number()
    .int()
    .min(1, 'Mínimo 1 plaza')
    .max(20, 'Máximo 20 plazas')
    .optional()
    .nullable(),
  maxBudget: z.number().positive('Debe ser mayor que 0').optional().nullable(),
  criticalEquipment: criticalEquipmentSchema.default({
    solar: false,
    kitchen: false,
    bathroom: false,
    shower: false,
    heating: false,
  }),
  useZone: z.string().optional(),
  purchaseTimeline: z.string().optional().nullable(),
})

export type CreateBuyerLeadInput = z.infer<typeof createBuyerLeadSchema>
export type BuyerLeadFormValues = z.input<typeof createBuyerLeadSchema>

export const updateBuyerLeadSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  email: z.string().email('Email no válido'),
  phone: z.string().min(6, 'Teléfono demasiado corto'),
  status: z.enum(['NUEVO', 'CONTACTADO', 'CUALIFICADO', 'EN_NEGOCIACION', 'CERRADO', 'PERDIDO']),
  agentId: z.string().nullable(),
  vehicleType: z.enum(['CAMPER', 'AUTOCARAVANA']).optional().nullable(),
  minSeats: z
    .number()
    .int()
    .min(1, 'Mínimo 1 plaza')
    .max(20, 'Máximo 20 plazas')
    .optional()
    .nullable(),
  maxBudget: z.number().positive('Debe ser mayor que 0').optional().nullable(),
  criticalEquipment: criticalEquipmentSchema.default({
    solar: false,
    kitchen: false,
    bathroom: false,
    shower: false,
    heating: false,
  }),
  useZone: z.string().optional(),
  purchaseTimeline: z.string().optional().nullable(),
  // ── Preferencias RV (Fase #3 v1) ──
  preferredCategory: z.enum(VEHICLE_CATEGORY_VALUES).optional().nullable(),
  preferredBedLayout: z.enum(BED_LAYOUT_VALUES).optional().nullable(),
  sleepingPlacesRequired: z.number().int().min(0).max(12).optional().nullable(),
  bathroomRequired: z.boolean().optional().nullable(),
  licenseType: z.enum(LICENSE_TYPE_VALUES).optional().nullable(),
  needsWinter: z.boolean().optional().nullable(),
  needsGarage: z.boolean().optional().nullable(),
  maxLengthM: z.number().positive().max(15).optional().nullable(),
  maxHeightM: z.number().positive().max(5).optional().nullable(),
  hasKids: z.boolean().optional().nullable(),
})

export type UpdateBuyerLeadValues = z.input<typeof updateBuyerLeadSchema>
