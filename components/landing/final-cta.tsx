import Link from 'next/link'

export function FinalCta() {
  return (
    <section className="px-8 pb-20 pt-4 max-[640px]:px-5">
      <div className="mx-auto max-w-[1280px]">
        <div
          className="overflow-hidden rounded-[28px] px-10 py-20 text-center max-[640px]:px-6 max-[640px]:py-14"
          style={{
            background: 'radial-gradient(ellipse at 50% 0%, #2e5e59 0%, var(--cn-teal-900) 60%)',
          }}
        >
          <p
            className="mb-5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: 'var(--cn-terra-300, #f5bc96)' }}
          >
            · Próximo paso
          </p>
          <h2
            className="mx-auto mb-6 max-w-[22ch] text-[2.2rem] font-bold leading-[1.1] tracking-[-0.025em] text-white lg:text-[3rem]"
            style={{ fontFamily: 'var(--font-fraunces)' }}
          >
            ¿Estás pensando en comprar o vender una camper o autocaravana?
          </h2>
          <p
            className="mx-auto mb-10 max-w-[46ch] text-[15px] leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.68)' }}
          >
            Cuéntanos qué necesitas y te ayudamos a dar el siguiente paso con seguridad, claridad y
            confianza.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/comprar"
              className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--cn-terra-500)' }}
            >
              Quiero comprar
            </Link>
            <Link
              href="/vender"
              className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-[15px] font-semibold transition-opacity hover:opacity-90"
              style={{ color: 'var(--cn-teal-900)' }}
            >
              Quiero vender
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
