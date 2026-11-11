import { z } from 'zod'
import { VEHICLE_ORIGIN_LABELS } from './seller-intake'
import { VEHICLE_STATUS_LABELS } from './state-machine'
import { formatEur } from './format/currency'

export const inventoryTypes = { CAMPER: 'Camper', AUTOCARAVANA: 'Autocaravana' }
export const inventoryOrders = {
  'createdAt:desc': 'Últimas altas',
  'createdAt:asc': 'Primeras altas',
  'salePrice:asc': 'Menor precio de venta',
  'salePrice:desc': 'Mayor precio de venta',
  'km:asc': 'Menos kilómetros',
  'km:desc': 'Más kilómetros',
  'year:desc': 'Año más reciente',
  'year:asc': 'Año más antiguo',
} as const

export const emptyCriteria = {
  brand: '',
  type: '',
  status: '',
  priceMax: '',
  yearMin: '',
  yearMax: '',
  kmMax: '',
  origin: '',
}
export type InventoryCriteria = typeof emptyCriteria
export type Criterion = keyof InventoryCriteria
export type InventoryOrder = keyof typeof inventoryOrders
export const criteriaKeys = Object.keys(emptyCriteria) as Criterion[]
export type InventoryParams = Record<string, string | string[] | undefined>
export function readInventoryParams(params: InventoryParams) {
  function read(key: string) {
    const value = params[key]
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? ''
  }
  const criteria = { ...emptyCriteria }
  for (const key of criteriaKeys) criteria[key] = read(key)
  criteria.priceMax = criteria.priceMax.replace(',', '.')
  const sort = read('sort') || 'createdAt'
  const orderKey =
    (sort === 'valuationRecommended' ? 'salePrice' : sort) +
    ':' +
    (read('dir') === 'asc' ? 'asc' : 'desc')
  const order: InventoryOrder = Object.hasOwn(inventoryOrders, orderKey)
    ? (orderKey as InventoryOrder)
    : 'createdAt:desc'
  const rawPage = Number(read('page'))
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1
  return { criteria, order, page }
}

const integer = z
  .string()
  .refine(
    (v) => v === '' || (/^\d+$/.test(v) && Number(v) <= 2147483647),
    'Introduce un número entero válido.'
  )
const inventorySchema = z
  .object({
    brand: z.string().max(200, 'Acorta la búsqueda a 200 caracteres.'),
    type: z
      .string()
      .refine((v) => !v || Object.hasOwn(inventoryTypes, v), 'Revisa el tipo de vehículo.'),
    status: z
      .string()
      .refine((v) => !v || Object.hasOwn(VEHICLE_STATUS_LABELS, v), 'Revisa el estado.'),
    origin: z
      .string()
      .refine((v) => !v || Object.hasOwn(VEHICLE_ORIGIN_LABELS, v), 'Revisa el origen.'),
    priceMax: z
      .string()
      .refine(
        (v) => !v || (/^\d+(?:\.\d{1,2})?$/.test(v) && Number(v) <= 99999999.99),
        'Introduce un precio entre 0 y 99.999.999,99 € con hasta dos decimales.'
      ),
    yearMin: integer,
    yearMax: integer,
    kmMax: integer,
  })
  .refine(
    (v) => !v.yearMin || !v.yearMax || Number(v.yearMin) <= Number(v.yearMax),
    'El año final debe ser igual o posterior al inicial.'
  )

export function inventoryError(criteria: InventoryCriteria) {
  const parsed = inventorySchema.safeParse(criteria)
  return parsed.success ? null : parsed.error.issues[0].message
}

export function inventoryUrl(criteria: InventoryCriteria, order: InventoryOrder, page = 1) {
  const params = new URLSearchParams()
  for (const key of criteriaKeys) if (criteria[key]) params.set(key, criteria[key])
  if (order !== 'createdAt:desc') {
    const [sort, dir] = order.split(':')
    params.set('sort', sort)
    params.set('dir', dir)
  }
  if (page > 1) params.set('page', String(page))
  return '/vehiculos' + (params.size ? '?' + params.toString() : '')
}

export function criterionLabel(key: Criterion, value: string) {
  switch (key) {
    case 'brand':
      return 'Búsqueda «' + value + '»'
    case 'type':
      return inventoryTypes[value as keyof typeof inventoryTypes] ?? value
    case 'status':
      return VEHICLE_STATUS_LABELS[value as keyof typeof VEHICLE_STATUS_LABELS] ?? value
    case 'origin':
      return VEHICLE_ORIGIN_LABELS[value as keyof typeof VEHICLE_ORIGIN_LABELS] ?? value
    case 'yearMin':
      return 'Desde ' + value
    case 'yearMax':
      return 'Hasta ' + value
    case 'priceMax':
      return (
        'Hasta ' +
        (Number.isFinite(Number(value)) ? formatEur(Number(value), 'cents') : value + ' €')
      )
    case 'kmMax':
      return (
        'Hasta ' +
        (Number.isFinite(Number(value)) ? Number(value).toLocaleString('es-ES') : value) +
        ' km'
      )
  }
}
