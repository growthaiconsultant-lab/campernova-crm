import { z } from 'zod'
import {
  VEHICLE_CATEGORY_VALUES,
  BED_LAYOUT_VALUES,
  BATHROOM_TYPE_VALUES,
  HEATING_TYPE_VALUES,
} from '@/lib/rv-taxonomy'

export const equipmentSchema = z.object({
  solar: z.boolean().default(false),
  kitchen: z.boolean().default(false),
  bathroom: z.boolean().default(false),
  shower: z.boolean().default(false),
  heating: z.boolean().default(false),
})

export const createSellerLeadSchema = z.object({
  // Vendedor
  name: z.string().min(1, 'El nombre es obligatorio'),
  email: z.string().email('Email no válido'),
  phone: z.string().min(6, 'Teléfono demasiado corto'),

  // Vehículo
  type: z.enum(['CAMPER', 'AUTOCARAVANA'], { error: 'Selecciona un tipo' }),
  brand: z.string().min(1, 'La marca es obligatoria'),
  model: z.string().min(1, 'El modelo es obligatorio'),
  year: z
    .number({ error: 'El año es obligatorio' })
    .int()
    .min(1980, 'Mínimo año 1980')
    .max(new Date().getFullYear() + 1, 'Año no válido'),
  km: z.number({ error: 'Los km son obligatorios' }).int().min(0, 'Los km no pueden ser negativos'),
  seats: z
    .number({ error: 'Las plazas son obligatorias' })
    .int()
    .min(1, 'Mínimo 1 plaza')
    .max(20, 'Máximo 20 plazas'),
  length: z.number().positive('Debe ser mayor que 0').optional().nullable(),
  conservationState: z.enum(['EXCELENTE', 'BUENO', 'NORMAL', 'DETERIORADO']).default('NORMAL'),
  location: z.string().optional(),
  desiredPrice: z.number().positive('Debe ser mayor que 0').optional().nullable(),
  plate: z.string().max(20).optional(),
  equipment: equipmentSchema.default({
    solar: false,
    kitchen: false,
    bathroom: false,
    shower: false,
    heating: false,
  }),
  // ── Ficha técnica RV (opcional en el alta web; el agente la afina luego) ──
  sleepingPlaces: z.number().int().min(0).max(12).optional().nullable(),
  category: z.enum(VEHICLE_CATEGORY_VALUES).optional().nullable(),
  bedLayout: z.enum(BED_LAYOUT_VALUES).optional().nullable(),
  bathroomType: z.enum(BATHROOM_TYPE_VALUES).optional().nullable(),
})

// OUTPUT: tipo validado que devuelve Zod (con defaults aplicados)
export type CreateSellerLeadInput = z.infer<typeof createSellerLeadSchema>

// INPUT: tipo que consume el formulario (campos con .default() son opcionales)
export type SellerLeadFormValues = z.input<typeof createSellerLeadSchema>

export const updateSellerLeadSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  email: z.string().email('Email no válido'),
  phone: z.string().min(6, 'Teléfono demasiado corto'),
  status: z.enum(['NUEVO', 'CONTACTADO', 'CUALIFICADO', 'EN_NEGOCIACION', 'CERRADO', 'DESCARTADO']),
  agentId: z.string().nullable(),
})

export type UpdateSellerLeadValues = z.input<typeof updateSellerLeadSchema>

export const updateVehicleSchema = z.object({
  type: z.enum(['CAMPER', 'AUTOCARAVANA'], { error: 'Selecciona un tipo' }),
  brand: z.string().min(1, 'La marca es obligatoria'),
  model: z.string().min(1, 'El modelo es obligatorio'),
  year: z
    .number({ error: 'El año es obligatorio' })
    .int()
    .min(1980, 'Mínimo año 1980')
    .max(new Date().getFullYear() + 1, 'Año no válido'),
  km: z.number({ error: 'Los km son obligatorios' }).int().min(0, 'Los km no pueden ser negativos'),
  seats: z
    .number({ error: 'Las plazas son obligatorias' })
    .int()
    .min(1, 'Mínimo 1 plaza')
    .max(20, 'Máximo 20 plazas'),
  length: z.number().positive('Debe ser mayor que 0').optional().nullable(),
  conservationState: z.enum(['EXCELENTE', 'BUENO', 'NORMAL', 'DETERIORADO']).default('NORMAL'),
  location: z.string().optional(),
  desiredPrice: z.number().positive('Debe ser mayor que 0').optional().nullable(),
  equipment: equipmentSchema.default({
    solar: false,
    kitchen: false,
    bathroom: false,
    shower: false,
    heating: false,
  }),
  status: z.enum(['NUEVO', 'TASADO', 'PUBLICADO', 'RESERVADO', 'VENDIDO', 'DESCARTADO']),
  // ── Ficha técnica RV (Fase #3 v1) ──
  category: z.enum(VEHICLE_CATEGORY_VALUES).optional().nullable(),
  bedLayout: z.enum(BED_LAYOUT_VALUES).optional().nullable(),
  sleepingPlaces: z.number().int().min(0).max(12).optional().nullable(),
  bathroomType: z.enum(BATHROOM_TYPE_VALUES).optional().nullable(),
  heatingType: z.enum(HEATING_TYPE_VALUES).optional().nullable(),
  winterized: z.boolean().optional().nullable(),
  hasGarage: z.boolean().optional().nullable(),
  maxMassKg: z.number().int().min(0).max(20000).optional().nullable(),
  heightM: z.number().positive().max(5).optional().nullable(),
  offGrid: z.boolean().optional().nullable(),
})

export type UpdateVehicleValues = z.input<typeof updateVehicleSchema>
