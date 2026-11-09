import { catalogFields, fieldById, type Catalog } from '@/lib/matching/catalog'
import type { SearchRequestInput } from './schema'

// Older versions of the public questionnaire send individual answers rather than a catalog.
export function preferencesFromRequest(input: SearchRequestInput): Catalog {
  const result = { ...input.catalog },
    a = input.answers
  function add(key: string, value: unknown, required = false) {
    if (result[key] || !value) return
    const field = fieldById.get(key)
    if (!field) return
    const values = (Array.isArray(value) ? value : [value]).filter(
      (v): v is string => typeof v === 'string' && (!field.options || field.options.includes(v))
    )
    if (values.length) result[key] = { values, required }
  }
  for (const [id, answer] of Object.entries(a)) {
    if (!id.startsWith('equipment_') || !['Imprescindible', 'Preferible'].includes(String(answer)))
      continue
    const key = id.slice(10)
    add(
      key === 'lithium' ? 'battery' : key,
      key === 'lithium' ? 'Litio' : 'Sí',
      answer === 'Imprescindible'
    )
  }

  add('gearbox', a.gearbox)
  if (Array.isArray(a.beds))
    add(
      'beds',
      a.beds.map(
        (v) =>
          (
            ({
              'Cama doble fija': 'Doble fija',
              'Cama elevable': 'Elevable',
              'Techo elevable': 'Cama en techo elevable',
              'Salón convertible': 'Dinette convertible',
            }) as Record<string, string>
          )[v] ?? v
      )
    )
  if (Array.isArray(a.shower))
    add(
      'showerOptions',
      a.shower.map(
        (v) =>
          (
            ({
              'Separada del inodoro': 'Independiente del inodoro',
              'Exterior suficiente': 'Exterior',
            }) as Record<string, string>
          )[v] ?? v
      )
    )
  if (a.hotWater === 'Imprescindible' || a.hotWater === 'Preferible')
    add('hotWater', 'Sí', a.hotWater === 'Imprescindible')
  add('year', a.minYear)
  add('km', a.maxKm, a.moreKm === 'No')
  add('conversion', a.conversion)
  if (a.origin === 'Solo España') add('origin', 'Nacional', true)
  if (a.toilet === 'Fijo') add('wc', 'Fijo')
  if (Array.isArray(a.fridge)) {
    if (a.fridge.includes('Grande')) add('fridge', 'Grande')
    if (a.fridge.includes('Necesito congelador')) add('freezer', 'Sí', true)
  }
  for (let i = 1; i <= 5; i++) {
    const text = a['essential' + i]
    if (typeof text !== 'string' || !text.trim()) continue
    const same = catalogFields.find(
      (f) => f.label.toLocaleLowerCase('es') === text.trim().toLocaleLowerCase('es')
    )
    if (same && result[same.id]) result[same.id] = { ...result[same.id], required: true }
    else if (same?.options?.join('|') === 'Sí|No') add(same.id, 'Sí', true)
    else add('use' + i, text, true)
  }
  return result
}
