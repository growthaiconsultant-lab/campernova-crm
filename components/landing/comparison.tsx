import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react'
import { FadeIn } from '@/components/landing/motion'

type Mark = 'yes' | 'no' | 'partial'

interface Row {
  label: string
  campernova: Mark | string
  portal: Mark | string
  dealer: Mark | string
}

const ROWS: Row[] = [
  {
    label: 'Comisión',
    campernova: 'Solo si vendemos',
    portal: '0% (lo haces tú)',
    dealer: '10–15%',
  },
  {
    label: 'Tiempo medio de venta',
    campernova: '~42 días',
    portal: '3–6 meses',
    dealer: '1–3 meses',
  },
  { label: 'Tasación profesional', campernova: 'yes', portal: 'no', dealer: 'partial' },
  { label: 'Filtro de compradores', campernova: 'yes', portal: 'no', dealer: 'yes' },
  { label: 'Fotos profesionales', campernova: 'yes', portal: 'no', dealer: 'yes' },
  { label: 'Gestión papeleo (ITP, titularidad)', campernova: 'yes', portal: 'no', dealer: 'yes' },
  {
    label: 'Precio obtenido',
    campernova: 'Precio de mercado',
    portal: 'Lo que negocies',
    dealer: '15–25% menos',
  },
  { label: 'Coste por adelantado', campernova: '0 €', portal: 'Anuncios / tiempo', dealer: '0 €' },
]

function MarkIcon({ value }: { value: Mark | string }) {
  if (value === 'yes')
    return <CheckCircle2 className="mx-auto h-5 w-5 text-[#294e4c]" aria-label="Incluido" />
  if (value === 'no')
    return <XCircle className="mx-auto h-5 w-5 text-red-400" aria-label="No incluido" />
  if (value === 'partial')
    return <MinusCircle className="mx-auto h-5 w-5 text-amber-400" aria-label="Parcial" />
  return <span className="text-sm font-medium text-foreground">{value}</span>
}

export function ComparisonSection() {
  return (
    <section className="bg-background px-4 py-20">
      <div className="container mx-auto max-w-4xl">
        <FadeIn className="mb-12 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#cc6119]">
            Por qué CampersNova
          </p>
          <h2 className="mb-3 font-display text-3xl font-bold text-foreground md:text-4xl">
            Compara antes de decidir
          </h2>
          <p className="mx-auto max-w-md text-muted-foreground">
            Sin coste por adelantado. Solo cobramos si vendemos. Esto es lo que obtienes a cambio.
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          {/* Mobile: scroll horizontal */}
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[600px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="w-[35%] px-4 py-3 text-left text-sm font-normal text-muted-foreground" />
                  {/* CampersNova highlighted */}
                  <th className="w-[22%] rounded-t-xl bg-[#294e4c] px-4 py-3 text-sm font-semibold text-white">
                    CampersNova
                  </th>
                  <th className="w-[22%] px-4 py-3 text-sm font-medium text-muted-foreground">
                    Wallapop / portales
                  </th>
                  <th className="w-[21%] px-4 py-3 text-sm font-medium text-muted-foreground">
                    Concesionario
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, i) => {
                  const isLast = i === ROWS.length - 1
                  return (
                    <tr key={row.label} className="group">
                      <td
                        className={`border-b border-border px-4 py-3.5 text-sm font-medium text-foreground ${isLast ? 'border-0' : ''}`}
                      >
                        {row.label}
                      </td>
                      {/* CampersNova column — highlighted bg */}
                      <td
                        className={`border-x border-b border-[#294e4c]/15 bg-[#294e4c]/5 px-4 py-3.5 text-center ${isLast ? 'rounded-b-xl border-b border-[#294e4c]/15' : ''}`}
                      >
                        <MarkIcon value={row.campernova} />
                      </td>
                      <td
                        className={`border-b border-border px-4 py-3.5 text-center ${isLast ? 'border-0' : ''}`}
                      >
                        <MarkIcon value={row.portal} />
                      </td>
                      <td
                        className={`border-b border-border px-4 py-3.5 text-center ${isLast ? 'border-0' : ''}`}
                      >
                        <MarkIcon value={row.dealer} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-center text-sm italic text-muted-foreground">
            Por eso solo cobramos si vendemos. Sin venta, sin comisión. Sin riesgo para ti.
          </p>
        </FadeIn>
      </div>
    </section>
  )
}
