'use client'

import { useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import { ArrowRight, Loader2, TrendingUp } from 'lucide-react'
import posthog from 'posthog-js'
import { Button } from '@/components/ui/button'
import { FadeIn } from '@/components/landing/motion'
import { getBrandsByType, getModelsByBrandAndType } from '@/lib/landing/vehicles'

type VehicleType = 'CAMPER' | 'AUTOCARAVANA'

interface ValuationResult {
  min: number
  recommended: number
  max: number
  method: string
  confidence: string
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1999 }, (_, i) => CURRENT_YEAR - i)

function formatPrice(n: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

export function ValuationCalculator() {
  const [type, setType] = useState<VehicleType>('CAMPER')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [km, setKm] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ValuationResult | null>(null)
  const [error, setError] = useState('')
  const startedRef = useRef(false)

  const brands = useMemo(() => getBrandsByType(type), [type])
  const models = useMemo(() => (brand ? getModelsByBrandAndType(brand, type) : []), [brand, type])

  function fireStarted() {
    if (!startedRef.current) {
      startedRef.current = true
      posthog.capture('calculator_started')
    }
  }

  function handleTypeChange(t: VehicleType) {
    fireStarted()
    setType(t)
    setBrand('')
    setModel('')
    setResult(null)
    setError('')
  }

  function handleBrandChange(b: string) {
    fireStarted()
    setBrand(b)
    setModel('')
    setResult(null)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!brand || !model || !year || !km) return

    setLoading(true)
    setResult(null)
    setError('')

    try {
      const params = new URLSearchParams({ type, brand, model, year, km })
      const res = await fetch(`/api/valuation?${params}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Error al calcular la tasación')
        return
      }

      if (data.method === 'NONE') {
        setError(
          'No tenemos suficientes datos para este modelo. Contacta con nosotros para una tasación manual.'
        )
        return
      }

      setResult(data)
      posthog.capture('calculator_submitted', { type, brand, model, year, km, method: data.method })
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const venderParams = result
    ? new URLSearchParams({ type, brand, model, year, km }).toString()
    : ''

  return (
    <section id="calculadora" className="scroll-mt-16 bg-background px-4 py-20">
      <div className="container mx-auto max-w-3xl">
        <FadeIn>
          <div className="mb-10 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#cc6119]">
              Tasación gratuita
            </p>
            <h2 className="mb-3 font-display text-3xl font-bold text-foreground md:text-4xl">
              ¿Cuánto vale tu camper?
            </h2>
            <p className="mx-auto max-w-md text-muted-foreground">
              Rellena los datos básicos y obtén un rango de precio en segundos, basado en
              comparables reales del mercado.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Tipo */}
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Tipo de vehículo</p>
                <div className="grid grid-cols-2 gap-3">
                  {(['CAMPER', 'AUTOCARAVANA'] as VehicleType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleTypeChange(t)}
                      className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all duration-150 ${
                        type === t
                          ? 'border-[#294e4c] bg-[#294e4c] text-white'
                          : 'border-border text-muted-foreground hover:border-[#294e4c]/40'
                      }`}
                    >
                      {t === 'CAMPER' ? '🚐 Camper / Furgoneta' : '🏠 Autocaravana'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Marca */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Marca</label>
                  <select
                    value={brand}
                    onChange={(e) => handleBrandChange(e.target.value)}
                    required
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#294e4c]/40"
                  >
                    <option value="">Selecciona marca</option>
                    {brands.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Modelo */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Modelo</label>
                  <select
                    value={model}
                    onChange={(e) => {
                      setModel(e.target.value)
                      setResult(null)
                      setError('')
                    }}
                    required
                    disabled={!brand}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#294e4c]/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Selecciona modelo</option>
                    {models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Año y km */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Año</label>
                  <select
                    value={year}
                    onChange={(e) => {
                      setYear(e.target.value)
                      setResult(null)
                      setError('')
                    }}
                    required
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#294e4c]/40"
                  >
                    <option value="">Selecciona año</option>
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Kilómetros
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={km}
                      onChange={(e) => {
                        setKm(e.target.value)
                        setResult(null)
                        setError('')
                      }}
                      placeholder="45000"
                      min={0}
                      max={999999}
                      required
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#294e4c]/40"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      km
                    </span>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={loading || !brand || !model || !year || !km}
                className="h-11 w-full bg-[#cc6119] text-base font-semibold text-white hover:bg-[#cc6119]/90 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Calculando...
                  </>
                ) : (
                  <>
                    Ver mi tasación
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            {/* Error */}
            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Result card */}
            {result && (
              <div className="mt-6 rounded-xl border border-[#294e4c]/20 bg-[#294e4c]/5 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#294e4c]">
                    <TrendingUp className="h-4 w-4 text-white" />
                  </div>
                  <p className="font-semibold text-foreground">Estimación de precio</p>
                  <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    Preliminar
                  </span>
                </div>

                <div className="mb-4 grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="mb-1 text-xs text-muted-foreground">Mínimo</p>
                    <p className="text-lg font-bold text-foreground">{formatPrice(result.min)}</p>
                  </div>
                  <div className="border-x border-[#294e4c]/15 text-center">
                    <p className="mb-1 text-xs font-medium text-[#cc6119]">Recomendado</p>
                    <p className="text-2xl font-bold text-[#294e4c]">
                      {formatPrice(result.recommended)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="mb-1 text-xs text-muted-foreground">Máximo</p>
                    <p className="text-lg font-bold text-foreground">{formatPrice(result.max)}</p>
                  </div>
                </div>

                <p className="mb-4 text-xs text-muted-foreground">
                  Estimación preliminar basada en datos del mercado. Un agente confirma el precio
                  definitivo en menos de 24 h tras revisar fotos y estado.
                </p>

                <Link
                  href={`/vender?${venderParams}`}
                  className="block"
                  onClick={() =>
                    posthog.capture('calculator_to_form', { type, brand, model, year, km })
                  }
                >
                  <Button className="w-full bg-[#cc6119] font-semibold text-white hover:bg-[#cc6119]/90">
                    Vender mi camper a este precio
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
