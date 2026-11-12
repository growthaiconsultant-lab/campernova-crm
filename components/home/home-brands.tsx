import Image from 'next/image'

export function HomeBrands() {
  return (
    <section className="home-brands" aria-labelledby="home-brand-heading">
      <h2 id="home-brand-heading">Marcas que han pasado por nuestra nave</h2>
      <div className="brand-line">
        <div className="brand-row">
          <Image
            className="brand-mark mark-seal"
            src="/cn-landing/img/marcas/mercedes-benz.svg"
            alt="Mercedes-Benz"
            width={150}
            height={50}
            unoptimized
          />
          <Image
            className="brand-mark mark-seal"
            src="/cn-landing/img/marcas/volkswagen.svg"
            alt="Volkswagen"
            width={150}
            height={50}
            unoptimized
          />
          <Image
            className="brand-mark mark-ford"
            src="/cn-landing/img/marcas/ford.svg"
            alt="Ford"
            width={150}
            height={50}
            unoptimized
          />
          <Image
            className="brand-mark mark-seal"
            src="/cn-landing/img/marcas/fiat.svg"
            alt="Fiat"
            width={150}
            height={50}
            unoptimized
          />
          <Image
            className="brand-mark mark-seal"
            src="/cn-landing/img/marcas/peugeot.svg"
            alt="Peugeot"
            width={150}
            height={50}
            unoptimized
          />
        </div>
        <div className="brand-row">
          <Image
            className="brand-mark mark-wide"
            src="/cn-landing/img/marcas/adria.svg"
            alt="Adria"
            width={150}
            height={50}
            unoptimized
          />
          <Image
            className="brand-mark mark-long"
            src="/cn-landing/img/marcas/challenger.svg"
            alt="Challenger"
            width={150}
            height={50}
            unoptimized
          />
          <Image
            className="brand-mark mark-giotti"
            src="/cn-landing/img/marcas/giottiline.svg"
            alt="GiottiLine"
            width={150}
            height={50}
            unoptimized
          />
          <Image
            className="brand-mark mark-wide"
            src="/cn-landing/img/marcas/burstner.svg"
            alt="Bürstner"
            width={150}
            height={50}
            unoptimized
          />
        </div>
      </div>
    </section>
  )
}
