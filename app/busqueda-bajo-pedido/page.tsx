import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { SearchForm } from './search-form'
import './search-form.css'

export const metadata: Metadata = {
  title: 'Buscamos tu camper o autocaravana',
  description:
    'Cuéntanos cómo quieres tu camper o autocaravana. El equipo de CampersNova revisará tus preferencias y te llamará para ayudarte con tu búsqueda.',
  alternates: { canonical: '/busqueda-bajo-pedido' },
}

export default function SearchRequestPage() {
  return (
    <div className="cn-search">
      <header className="cn-search-header">
        <Link href="/" aria-label="CampersNova — inicio">
          <Image
            src="/cn-landing/img/logo-cn.png"
            width={150}
            height={70}
            alt="CampersNova"
            priority
          />
        </Link>
        <Link href="/comprar">
          Ver vehículos disponibles <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main id="contenido">
        <div className="cn-search-intro">
          <p className="cn-eyebrow">BÚSQUEDA BAJO PEDIDO</p>
          <h1>
            Tu próxima aventura
            <br />
            <em>empieza contigo.</em>
          </h1>
          <p>
            Cuéntanos qué necesitas en tu camper o autocaravana. Revisaremos tu ficha y un asesor de
            CampersNova te llamará para conocer mejor tu búsqueda.
          </p>
          <div className="cn-search-promises">
            <span>01 · Cuéntanos qué buscas</span>
            <span>02 · Revisamos tu ficha</span>
            <span>03 · Hablamos contigo</span>
          </div>
        </div>
        <SearchForm />
      </main>
      <footer className="cn-search-footer">
        <span>CampersNova · Viajar empieza por elegir bien.</span>
        <nav aria-label="Información legal">
          <Link href="/privacidad">Privacidad</Link>
          <Link href="/aviso-legal">Aviso legal</Link>
          <Link href="/contacto">Contacto</Link>
        </nav>
      </footer>
    </div>
  )
}
