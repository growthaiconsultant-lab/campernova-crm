'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Car, ArrowRightLeft, ExternalLink, Check } from 'lucide-react'
import { updateTradeIn, createSellerLeadFromTradeIn } from './trade-in-actions'
import { isStockEligibleTradeIn, TRADE_IN_TYPE_OPTIONS } from '@/lib/trade-in'
import type { TradeInVehicleType } from '@prisma/client'

type Props = {
  leadId: string
  hasTradeIn: boolean | null
  type: TradeInVehicleType | null
  brand: string | null
  model: string | null
  year: number | null
  km: number | null
  financePending: boolean | null
  notes: string | null
  sellerLeadId: string | null
}

export function TradeInCard(props: Props) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(!!props.hasTradeIn)
  const [type, setType] = useState<string>(props.type ?? '')
  const [brand, setBrand] = useState(props.brand ?? '')
  const [model, setModel] = useState(props.model ?? '')
  const [year, setYear] = useState(props.year != null ? String(props.year) : '')
  const [km, setKm] = useState(props.km != null ? String(props.km) : '')
  const [financePending, setFinancePending] = useState(!!props.financePending)
  const [notes, setNotes] = useState(props.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState(false)
  const [saving, startSave] = useTransition()
  const [creating, startCreate] = useTransition()

  const stockEligible = isStockEligibleTradeIn((type || null) as TradeInVehicleType | null)
  const canCreateSeller =
    stockEligible && !props.sellerLeadId && brand.trim() && model.trim() && year && km

  function save() {
    setError(null)
    setSavedMsg(false)
    startSave(async () => {
      const result = await updateTradeIn(props.leadId, {
        hasTradeIn: enabled,
        type: enabled ? type || null : null,
        brand: enabled ? brand : null,
        model: enabled ? model : null,
        year: enabled && year ? parseInt(year, 10) : null,
        km: enabled && km ? parseInt(km, 10) : null,
        financePending: enabled ? financePending : false,
        notes: enabled ? notes : null,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setSavedMsg(true)
        router.refresh()
        setTimeout(() => setSavedMsg(false), 2500)
      }
    })
  }

  function createSeller() {
    setError(null)
    startCreate(async () => {
      const result = await createSellerLeadFromTradeIn(props.leadId)
      if (result.error) {
        setError(result.error)
      } else if (result.sellerLeadId) {
        router.push(`/vendedores/${result.sellerLeadId}`)
      }
    })
  }

  const inputCls =
    'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
          <Car className="h-4 w-4 text-muted-foreground" />
          Vehículo de parte de pago
        </h2>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Entrega un vehículo
        </label>
      </div>

      {enabled && (
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-foreground">Tipo</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
                <option value="">Selecciona…</option>
                {TRADE_IN_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
                <input
                  type="checkbox"
                  checked={financePending}
                  onChange={(e) => setFinancePending(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Tiene financiación pendiente
              </label>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-foreground">Marca</label>
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-foreground">Modelo</label>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-foreground">Año</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-foreground">Km</label>
              <input
                type="number"
                value={km}
                onChange={(e) => setKm(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-foreground">Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder="Estado, extras, expectativa de valor…"
              className={inputCls}
            />
          </div>

          {error && <p className="text-[13px] text-red-600">{error}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-[13px] font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {savedMsg ? <Check className="h-3.5 w-3.5" /> : null}
              {saving ? 'Guardando…' : savedMsg ? 'Guardado' : 'Guardar'}
            </button>

            {props.sellerLeadId ? (
              <Link
                href={`/vendedores/${props.sellerLeadId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ver lead de vendedor
              </Link>
            ) : (
              stockEligible && (
                <button
                  type="button"
                  onClick={createSeller}
                  disabled={creating || !canCreateSeller}
                  title={
                    canCreateSeller
                      ? 'Crear un lead de vendedor con este vehículo'
                      : 'Guarda marca, modelo, año y km primero'
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#0e7d6b] bg-[#0e7d6b]/10 px-4 py-2 text-[13px] font-semibold text-[#0b5f52] transition-colors hover:bg-[#0e7d6b]/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  {creating ? 'Creando…' : 'Crear lead de vendedor'}
                </button>
              )
            )}
          </div>

          {stockEligible && !props.sellerLeadId && (
            <p className="text-[12px] text-muted-foreground">
              Al ser camper/autocaravana, puedes captarlo como stock creando un lead de vendedor
              vinculado.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
