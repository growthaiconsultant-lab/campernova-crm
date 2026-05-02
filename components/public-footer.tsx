import Image from 'next/image'
import Link from 'next/link'

const FOOTER_LINKS = {
  Producto: [
    { href: '/vender', label: 'Vender tu camper' },
    { href: '/#como-funciona', label: 'Cómo funciona' },
    { href: '/#calculadora', label: 'Tasación gratuita' },
  ],
  Empresa: [{ href: '/contacto', label: 'Contacto' }],
  Legal: [
    { href: '/aviso-legal', label: 'Aviso legal' },
    { href: '/privacidad', label: 'Privacidad' },
    { href: '/cookies', label: 'Cookies' },
  ],
}

export function PublicFooter() {
  return (
    <footer className="bg-[#294e4c] px-4 pb-6 pt-12">
      <div className="container mx-auto max-w-6xl">
        {/* Main grid */}
        <div className="mb-10 grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="mb-4 inline-block">
              <Image
                src="/images/brand/Logo Campers Nova.png"
                alt="CampersNova"
                width={120}
                height={32}
                className="h-7 w-auto object-contain brightness-0 invert"
              />
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-white/55">
              Intermediación profesional para el mercado de campers y autocaravanas semi-nuevas en
              España.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([section, links]) => (
            <div key={section}>
              <p className="mb-3 text-sm font-semibold text-white">{section}</p>
              <ul className="space-y-2">
                {links.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-sm text-white/55 transition-colors hover:text-white"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/40 sm:flex-row">
          <p>© 2026 CampersNova · info@campersnova.com</p>
          <p>Hecho con ♥ en España</p>
        </div>
      </div>
    </footer>
  )
}
