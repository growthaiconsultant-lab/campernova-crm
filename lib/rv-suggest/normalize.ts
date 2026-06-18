import {
  VEHICLE_CATEGORY_VALUES,
  BED_LAYOUT_VALUES,
  BATHROOM_TYPE_VALUES,
  HEATING_TYPE_VALUES,
} from '@/lib/rv-taxonomy'

/** Ficha técnica RV sugerida por la IA. Todo nullable salvo equipment/notes. */
export type RvSuggestion = {
  category: (typeof VEHICLE_CATEGORY_VALUES)[number] | null
  bedLayout: (typeof BED_LAYOUT_VALUES)[number] | null
  bathroomType: (typeof BATHROOM_TYPE_VALUES)[number] | null
  heatingType: (typeof HEATING_TYPE_VALUES)[number] | null
  sleepingPlaces: number | null
  maxMassKg: number | null
  heightM: number | null
  length: number | null
  winterized: boolean | null
  hasGarage: boolean | null
  offGrid: boolean | null
  equipment: { solar: boolean; kitchen: boolean; shower: boolean; heating: boolean }
  notes: string
}

function pickEnum<T extends readonly string[]>(v: unknown, values: T): T[number] | null {
  return typeof v === 'string' && (values as readonly string[]).includes(v)
    ? (v as T[number])
    : null
}

function pickInt(v: unknown, min: number, max: number): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null
}

function pickNum(v: unknown, min: number, max: number): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null
}

function pickBool(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null
}

/**
 * Valida y coacciona la salida del modelo a una `RvSuggestion` segura.
 * Nunca lanza: cualquier valor inválido, ausente o de tipo erróneo cae a null
 * (o false en equipment). La fuente de verdad de los enums es lib/rv-taxonomy.
 */
export function normalizeRvSuggestion(raw: unknown): RvSuggestion {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const eq = (o.equipment && typeof o.equipment === 'object' ? o.equipment : {}) as Record<
    string,
    unknown
  >
  return {
    category: pickEnum(o.category, VEHICLE_CATEGORY_VALUES),
    bedLayout: pickEnum(o.bedLayout, BED_LAYOUT_VALUES),
    bathroomType: pickEnum(o.bathroomType, BATHROOM_TYPE_VALUES),
    heatingType: pickEnum(o.heatingType, HEATING_TYPE_VALUES),
    sleepingPlaces: pickInt(o.sleepingPlaces, 0, 12),
    maxMassKg: pickInt(o.maxMassKg, 1000, 7500),
    heightM: pickNum(o.heightM, 1, 4.5),
    length: pickNum(o.length, 3, 12),
    winterized: pickBool(o.winterized),
    hasGarage: pickBool(o.hasGarage),
    offGrid: pickBool(o.offGrid),
    equipment: {
      solar: eq.solar === true,
      kitchen: eq.kitchen === true,
      shower: eq.shower === true,
      heating: eq.heating === true,
    },
    notes: typeof o.notes === 'string' ? o.notes.slice(0, 600) : '',
  }
}
