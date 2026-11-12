import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { HomeNav } from '@/components/home/home-nav'
import { homeFormPaths } from '@/lib/public-navigation'
import { SearchForm } from './search-form'
import './search-form.css'

export const metadata: Metadata = {
  title: 'Buscamos tu camper o autocaravana',
  description:
    'Cuéntanos cómo quieres tu camper o autocaravana. El equipo de CampersNova revisará tus preferencias y te llamará para ayudarte con tu búsqueda.',
  alternates: { canonical: '/busqueda-bajo-pedido' },
}

const path = '/busqueda-bajo-pedido'
const catalog = '/comprar/vehiculos'
const navigation = [
  { href: '/', label: 'Inicio' },
  { href: '/comprar', label: 'Comprar' },
  { href: '/vender', label: 'Vender' },
  { href: catalog, label: 'Catálogo' },
  { href: path, label: 'Búsqueda a medida' },
  { href: '/como-funciona', label: 'Cómo funciona' },
  { href: '/sobre', label: 'Sobre nosotros' },
]

export default function SearchRequestPage() {
  return (
    <>
      <header className="cn-search-header">
        <HomeNav currentPath={path} navigation={navigation} />
      </header>
      <main id="contenido" className="cn-search">
        <section className="cn-search-hero" aria-labelledby="search-title">
          <div className="cn-search-lead">
            <p className="cn-eyebrow">Búsqueda bajo pedido</p>
            <h1 id="search-title">
              Tu próxima aventura
              <br />
              empieza contigo.
            </h1>
            <p className="cn-search-introduction">
              Cuéntanos cómo viajas y qué necesitas en tu camper o autocaravana. Un asesor de
              CampersNova revisará tu ficha y te llamará para hablar de tu búsqueda.
            </p>
            <div className="cn-search-links">
              <a className="cn-search-start" href="#ficha">
                Empezar mi búsqueda <span aria-hidden="true">↓</span>
              </a>
              <Link href={catalog}>Ver vehículos disponibles</Link>
            </div>
          </div>
          <Image
            src="/images/landing/hero-sunset-couple.png"
            alt="Dos viajeros contemplan el mar al atardecer desde el interior de su camper"
            width={1536}
            height={1024}
            sizes="(max-width: 760px) 100vw, 50vw"
            priority
          />
        </section>
        <div id="ficha" className="cn-search-ficha">
          <SearchForm />
        </div>
      </main>
      <footer className="cn-search-footer">
        <Link href="/" aria-label="CampersNova, inicio">
          <Image src="/cn-landing/img/logo-cn-crema.png" alt="" width={90} height={44} />
        </Link>
        <nav aria-label="Enlaces al pie">
          <a href={homeFormPaths['/comprar']}>Comprar</a>
          <a href={homeFormPaths['/vender']}>Vender</a>
          <Link href={catalog}>Catálogo</Link>
          <Link href="/contacto">Contacto</Link>
          <Link href="/privacidad">Privacidad</Link>
          <Link href="/aviso-legal">Aviso legal</Link>
          <Link href="/cookies">Cookies</Link>
        </nav>
      </footer>
    </>
  )
}
