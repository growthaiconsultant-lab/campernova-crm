import type { HeatingType, Prisma } from '@prisma/client'
import { catalogFields, readCatalog } from '../matching/catalog'
import { vehicleFacts } from '../matching/vehicle-characteristics'
import type { EquipmentFlags } from '../valuation/types'

type VehicleFacts = {
  matchCatalog: Prisma.JsonValue
  equipment: Prisma.JsonValue
  heatingType: HeatingType | null
}
const binaryFields = catalogFields.filter((f) => f.options?.join('|') === 'Sí|No')
export function inspectionField(label: string) {
  return binaryFields.find(
    (f) => f.label.toLocaleLowerCase('es') === label.trim().toLocaleLowerCase('es')
  )?.id
}
export function initialEquipment(v: VehicleFacts, label: string) {
  const key = inspectionField(label)
  const facts = vehicleFacts(readCatalog(v.matchCatalog), {
    equipment: v.equipment as EquipmentFlags,
    heatingType: v.heatingType,
  })
  if (!key) {
    const detail =
      label === 'Baterías auxiliares'
        ? facts.battery
        : label === 'Nevera'
          ? facts.fridge
          : undefined
    return detail?.values.length ? !detail.values.includes('No tiene') : null
  }
  const value = facts[key]?.values[0]
  return value === 'Sí' ? true : value === 'No' ? false : null
}
