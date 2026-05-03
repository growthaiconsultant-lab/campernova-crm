import Image from 'next/image'
import Link from 'next/link'

const NAV_LINKS = [
  { href: '/comprar', label: 'Comprar' },
  { href: '/vender', label: 'Vender' },
  { href: '/como-funciona', label: 'Cómo funciona' },
  { href: '/sobre', label: 'Sobre nosotros' },
  { href: '/contacto', label: 'Contacto' },
]

const LEGAL_LINKS = [
  { href: '/aviso-legal', label: 'Aviso legal' },
  { href: '/privacidad', label: 'Privacidad' },
  { href: '/cookies', label: 'Cookies' },
]

export function PublicFooter() {
  return (
    <footer className="border-t border-cn-line bg-cn-cream-200 px-8 pb-8 pt-16 max-[640px]:px-5">
      <div className="mx-auto max-w-[1280px]">
        {/* Main grid: 1 col → 2 col → 4 col */}
        <div className="mb-14 grid grid-cols-2 gap-10 max-[640px]:grid-cols-1 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          {/* Brand column */}
          <div className="col-span-2 max-[640px]:col-span-1 lg:col-span-1">
            <Link href="/" className="inline-block">
              <Image
                src="/images/brand/Logo Campers Nova.png"
                alt="CampersNova"
                width={148}
                height={38}
                className="h-[38px] w-auto object-contain"
              />
            </Link>
            <p className="mt-3.5 max-w-[32ch] text-sm leading-relaxed text-cn-ink-500">
              Compraventa de campers y autocaravanas con acompañamiento profesional, transparente y
              cercano. Desde 2019.
            </p>

            {/* Google rating */}
            <div className="mt-4 flex items-center gap-2.5">
              <div className="flex items-center gap-0.5 text-cn-terra-500">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg
                    key={i}
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
                  </svg>
                ))}
              </div>
              <span className="text-sm text-cn-ink-500">
                <strong className="font-semibold text-cn-teal-900">4,6</strong>
                {' · '}36 reseñas en Google
              </span>
            </div>
          </div>

          {/* Explora */}
          <div>
            <h5 className="mb-[18px] text-[11px] font-semibold uppercase tracking-[0.12em] text-cn-teal-900">
              Explora
            </h5>
            <ul className="flex flex-col gap-2.5">
              {NAV_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-cn-ink-700 transition-colors hover:text-cn-teal-900"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h5 className="mb-[18px] text-[11px] font-semibold uppercase tracking-[0.12em] text-cn-teal-900">
              Contacto
            </h5>
            <ul className="flex flex-col gap-2.5">
              <li>
                <a
                  href="tel:+34629925821"
                  className="text-sm text-cn-ink-700 transition-colors hover:text-cn-teal-900"
                >
                  629 92 58 21
                </a>
              </li>
              <li>
                <a
                  href="mailto:info@campersnova.com"
                  className="text-sm text-cn-ink-700 transition-colors hover:text-cn-teal-900"
                >
                  info@campersnova.com
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/campersnova/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-cn-ink-700 transition-colors hover:text-cn-teal-900"
                >
                  Instagram · @campersnova
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/34629925821"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-cn-ink-700 transition-colors hover:text-cn-teal-900"
                >
                  WhatsApp directo
                </a>
              </li>
              <li>
                <a
                  href="https://www.google.com/maps/dir//CAMPERS+NOVA,+SL,+Carrer+Torre+de+Cellers,+08150,+Barcelona"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm leading-snug text-cn-ink-700 transition-colors hover:text-cn-teal-900"
                >
                  Carrer Torre de Cellers
                  <br />
                  08150 Barcelona
                </a>
              </li>
            </ul>
          </div>

          {/* Horario + Legal */}
          <div>
            <h5 className="mb-[18px] text-[11px] font-semibold uppercase tracking-[0.12em] text-cn-teal-900">
              Horario
            </h5>
            <ul className="flex flex-col gap-2.5">
              {[
                { day: 'Lun – Vie', hours: '10:00 – 19:00' },
                { day: 'Sábado', hours: '10:00 – 13:00' },
                { day: 'Domingo', hours: 'Cerrado' },
              ].map(({ day, hours }) => (
                <li
                  key={day}
                  className="flex items-center justify-between gap-3 text-[13px] text-cn-ink-700"
                >
                  <span>{day}</span>
                  <span className="font-mono text-[12px] tracking-[0.04em] text-cn-teal-900">
                    {hours}
                  </span>
                </li>
              ))}
            </ul>

            {/* Legal links */}
            <div className="mt-8 flex flex-col gap-2">
              {LEGAL_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="text-[13px] text-cn-ink-500 transition-colors hover:text-cn-teal-900"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-start justify-between gap-2 border-t border-cn-line pt-6 sm:flex-row sm:items-center">
          <span className="font-mono text-[12px] tracking-[0.06em] text-cn-ink-500">
            © 2026 CAMPERS NOVA, S.L. · CIF B-12345678
          </span>
          <span className="font-mono text-[12px] tracking-[0.06em] text-cn-ink-500">
            BARCELONA · 08150
          </span>
        </div>
      </div>
    </footer>
  )
}
