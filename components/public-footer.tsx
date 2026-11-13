/* eslint-disable @next/next/no-img-element -- Las campañas estáticas utilizan el mismo marcado. */
import React from 'react'
import { publicNavigation } from '../lib/public-navigation'

const footerLinks = [
  ...publicNavigation.filter((link) => link.href !== '/'),
  { href: '/comprar/campers', label: 'Campers en venta' },
  { href: '/comprar/autocaravanas', label: 'Autocaravanas en venta' },
  { href: '/comprar/marcas', label: 'Por marca' },
  { href: '/#taller', label: 'Taller' },
  { href: '/#garantias', label: 'Garantías y posventa' },
  { href: '/#tienda', label: 'Tienda online' },
]

const whatsappLinks = {
  comprar:
    'https://wa.me/34645639185?text=Hola%20Esteban%2C%20vengo%20del%20anuncio%20y%20estoy%20buscando%20camper.',
  vender:
    'https://wa.me/34645639185?text=Hola%2C%20vengo%20del%20anuncio%20de%20tasaci%C3%B3n%20y%20quiero%20vender%20mi%20camper.',
  general: 'https://wa.me/34645639185',
}

export function PublicFooter({ campaign = 'general' }: { campaign?: keyof typeof whatsappLinks }) {
  const whatsapp = whatsappLinks[campaign]
  return (
    <footer className="cn-site-footer">
      <div className="pie-inner">
        <div className="pie-top">
          <div className="pie-marca">
            <a href="/" aria-label="CampersNova, inicio">
              <img
                className="pie-logo"
                src="/cn-landing/img/logo-cn.png"
                alt="Campers Nova"
                width="128"
                height="56"
                loading="lazy"
              />
            </a>
            <p className="pie-lema">
              Campers y autocaravanas de ocasión en Parets del Vallès desde 2019.
            </p>
            <a className="pie-wa" href={whatsapp} target="_blank" rel="noopener">
              <img
                src="/cn-landing/media/av-esteban.jpg?v=57"
                alt=""
                width="48"
                height="48"
                loading="lazy"
              />
              <span>
                <b>Habla con Esteban</b>
                <small>Por WhatsApp, sin compromiso</small>
              </span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14" />
                <path d="M13 5l7 7-7 7" />
              </svg>
            </a>
          </div>
          <div className="pie-col">
            <p className="pie-h">Visítanos</p>
            <address className="pie-dir">
              Carrer Torre de Cellers, 1<br />
              08150 Parets del Vallès
              <br />
              Barcelona
            </address>
            <a
              className="pie-link"
              href="https://www.google.com/maps/search/?api=1&amp;query=Campers%20Nova%2C%20Carrer%20Torre%20de%20Cellers%201%2C%2008150%20Parets%20del%20Vall%C3%A8s"
              target="_blank"
              rel="noopener"
            >
              Cómo llegar
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M7 17L17 7" />
                <path d="M8 7h9v9" />
              </svg>
            </a>
          </div>
          <div className="pie-col">
            <p className="pie-h">Horario</p>
            <ul className="pie-hor">
              <li>
                <span>Lunes a viernes</span>
                <b>10:00–19:00</b>
              </li>
              <li>
                <span>Sábado</span>
                <b>10:00–13:00</b>
              </li>
              <li>
                <span>Domingo</span>
                <b>Cerrado</b>
              </li>
            </ul>
            {React.createElement('cn-footer-hours', { class: 'pie-ahora', hidden: true })}
          </div>
          <div className="pie-col">
            <p className="pie-h">Contacto</p>
            <ul className="pie-ct">
              <li>
                <a href="tel:+34645639185">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
                  </svg>
                  +34 645 63 91 85
                </a>
              </li>
              <li>
                <a href="mailto:info@campersnova.com">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="5" width="18" height="14" rx="2.5" />
                    <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
                  </svg>
                  info@campersnova.com
                </a>
              </li>
              <li>
                <a href="https://www.instagram.com/campersnova/" target="_blank" rel="noopener">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r=".6" fill="currentColor" />
                  </svg>
                  @campersnova
                </a>
              </li>
            </ul>
          </div>
        </div>
        <nav className="pie-nav" aria-label="Enlaces de la web">
          {footerLinks.map(({ href, label }) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
        <div className="pie-bot">
          <span>© 2026 Campers Nova, S.L. · CIF B-22466874</span>
          <nav aria-label="Textos legales">
            <a href="/aviso-legal" target="_blank" rel="noopener">
              Aviso legal
            </a>
            <a href="/privacidad" target="_blank" rel="noopener">
              Privacidad
            </a>
            <a href="/cookies" target="_blank" rel="noopener">
              Cookies
            </a>
          </nav>
        </div>
      </div>
    </footer>
  )
}
