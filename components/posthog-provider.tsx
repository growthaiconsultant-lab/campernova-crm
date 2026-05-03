'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'
import { CONSENT_KEY, CONSENT_EVENT } from '@/lib/consent'

function getConsent(): string | null {
  try {
    return localStorage.getItem(CONSENT_KEY)
  } catch {
    return null
  }
}

function applyConsent(consent: string | null) {
  if (consent === 'all') {
    posthog.opt_in_capturing()
  } else {
    posthog.opt_out_capturing()
  }
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST

    if (!key || posthog.__loaded) return

    posthog.init(key, {
      api_host: host ?? 'https://eu.posthog.com',
      ui_host: 'https://eu.posthog.com',
      opt_out_capturing_by_default: true,
      capture_pageview: true,
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
      loaded: () => applyConsent(getConsent()),
    })

    // Same-tab consent changes (dispatched by CookieBanner)
    const onConsent = (e: Event) => applyConsent((e as CustomEvent<string>).detail)
    window.addEventListener(CONSENT_EVENT, onConsent)

    // Cross-tab consent changes
    const onStorage = (e: StorageEvent) => {
      if (e.key === CONSENT_KEY) applyConsent(e.newValue)
    }
    window.addEventListener('storage', onStorage)

    return () => {
      window.removeEventListener(CONSENT_EVENT, onConsent)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
