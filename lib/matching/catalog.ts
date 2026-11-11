import { z } from 'zod'
import { RV_BED_OPTIONS, RV_CATEGORY_OPTIONS } from '@/lib/rv-taxonomy'

export type Field = {
  id: string
  group: string
  label: string
  kind: 'option' | 'min' | 'max' | 'text'
  options?: string[]
  family?: 'CAMPER' | 'AUTOCARAVANA'
}
const fields: Field[] = []
function group(group: string, entries: [string, string, string?][], family?: Field['family']) {
  for (const [id, label, spec = 'Sí|No'] of entries) {
    const kind = spec === 'min' || spec === 'max' || spec === 'text' ? spec : 'option'
    fields.push({
      id,
      group,
      label,
      kind,
      options: kind === 'option' ? spec.split('|') : undefined,
      family,
    })
  }
}
group('Vehículo y cabina', [
  ['family', 'Familia', 'Camper|Autocaravana'],
  [
    'format',
    'Formato',
    [...RV_CATEGORY_OPTIONS.map((o) => o.label), 'Compacta', 'Tipo California'].join('|'),
  ],
  ['origin', 'Procedencia', 'Nacional|Importado'],
  ['brand', 'Marca de cabina', 'text'],
  ['model', 'Modelo de cabina', 'text'],
  ['engine', 'Motorización', 'text'],
  ['power', 'Potencia (CV)', 'min'],
  ['km', 'Kilometraje (km)', 'max'],
  ['gearbox', 'Cambio', 'Manual|Automático'],
  ['drive', 'Tracción', 'Delantera|Trasera|4×4'],
  ['cabAir', 'Aire acondicionado de cabina'],
  ['assist', 'Equipamiento de conducción', 'text'],
  ['parking', 'Cámara o sensores de aparcamiento'],
  ['cabOther', 'Otros extras de cabina', 'text'],
  ['year', 'Año de matriculación', 'min'],
])
group(
  'Camperización y techo',
  [
    ['conversion', 'Camperización', 'De fábrica|Profesional|Artesanal'],
    ['roof', 'Tipo de techo', 'Alto de fábrica|Alto|Elevable|Rígido'],
    ['roofLift', 'Accionamiento del techo', 'Manual|Eléctrico'],
    ['roofBed', 'Cama en el techo'],
  ],
  'CAMPER'
)
group('Camas y salón', [
  [
    'beds',
    'Distribuciones de cama',
    [
      ...RV_BED_OPTIONS.map((o) => o.label),
      'Capuchina',
      'Superior',
      'Doble fija',
      'Elevable',
      'Supletoria en techo',
    ].join('|'),
  ],
  ['bedLift', 'Accionamiento de cama elevable', 'Manual|Eléctrico'],
  ['bedOther', 'Otras distribuciones', 'text'],
  ['lounge', 'Distribución del salón', 'Face to face|En L|En U|Clásico'],
  ['dining', 'Ubicación del comedor', 'Delantero|Trasero'],
  ['swivel', 'Asientos giratorios'],
])
group('Cocina', [
  ['kitchen', 'Cocina instalada'],
  ['kitchenPlace', 'Ubicación de cocina', 'Lateral|Trasera|Exterior'],
  ['kitchenShape', 'Forma de cocina', 'En L|Con isla'],
  ['kitchenMount', 'Montaje', 'Fija|Extraíble'],
  ['fridge', 'Tamaño de nevera', 'Grande|Pequeña'],
  ['fridgeLitres', 'Capacidad de nevera (litros)', 'min'],
  ['cooling', 'Tecnología de nevera', 'Trivalente|De compresor'],
  ['freezer', 'Congelador'],
  ['oven', 'Horno'],
  ['microwave', 'Microondas'],
  ['kitchenOther', 'Tipo de cocina y otros equipos', 'text'],
])
group('Baño', [
  ['interiorBath', 'Baño interior'],
  ['fullBath', 'Baño completo'],
  ['shower', 'Ducha'],
  [
    'showerOptions',
    'Opciones de ducha',
    'Interior|Independiente del inodoro|Integrada|Exterior|Sin baño interior',
  ],
  ['bathRear', 'Baño trasero'],
  ['wc', 'Inodoro', 'Fijo|Portátil'],
  ['pullBath', 'Baño extraíble'],
  ['indBath', 'Baño independiente'],
  ['bathOther', 'Otros tipos de baño', 'text'],
])
group('Vivienda y autonomía', [
  ['aircon', 'Aire acondicionado de vivienda'],
  ['heating', 'Calefacción'],
  ['stationary', 'Calefacción estacionaria'],
  ['hotWater', 'Agua caliente'],
  ['solar', 'Placas solares'],
  ['battery', 'Baterías auxiliares', 'Litio|AGM|Gel'],
  ['inverter', 'Inversor'],
  ['autonomy', 'Autonomía (horas en condiciones comparables)', 'min'],
  ['electrics', 'Instalación eléctrica y condiciones de autonomía', 'text'],
  ['water', 'Agua limpia (litros)', 'min'],
  ['grey', 'Aguas grises (litros)', 'min'],
  ['deposits', 'Otros depósitos', 'text'],
  ['tv', 'TV'],
  ['antenna', 'Antena'],
  ['skylight', 'Claraboyas'],
  ['windows', 'Ventanas'],
  ['blinds', 'Mosquiteras y oscurecedores'],
  ['insulation', 'Aislamiento', 'text'],
  ['furniture', 'Mobiliario', 'text'],
  ['storage', 'Almacenamiento', 'text'],
  ['garage', 'Garaje'],
  ['garageSize', 'Tamaño del garaje', 'Grande|Pequeño'],
  ['garageBikes', 'Bicicletas que caben dentro (verificadas)', 'min'],
  ['extras', 'Otros extras de vivienda', 'text'],
])
group('Exterior', [
  ['awning', 'Toldo'],
  ['bikes', 'Portabicicletas'],
  ['moto', 'Portamotos'],
  ['towbar', 'Enganche de remolque'],
  ['suspension', 'Suspensión neumática'],
  ['wheels', 'Llantas especiales'],
  ['tyres', 'Neumáticos All Terrain'],
  ['legs', 'Patas estabilizadoras'],
  ['alarm', 'Alarma o sistema de seguridad'],
  ['otherExterior', 'Otros accesorios', 'text'],
])
group(
  'Necesidades concretas',
  Array.from(
    { length: 5 },
    (_, i) =>
      ['use' + (i + 1), 'Uso o requisito concreto ' + (i + 1), 'text'] as [string, string, string]
  )
)
export const catalogFields: readonly Field[] = fields
export const fieldById = new Map(fields.map((f) => [f.id, f]))
export type Entry = { values: string[]; required?: boolean; all?: boolean }
export type Catalog = Record<string, Entry>
const entry = z
  .object({
    values: z.array(z.string().trim().min(1).max(300)).min(1).max(24),
    required: z.boolean().optional(),
    all: z.boolean().optional(),
  })
  .strict()
export const catalogSchema = z.record(z.string(), entry).superRefine((data, ctx) => {
  for (const [key, e] of Object.entries(data)) {
    const f = fieldById.get(key)
    if (
      !f ||
      new Set(e.values).size !== e.values.length ||
      (f.kind !== 'option' && e.values.length !== 1) ||
      (f.kind === 'option' &&
        e.values.some(
          (v) => !f.options?.includes(v) && !(v === 'No tiene' && e.values.length === 1)
        )) ||
      (f.options?.join('|') === 'Sí|No' && e.values.length !== 1) ||
      ((f.kind === 'min' || f.kind === 'max') && !/^\d{1,8}(\.\d{1,2})?$/.test(e.values[0]))
    )
      ctx.addIssue({ code: 'custom', message: 'Característica no válida', path: [key] })
  }
})
export function readCatalog(value: unknown): Catalog {
  const result = catalogSchema.safeParse(value)
  return result.success ? result.data : {}
}

export const familyLabel = (type: string | null) =>
  type === 'AUTOCARAVANA' ? 'Autocaravana' : type === 'CAMPER' ? 'Camper' : undefined

export function buyerCatalogPreferences(
  b: {
    vehicleType: string | null
    preferredCategory: string | null
    preferredBedLayout: string | null
    criticalEquipment: Record<string, boolean> | null
    needsGarage?: boolean | null
  },
  catalog?: Catalog
): Catalog {
  const prefs: Catalog = { ...catalog }
  function pref(id: string, val: string | undefined, required = false) {
    if (val && !prefs[id]) prefs[id] = { values: [val], required }
    else if (required && val && prefs[id]?.values.includes(val))
      prefs[id] = { ...prefs[id], required: true }
  }
  pref('family', familyLabel(b.vehicleType))
  pref('format', RV_CATEGORY_OPTIONS.find((o) => o.value === b.preferredCategory)?.label)
  pref('beds', RV_BED_OPTIONS.find((o) => o.value === b.preferredBedLayout)?.label)
  for (const key of ['solar', 'heating', 'shower', 'kitchen'] as const) {
    if (b.criticalEquipment?.[key]) pref(key, 'Sí', true)
  }
  if (b.needsGarage) pref('garage', 'Sí', true)
  return prefs
}
