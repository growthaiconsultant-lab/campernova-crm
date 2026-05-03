import type { ConservationState } from '@prisma/client'
import type { EquipmentFlags } from './types'

/// Factores multiplicativos por estado de conservación.
const CONSERVATION_FACTORS: Record<ConservationState, number> = {
  EXCELENTE: 1.05,
  BUENO: 1.0,
  NORMAL: 0.97,
  DETERIORADO: 0.9,
}

export function conservationFactor(state: ConservationState): number {
  return CONSERVATION_FACTORS[state]
}

/// Equipamiento considerado "premium" para ajuste al alza.
/// `kitchen` no cuenta — viene de serie en casi todas las conversiones.
const PREMIUM_EQUIPMENT: Array<keyof EquipmentFlags> = ['solar', 'bathroom', 'shower', 'heating']

/// +2% por cada item premium presente. Tope acumulado sano (4 items = +8%).
export function equipmentFactor(equipment: EquipmentFlags): number {
  const present = PREMIUM_EQUIPMENT.filter((key) => equipment[key]).length
  return 1 + present * 0.02
}

/// Ajuste por diferencia de año cuando se usa la tabla de referencia.
/// Cada año más viejo que baseYear: -8%. Cada año más nuevo: +5% (suelen ser muy raros).
export function yearFactor(year: number, baseYear: number): number {
  const diff = year - baseYear
  if (diff === 0) return 1
  if (diff < 0) return Math.pow(0.92, -diff)
  return Math.pow(1.05, diff)
}
