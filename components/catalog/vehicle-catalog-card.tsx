import Image from 'next/image'
import Link from 'next/link'
import { BadgeCheck, MessageCircle } from 'lucide-react'
import type { PublicVehicle } from '@/lib/public-catalog'
import { formatEur } from '@/lib/format/currency'
import { BUSINESS } from '@/lib/seo'
import { buildWhatsAppUrl } from '@/lib/whatsapp'
import { VehicleFinanceButton } from './vehicle-finance-button'
import './vehicle-catalog-card.css'

export type CardVehicle = Pick<
  PublicVehicle,
  'slug' | 'title' | 'typeLabel' | 'price' | 'monthlyPaymentFrom' | 'photos'
> &
  Partial<
    Pick<
      PublicVehicle,
      'brand' | 'model' | 'year' | 'km' | 'seats' | 'length' | 'location' | 'verified'
    >
  >

// Las siglas y acabados desconocidos conservan la grafía del CRM.
function displayName(value: string) {
  return value
    .trim()
    .replace(/\bcitro[eë]n\b/gi, 'Citroën')
    .replace(
      /\b(ford|transit|jumper|fiat|ducato|sprinter|mercedes|volkswagen|peugeot|adria|sunlight|roller|team|kronos|bavaria|capron|carado|custom)\b/gi,
      (word) => word[0].toUpperCase() + word.slice(1).toLowerCase()
    )
    .replace(/\b(\d+)tl\b/gi, '$1 TL')
}

export function VehicleCatalogCard({
  vehicle: v,
  reserved = false,
  archiveNote,
  showDetails = true,
}: {
  vehicle: CardVehicle
  reserved?: boolean
  archiveNote?: string
  showDetails?: boolean
}) {
  const archived = archiveNote !== undefined
  const href = archived ? '/busqueda-bajo-pedido' : '/comprar/' + v.slug
  const title = displayName(v.model?.trim() || v.title)
  const brand = v.model?.trim() && v.brand?.trim() ? displayName(v.brand) : ''
  const headline = [brand, title].filter(Boolean).join(' ')
  const subject = (archived ? 'una unidad similar a la ' : 'la ') + headline
  const message =
    'Hola, me interesa ' +
    subject +
    (archived ? '. ¿Me ayudáis a encontrarla?' : '. ¿Podría pasar a verla?')
  const specs = [
    v.year,
    v.km != null && v.km.toLocaleString('es-ES') + ' km',
    v.seats != null && v.seats + (v.seats === 1 ? ' plaza' : ' plazas'),
    showDetails && v.length != null && v.length + ' m',
  ]
    .filter(Boolean)
    .join(' · ')
  const badge = archived ? 'Modelo de archivo' : reserved ? 'Reservado' : 'Disponible'
  const photo = v.photos[0]
  const secondPhoto = archived ? v.photos[1] : undefined
  return (
    <article className="cn-stock-card">
      <Link
        className={'cn-stock-photo' + (secondPhoto ? ' cn-stock-pair' : '')}
        href={href}
        aria-label={(archived ? 'Buscar una similar a ' : 'Ver ficha de ') + headline}
      >
        {photo ? (
          <Image
            src={photo.url}
            alt={photo.alt}
            width={720}
            height={480}
            sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw"
          />
        ) : (
          <span>Fotos próximamente</span>
        )}
        {secondPhoto && (
          <Image
            src={secondPhoto.url}
            alt={secondPhoto.alt}
            width={360}
            height={480}
            sizes="(max-width: 640px) 50vw, 16vw"
          />
        )}
      </Link>
      <span className="cn-stock-badge" data-available={!archived && !reserved}>
        {badge}
      </span>
      {v.verified && (
        <span className="cn-stock-verified">
          <BadgeCheck size={15} /> Verificado
        </span>
      )}
      <div className="cn-stock-body">
        <p className="cn-stock-make">{[v.typeLabel, brand].filter(Boolean).join(' · ')}</p>
        <h3>
          <Link href={href}>{title}</Link>
        </h3>
        {(archiveNote || specs) && <p className="cn-stock-specs">{archiveNote || specs}</p>}
        {showDetails && v.location && <p className="cn-stock-specs">{v.location}</p>}
        <div className="cn-stock-prices">
          {!archived && (
            <div>
              {v.price == null ? (
                <strong>Precio a consultar</strong>
              ) : (
                <>
                  <small>Al contado</small>
                  <b>{formatEur(v.price, 'cents')}</b>
                </>
              )}
            </div>
          )}
          <VehicleFinanceButton
            subject={subject}
            label={
              v.monthlyPaymentFrom != null
                ? 'Desde ' + formatEur(v.monthlyPaymentFrom, 'cents') + '/mes'
                : archived
                  ? 'Consultar financiación'
                  : 'Consultar cuota'
            }
          />
        </div>
        <div className="cn-stock-actions">
          <Link className="cn-stock-open" href={href}>
            {archived ? 'Buscar una similar' : 'Ver ficha'} <span aria-hidden="true">→</span>
          </Link>
          <a
            className="cn-stock-wa"
            href={buildWhatsAppUrl(BUSINESS.phone, message)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={'WhatsApp sobre ' + headline}
          >
            <MessageCircle size={17} aria-hidden="true" /> WhatsApp
          </a>
        </div>
      </div>
    </article>
  )
}
