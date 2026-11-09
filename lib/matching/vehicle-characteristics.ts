import { EQUIPMENT_OPTIONS, RV_BED_OPTIONS, RV_CATEGORY_OPTIONS } from '@/lib/rv-taxonomy'
import type { Catalog } from './catalog'
import type { EquipmentFlags } from '@/lib/valuation/types'
import type { BathroomType, HeatingType } from '@prisma/client'

type Legacy = {
  equipment?: EquipmentFlags
  category?: string | null
  bedLayout?: string | null
  hasGarage?: boolean | null
  bathroomType?: BathroomType | null
  heatingType?: HeatingType | null
}
const bathLabels = {
  SEPARADO: 'Independiente del inodoro',
  HUMEDO: 'Integrada',
  NINGUNO: 'Sin baño interior',
} as const

export function editableCharacteristics(raw: Catalog, v: Legacy): Catalog {
  const result = { ...raw }
  function inherit(id: string, value?: string, multiple = false) {
    if (!value) return
    const entry = result[id]
    if (!entry) result[id] = { values: [value] }
    else if (multiple && !entry.values.includes(value) && !entry.values.includes('No tiene'))
      result[id] = { ...entry, values: [...entry.values, value] }
  }
  inherit('format', RV_CATEGORY_OPTIONS.find((o) => o.value === v.category)?.label, true)
  inherit('beds', RV_BED_OPTIONS.find((o) => o.value === v.bedLayout)?.label, true)
  inherit('showerOptions', v.bathroomType ? bathLabels[v.bathroomType] : undefined, true)
  inherit('heating', v.heatingType ? (v.heatingType === 'NINGUNA' ? 'No' : 'Sí') : undefined)
  for (const { id } of EQUIPMENT_OPTIONS)
    if (v.equipment?.[id] && inferredPresence(result, id) !== 'Sí') inherit(id, 'Sí')
  if (v.hasGarage != null && inferredPresence(result, 'garage') !== (v.hasGarage ? 'Sí' : 'No'))
    inherit('garage', v.hasGarage ? 'Sí' : 'No')
  return result
}

export function inferredPresence(c: Catalog, id: string) {
  if (
    id === 'shower' &&
    c.showerOptions?.values.some((v) =>
      ['Interior', 'Exterior', 'Integrada', 'Independiente del inodoro'].includes(v)
    )
  )
    return 'Sí'
  if (id === 'garage') {
    if (Number(c.garageBikes?.values[0]) > 0 || c.garageSize?.values.some((v) => v !== 'No tiene'))
      return 'Sí'
    if (c.garageSize?.values.includes('No tiene')) return 'No'
  }
  if (
    id === 'kitchen' &&
    ['kitchenPlace', 'kitchenShape', 'kitchenMount'].some((k) =>
      c[k]?.values.some((v) => v !== 'No tiene')
    )
  )
    return 'Sí'
  return undefined
}

export function vehicleFacts(raw: Catalog, legacy: Legacy) {
  const facts = editableCharacteristics(raw, legacy)
  for (const id of ['shower', 'garage', 'kitchen']) {
    const inferred = inferredPresence(facts, id)
    if (!facts[id] && inferred) facts[id] = { values: [inferred] }
  }
  return facts
}

export function legacyProjection(c: Catalog, old: Legacy) {
  function option<T extends string>(
    id: string,
    options: readonly { value: T; label: string }[],
    previous?: string | null
  ) {
    const matches = options.filter((o) => c[id]?.values.includes(o.label))
    return (matches.find((o) => o.value === previous) ?? matches[0])?.value ?? null
  }
  const showers = c.showerOptions?.values ?? []
  const types = (Object.keys(bathLabels) as BathroomType[]).filter((k) =>
    showers.includes(bathLabels[k])
  )
  const bathroomType = types.find((v) => v === old.bathroomType) ?? types[0] ?? null
  const equipment = { ...old.equipment }
  for (const { id } of EQUIPMENT_OPTIONS)
    equipment[id] = (c[id]?.values[0] ?? inferredPresence(c, id)) === 'Sí'
  if (bathroomType) equipment.bathroom = bathroomType !== 'NINGUNO'
  else if (old.bathroomType) equipment.bathroom = false
  const garage = c.garage?.values[0] ?? inferredPresence(c, 'garage')
  return {
    category: option('format', RV_CATEGORY_OPTIONS, old.category),
    bedLayout: option('beds', RV_BED_OPTIONS, old.bedLayout),
    bathroomType,
    equipment,
    hasGarage: garage ? garage === 'Sí' : null,
  }
}
