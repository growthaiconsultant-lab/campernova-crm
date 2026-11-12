import Image from 'next/image'
import Link from 'next/link'
import { BUSINESS, BUSINESS_MAPS_URL } from '@/lib/seo'
import { homeFormPaths } from '@/lib/public-navigation'
import { InstagramMosaic } from './instagram-mosaic'
import { PublicNav } from '@/components/public-nav'
import { HomeBrands } from './home-brands'
import { Ownership } from './ownership'
import type { CardVehicle } from '@/components/catalog/vehicle-catalog-card'
import { HomeCatalog } from './home-catalog'
import './public-home.css'
import './home-opening.css'

export function PublicHome({ vehicles }: { vehicles: CardVehicle[] }) {
  return (
    <div className="cn-home-page">
      <PublicNav overPhoto />
      <div className="public-home">
        <main id="main-content">
          <div className="home-opening">
            <section className="hero">
              <Image
                className="land"
                alt="Una camper abierta frente a un valle de montaña al atardecer"
                src="/images/landing/ChatGPT Image 4 may 2026, 10_13_47.png"
                width={1536}
                height={1024}
                sizes="100vw"
                priority
              />
              <div className="veil"></div>
              <div className="shell hero-copy">
                <div className="kicker">Campers y autocaravanas · Barcelona</div>
                <h1>
                  Hoy dormimos <span>aquí.</span>
                </h1>
                <p>
                  ¿Mar o montaña este fin de semana? Pásate por la nave en Barcelona. Te enseñamos
                  las campers y hablamos de ese viaje que tienes en mente.
                </p>
                <div className="actions">
                  <a className="pill" href="#comprar">
                    Ver campers disponibles{' '}
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 12h15m-6-6 6 6-6 6" />
                    </svg>
                  </a>
                  <a className="textlink" href="#taller">
                    Conocer el taller{' '}
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 19 19 5M6 5h13v13" />
                    </svg>
                  </a>
                </div>
              </div>
            </section>
            <HomeBrands />
          </div>
          <Ownership />
          <HomeCatalog vehicles={vehicles} />
          <InstagramMosaic />
          <section className="journey" id="busqueda">
            <Image
              alt="Dos viajeros viendo caer el sol desde su camper"
              src="/images/landing/hero-sunset-couple.png"
              width={1536}
              height={1024}
              sizes="100vw"
            />
            <div className="spread">
              <div className="micro">Búsqueda a medida</div>
              <h2>
                ¿Mar mañana
                <br />o <i>montaña?</i>
              </h2>
              <p>
                ¿Dos tablas de surf o cuatro pares de botas? Cuéntanos qué llevarías. Te ayudamos a
                encontrar una camper donde quepa tu forma de viajar.
              </p>
              <Link href="/busqueda-bajo-pedido" className="ghostbtn">
                Contarnos qué buscas →
              </Link>
            </div>
          </section>
          <section className="seller" id="vender">
            <div className="spread">
              <div className="seller-photos">
                <Image
                  alt="Conductora de una camper"
                  src="/images/landing/sell-driver.jpg"
                  width={1280}
                  height={853}
                  sizes="(max-width: 660px) 60vw, 32vw"
                />
                <Image
                  alt="Una camper frente al mar al atardecer"
                  src="/images/landing/hero-sunset-window.png"
                  width={1536}
                  height={1024}
                  sizes="(max-width: 660px) 40vw, 18vw"
                />
              </div>
              <div>
                <div className="micro">Vender tu camper</div>
                <h2>
                  ¿A quién le tocará
                  <br />
                  el próximo viaje?
                </h2>
                <p>
                  Si ha llegado la hora de vender la tuya, pásate por la nave. Tú nos enseñas sus
                  rincones y nosotros nos ocupamos de valorarla, hacer las fotos y recibir las
                  visitas.
                </p>
                <div className="actions">
                  <a href="/vende-tu-camper" className="inkbtn">
                    Valorar mi camper →
                  </a>
                  <Link href="/como-funciona" className="quietlink">
                    Cómo funciona
                  </Link>
                </div>
              </div>
            </div>
          </section>
          <section className="care" id="garantias">
            <div className="spread care-inner">
              <div>
                <div className="micro">Garantías y posventa</div>
                <h2>Seguimos aquí cuando arranques.</h2>
              </div>
              <div>
                <details open>
                  <summary>¿Qué cubre mi garantía?</summary>
                  <p>
                    Tienes dos años de garantía en el vehículo y en la vivienda.{' '}
                    <Link href="/contacto">Consúltanos la cobertura de tu unidad</Link>.
                  </p>
                </details>
                <details>
                  <summary>¿Puedo probarla antes de comprar?</summary>
                  <p>
                    Sí. Escríbenos para concertar una visita y probar el vehículo con el equipo.
                  </p>
                </details>
                <details>
                  <summary>¿Quién hace el cambio de nombre?</summary>
                  <p>
                    Nosotros gestionamos el cambio de nombre. Es gratuito al comprar cualquier
                    vehículo. <Link href="/como-funciona">Ver los pasos de la compra.</Link>
                  </p>
                </details>
              </div>
            </div>
          </section>
          <section className="gear" id="tienda">
            <div className="spread">
              <Image
                alt="Una camper equipada para acampar"
                src="/images/landing/hero-vw-bus.jpg"
                width={3774}
                height={2670}
                sizes="(max-width: 660px) 95px, 275px"
              />
              <div>
                <div className="micro">Tienda online · Próximamente</div>
                <h2>Para llevar a bordo.</h2>
              </div>
              <p>
                En una camper, cada cosa tiene que ganarse su sitio. Con esa idea estamos preparando
                la tienda.
              </p>
            </div>
          </section>
          <section className="visit-section" id="visitanos">
            <div className="spread visitbody">
              <h2 className="visit-title">
                ¿Nos vemos
                <br />
                <i>en la nave?</i>
              </h2>
              <div>
                <div className="person">
                  <Image
                    alt="Esteban"
                    src="/cn-landing/media/av-esteban.jpg"
                    width={166}
                    height={166}
                    sizes="51px"
                  />
                  <p>
                    <b>Esteban y el equipo de CampersNova</b>
                    <a className="linktel" href={`tel:${BUSINESS.phone}`}>
                      {BUSINESS.phoneDisplay}
                    </a>
                  </p>
                </div>
                <address>
                  {BUSINESS.street} · {BUSINESS.postalCode} {BUSINESS.city}
                  <br />
                  Lun–vie de 10 a 19 h · Sábados de 10 a 13 h
                </address>
                <div className="actions">
                  <a
                    href={BUSINESS.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inkbtn"
                  >
                    Escríbenos ↗
                  </a>
                  <a
                    href={BUSINESS_MAPS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="quietlink"
                  >
                    Cómo llegar ↗
                  </a>
                </div>
              </div>
            </div>
          </section>
        </main>
        <footer className="bottom">
          <div className="shell">
            <div className="cols">
              <div>
                <Link href="/" aria-label="CampersNova, inicio">
                  <Image
                    alt="CampersNova"
                    src="/logo-cn-cropped.png"
                    width={756}
                    height={334}
                    sizes="100px"
                  />
                </Link>
              </div>
              <div>
                <b>Vehículos</b>
                <Link href="/comprar/vehiculos">Catálogo completo</Link>
                <Link href="/comprar/campers">Campers en venta</Link>
                <Link href="/comprar/autocaravanas">Autocaravanas en venta</Link>
                <Link href="/comprar/marcas">Buscar por marca</Link>
                <Link href="/busqueda-bajo-pedido">Búsqueda a medida</Link>
              </div>
              <div>
                <b>CampersNova</b>
                <a href={homeFormPaths['/comprar']}>Comprar</a>
                <a href={homeFormPaths['/vender']}>Vender</a>
                <Link href="/sobre">Sobre nosotros</Link>
                <a href="#taller">Taller</a>
                <a href="#garantias">Garantías y posventa</a>
                <a href="#tienda">Tienda online</a>
                <Link href="/como-funciona">Cómo funciona</Link>
              </div>
              <div>
                <b>Contacto</b>
                <Link href="/contacto">Contacto</Link>
                <a href={`tel:${BUSINESS.phone}`}>{BUSINESS.phoneDisplay}</a>
                <a href="mailto:info@campersnova.com">info@campersnova.com</a>
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://www.instagram.com/campersnova/"
                >
                  Instagram
                </a>
              </div>
            </div>
            <div className="legal">
              <span>© {new Date().getFullYear()} Campers Nova, S.L.</span>
              <Link href="/aviso-legal">Aviso legal</Link>
              <Link href="/privacidad">Privacidad</Link>
              <Link href="/cookies">Cookies</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
