import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicNav } from '@/components/public-nav'
import { PublicPageIntro } from '@/components/public-page-intro'
import { PublicFooter } from '@/components/public-footer'
import { SearchForm } from './search-form'
import './search-form.css'

export const metadata: Metadata = {
  title: 'Buscamos tu camper o autocaravana',
  description:
    'Cuéntanos cómo quieres tu camper o autocaravana. El equipo de CampersNova revisará tus preferencias y te llamará para ayudarte con tu búsqueda.',
  alternates: { canonical: '/busqueda-bajo-pedido' },
}

const catalog = '/comprar/vehiculos'

export default function SearchRequestPage() {
  return (
    <>
      <PublicNav overPhoto />
      <main id="contenido" className="cn-search">
        <PublicPageIntro
          label="Búsqueda a medida"
          title="Tu próxima aventura"
          accent="empieza contigo."
          description="Cuéntanos cómo viajas y qué necesitas en tu camper o autocaravana. Un asesor de CampersNova revisará tu ficha y te llamará para hablar de tu búsqueda."
          photo="/images/landing/hero-sunset-couple.png"
        >
          <a href="#ficha">
            Empezar mi búsqueda <span aria-hidden="true">↓</span>
          </a>
          <Link href={catalog}>Ver vehículos disponibles</Link>
        </PublicPageIntro>
        <div id="ficha" className="cn-search-ficha">
          <SearchForm />
        </div>
      </main>
      <PublicFooter />
    </>
  )
}
