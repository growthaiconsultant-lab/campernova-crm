import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

const script = readFileSync('public/cn-landing/visit-source.js', 'utf8')
const home = 'https://campersnova.com'
function tab() {
  const storage = new Map<string, string>()
  return (search = '', referrer = '', type = 'navigate') => {
    const window = {} as { CNLandingVisit: { fromMeta: boolean; params: Record<string, string> } }
    runInNewContext(script, {
      window,
      location: { origin: home, search },
      document: { referrer },
      performance: { getEntriesByType: () => [{ type }] },
      URL,
      URLSearchParams,
      sessionStorage: {
        getItem: (k: string) => storage.get(k),
        setItem: (k: string, v: string) => storage.set(k, v),
      },
    })
    return window.CNLandingVisit.fromMeta
  }
}
describe('destino de las landings por visita', () => {
  it.each([
    ['?utm_source=FB', '', true],
    ['?utm_source=ig', '', true],
    ['?utm_source=meta', '', true],
    ['?fbclid=click', '', true],
    ['', 'https://l.instagram.com/', true],
    ['', 'https://m.facebook.com/', true],
    ['?utm_source=google&fbclid=click', '', false],
    ['?utm_source=newsletter', 'https://l.facebook.com/', false],
    ['?gclid=click', 'https://www.instagram.com/', false],
    ['?ad_id=123', '', false],
    ['?utm_source={{site_source_name}}', '', false],
    ['', 'https://notfacebook.com/', false],
    ['', 'https://facebook.com.example.org/', false],
    ['', '', false],
  ] as const)('origen %s / %s → %s', (query, ref, expected) =>
    expect(tab()(query, ref)).toBe(expected)
  )
  it('conserva la procedencia entre la portada y la landing, pero la sustituye al empezar otra visita', () => {
    const visit = tab()
    expect(visit('?utm_source=instagram')).toBe(true)
    expect(visit('', home + '/')).toBe(true)
    expect(visit('', '', 'reload')).toBe(true)
    expect(visit('', 'https://www.google.es/')).toBe(false)
    expect(visit('', home + '/catalogo')).toBe(false)
    expect(visit('?fbclid=click')).toBe(true)
    expect(visit()).toBe(false)
  })
})
