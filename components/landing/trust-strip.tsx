import { FadeIn, AnimatedCounter } from '@/components/landing/motion'

const STATS = [
  {
    value: 60,
    suffix: ' seg',
    prefix: '<',
    label: 'Tasación al instante',
    isCounter: true,
  },
  {
    value: 4,
    suffix: '%',
    prefix: 'Solo el ',
    label: 'Al cierre, nada antes',
    isCounter: true,
  },
  {
    value: 0,
    suffix: '€',
    prefix: '',
    label: 'Coste por adelantado',
    isCounter: false,
    display: '0 €',
  },
  {
    value: null,
    suffix: '',
    prefix: '',
    label: 'Atención humana',
    isCounter: false,
    display: '100%',
  },
]

export function TrustStrip() {
  return (
    <section className="border-y border-[#e8dfc8] bg-sand px-4 py-10">
      <div className="container mx-auto max-w-5xl">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-0 md:divide-x md:divide-[#e8dfc8]">
          {STATS.map((stat, i) => (
            <FadeIn
              key={stat.label}
              delay={i * 0.08}
              className="flex flex-col items-center px-4 py-2 text-center"
            >
              <p className="mb-1.5 text-3xl font-bold leading-none text-[#294e4c] md:text-4xl">
                {stat.isCounter && stat.value !== null ? (
                  <>
                    {stat.prefix}
                    <AnimatedCounter to={stat.value} suffix={stat.suffix} />
                  </>
                ) : (
                  <span>{stat.display ?? `${stat.prefix}${stat.value}${stat.suffix}`}</span>
                )}
              </p>
              <p className="text-sm font-medium text-[#78716c]">{stat.label}</p>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
