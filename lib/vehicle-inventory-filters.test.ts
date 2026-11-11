import { expect, it } from 'vitest'
import {
  emptyCriteria,
  inventoryError,
  inventoryUrl,
  readInventoryParams,
} from './vehicle-inventory-filters'

it('conserva enlaces del inventario y elimina la página al cambiar criterios', () => {
  const { criteria, order, page } = readInventoryParams({
    brand: ' Crafter ',
    priceMax: '60000,10',
    sort: 'valuationRecommended',
    dir: 'asc',
    page: '2',
  })
  expect(criteria).toEqual({ ...emptyCriteria, brand: 'Crafter', priceMax: '60000.10' })
  expect(order).toBe('salePrice:asc')
  expect(page).toBe(2)
  expect(inventoryUrl(criteria, order)).toBe(
    '/vehiculos?brand=Crafter&priceMax=60000.10&sort=salePrice&dir=asc'
  )
  expect(inventoryUrl(emptyCriteria, 'createdAt:desc')).toBe('/vehiculos')
})
it('valida intervalos, enums y números completos, incluido un límite cero', () => {
  expect(
    inventoryError({
      ...emptyCriteria,
      priceMax: '0',
      kmMax: '0',
      yearMin: '2020',
      yearMax: '2020',
    })
  ).toBeNull()
  for (const input of [
    { priceMax: '3e2' },
    { yearMin: '2020abc' },
    { priceMax: '-1' },
    { kmMax: '1.7' },
    { yearMin: '2023', yearMax: '2022' },
    { type: 'otro' },
    { status: 'toString' },
    { origin: 'otra' },
  ]) {
    expect(inventoryError({ ...emptyCriteria, ...input })).toBeTruthy()
  }
})

it('sin precio limpia el máximo y conserva los filtros compatibles al reabrir el enlace', () => {
  const { criteria, order } = readInventoryParams({
    priceState: 'missing',
    priceMax: '50000',
    status: 'DESCARTADO',
  })
  expect(criteria).toMatchObject({ priceState: 'missing', priceMax: '', status: 'DESCARTADO' })
  expect(inventoryUrl(criteria, order)).toBe('/vehiculos?status=DESCARTADO&priceState=missing')
  expect(inventoryError({ ...criteria, priceState: 'otro' })).toBeTruthy()
})
