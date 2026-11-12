import React from 'react'
import { publicNavigation, publicMenuSection } from '../lib/public-navigation'

/** Also rendered into the two static campaign pages by scripts/sync-public-menu.tsx. */
export function PublicMenu({
  pathname,
  transparent = false,
}: {
  pathname: string
  transparent?: boolean
}) {
  const section = publicMenuSection(pathname)
  const items = publicNavigation.map(({ href, label }) => (
    <a
      key={href}
      href={href}
      aria-current={
        section === href
          ? pathname.replace(/\.html$/, '') === href
            ? 'page'
            : 'location'
          : undefined
      }
    >
      {label}
    </a>
  ))
  return (
    <header className={transparent ? 'cn-site-menu cn-site-over-photo' : 'cn-site-menu'}>
      <div className="cn-site-menu-inner">
        <a href="/" aria-label="CampersNova, inicio">
          {/* The same native image markup is used in the standalone campaign pages. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="cn-site-logo"
            src="/cn-landing/img/logo-cn-crema.png"
            width="94"
            height="42"
            alt="CampersNova"
          />
        </a>
        <nav className="cn-site-links" aria-label="Navegación principal">
          {items}
        </nav>
        <details className="cn-site-drawer">
          <summary>
            Menú <span aria-hidden="true">☰</span>
          </summary>
          <nav className="cn-site-mobile-links" aria-label="Menú móvil">
            {items}
          </nav>
        </details>
      </div>
    </header>
  )
}
