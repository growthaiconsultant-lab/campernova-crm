import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { CONSENT_EVENT, CONSENT_KEY } from './consent'
const code = readFileSync(new URL('../public/cn-landing/cn-consent.js', import.meta.url), 'utf8')
const metaTag = readFileSync(
  new URL('../docs/analytics/gtm-meta-base.html', import.meta.url),
  'utf8'
).match(/<script>([\s\S]*?)<\/script>/)![1]
function setup(stored: string | null = null, blocked = false) {
  const target = new EventTarget()
  const window = Object.assign(target, {
    localStorage: {
      getItem: vi.fn(() => {
        if (blocked) throw Error('blocked')
        return stored
      }),
      setItem: vi.fn(() => {
        if (blocked) throw Error('blocked')
      }),
    },
    dataLayer: [] as unknown[],
    CNConsent: undefined as Window['CNConsent'],
    fbq: undefined as undefined | ReturnType<typeof vi.fn>,
  })
  runInNewContext(code, { window, CustomEvent })
  return window
}
describe('common browser consent', () => {
  it('the exact GTM base tag respects consent and initializes only one PageView, no conversions', () => {
    const w = setup(),
      insert = vi.fn()
    const document = {
      createElement: () => ({}),
      getElementsByTagName: () => [{ parentNode: { insertBefore: insert } }],
    }
    const run = () => runInNewContext(metaTag, { window: w, document })
    run()
    expect(insert).not.toHaveBeenCalled()
    w.CNConsent!.set('all')
    run()
    run()
    expect(insert).toHaveBeenCalledOnce()
    const queue = (w.fbq as unknown as { queue: ArrayLike<unknown>[] }).queue.map((a) =>
      Array.from(a)
    )
    expect(queue.filter((a) => a[0] === 'init')).toEqual([['init', '1409201494758945']])
    expect(queue.filter((a) => a[0] === 'track')).toEqual([['track', 'PageView']])
    expect(queue).toContainEqual(['set', 'autoConfig', false, '1409201494758945'])
    w.CNConsent!.trackMeta('track', 'Lead', { content_name: 'qa' })
    w.CNConsent!.set('essential')
    expect(
      (w.fbq as unknown as { queue: ArrayLike<unknown>[] }).queue
        .map((a) => Array.from(a))
        .filter((a) => a[0] === 'track')
    ).toHaveLength(0)
  })
  it.each([null, 'essential', 'unknown'])('does not start measurement with %s', (stored) => {
    const w = setup(stored),
      load = vi.fn()
    w.CNConsent!.onAccept(load)
    expect(load).not.toHaveBeenCalled()
    expect(w.CNConsent!.trackMeta('track', 'Contact', { content_name: 'qa' })).toBe(false)
    expect(Array.from(w.dataLayer[0] as ArrayLike<unknown>)).toEqual([
      'consent',
      'default',
      {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      },
    ])
  })
  it('loads once after acceptance, shares the web key and never duplicates on reacceptance', () => {
    const w = setup(),
      load = vi.fn()
    w.CNConsent!.onAccept(load)
    w.CNConsent!.set('all')
    w.CNConsent!.set('all')
    expect(load).toHaveBeenCalledTimes(1)
    expect(w.localStorage.setItem).toHaveBeenCalledWith(CONSENT_KEY, 'all')
    expect(w.CNConsent!.get()).toBe('all')
    expect(Array.from(w.dataLayer[1] as ArrayLike<unknown>)).toEqual([
      'consent',
      'update',
      {
        analytics_storage: 'granted',
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted',
      },
    ])
  })
  it('restores granted consent before the GTM loader runs', () => {
    const w = setup('all'),
      load = vi.fn()
    w.CNConsent!.onAccept(load)
    expect(load).toHaveBeenCalledOnce()
    expect(w.CNConsent!.isAllowed()).toBe(true)
  })
  it('allows an explicit choice in memory when storage is blocked', () => {
    const w = setup(null, true),
      load = vi.fn()
    w.CNConsent!.onAccept(load)
    expect(w.CNConsent!.isAllowed()).toBe(false)
    w.CNConsent!.set('all')
    expect(load).toHaveBeenCalledOnce()
    expect(w.CNConsent!.isAllowed()).toBe(true)
  })
  it('queues only consented events while Meta loads and flushes them exactly once', () => {
    const w = setup()
    expect(w.CNConsent!.trackMeta('track', 'Contact')).toBe(false)
    w.CNConsent!.set('all')
    expect(
      w.CNConsent!.trackMeta('track', 'Lead', { content_name: 'qa' }, { eventID: 'qa_event' })
    ).toBe(true)
    w.fbq = vi.fn()
    w.CNConsent!.flushMeta()
    w.CNConsent!.flushMeta()
    expect(w.fbq).toHaveBeenCalledExactlyOnceWith(
      'track',
      'Lead',
      { content_name: 'qa' },
      { eventID: 'qa_event' }
    )
  })
  it('clears pending events and revokes Meta when consent changes in this or another tab', () => {
    const w = setup('all')
    w.CNConsent!.trackMeta('track', 'Lead')
    w.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: 'essential' }))
    w.fbq = vi.fn()
    w.CNConsent!.flushMeta()
    expect(w.fbq).not.toHaveBeenCalled()
    w.CNConsent!.set('all')
    const storage = new Event('storage')
    Object.assign(storage, { key: CONSENT_KEY, newValue: null })
    w.dispatchEvent(storage)
    expect(w.fbq).toHaveBeenLastCalledWith('consent', 'revoke')
    expect(w.CNConsent!.trackMeta('track', 'Contact')).toBe(false)
  })
})
