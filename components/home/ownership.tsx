import Image from 'next/image'
import Link from 'next/link'

export function Ownership() {
  return (
    <section className="ownership" aria-label="Ventajas al comprar con CampersNova">
      <div className="spread ownership-grid">
        <article className="promise warranty" id="garantia-compra">
          <div className="proof-kicker">
            <svg
              aria-hidden="true"
              viewBox="0 0 32 32"
              width="36"
              height="36"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m16 3 10 4v8c0 6-5 11-10 14C11 26 6 21 6 15V7z" />
              <path d="m11.5 15.5 3.25 3.25 6-6.5" />
            </svg>
            <span>Garantía CampersNova</span>
          </div>
          <h2>
            <span className="term">2 años</span>
            <span className="scope">de garantía en vehículo y vivienda.</span>
          </h2>
          <a
            className="proof-link"
            href="https://wa.me/34645639185?text=Hola%2C+%C2%BFme+explic%C3%A1is+las+condiciones+de+los+dos+a%C3%B1os+de+garant%C3%ADa+en+veh%C3%ADculo+y+vivienda%3F"
            target="_blank"
            rel="noopener noreferrer"
          >
            Consultar la cobertura <span aria-hidden="true">↗</span>
          </a>
        </article>
        <article className="promise own-workshop" id="taller">
          <Image
            src="/cn-landing/media/proceso-vende.jpg"
            alt="Un técnico revisa el techo de una autocaravana en el taller de CampersNova"
            width={1000}
            height={625}
            sizes="(max-width: 680px) 100vw, 40vw"
          />
          <div className="work-text">
            <h2>Taller propio.</h2>
            <p>Cuéntanos qué necesita tu camper y lo vemos en nuestra nave de Barcelona.</p>
            <a
              className="proof-link"
              href="https://wa.me/34645639185?text=Hola%2C+me+gustar%C3%ADa+hablar+con+vuestro+taller+sobre+mi+camper."
              target="_blank"
              rel="noopener noreferrer"
            >
              Hablar con el taller <span aria-hidden="true">↗</span>
            </a>
          </div>
        </article>
        <article className="promise funding" id="financiacion">
          <svg
            aria-hidden="true"
            viewBox="0 0 32 32"
            width="36"
            height="36"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="7" width="26" height="18" rx="3.5" />
            <path d="M3.5 13h25M8 20h6" />
          </svg>
          <div>
            <h2>Opciones de financiación.</h2>
            <p>
              Dinos qué vehículo te interesa y qué entrada tienes en mente. Te explicamos la cuota,
              el plazo y el importe total.
            </p>
          </div>
          <a
            className="proof-link"
            href="https://wa.me/34645639185?text=Hola%2C+me+interesan+las+opciones+de+financiaci%C3%B3n+para+una+camper.+%C2%BFPodemos+ver+la+entrada%2C+la+cuota+y+el+plazo%3F"
            target="_blank"
            rel="noopener noreferrer"
          >
            Consultar financiación <span aria-hidden="true">↗</span>
          </a>
        </article>
        <aside className="transfer-benefit">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 3h9l5 5v6M14 3v6h5M5 3v18h6M8 12h5M8 16h3m3 2 2 2 5-6" />
          </svg>
          <p>
            <strong>Cambio de nombre gratuito</strong> al comprar cualquier vehículo.
          </p>
          <Link href="/como-funciona">Ver cómo funciona →</Link>
        </aside>
      </div>
    </section>
  )
}
