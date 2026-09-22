import { describe, expect, it } from 'vitest'
import { createLatestSearchRequest } from './latest-search-request'

describe('createLatestSearchRequest', () => {
  it('sólo acepta la búsqueda iniciada más recientemente', () => {
    const requests = createLatestSearchRequest()
    const first = requests.begin()
    const second = requests.begin()

    expect(requests.isCurrent(first)).toBe(false)
    expect(requests.isCurrent(second)).toBe(true)
  })

  it('invalida una respuesta pendiente al cerrar o limpiar el buscador', () => {
    const requests = createLatestSearchRequest()
    const pending = requests.begin()

    requests.invalidate()

    expect(requests.isCurrent(pending)).toBe(false)
  })
})
