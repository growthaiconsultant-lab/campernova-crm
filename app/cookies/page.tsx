import type { Metadata } from 'next'
import { LegalLayout } from '@/components/legal-layout'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Política de Cookies — CampersNova',
  description: 'Información sobre el uso de cookies en campersnova.com.',
}

export default function CookiesPage() {
  return (
    <LegalLayout title="Política de Cookies" lastUpdated="Mayo 2026">
      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">1. ¿Qué son las cookies?</h2>
        <p className="text-muted-foreground">
          Las cookies son pequeños archivos de texto que los sitios web almacenan en tu dispositivo
          cuando los visitas. Permiten que el sitio recuerde tus preferencias y analice cómo se usa
          para mejorarlo.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">2. Cookies que utilizamos</h2>
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-foreground">Cookie</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Tipo</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Finalidad</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Duración</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  cn_cookie_consent
                </td>
                <td className="px-4 py-3 text-muted-foreground">Técnica</td>
                <td className="px-4 py-3 text-muted-foreground">
                  Guarda tu preferencia sobre cookies analíticas
                </td>
                <td className="px-4 py-3 text-muted-foreground">1 año</td>
              </tr>
              <tr className="bg-muted/20">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  sb-* (Supabase)
                </td>
                <td className="px-4 py-3 text-muted-foreground">Técnica</td>
                <td className="px-4 py-3 text-muted-foreground">
                  Gestión de sesión autenticada en el backoffice
                </td>
                <td className="px-4 py-3 text-muted-foreground">Sesión</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  ph_* (PostHog)
                </td>
                <td className="px-4 py-3 text-muted-foreground">Analítica</td>
                <td className="px-4 py-3 text-muted-foreground">
                  Análisis de uso del sitio web (anónimo y agregado)
                </td>
                <td className="px-4 py-3 text-muted-foreground">1 año</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Las cookies técnicas son necesarias para el funcionamiento del sitio y no requieren
          consentimiento. Las cookies analíticas solo se activan si aceptas su uso.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">
          3. Cómo gestionar las cookies
        </h2>
        <p className="text-muted-foreground">
          Puedes gestionar tus preferencias de cookies en cualquier momento:
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            Mediante el <strong className="text-foreground">banner de cookies</strong> que aparece
            en tu primera visita al sitio.
          </li>
          <li>
            Borrando las cookies desde la configuración de tu navegador (esto restablece tus
            preferencias y el banner volverá a mostrarse).
          </li>
        </ul>
        <p className="mt-3 text-muted-foreground">
          Puedes consultar cómo gestionar cookies en los principales navegadores:
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            <a
              href="https://support.google.com/chrome/answer/95647"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#294e4c] hover:underline"
            >
              Google Chrome
            </a>
          </li>
          <li>
            <a
              href="https://support.mozilla.org/es/kb/habilitar-y-deshabilitar-cookies-que-los-sitios-we"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#294e4c] hover:underline"
            >
              Mozilla Firefox
            </a>
          </li>
          <li>
            <a
              href="https://support.apple.com/es-es/guide/safari/sfri11471/mac"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#294e4c] hover:underline"
            >
              Safari
            </a>
          </li>
          <li>
            <a
              href="https://support.microsoft.com/es-es/windows/eliminar-y-administrar-cookies-168dab11-0753-043d-7c16-ede5947fc64d"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#294e4c] hover:underline"
            >
              Microsoft Edge
            </a>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">4. Más información</h2>
        <p className="text-muted-foreground">
          Para más información sobre cómo tratamos tus datos personales, consulta nuestra{' '}
          <Link href="/privacidad" className="text-[#294e4c] hover:underline">
            Política de Privacidad
          </Link>
          . Si tienes dudas, escríbenos a{' '}
          <a href="mailto:info@campersnova.com" className="text-[#294e4c] hover:underline">
            info@campersnova.com
          </a>
          .
        </p>
      </section>
    </LegalLayout>
  )
}
