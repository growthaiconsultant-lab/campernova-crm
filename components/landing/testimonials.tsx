const TESTIMONIALS = [
  {
    name: 'Carlos R.',
    location: 'Madrid',
    vehicle: 'Volkswagen California 2018',
    price: '38.000 €',
    quote:
      'Pensaba que tardaría meses y tendría que lidiar con curiosos. En menos de 6 semanas encontraron un comprador serio y se ocuparon de todo el papeleo. Solo tuve que firmar.',
  },
  {
    name: 'Ana y Jordi',
    location: 'Barcelona',
    vehicle: 'Fiat Ducato camper 2020',
    price: '52.500 €',
    quote:
      'La tasación fue la más alta que habíamos visto. Al principio dudamos, pero vendieron al precio que dijeron en el tiempo que prometieron. Muy recomendable.',
  },
  {
    name: 'Miguel T.',
    location: 'Valencia',
    vehicle: 'Hymer B-Class 2016',
    price: '41.000 €',
    quote:
      'El trato fue excelente desde el primer momento. Nos mantuvieron informados en todo momento y las visitas fueron muy organizadas. Sin estrés.',
  },
]

const STARS = (
  <span aria-label="5 estrellas" className="text-[14px]">
    ⭐⭐⭐⭐⭐
  </span>
)

export function TestimonialsSection() {
  return (
    <section className="px-8 py-20 max-[640px]:px-5">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-14 text-center">
          <p
            className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: 'var(--cn-terra-500)' }}
          >
            · Lo que dicen nuestros clientes
          </p>
          <h2
            className="text-[2rem] font-bold leading-tight tracking-[-0.02em] lg:text-[2.4rem]"
            style={{ color: 'var(--cn-teal-900)', fontFamily: 'var(--font-fraunces)' }}
          >
            Propietarios que ya vendieron con nosotros.
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map(({ name, location, vehicle, price, quote }) => (
            <div
              key={name}
              className="flex flex-col rounded-[20px] p-7"
              style={{ background: 'var(--cn-cream-50)', border: '1px solid var(--cn-line)' }}
            >
              {STARS}
              <p
                className="mb-6 mt-4 flex-1 text-[14px] leading-relaxed"
                style={{ color: 'var(--cn-ink-700)' }}
              >
                &ldquo;{quote}&rdquo;
              </p>
              <div className="border-t pt-5" style={{ borderColor: 'var(--cn-line)' }}>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--cn-teal-900)' }}>
                  {name} · {location}
                </p>
                <p className="mt-0.5 text-[12px]" style={{ color: 'var(--cn-ink-500)' }}>
                  Vendió su {vehicle} por {price}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
