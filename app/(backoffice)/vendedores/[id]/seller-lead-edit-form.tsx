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
import { updateSellerLeadSchema, type UpdateSellerLeadValues } from '@/lib/validators/seller-lead'
import {
  SELLER_DEAL_TYPE_OPTIONS,
  SELLER_URGENCY_OPTIONS,
  SELLER_RISK_OPTIONS,
} from '@/lib/deal-terms'
import { updateSellerLead } from './actions'
import {
  SELLER_LEAD_TRANSITIONS,
  SELLER_LEAD_STATUS_LABELS,
  SELLER_LEAD_STATUS_CLASSES,
} from '@/lib/state-machine'
import type { SellerLeadStatus } from '@prisma/client'

type Agent = { id: string; name: string }

type Props = {
  leadId: string
  defaultValues: UpdateSellerLeadValues
  agents: Agent[]
  isAdmin: boolean
}

export function SellerLeadEditForm({ leadId, defaultValues, agents, isAdmin }: Props) {
  const [saved, setSaved] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const currentStatus = defaultValues.status as SellerLeadStatus
  const allowedStatuses: SellerLeadStatus[] = [
    currentStatus,
    ...(SELLER_LEAD_TRANSITIONS[currentStatus] ?? []),
  ]
  const isTerminal = !SELLER_LEAD_TRANSITIONS[currentStatus]

  const form = useForm<UpdateSellerLeadValues>({
    resolver: zodResolver(updateSellerLeadSchema),
    defaultValues,
  })

  async function onSubmit(data: UpdateSellerLeadValues) {
    setSaved(false)
    setServerError(null)
    const result = await updateSellerLead(leadId, data)
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SELLER_LEAD_STATUS_CLASSES[field.value as SellerLeadStatus]}`}
                        >
                          {SELLER_LEAD_STATUS_LABELS[field.value as SellerLeadStatus]}
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {allowedStatuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SELLER_LEAD_STATUS_CLASSES[s]}`}
                        >
                          {SELLER_LEAD_STATUS_LABELS[s]}
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

        {/* ── Condiciones de la operación (Seller Supply Graph, Block 17) ── */}
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Condiciones de la operación
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="minPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Precio mínimo aceptado (€)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step="500"
                      placeholder="Sin definir"
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
              name="dealType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modalidad de acuerdo</FormLabel>
                  <Select
                    value={field.value ?? '__none__'}
                    onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin definir" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Sin definir</SelectItem>
                      {SELLER_DEAL_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="urgency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Urgencia por cerrar</FormLabel>
                  <Select
                    value={field.value ?? '__none__'}
                    onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin definir" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Sin definir</SelectItem>
                      {SELLER_URGENCY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="riskLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Riesgo mecánico/documental</FormLabel>
                  <Select
                    value={field.value ?? '__none__'}
                    onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin definir" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Sin definir</SelectItem>
                      {SELLER_RISK_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="riskNotes"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Detalle del riesgo</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Humedad en el techo, ITV a punto de caducar…"
                      maxLength={500}
                      value={field.value ?? ''}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? null : e.target.value)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
