import type { ChecklistItemCategory } from '@prisma/client'

/** Estados de WorkOrder en los que una orden de inspección de entrada está ACTIVA (no terminal). */
export const ACTIVE_WORKORDER_STATUSES = [
  'PENDIENTE',
  'EN_DIAGNOSTICO',
  'PRESUPUESTADA',
  'EN_CURSO',
] as const

/** Puntos iniciales de la inspección técnica y de equipamiento. */
export const INSPECTION_CHECKLIST: ReadonlyArray<{
  category: ChecklistItemCategory
  item: string
}> = [
  { category: 'MECANICA', item: 'Motor' },
  { category: 'MECANICA', item: 'Caja de cambios' },
  { category: 'MECANICA', item: 'Frenos' },
  { category: 'MECANICA', item: 'Suspensión' },
  { category: 'MECANICA', item: 'Neumáticos' },
  { category: 'MECANICA', item: 'Batería motor' },
  { category: 'MECANICA', item: 'ITV y documentación' },
  { category: 'CAMPER', item: 'Agua' },
  { category: 'CAMPER', item: 'Gas' },
  { category: 'CAMPER', item: 'Calefacción' },
  { category: 'CAMPER', item: 'Boiler' },
  { category: 'CAMPER', item: 'Nevera' },
  { category: 'CAMPER', item: 'Placas solares' },
  { category: 'CAMPER', item: 'Toldo' },
  { category: 'CAMPER', item: 'Cocina instalada' },
  { category: 'CAMPER', item: 'Ducha' },
  { category: 'CAMPER', item: 'Portabicicletas' },
  { category: 'CAMPER', item: 'Limpieza interior' },
  { category: 'CAMPER', item: 'Limpieza exterior' },
  { category: 'ELECTRICIDAD', item: 'Centralita' },
  { category: 'ELECTRICIDAD', item: 'Inversor' },
  { category: 'ELECTRICIDAD', item: 'Baterías auxiliares' },
  { category: 'ELECTRICIDAD', item: 'Luces' },
  { category: 'ELECTRICIDAD', item: 'Tomas 230V' },
  { category: 'ELECTRICIDAD', item: 'Cargadores' },
]
