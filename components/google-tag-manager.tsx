'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'
import { CONSENT_KEY, CONSENT_EVENT } from '@/lib/consent'

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID

function getConsent(): string | null {
  try {
    return localStorage.getItem(CONSENT_KEY)
  } catch {
    return null
  }
}

/**
 * Carga Google Tag Manager solo cuando el usuario acepta las cookies analíticas
 * ("Aceptar todas"). Mismo modelo de consentimiento que PostHog
 * (ver components/posthog-provider.tsx): nada se carga antes del consentimiento,
 * coherente con RGPD/AEPD.
 *
 * GA4 se configura DENTRO del contenedor GTM (etiqueta "Configuración de Google
 * Analytics: GA4"), no aquí. La web solo necesita el ID del contenedor
 * (NEXT_PUBLIC_GTM_ID, formato GTM-XXXXXXX).
 *
 * Limitación del modelo estricto: una vez cargado, GTM no puede "descargarse" en
 * la misma sesión si el usuario revoca el consentimiento en otra pestaña. El caso
 * es marginal (la elección se persiste en la 1ª visita). Si en el futuro se
 * necesita control fino post-carga o conversiones modeladas para Google Ads,
 * migrar a Consent Mode v2 (se configura dentro de GTM).
 */
export function GoogleTagManager() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const apply = (consent: string | null) => setEnabled(consent === 'all')
    apply(getConsent())

    // Cambios de consentimiento en la misma pestaña (los emite CookieBanner)
    const onConsent = (e: Event) => apply((e as CustomEvent<string>).detail)
    window.addEventListener(CONSENT_EVENT, onConsent)

    // Cambios de consentimiento entre pestañas
    const onStorage = (e: StorageEvent) => {
      if (e.key === CONSENT_KEY) apply(e.newValue)
    }
    window.addEventListener('storage', onStorage)

    return () => {
      window.removeEventListener(CONSENT_EVENT, onConsent)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  if (!GTM_ID || !enabled) return null

  return (
    <Script id="gtm-init" strategy="afterInteractive">
      {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
    </Script>
  )
}
