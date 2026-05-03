'use client'

import { useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  updateBuyerLeadSchema,
  PURCHASE_TIMELINE_OPTIONS,
  type UpdateBuyerLeadValues,
} from '@/lib/validators/buyer-lead'
import { updateBuyerLead } from './actions'
import {
  BUYER_LEAD_TRANSITIONS,
  BUYER_LEAD_STATUS_LABELS,
  BUYER_LEAD_STATUS_CLASSES,
} from '@/lib/state-machine'
import type { BuyerLeadStatus } from '@prisma/client'

const EQUIPMENT_ITEMS = [
  { id: 'solar', label: 'Placas solares' },
  { id: 'kitchen', label: 'Cocina' },
  { id: 'bathroom', label: 'Baño' },
  { id: 'shower', label: 'Ducha' },
  { id: 'heating', label: 'Calefacción' },
] as const

type EquipmentKey = (typeof EQUIPMENT_ITEMS)[number]['id']
type Agent = { id: string; name: string }

type Props = {
  leadId: string
  defaultValues: UpdateBuyerLeadValues
  agents: Agent[]
  isAdmin: boolean
}

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
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* Contacto */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Teléfono</FormLabel>
                <FormControl>
                  <Input type="tel" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado del lead</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={isTerminal}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BUYER_LEAD_STATUS_CLASSES[field.value as BuyerLeadStatus]}`}
                        >
                          {BUYER_LEAD_STATUS_LABELS[field.value as BuyerLeadStatus]}
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {allowedStatuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BUYER_LEAD_STATUS_CLASSES[s]}`}
                        >
                          {BUYER_LEAD_STATUS_LABELS[s]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isTerminal && (
                  <p className="text-xs text-muted-foreground">
                    Estado final — no puede modificarse
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="agentId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Agente asignado</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                  value={field.value ?? '__none__'}
                  disabled={!isAdmin}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">Sin asignar</SelectItem>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!isAdmin && (
                  <p className="text-xs text-muted-foreground">Solo el admin puede reasignar</p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="border-t pt-4">
          <p className="mb-4 text-sm font-medium">Preferencias de búsqueda</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="vehicleType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo buscado</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === 'any' ? null : v)}
                    value={field.value ?? 'any'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Cualquier tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="any">Cualquier tipo</SelectItem>
                      <SelectItem value="CAMPER">Camper</SelectItem>
                      <SelectItem value="AUTOCARAVANA">Autocaravana</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="minSeats"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plazas mínimas</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={field.value ?? ''}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? null : Number(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="maxBudget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Presupuesto máximo (€)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step="500"
                      value={field.value ?? ''}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? null : Number(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="useZone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zona de uso</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Montaña, Costa, Europa…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="purchaseTimeline"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plazo de compra</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === 'none' ? null : v)}
                    value={field.value ?? 'none'}
                  >
                    <FormControl>
                      <SelectTrigger>
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
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Equipamiento crítico */}
          <div className="mt-4">
            <p className="mb-3 text-sm font-medium leading-none">Equipamiento imprescindible</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {EQUIPMENT_ITEMS.map((item) => (
                <FormField
                  key={item.id}
                  control={form.control}
                  name={`criticalEquipment.${item.id}` as `criticalEquipment.${EquipmentKey}`}
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value as boolean}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="cursor-pointer font-normal">{item.label}</FormLabel>
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        {serverError && <p className="text-sm text-destructive">{serverError}</p>}

        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Guardando…' : 'Guardar cambios'}
          </Button>
          {saved && <span className="text-sm text-green-600 dark:text-green-400">✓ Guardado</span>}
        </div>
      </form>
    </Form>
  )
}
