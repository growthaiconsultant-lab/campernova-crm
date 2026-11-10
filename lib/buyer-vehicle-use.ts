import type { BuyerVehicleUse } from '@prisma/client'
import { z } from 'zod'

export const useLabels = {
  ESCAPADAS: 'Escapadas y vacaciones',
  VIAJES_LARGOS: 'Viajes largos',
  VIVIENDA: 'Vivir en ella',
  VIVIENDA_TEMPORADAS: 'Vivir en ella · Por temporadas',
  VIVIENDA_ANUAL: 'Vivir en ella · Todo el año',
  OTRO: 'Otro uso',
} satisfies Record<BuyerVehicleUse, string>

export const usageSchema = z
  .object({
    intendedUse: z
      .enum([
        'ESCAPADAS',
        'VIAJES_LARGOS',
        'VIVIENDA',
        'VIVIENDA_TEMPORADAS',
        'VIVIENDA_ANUAL',
        'OTRO',
      ])
      .nullable(),
    otherUse: z.string().max(300).nullable(),
    useZone: z.string().nullable(),
  })
  .strict()
  .refine((p) => !p.otherUse || p.intendedUse === 'OTRO')
export type BuyerUsage = z.infer<typeof usageSchema>

export function usageLabel({
  intendedUse,
  otherUse,
}: Pick<BuyerUsage, 'intendedUse' | 'otherUse'>) {
  if (!intendedUse) return 'Por confirmar'
  if (intendedUse === 'OTRO' && otherUse) return otherUse
  if (intendedUse === 'VIVIENDA') return 'Vivir en ella · Duración por concretar'
  return useLabels[intendedUse]
}
