'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAutosave, type AutosaveState } from '@/lib/autosave'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { BuyerSourceSelect } from '@/components/buyer-source-select'
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
  legacySource?: string | null
}

// ── Styled primitives ─────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <FormLabel className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-[#8b94a3]">
      {children}
    </FormLabel>
  )
}

const inputCls =
  'h-9 w-full rounded-lg border border-[#e6e9ee] bg-[#f8fafc] px-3 text-[13.5px] text-[#141922] placeholder-[#8b94a3] outline-none transition-colors focus:border-[#0e7d6b] focus:bg-white focus:shadow-[0_0_0_3px_rgba(14,125,107,0.12)]'

// ── Component ─────────────────────────────────────────────────────────────────

export function BuyerLeadEditForm({ leadId, defaultValues, agents, legacySource }: Props) {
  const router = useRouter()
  const [saveState, setSaveState] = useState<AutosaveState>({ status: 'idle' })

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

  const [autosave] = useState(() =>
    createAutosave({
      initial: form.getValues(),
      onState: setSaveState,
      validate: (data) => {
        const result = updateBuyerLeadSchema.safeParse(data)
        // Populate the existing inline validation messages without changing the inputs.
        void form.trigger()
        return result.success ? null : 'Hay cambios sin guardar. Revisa los campos indicados.'
      },
      save: async (data, fields) => {
        const result = await updateBuyerLead(leadId, data, fields)
        if ('error' in result) {
          const error = result.error as {
            formErrors?: string[]
            fieldErrors?: Record<string, string[]>
          }
          return (
            error.formErrors?.[0] ??
            Object.values(error.fieldErrors ?? {}).flat()[0] ??
            'No se ha podido guardar. Reintenta.'
          )
        }
        return null
      },
    })
  )

  useEffect(() => {
    autosave.start()
    const subscription = form.watch(() => autosave.change(form.getValues()))
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!autosave.hasPending()) return
      event.preventDefault()
      event.returnValue = ''
    }
    let navigating = false
    const beforeNavigate = (event: MouseEvent) => {
      if (
        !autosave.hasPending() ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.download ||
        (link.target && link.target !== '_self')
      )
        return
      const destination = new URL(link.href)
      if (!['http:', 'https:'].includes(destination.protocol)) return
      if (
        destination.origin === location.origin &&
        destination.pathname === location.pathname &&
        destination.search === location.search &&
        destination.hash
      )
        return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (navigating) return
      navigating = true
      void autosave.flush().then((saved) => {
        navigating = false
        if (!saved) return
        if (destination.origin === location.origin)
          router.push(destination.pathname + destination.search + destination.hash)
        else location.assign(destination.href)
      })
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', beforeNavigate, true)
    return () => {
      subscription.unsubscribe()
      autosave.stop()
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('click', beforeNavigate, true)
    }
  }, [autosave, form, router])

  const saveMessage =
    saveState.status === 'saving'
      ? 'Guardando…'
      : saveState.status === 'pending'
        ? 'Cambios pendientes de guardar…'
        : saveState.status === 'saved'
          ? 'Guardado'
          : saveState.status === 'error'
            ? saveState.message
            : 'Los cambios se guardan automáticamente'

  return (
    <Form {...form}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void autosave.flush()
        }}
      >
        <div
          className={`sticky top-2 z-10 mb-4 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 shadow-sm ${saveState.status === 'error' ? 'border-amber-200 bg-amber-50' : 'border-[#e6e9ee] bg-white'}`}
        >
          <span
            role={saveState.status === 'error' ? 'alert' : 'status'}
            aria-live="polite"
            className={`flex-1 text-[12px] ${saveState.status === 'error' ? 'text-red-700' : saveState.status === 'saved' ? 'text-[#0e7d6b]' : 'text-muted-foreground'}`}
          >
            {saveMessage}
          </span>
          {saveState.status === 'error' && (
            <Button type="submit" size="sm">
              Reintentar guardado
            </Button>
          )}
        </div>
        {/* ── Card 1: Datos del comprador ── */}
        <div className="overflow-hidden rounded-xl border border-[#e6e9ee] bg-white">
          <div className="border-b border-[#e6e9ee] px-6 py-4">
            <h2 className="text-[14px] font-semibold text-[#141922]">Datos del comprador</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Guardado automático de datos y preferencias
            </p>
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
                      <input
                        type="email"
                        {...field}
                        value={field.value ?? ''}
                        className={inputCls}
                      />
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

              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#8b94a3]">
                      Origen de captación
                    </FormLabel>
                    <FormControl>
                      <BuyerSourceSelect
                        {...field}
                        legacySource={legacySource}
                        className={inputCls}
                      />
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
                        <SelectTrigger className="h-9 border-[#e6e9ee] bg-[#f8fafc] text-[13.5px] data-[disabled]:opacity-60">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${BUYER_LEAD_STATUS_CLASSES[field.value as BuyerLeadStatus]}`}
                            >
                              {BUYER_LEAD_STATUS_LABELS[field.value as BuyerLeadStatus]}
                            </span>
                            {isTerminal && <Lock className="h-3 w-3 text-[#8b94a3]" />}
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
                    >
                      <FormControl>
                        <SelectTrigger className="h-9 border-[#e6e9ee] bg-[#f8fafc] text-[13.5px] data-[disabled]:opacity-60">
                          <SelectValue>
                            {field.value ? (
                              <div className="flex items-center gap-2">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0e7d6b] text-[9px] font-bold text-white">
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
                              <span className="text-[#8b94a3]">Sin asignar</span>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <span className="text-[#8b94a3]">Sin asignar</span>
                        </SelectItem>
                        {agents.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            <div className="flex items-center gap-2">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0e7d6b] text-[9px] font-bold text-white">
                                {a.name.charAt(0).toUpperCase()}
                              </span>
                              {a.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        {/* ── Card 2: Preferencias de búsqueda ── */}
        <div className="mt-5 overflow-hidden rounded-xl border border-[#e6e9ee] bg-white">
          <div className="border-b border-[#e6e9ee] px-6 py-4">
            <h2 className="text-[14px] font-semibold text-[#141922]">Preferencias de búsqueda</h2>
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
                        <SelectTrigger className="h-9 border-[#e6e9ee] bg-[#f8fafc] text-[13.5px]">
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
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#8b94a3]">
                        €
                      </span>
                      <FormControl>
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
                      </FormControl>
                    </div>
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
                        <SelectTrigger className="h-9 border-[#e6e9ee] bg-[#f8fafc] text-[13.5px]">
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
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#8b94a3]">
                        €
                      </span>
                      <FormControl>
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
                      </FormControl>
                    </div>
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
                        <SelectTrigger className="h-9 border-[#e6e9ee] bg-[#f8fafc] text-[13.5px]">
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
            <div className="mt-5 border-t border-[#eef1f5] pt-5">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#8b94a3]">
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
                                ? 'border-[#0e7d6b] bg-[#e6f4f0] text-[#0e7d6b]'
                                : 'border-[#e6e9ee] bg-[#f8fafc] text-[#586173] hover:bg-white'
                            }`}
                          >
                            {/* Custom checkbox */}
                            <div
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${
                                field.value
                                  ? 'border-[#0e7d6b] bg-[#0e7d6b]'
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
            <div className="mt-5 border-t border-[#eef1f5] pt-5">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#8b94a3]">
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
                          <SelectTrigger className="h-9 border-[#e6e9ee] bg-[#f8fafc] text-[13.5px]">
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
                          <SelectTrigger className="h-9 border-[#e6e9ee] bg-[#f8fafc] text-[13.5px]">
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
                          <SelectTrigger className="h-9 border-[#e6e9ee] bg-[#f8fafc] text-[13.5px]">
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
                                ? 'border-[#0e7d6b] bg-[#e6f4f0] text-[#0e7d6b]'
                                : 'border-[#e6e9ee] bg-[#f8fafc] text-[#586173] hover:bg-white'
                            }`}
                          >
                            <div
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${
                                field.value
                                  ? 'border-[#0e7d6b] bg-[#0e7d6b]'
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
        </div>
      </form>
    </Form>
  )
}
