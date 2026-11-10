import { fieldById, buyerCatalogPreferences, familyLabel } from './catalog'
import type { MatchingBuyerInput, MatchingVehicleInput } from './types'

import { vehicleFacts, legacyProjection } from './vehicle-characteristics'

export function assessPair(v: MatchingVehicleInput, b: MatchingBuyerInput) {
  const missing: string[] = [],
    failed: string[] = [],
    confirmed: string[] = [],
    wanted: string[] = [],
    unknown: string[] = [],
    met: string[] = []
  function check(label: string, required: boolean, ok: boolean | null) {
    if (required) {
      const group = ok === null ? missing : ok ? met : failed
      group.push(label)
    } else {
      wanted.push(label)
      if (ok === true) confirmed.push(label)
      if (ok === null) unknown.push(label)
    }
  }
  function limit(label: string, actual: number | null, threshold: number | null, max = false) {
    if (threshold !== null)
      check(
        label + ' ' + (max ? '≤ ' : '≥ ') + threshold,
        true,
        actual === null ? null : max ? actual <= threshold : actual >= threshold
      )
  }

  limit('Precio (€)', v.price, b.maxBudget, true)
  limit('Plazas para viajar', v.seats, b.minSeats)
  limit('Plazas para dormir', v.sleepingPlaces, b.sleepingPlacesRequired)
  limit('Longitud (m)', v.length, b.maxLengthM, true)
  limit('Altura (m)', v.heightM, b.maxHeightM, true)
  if (b.licenseType === 'B') limit('MMA (kg)', v.maxMassKg, 3500, true)
  const facts = vehicleFacts(v.catalog ?? {}, v)
  const bathType = legacyProjection(facts, v).bathroomType
  const bathroom = bathType
    ? bathType !== 'NINGUNO'
    : facts.fullBath?.values.includes('Sí') || v.equipment.bathroom === true
      ? true
      : null
  if (b.bathroomRequired) check('Baño interior', true, bathroom)
  if (b.useZone)
    check(
      'Zona · ' + b.useZone,
      false,
      v.location === null
        ? null
        : v.location.trim().toLowerCase() === b.useZone.trim().toLowerCase()
    )
  const prefs = buyerCatalogPreferences(b, b.catalog)
  function fact(id: string, val: string | undefined) {
    if (val && !facts[id]) facts[id] = { values: [val] }
  }
  fact('family', familyLabel(v.type))
  fact('year', v.year?.toString())
  fact('km', v.km?.toString())
  fact('brand', v.brand ?? undefined)
  fact('model', v.model ?? undefined)
  if (
    facts.roof?.values.includes('Elevable') &&
    facts.roofBed?.values.includes('Sí') &&
    !facts.beds
  )
    fact('beds', 'Cama en techo elevable')
  if (b.criticalEquipment.bathroom && !b.bathroomRequired) check('Baño', true, bathroom)
  if (facts.garage?.values.includes('No')) {
    fact('garageSize', 'No tiene')
    fact('garageBikes', '0')
  }
  if (b.needsWinter) check('Preparación de invierno', true, v.winterized ?? null)
  for (const [id, p] of Object.entries(prefs)) {
    const f = fieldById.get(id)
    if (!f) continue
    const values = /^use[1-5]$/.test(id)
      ? Object.entries(facts)
          .filter(([key]) => /^use[1-5]$/.test(key))
          .flatMap(([, e]) => e.values)
      : facts[id]?.values
    let ok: boolean | null = null
    if (values?.length) {
      if (f.kind === 'min') ok = Number(values[0]) >= Number(p.values[0])
      else if (f.kind === 'max') ok = Number(values[0]) <= Number(p.values[0])
      else {
        const accepted = new Set(values.map((x) => x.trim().toLocaleLowerCase('es')))
        if (id === 'roof' && accepted.has('alto de fábrica')) accepted.add('alto')
        if (
          id === 'showerOptions' &&
          (accepted.has('integrada') || accepted.has('independiente del inodoro'))
        )
          accepted.add('interior')
        const found = (x: string) => accepted.has(x.trim().toLocaleLowerCase('es'))
        const matches = p.all ? p.values.every(found) : p.values.some(found)
        ok = f.kind === 'text' && !matches && !['brand', 'model'].includes(id) ? null : matches
      }
    }
    check(f.label + ' · ' + p.values.join(p.all ? ' y ' : ' o '), !!p.required, ok)
  }
  return {
    state: failed.length ? 'descartado' : missing.length ? 'pendiente' : 'apto',
    failed,
    missing,
    met,
    wanted,
    confirmed,
    unknown,
    score: wanted.length ? Math.round((100 * confirmed.length) / wanted.length) : 100,
  }
}
