import type { VehicleType, VehicleCategory, BedLayout, LicenseType } from '@prisma/client'
import { buyerCatalogPreferences, familyLabel, fieldById, type Catalog } from './matching/catalog'

export type BuyerCriteriaInput = {
  vehicleType: VehicleType | null
  minSeats: number | null
  maxBudget: number | string | null
  sleepingPlacesRequired: number | null
  bathroomRequired: boolean | null
  licenseType: LicenseType | null
  maxLengthM: number | null
  maxHeightM: number | null
  preferredCategory: VehicleCategory | null
  preferredBedLayout: BedLayout | null
  criticalEquipment: Record<string, boolean> | null
  useZone: string | null
  needsWinter: boolean | null
  needsGarage: boolean | null
  hasKids: boolean | null
}

/** Reading order for the buyer brief; the four headline facts are displayed separately. */
export function buyerSearchCriteria(b: BuyerCriteriaInput, catalog: Catalog) {
  const required: string[] = []
  const preferred: string[] = []
  if (b.bathroomRequired || b.criticalEquipment?.bathroom) required.push('Baño interior')
  if (b.licenseType === 'B') required.push('Permiso B · hasta 3.500 kg')
  if (b.maxLengthM != null)
    required.push(`Longitud máxima de ${b.maxLengthM.toLocaleString('es-ES')} m`)
  if (b.maxHeightM != null)
    required.push(`Altura máxima de ${b.maxHeightM.toLocaleString('es-ES')} m`)
  if (b.needsWinter) required.push('Preparación para invierno')
  const prefs = buyerCatalogPreferences(b, catalog)
  const declaredFamily = familyLabel(b.vehicleType)
  const catalogFamily = prefs.family?.values.join(prefs.family.all ? ' y ' : ' o ')
  for (const [id, entry] of Object.entries(prefs)) {
    if (id === 'family' && (!declaredFamily || declaredFamily === catalogFamily)) continue
    const f = fieldById.get(id)
    if (!f) continue
    const value = entry.values.join(entry.all ? ' y ' : ' o ')
    let text = f.label + ' · ' + value
    if (f.kind === 'min' || f.kind === 'max')
      text =
        f.label +
        ' · ' +
        (f.kind === 'min' ? 'mínimo ' : 'máximo ') +
        Number(value).toLocaleString('es-ES')
    else if (value === 'Sí')
      text = id === 'garage' ? 'Garaje para equipaje en el vehículo' : f.label
    else if (/^use[1-5]$/.test(id)) text = value
    const group = entry.required ? required : preferred
    group.push(text)
  }
  for (const [key, enabled] of Object.entries(b.criticalEquipment ?? {})) {
    if (enabled && !['solar', 'heating', 'shower', 'kitchen', 'bathroom'].includes(key))
      preferred.push(key)
  }
  if (b.hasKids) preferred.push('Viaja con niños')
  return {
    family: declaredFamily ?? catalogFamily,
    required: Array.from(new Set(required)),
    preferred: Array.from(new Set(preferred)),
  }
}
