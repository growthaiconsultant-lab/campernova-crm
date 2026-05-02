// Static list from prisma/data/reference-prices.csv
// Grouped by type → brand → models

export type VehicleEntry = {
  brand: string
  model: string
  type: 'CAMPER' | 'AUTOCARAVANA'
}

export const VEHICLE_LIST: VehicleEntry[] = [
  // ── CAMPER ─────────────────────────────────────────────────────
  { type: 'CAMPER', brand: 'Adria', model: 'Twin' },
  { type: 'CAMPER', brand: 'Adria', model: 'Twin Supreme' },
  { type: 'CAMPER', brand: 'Carado', model: 'Banff' },
  { type: 'CAMPER', brand: 'Chausson', model: 'Van 594' },
  { type: 'CAMPER', brand: 'Citroën', model: 'SpaceTourer Camper' },
  { type: 'CAMPER', brand: 'Dethleffs', model: 'Globevan' },
  { type: 'CAMPER', brand: 'Fiat', model: 'Ducato Camper' },
  { type: 'CAMPER', brand: 'Fiat', model: 'Ducato Camper XL' },
  { type: 'CAMPER', brand: 'Ford', model: 'Transit Custom Nugget' },
  { type: 'CAMPER', brand: 'Ford', model: 'Transit Custom Nugget Plus' },
  { type: 'CAMPER', brand: 'Hymer', model: 'Venture S' },
  { type: 'CAMPER', brand: 'Knaus', model: 'BoxStar' },
  { type: 'CAMPER', brand: 'LMC', model: 'Innova Camper' },
  { type: 'CAMPER', brand: 'Mercedes-Benz', model: 'Marco Polo' },
  { type: 'CAMPER', brand: 'Mercedes-Benz', model: 'Marco Polo Activity' },
  { type: 'CAMPER', brand: 'Mercedes-Benz', model: 'Sprinter Camper' },
  { type: 'CAMPER', brand: 'Opel', model: 'Zafira Life Camper' },
  { type: 'CAMPER', brand: 'Peugeot', model: 'Traveller Camper' },
  { type: 'CAMPER', brand: 'Renault', model: 'Trafic SpaceClass' },
  { type: 'CAMPER', brand: 'Roller Team', model: 'Auto-Roller' },
  { type: 'CAMPER', brand: 'Sunlight', model: 'Van 47' },
  { type: 'CAMPER', brand: 'Toyota', model: 'Proace Verso Camper' },
  { type: 'CAMPER', brand: 'Trigano', model: 'Tribute 640 Camper' },
  { type: 'CAMPER', brand: 'Volkswagen', model: 'California Ocean' },
  { type: 'CAMPER', brand: 'Volkswagen', model: 'California Beach' },
  { type: 'CAMPER', brand: 'Volkswagen', model: 'California 6.1 Ocean' },
  { type: 'CAMPER', brand: 'Volkswagen', model: 'Crafter Grand California' },
  { type: 'CAMPER', brand: 'Westfalia', model: 'Kepler Six' },
  { type: 'CAMPER', brand: 'Westfalia', model: 'Kepler One' },
  { type: 'CAMPER', brand: 'Wingamm', model: 'Oasi 690G' },
  // ── AUTOCARAVANA ───────────────────────────────────────────────
  { type: 'AUTOCARAVANA', brand: 'Adria', model: 'Compact SP' },
  { type: 'AUTOCARAVANA', brand: 'Adria', model: 'Coral 600 SL' },
  { type: 'AUTOCARAVANA', brand: 'Adria', model: 'Coral XL 670 SF' },
  { type: 'AUTOCARAVANA', brand: 'Adria', model: 'Matrix Plus 670 SC' },
  { type: 'AUTOCARAVANA', brand: 'Adria', model: 'Sonic Plus 700 SL' },
  { type: 'AUTOCARAVANA', brand: 'Bürstner', model: 'Ixeo Time IT 706' },
  { type: 'AUTOCARAVANA', brand: 'Bürstner', model: 'Lyseo TD 744' },
  { type: 'AUTOCARAVANA', brand: 'Bürstner', model: 'Minimax T 680' },
  { type: 'AUTOCARAVANA', brand: 'Carado', model: 'A 461' },
  { type: 'AUTOCARAVANA', brand: 'Carado', model: 'I 338' },
  { type: 'AUTOCARAVANA', brand: 'Carado', model: 'T 337' },
  { type: 'AUTOCARAVANA', brand: 'Carado', model: 'T 447' },
  { type: 'AUTOCARAVANA', brand: 'Carthago', model: 'C-Tourer I 138' },
  { type: 'AUTOCARAVANA', brand: 'Carthago', model: 'Chic C-Line I 50' },
  { type: 'AUTOCARAVANA', brand: 'Chausson', model: '630' },
  { type: 'AUTOCARAVANA', brand: 'Chausson', model: '720 Welcome Premium' },
  { type: 'AUTOCARAVANA', brand: 'Chausson', model: '757 UA' },
  { type: 'AUTOCARAVANA', brand: 'Chausson', model: 'Welcome 60' },
  { type: 'AUTOCARAVANA', brand: 'Dethleffs', model: 'Trend T 7057 EB' },
  { type: 'AUTOCARAVANA', brand: 'Dethleffs', model: 'Esprit T 7150 EB' },
  { type: 'AUTOCARAVANA', brand: 'Dethleffs', model: 'Globe T 7857 ET' },
  { type: 'AUTOCARAVANA', brand: 'Dethleffs', model: 'Pulse T 7051 EB' },
  { type: 'AUTOCARAVANA', brand: 'Hobby', model: 'Optima De Luxe T 65 GH' },
  { type: 'AUTOCARAVANA', brand: 'Hobby', model: 'Premium T 65 GH' },
  { type: 'AUTOCARAVANA', brand: 'Hobby', model: 'Siesta T 65 HQ' },
  { type: 'AUTOCARAVANA', brand: 'Hymer', model: 'B-Class MobiLine 560' },
  { type: 'AUTOCARAVANA', brand: 'Hymer', model: 'B-Class 570' },
  { type: 'AUTOCARAVANA', brand: 'Hymer', model: 'B-Class 580' },
  { type: 'AUTOCARAVANA', brand: 'Hymer', model: 'T-Class S 698' },
  { type: 'AUTOCARAVANA', brand: 'Hymer', model: 'Exsis-i 580' },
  { type: 'AUTOCARAVANA', brand: 'Itineo', model: 'MB 700' },
  { type: 'AUTOCARAVANA', brand: 'Knaus', model: 'Sudwind 630 LG' },
  { type: 'AUTOCARAVANA', brand: 'Knaus', model: 'Sun Ti 700 LFG' },
  { type: 'AUTOCARAVANA', brand: 'Knaus', model: 'Van Ti 650 MEG' },
  { type: 'AUTOCARAVANA', brand: 'Knaus', model: 'Sport TI 700 MEG' },
  { type: 'AUTOCARAVANA', brand: 'Laika', model: 'Ecovip L 3109' },
  { type: 'AUTOCARAVANA', brand: 'LMC', model: 'Explorer T 630 G' },
  { type: 'AUTOCARAVANA', brand: 'LMC', model: 'Innova 650 G' },
  { type: 'AUTOCARAVANA', brand: 'Niesmann+Bischoff', model: 'Flair i 930 LE' },
  { type: 'AUTOCARAVANA', brand: 'Pilote', model: 'G740 LJ Sensation' },
  { type: 'AUTOCARAVANA', brand: 'Pilote', model: 'Pacific P716' },
  { type: 'AUTOCARAVANA', brand: 'Rapido', model: '676' },
  { type: 'AUTOCARAVANA', brand: 'Rapido', model: '896F' },
  { type: 'AUTOCARAVANA', brand: 'Roller Team', model: 'Granduca 294' },
  { type: 'AUTOCARAVANA', brand: 'Roller Team', model: 'Kronos 695 M' },
  { type: 'AUTOCARAVANA', brand: 'Roller Team', model: 'Livingstone 5' },
  { type: 'AUTOCARAVANA', brand: 'Sunlight', model: 'A 70' },
  { type: 'AUTOCARAVANA', brand: 'Sunlight', model: 'T 68' },
  { type: 'AUTOCARAVANA', brand: 'Trigano', model: 'Tribute 640' },
  { type: 'AUTOCARAVANA', brand: 'Trigano', model: 'Vision 554' },
]

export function getBrandsByType(type: 'CAMPER' | 'AUTOCARAVANA'): string[] {
  const brands = new Set(VEHICLE_LIST.filter((v) => v.type === type).map((v) => v.brand))
  return Array.from(brands).sort()
}

export function getModelsByBrandAndType(brand: string, type: 'CAMPER' | 'AUTOCARAVANA'): string[] {
  return VEHICLE_LIST.filter((v) => v.type === type && v.brand === brand).map((v) => v.model)
}
