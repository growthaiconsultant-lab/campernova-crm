'use client'

import Script from 'next/script'
import '@/lib/consent'

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID

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
 * cn-consent.js aplica el mismo gate en HTML estático y Next, actualiza Consent
 * Mode y revoca Meta si cambia la elección. El loader se ejecuta una sola vez.
 */
export function GoogleTagManager() {
  if (!GTM_ID || !/^GTM-[A-Z0-9]+$/.test(GTM_ID)) return null

  return (
    <Script id="gtm-init" strategy="afterInteractive">
      {`window.CNConsent && window.CNConsent.onAccept(function(){(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');});`}
    </Script>
  )
}
