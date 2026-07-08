'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  updateBuyerLeadSchema,
  PURCHASE_TIMELINE_OPTIONS,
  type UpdateBuyerLeadValues,
} from '@/lib/validators/buyer-lead'
import {
  EQUIPMENT_OPTIONS,
  RV_CATEGORY_OPTIONS,
  RV_BED_OPTIONS,
  RV_LICENSE_OPTIONS,
  RV_NONE,
} from '@/lib/rv-taxonomy'
import { updateBuyerLead } from './actions'
import {
  BUYER_LEAD_TRANSITIONS,
  BUYER_LEAD_STATUS_LABELS,
  BUYER_LEAD_STATUS_CLASSES,
} from '@/lib/state-machine'
import type { BuyerLeadStatus } from '@prisma/client'
import { Lock } from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────────

// Opciones desde la fuente única (lib/rv-taxonomy). Baño = bathroomRequired (no flag de equipo).
const EQUIPMENT_ITEMS = EQUIPMENT_OPTIONS
type EquipmentKey = (typeof EQUIPMENT_ITEMS)[number]['id']
type Agent = { id: string; name: string }

const PREF_CATEGORY_OPTIONS = RV_CATEGORY_OPTIONS
const PREF_BED_OPTIONS = RV_BED_OPTIONS
const LICENSE_OPTIONS = RV_LICENSE_OPTIONS
const NONE = RV_NONE
const PREF_BOOLEANS = [
  { id: 'bathroomRequired', label: 'Baño imprescindible' },
  { id: 'hasKids', label: 'Viaja con niños' },
  { id: 'needsWinter', label: 'Uso en invierno' },
  { id: 'needsGarage', label: 'Necesita garaje' },
] as const
type PrefBoolKey = (typeof PREF_BOOLEANS)[number]['id']

type Props = {
  leadId: string
  defaultValues: UpdateBuyerLeadValues
  agents: Agent[]
  isAdmin: boolean
}

// ── Styled primitives ─────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#94a3b8]">
      {children}
    </p>
  )
}

const inputCls =
  'h-9 w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 text-[13.5px] text-[#0a0a0a] placeholder-[#94a3b8] outline-none transition-colors focus:border-[#294e4c] focus:bg-white focus:shadow-[0_0_0_3px_rgba(41,78,76,0.12)]'

// ── Component ─────────────────────────────────────────────────────────────────

export function BuyerLeadEditForm({ leadId, defaultValues, agents, isAdmin }: Props) {
  const [saved, setSaved] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const currentStatus = defaultValues.status as BuyerLeadStatus
  const allowedStatuses: BuyerLeadStatus[] = [
    currentStatus,
    ...(BUYER_LEAD_TRANSITIONS[currentStatus] ?? []),
  ]
  const isTerminal = !BUYER_LEAD_TRANSITIONS[currentStatus]

  const form = useForm<UpdateBuyerLeadValues>({
    resolver: zodResolver(updateBuyerLeadSchema),
    defaultValues,
  })

  const isDirty = form.formState.isDirty

  async function onSubmit(data: UpdateBuyerLeadValues) {
    setSaved(false)
    setServerError(null)
    const result = await updateBuyerLead(leadId, data)
    if ('error' in result) {
      const fe = (result.error as { formErrors?: string[] })?.formErrors
      setServerError(fe?.[0] ?? 'Error al guardar. Revisa los datos.')
      return
    }
    setSaved(true)
    form.reset(data)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* ── Card 1: Datos del comprador ── */}
        <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white">
          <div className="border-b border-[#e2e8f0] px-6 py-4">
            <h2 className="text-[14px] font-semibold text-[#0a0a0a]">Datos del comprador</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Nombre */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FieldLabel>Nombre</FieldLabel>
                    <FormControl>
                      <input {...field} className={inputCls} />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FieldLabel>Email</FieldLabel>
                    <FormControl>
                      <input type="email" {...field} className={inputCls} />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              {/* Teléfono */}
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FieldLabel>Teléfono</FieldLabel>
                    <FormControl>
                      <input type="tel" {...field} className={inputCls} />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              {/* Estado */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FieldLabel>Estado del lead</FieldLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isTerminal}
                    >
                      <FormControl>
                        <SelectTrigger className="h-9 border-[#e2e8f0] bg-[#f8fafc] text-[13.5px] data-[disabled]:opacity-60">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${BUYER_LEAD_STATUS_CLASSES[field.value as BuyerLeadStatus]}`}
                            >
                              {BUYER_LEAD_STATUS_LABELS[field.value as BuyerLeadStatus]}
                            </span>
                            {isTerminal && <Lock className="h-3 w-3 text-[#94a3b8]" />}
                          </div>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {allowedStatuses.map((s) => (
                          <SelectItem key={s} value={s}>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${BUYER_LEAD_STATUS_CLASSES[s]}`}
                            >
                              {BUYER_LEAD_STATUS_LABELS[s]}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              {/* Agente asignado */}
              <FormField
                control={form.control}
                name="agentId"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FieldLabel>Agente asignado</FieldLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                      value={field.value ?? '__none__'}
                      disabled={!isAdmin}
                    >
                      <FormControl>
                        <SelectTrigger className="h-9 border-[#e2e8f0] bg-[#f8fafc] text-[13.5px] data-[disabled]:opacity-60">
                          <SelectValue>
                            {field.value ? (
                              <div className="flex items-center gap-2">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#294e4c] text-[9px] font-bold text-white">
                                  {agents
                                    .find((a) => a.id === field.value)
                                    ?.name.charAt(0)
                                    .toUpperCase() ?? '?'}
                                </span>
                                <span>
                                  {agents.find((a) => a.id === field.value)?.name ?? 'Agente'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[#94a3b8]">Sin asignar</span>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <span className="text-[#94a3b8]">Sin asignar</span>
                        </SelectItem>
                        {agents.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            <div className="flex items-center gap-2">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#294e4c] text-[9px] font-bold text-white">
                                {a.name.charAt(0).toUpperCase()}
                              </span>
                              {a.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!isAdmin && (
                      <p className="mt-1 text-[10px] text-[#94a3b8]">
                        Solo el admin puede reasignar
                      </p>
                    )}
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        {/* ── Card 2: Preferencias de búsqueda ── */}
        <div className="mt-5 overflow-hidden rounded-xl border border-[#e2e8f0] bg-white">
          <div className="border-b border-[#e2e8f0] px-6 py-4">
            <h2 className="text-[14px] font-semibold text-[#0a0a0a]">Preferencias de búsqueda</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Tipo */}
              <FormField
                control={form.control}
                name="vehicleType"
                render={({ field }) => (
                  <FormItem>
                    <FieldLabel>Tipo buscado</FieldLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === 'any' ? null : v)}
                      value={field.value ?? 'any'}
                    >
                      <FormControl>
                        <SelectTrigger className="h-9 border-[#e2e8f0] bg-[#f8fafc] text-[13.5px]">
                          <SelectValue placeholder="Cualquier tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="any">Cualquier tipo</SelectItem>
                        <SelectItem value="CAMPER">Camper</SelectItem>
                        <SelectItem value="AUTOCARAVANA">Autocaravana</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              {/* Plazas mínimas */}
              <FormField
                control={form.control}
                name="minSeats"
                render={({ field }) => (
                  <FormItem>
                    <FieldLabel>Plazas mínimas</FieldLabel>
                    <FormControl>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? null : Number(e.target.value))
                        }
                        placeholder="Sin mínimo"
                        className={inputCls}
                      />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              {/* Presupuesto máximo */}
              <FormField
                control={form.control}
                name="maxBudget"
                render={({ field }) => (
                  <FormItem>
                    <FieldLabel>Presupuesto máximo</FieldLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#94a3b8]">
                          €
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="500"
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(e.target.value === '' ? null : Number(e.target.value))
                          }
                          placeholder="Sin límite"
                          className={`${inputCls} pl-7`}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              {/* ¿Necesita financiación? */}
              <FormField
                control={form.control}
                name="financingNeeded"
                render={({ field }) => (
                  <FormItem>
                    <FieldLabel>¿Necesita financiación?</FieldLabel>
                    <Select
                      value={field.value == null ? 'none' : field.value ? 'yes' : 'no'}
                      onValueChange={(v) => field.onChange(v === 'none' ? null : v === 'yes')}
                    >
                      <FormControl>
                        <SelectTrigger className="h-9 border-[#e2e8f0] bg-[#f8fafc] text-[13.5px]">
                          <SelectValue placeholder="Sin especificar" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sin especificar</SelectItem>
                        <SelectItem value="yes">Sí</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              {/* Cuota máxima mensual */}
              <FormField
                control={form.control}
                name="maxMonthlyPayment"
                render={({ field }) => (
                  <FormItem>
                    <FieldLabel>Cuota máxima mensual</FieldLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#94a3b8]">
                          €
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="10"
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(e.target.value === '' ? null : Number(e.target.value))
                          }
                          placeholder="Sin especificar"
                          className={`${inputCls} pl-7`}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              {/* Zona preferida */}
              <FormField
                control={form.control}
                name="useZone"
                render={({ field }) => (
                  <FormItem>
                    <FieldLabel>Zona preferida</FieldLabel>
                    <FormControl>
                      <input
                        placeholder="Montaña, Costa, Europa…"
                        {...field}
                        className={inputCls}
                      />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              {/* Plazo de compra */}
              <FormField
                control={form.control}
                name="purchaseTimeline"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FieldLabel>Plazo de compra</FieldLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === 'none' ? null : v)}
                      value={field.value ?? 'none'}
                    >
                      <FormControl>
                        <SelectTrigger className="h-9 border-[#e2e8f0] bg-[#f8fafc] text-[13.5px]">
                          <SelectValue placeholder="Sin especificar" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sin especificar</SelectItem>
                        {PURCHASE_TIMELINE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />
            </div>

            {/* Equipamiento imprescindible */}
            <div className="mt-5 border-t border-[#f1f5f9] pt-5">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#94a3b8]">
                Equipamiento imprescindible
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {EQUIPMENT_ITEMS.map((item) => (
                  <FormField
                    key={item.id}
                    control={form.control}
                    name={`criticalEquipment.${item.id}` as `criticalEquipment.${EquipmentKey}`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <label
                            className={`flex cursor-pointer select-none items-center gap-2 rounded-lg border px-3 py-2 transition-all ${
                              field.value
                                ? 'border-[#294e4c] bg-[#f0f7f6] text-[#294e4c]'
                                : 'border-[#e2e8f0] bg-[#f8fafc] text-[#64748b] hover:bg-white'
                            }`}
                          >
                            {/* Custom checkbox */}
                            <div
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${
                                field.value
                                  ? 'border-[#294e4c] bg-[#294e4c]'
                                  : 'border-[#cbd5e1] bg-white'
                              }`}
                            >
                              {field.value && (
                                <svg
                                  className="h-2.5 w-2.5 text-white"
                                  viewBox="0 0 12 12"
                                  fill="none"
                                >
                                  <polyline
                                    points="1.5,6 5,9.5 10.5,2.5"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </div>
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={field.value as boolean}
                              onChange={field.onChange}
                            />
                            <span className="text-[12.5px] font-medium">{item.label}</span>
                          </label>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Ficha técnica buscada (RV) */}
            <div className="mt-5 border-t border-[#f1f5f9] pt-5">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#94a3b8]">
                Ficha técnica buscada (RV)
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Distribución preferida */}
                <FormField
                  control={form.control}
                  name="preferredCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Distribución preferida</FieldLabel>
                      <Select
                        value={field.value ?? NONE}
                        onValueChange={(v) => field.onChange(v === NONE ? null : v)}
                      >
                        <FormControl>
                          <SelectTrigger className="h-9 border-[#e2e8f0] bg-[#f8fafc] text-[13.5px]">
                            <SelectValue placeholder="Sin preferencia" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NONE}>Sin preferencia</SelectItem>
                          {PREF_CATEGORY_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-[11px]" />
                    </FormItem>
                  )}
                />

                {/* Cama preferida */}
                <FormField
                  control={form.control}
                  name="preferredBedLayout"
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Cama preferida</FieldLabel>
                      <Select
                        value={field.value ?? NONE}
                        onValueChange={(v) => field.onChange(v === NONE ? null : v)}
                      >
                        <FormControl>
                          <SelectTrigger className="h-9 border-[#e2e8f0] bg-[#f8fafc] text-[13.5px]">
                            <SelectValue placeholder="Sin preferencia" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NONE}>Sin preferencia</SelectItem>
                          {PREF_BED_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-[11px]" />
                    </FormItem>
                  )}
                />

                {/* Carnet */}
                <FormField
                  control={form.control}
                  name="licenseType"
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Carnet del comprador</FieldLabel>
                      <Select
                        value={field.value ?? NONE}
                        onValueChange={(v) => field.onChange(v === NONE ? null : v)}
                      >
                        <FormControl>
                          <SelectTrigger className="h-9 border-[#e2e8f0] bg-[#f8fafc] text-[13.5px]">
                            <SelectValue placeholder="Sin especificar" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NONE}>Sin especificar</SelectItem>
                          {LICENSE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-[11px]" />
                    </FormItem>
                  )}
                />

                {/* Plazas para dormir requeridas */}
                <FormField
                  control={form.control}
                  name="sleepingPlacesRequired"
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Plazas para dormir (mín.)</FieldLabel>
                      <FormControl>
                        <input
                          type="number"
                          min={0}
                          max={12}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(e.target.value === '' ? null : Number(e.target.value))
                          }
                          placeholder="Sin mínimo"
                          className={inputCls}
                        />
                      </FormControl>
                      <FormMessage className="text-[11px]" />
                    </FormItem>
                  )}
                />

                {/* Largo máximo (parking) */}
                <FormField
                  control={form.control}
                  name="maxLengthM"
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Largo máximo (m)</FieldLabel>
                      <FormControl>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(e.target.value === '' ? null : Number(e.target.value))
                          }
                          placeholder="Sin límite"
                          className={inputCls}
                        />
                      </FormControl>
                      <FormMessage className="text-[11px]" />
                    </FormItem>
                  )}
                />

                {/* Alto máximo (parking) */}
                <FormField
                  control={form.control}
                  name="maxHeightM"
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Alto máximo (m)</FieldLabel>
                      <FormControl>
                        <input
                          type="number"
                          step="0.05"
                          min="0"
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(e.target.value === '' ? null : Number(e.target.value))
                          }
                          placeholder="Sin límite"
                          className={inputCls}
                        />
                      </FormControl>
                      <FormMessage className="text-[11px]" />
                    </FormItem>
                  )}
                />
              </div>

              {/* Flags de preferencia */}
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PREF_BOOLEANS.map((item) => (
                  <FormField
                    key={item.id}
                    control={form.control}
                    name={item.id as PrefBoolKey}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <label
                            className={`flex cursor-pointer select-none items-center gap-2 rounded-lg border px-3 py-2 transition-all ${
                              field.value
                                ? 'border-[#294e4c] bg-[#f0f7f6] text-[#294e4c]'
                                : 'border-[#e2e8f0] bg-[#f8fafc] text-[#64748b] hover:bg-white'
                            }`}
                          >
                            <div
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${
                                field.value
                                  ? 'border-[#294e4c] bg-[#294e4c]'
                                  : 'border-[#cbd5e1] bg-white'
                              }`}
                            >
                              {field.value && (
                                <svg
                                  className="h-2.5 w-2.5 text-white"
                                  viewBox="0 0 12 12"
                                  fill="none"
                                >
                                  <polyline
                                    points="1.5,6 5,9.5 10.5,2.5"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </div>
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={field.value === true}
                              onChange={field.onChange}
                            />
                            <span className="text-[12px] font-medium">{item.label}</span>
                          </label>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Save bar */}
          <div
            className={`flex items-center gap-3 border-t px-6 py-3 transition-colors ${
              isDirty ? 'border-amber-200 bg-amber-50' : 'border-[#f1f5f9] bg-[#fafafa]'
            }`}
          >
            {isDirty && (
              <span className="flex items-center gap-1.5 text-[12px] text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Cambios sin guardar
              </span>
            )}
            {saved && !isDirty && (
              <span className="flex items-center gap-1.5 text-[12px] text-[#1f8a5b]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1f8a5b]" />
                Guardado
              </span>
            )}
            {serverError && <span className="text-[12px] text-red-600">{serverError}</span>}
            <div className="flex-1" />
            {isDirty && (
              <button
                type="button"
                onClick={() => form.reset()}
                className="px-3 py-1.5 text-[12.5px] font-medium text-[#64748b] transition-colors hover:text-[#0a0a0a]"
              >
                Descartar
              </button>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={form.formState.isSubmitting}
              className="h-8 bg-[#0a0a0a] px-4 text-[12.5px] text-white hover:bg-[#1a1a1a]"
            >
              {form.formState.isSubmitting ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  )
}
