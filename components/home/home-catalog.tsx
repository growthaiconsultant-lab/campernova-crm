'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { MessageCircle, X } from 'lucide-react'
import { formatEur } from '@/lib/format/currency'
import { BUSINESS } from '@/lib/seo'
import { buildWhatsAppUrl } from '@/lib/whatsapp'

export type HomeVehicle = {
  slug: string
  title: string
  type: string
  photo: { url: string; alt: string } | null
  price: number | null
  monthlyPaymentFrom: number | null
  specs: string
}

const archive: HomeVehicle[] = [
  {
    slug: 'ford-nugget',
    title: 'Ford Nugget',
    type: 'Camper',
    photo: { url: '/cn-landing/media/v-nugget.jpg', alt: 'Ford Nugget con techo elevable' },
    price: null,
    monthlyPaymentFrom: null,
    specs: 'Transit Custom · Techo elevable',
  },
  {
    slug: 'autocaravana-perfilada',
    title: 'Autocaravana perfilada',
    type: 'Autocaravana',
    photo: {
      url: '/cn-landing/media/hero-compra-m.jpg',
      alt: 'Autocaravanas de archivo en la exposición',
    },
    price: null,
    monthlyPaymentFrom: null,
    specs: '',
  },
]
const filters = [
  ['Todos', 'Todos'],
  ['Camper', 'Campers'],
  ['Autocaravana', 'Autocaravanas'],
]
const euros = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function HomeCatalog({ vehicles }: { vehicles: HomeVehicle[] }) {
  const [filter, setFilter] = useState('Todos')
  const [enquiry, setEnquiry] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const [deposit, setDeposit] = useState('')
  const [term, setTerm] = useState('')
  const stock = vehicles.filter((v) => filter === 'Todos' || v.type === filter)
  const examples = archive
    .filter(
      (v) =>
        (filter === 'Todos' || v.type === filter) &&
        !stock.some((item) => item.title.toLowerCase() === v.title.toLowerCase())
    )
    .slice(0, Math.max(0, 3 - stock.length))
  function showFinance(subject: string) {
    setEnquiry(subject)
    setDeposit('')
    setTerm('')
    dialog.current?.showModal()
  }
  function card(v: HomeVehicle, archived: boolean) {
    const href = archived ? '/busqueda-bajo-pedido' : '/comprar/' + v.slug
    const subject = archived ? 'una unidad similar a la ' + v.title : 'la ' + v.title
    const message = archived
      ? 'Hola, me interesa ' + subject + '. ¿Me ayudáis a encontrarla?'
      : 'Hola, me interesa ' + subject + '. ¿Podría pasar a verla?'
    const doublePhoto = archived && v.slug === 'ford-nugget'
    return (
      <article key={(archived ? 'archive-' : 'stock-') + v.slug} className="catalog-card">
        <Link
          href={href}
          className={'catalog-image' + (doublePhoto ? ' catalog-pair' : '')}
          aria-label={(archived ? 'Buscar una similar a ' : 'Ver ficha de ') + v.title}
        >
          {v.photo ? (
            <Image
              src={v.photo.url}
              alt={v.photo.alt}
              width={720}
              height={480}
              sizes="(max-width: 660px) 48vw, 32vw"
            />
          ) : (
            <span>Fotos próximamente</span>
          )}
          {doublePhoto && (
            <Image
              src="/images/landing/nugget-archivo-trasera.webp"
              alt="Vista trasera de la Ford Nugget"
              width={360}
              height={640}
              sizes="(max-width:660px) 48vw, 16vw"
            />
          )}
        </Link>
        <span className={'catalog-badge' + (archived ? '' : ' available')}>
          {archived ? 'Modelo de archivo' : 'Disponible'}
        </span>
        <div className="catalog-details">
          <h3>
            <Link href={href}>{v.title}</Link>
          </h3>
          {v.specs && <p>{v.specs}</p>}
        </div>
        <div className="catalog-pricing">
          <div>
            {archived ? (
              <Link href={href}>Buscar una similar ↗</Link>
            ) : v.price == null ? (
              <strong>Precio a consultar</strong>
            ) : (
              <>
                <strong className="catalog-amount">{euros.format(v.price)}</strong>{' '}
                <small>al contado</small>
              </>
            )}
            <button
              type="button"
              className="catalog-finance"
              aria-haspopup="dialog"
              onClick={() => showFinance(subject)}
            >
              {v.monthlyPaymentFrom != null
                ? `Desde ${formatEur(v.monthlyPaymentFrom, 'cents')}/mes`
                : archived
                  ? 'Consultar financiación'
                  : 'Consultar cuota'}{' '}
              ↗
            </button>
          </div>
          <a
            className="catalog-wa"
            href={buildWhatsAppUrl(BUSINESS.phone, message)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={'WhatsApp sobre ' + v.title}
            title="Preguntar por WhatsApp"
          >
            <MessageCircle size={19} />
          </a>
        </div>
      </article>
    )
  }
  const financeMessage = [
    'Hola, me gustaría una propuesta de financiación para ' + enquiry + '.',
    deposit !== '' ? 'Entrada prevista: ' + euros.format(Number(deposit)) + '.' : '',
    term ? 'Plazo: ' + term + ' años.' : '',
    '¿Me podéis indicar cuota mensual, TAE y total a pagar?',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <section id="comprar" className="home-catalog">
      <div className="spread">
        <div className="catalog-heading">
          <h2>Campers y autocaravanas</h2>
          <Link className="quietlink" href="/comprar/vehiculos">
            Ver todo el catálogo ↗
          </Link>
        </div>
        <div className="catalog-filters" role="group" aria-label="Filtrar por tipo">
          {filters.map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {stock.length === 0 && (
          <p className="catalog-empty">
            Consulta el <Link href="/comprar/vehiculos">catálogo completo</Link> o{' '}
            <Link href="/busqueda-bajo-pedido">cuéntanos qué buscas</Link> para encontrar tu próxima
            camper.
          </p>
        )}
        <div className="catalog-grid">
          {stock.slice(0, 6).map((v) => card(v, false))}
          {examples.map((v) => card(v, true))}
        </div>
      </div>
      <dialog ref={dialog} className="home-finance" aria-labelledby="finance-title">
        <button
          type="button"
          className="close-finance"
          aria-label="Cerrar"
          onClick={() => dialog.current?.close()}
        >
          <X />
        </button>
        <h2 id="finance-title">Tu cuota mensual</h2>
        <p>
          Pide una propuesta para {enquiry}. Puedes indicarnos qué entrada y plazo tienes en mente.
        </p>
        <form action={BUSINESS.whatsapp} target="_blank" rel="noopener noreferrer" method="get">
          <label>
            Entrada prevista en euros (opcional)
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
            />
          </label>
          <label>
            Plazo que te interesa
            <select value={term} onChange={(e) => setTerm(e.target.value)}>
              <option value="">Prefiero que me asesoréis</option>
              {[3, 5, 7].map((y) => (
                <option key={y} value={y}>
                  {y} años
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="text" value={financeMessage} />
          <button type="submit" className="inkbtn">
            Pedir propuesta por WhatsApp ↗
          </button>
        </form>
      </dialog>
    </section>
  )
}
