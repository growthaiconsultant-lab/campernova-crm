'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  createBuyerLeadSchema,
  PURCHASE_TIMELINE_OPTIONS,
  type BuyerLeadFormValues,
} from '@/lib/validators/buyer-lead'
import { createBuyerLead } from '../actions'

const EQUIPMENT_ITEMS = [
  { id: 'solar', label: 'Placas solares' },
  { id: 'kitchen', label: 'Cocina' },
  { id: 'bathroom', label: 'Baño' },
  { id: 'shower', label: 'Ducha' },
  { id: 'heating', label: 'Calefacción' },
] as const

type EquipmentKey = (typeof EQUIPMENT_ITEMS)[number]['id']

export function BuyerLeadForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<BuyerLeadFormValues>({
    resolver: zodResolver(createBuyerLeadSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      vehicleType: null,
      minSeats: null,
      maxBudget: null,
      criticalEquipment: {
        solar: false,
        kitchen: false,
        bathroom: false,
        shower: false,
        heating: false,
      },
      useZone: '',
      purchaseTimeline: null,
    },
  })

  async function onSubmit(data: BuyerLeadFormValues) {
    setServerError(null)
    const result = await createBuyerLead(data)
    if ('error' in result) {
      setServerError('Error al guardar el lead. Revisa los datos e inténtalo de nuevo.')
      return
    }
    router.push(`/compradores/${result.leadId}`)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Sección: Datos del comprador */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos del comprador</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre completo" {...field} />
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
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="correo@ejemplo.com" {...field} />
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
                  <FormLabel>Teléfono *</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="+34 600 000 000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Sección: Preferencias de búsqueda */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preferencias de búsqueda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Tipo buscado */}
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

              {/* Plazas mínimas */}
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
                        placeholder="Ej: 4"
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

              {/* Presupuesto máximo */}
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
                        placeholder="Ej: 40000"
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

              {/* Zona de uso */}
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

              {/* Plazo de compra */}
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
                          <SelectValue placeholder="Selecciona plazo" />
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
            <div>
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
          </CardContent>
        </Card>

        {serverError && <p className="text-sm text-destructive">{serverError}</p>}

        <div className="flex gap-3">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Guardando…' : 'Crear lead'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={form.formState.isSubmitting}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  )
}
