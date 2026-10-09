export const CONSENT_KEY = 'cn_cookie_consent'
export const CONSENT_EVENT = 'cn:consent'

declare global {
  interface Window {
    CNConsent?: {
      get(): 'all' | 'essential' | null
      isAllowed(): boolean
      set(value: 'all' | 'essential'): void
      onAccept(callback: () => void): void
      trackMeta(...args: unknown[]): boolean
      flushMeta(): void
    }
  }
}
