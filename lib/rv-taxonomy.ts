// Fuente ÚNICA de las opciones de la taxonomía RV (Fase #3).
// La usan el formulario público /vender, la ficha de vehículo y la de comprador
// del backoffice → mismas etiquetas y valores en todas partes (homogéneo).
// Los valores deben coincidir con los enums de Prisma (VehicleCategory, BedLayout,
// BathroomType, HeatingType, LicenseType).

export const RV_CATEGORY_OPTIONS = [
  { value: 'MINI_CAMPER', label: 'Mini camper' },
  { value: 'CAMPER', label: 'Camper compacta' },
  { value: 'GRAN_VOLUMEN', label: 'Gran volumen (furgón)' },
  { value: 'PERFILADA', label: 'Perfilada' },
  { value: 'CAPUCHINA', label: 'Capuchina' },
  { value: 'INTEGRAL', label: 'Integral' },
] as const

export const RV_BED_OPTIONS = [
  { value: 'TRANSVERSAL', label: 'Transversal' },
  { value: 'LONGITUDINAL', label: 'Longitudinal' },
  { value: 'GEMELAS', label: 'Camas gemelas' },
  { value: 'ISLA', label: 'Cama isla' },
  { value: 'FRANCESA', label: 'Cama francesa' },
  { value: 'BASCULANTE', label: 'Basculante (techo)' },
  { value: 'LITERAS', label: 'Literas' },
  { value: 'TECHO_ELEVABLE', label: 'Cama en techo elevable' },
  { value: 'DINETTE', label: 'Dinette convertible' },
] as const

export const RV_BATHROOM_OPTIONS = [
  { value: 'NINGUNO', label: 'Sin baño' },
  { value: 'HUMEDO', label: 'Baño húmedo (ducha + WC)' },
  { value: 'SEPARADO', label: 'Ducha / WC separados' },
] as const

export const RV_HEATING_OPTIONS = [
  { value: 'NINGUNA', label: 'Sin calefacción' },
  { value: 'GAS', label: 'Gas' },
  { value: 'DIESEL', label: 'Diésel' },
  { value: 'ELECTRICA', label: 'Eléctrica' },
] as const

export const RV_LICENSE_OPTIONS = [
  { value: 'B', label: 'Carnet B (hasta 3.500 kg)' },
  { value: 'C1', label: 'Carnet C1 (más de 3.500 kg)' },
] as const

// Valores (tuplas) para z.enum en los validadores. Coinciden con los enums de Prisma.
export const VEHICLE_CATEGORY_VALUES = [
  'MINI_CAMPER',
  'CAMPER',
  'GRAN_VOLUMEN',
  'PERFILADA',
  'CAPUCHINA',
  'INTEGRAL',
] as const
export const BED_LAYOUT_VALUES = [
  'TRANSVERSAL',
  'LONGITUDINAL',
  'GEMELAS',
  'ISLA',
  'FRANCESA',
  'BASCULANTE',
  'LITERAS',
  'TECHO_ELEVABLE',
  'DINETTE',
] as const
export const BATHROOM_TYPE_VALUES = ['NINGUNO', 'HUMEDO', 'SEPARADO'] as const
export const HEATING_TYPE_VALUES = ['NINGUNA', 'GAS', 'DIESEL', 'ELECTRICA'] as const
export const LICENSE_TYPE_VALUES = ['B', 'C1'] as const

// Equipamiento (flags) — el baño YA NO va aquí: es su propia dimensión (bathroomType).
export const EQUIPMENT_OPTIONS = [
  { id: 'solar', label: 'Placas solares' },
  { id: 'kitchen', label: 'Cocina' },
  { id: 'shower', label: 'Ducha' },
  { id: 'heating', label: 'Calefacción' },
] as const

export type EquipmentOptionKey = (typeof EQUIPMENT_OPTIONS)[number]['id']

// Centinela para "sin selección" en los <Select> (no se permite value="").
export const RV_NONE = '__none__'
