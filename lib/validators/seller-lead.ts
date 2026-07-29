import { z } from 'zod'
import {
  VEHICLE_CATEGORY_VALUES,
  BED_LAYOUT_VALUES,
  BATHROOM_TYPE_VALUES,
  HEATING_TYPE_VALUES,
} from '@/lib/rv-taxonomy'
import { optionalText, optionalEmail, optionalInt, optionalPositive } from './optional'

// CAP-1 — captación progresiva: ningún campo de negocio es obligatorio al crear/editar. Vacío es
// válido; si se aporta un valor debe tener formato/dominio válidos. Ausencia → null (nunca placeholder).
// `status` NO es dato de negocio libre: es un estado de workflow controlado (enum), se mantiene.
const CURRENT_YEAR = new Date().getFullYear()

export const equipmentSchema = z.object({
  solar: z.boolean().default(false),
  kitchen: z.boolean().default(false),
  bathroom: z.boolean().default(false),
  shower: z.boolean().default(false),
  heating: z.boolean().default(false),
})

export const createSellerLeadSchema = z.object({
  // Vendedor (CAP-1: opcionales; vacío → null; email/teléfono validados solo si se informan)
  name: optionalText(200),
  email: optionalEmail(),
  phone: optionalText(30),

  // Vehículo (CAP-1: opcionales; rango válido solo si se informa el valor)
  type: z.enum(['CAMPER', 'AUTOCARAVANA']).optional().nullable(),
  brand: optionalText(120),
  model: optionalText(120),
  year: optionalInt({
    min: 1980,
    max: CURRENT_YEAR + 1,
    minMsg: 'Mínimo año 1980',
    maxMsg: 'Año no válido',
  }),
  km: optionalInt({ min: 0, minMsg: 'Los km no pueden ser negativos' }),
  seats: optionalInt({ min: 1, max: 20, minMsg: 'Mínimo 1 plaza', maxMsg: 'Máximo 20 plazas' }),
  length: optionalPositive(),
  conservationState: z.enum(['EXCELENTE', 'BUENO', 'NORMAL', 'DETERIORADO']).default('NORMAL'),
  location: optionalText(200),
  desiredPrice: optionalPositive(),
  plate: optionalText(20),
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

// CAP-1: el formulario PÚBLICO `/vender` conserva sus reglas estrictas (no se relaja). Sobrescribe
// los campos de negocio del schema interno para exigir valores. `submitPublicLead` usa este schema.
export const createSellerLeadPublicSchema = createSellerLeadSchema.extend({
  name: z.string().min(1, 'El nombre es obligatorio'),
  email: z.string().email('Email no válido'),
  phone: z.string().min(6, 'Teléfono demasiado corto'),
  type: z.enum(['CAMPER', 'AUTOCARAVANA'], { error: 'Selecciona un tipo' }),
  brand: z.string().min(1, 'La marca es obligatoria'),
  model: z.string().min(1, 'El modelo es obligatorio'),
  year: z
    .number({ error: 'El año es obligatorio' })
    .int()
    .min(1980, 'Mínimo año 1980')
    .max(CURRENT_YEAR + 1, 'Año no válido'),
  km: z.number({ error: 'Los km son obligatorios' }).int().min(0, 'Los km no pueden ser negativos'),
  seats: z
    .number({ error: 'Las plazas son obligatorias' })
    .int()
    .min(1, 'Mínimo 1 plaza')
    .max(20, 'Máximo 20 plazas'),
})

// OUTPUT: tipo validado que devuelve Zod (con defaults aplicados)
export type CreateSellerLeadInput = z.infer<typeof createSellerLeadSchema>

// INPUT: tipo que consume el formulario (campos con .default() son opcionales)
export type SellerLeadFormValues = z.input<typeof createSellerLeadSchema>

export const updateSellerLeadSchema = z.object({
  name: optionalText(200),
  email: optionalEmail(),
  phone: optionalText(30),
  status: z.enum(['NUEVO', 'CONTACTADO', 'CUALIFICADO', 'EN_NEGOCIACION', 'CERRADO', 'DESCARTADO']),
  agentId: z.string().nullable(),
  // ── Condiciones de la operación (Seller Supply Graph, Block 17) ──
  minPrice: z.number().positive('Debe ser mayor que 0').optional().nullable(),
  dealType: z
    .enum(['DEPOSITO_VENTA', 'COMPRA_DIRECTA', 'PARTE_PAGO', 'INDECISO'])
    .optional()
    .nullable(),
  urgency: z.enum(['ALTA', 'MEDIA', 'BAJA']).optional().nullable(),
  riskLevel: z.enum(['BAJO', 'MEDIO', 'ALTO']).optional().nullable(),
  riskNotes: z.string().max(500).optional().nullable(),
})

export type UpdateSellerLeadValues = z.input<typeof updateSellerLeadSchema>

export const updateVehicleSchema = z.object({
  // CAP-1: datos de negocio del vehículo opcionales al editar. `status` es workflow controlado.
  type: z.enum(['CAMPER', 'AUTOCARAVANA']).optional().nullable(),
  brand: optionalText(120),
  model: optionalText(120),
  year: optionalInt({
    min: 1980,
    max: CURRENT_YEAR + 1,
    minMsg: 'Mínimo año 1980',
    maxMsg: 'Año no válido',
  }),
  km: optionalInt({ min: 0, minMsg: 'Los km no pueden ser negativos' }),
  seats: optionalInt({ min: 1, max: 20, minMsg: 'Mínimo 1 plaza', maxMsg: 'Máximo 20 plazas' }),
  length: optionalPositive(),
  conservationState: z.enum(['EXCELENTE', 'BUENO', 'NORMAL', 'DETERIORADO']).default('NORMAL'),
  location: optionalText(200),
  desiredPrice: optionalPositive(),
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
