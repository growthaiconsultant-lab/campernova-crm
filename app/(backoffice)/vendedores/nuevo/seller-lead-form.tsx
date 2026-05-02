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
import { createSellerLeadSchema, type SellerLeadFormValues } from '@/lib/validators/seller-lead'
import { createSellerLead } from '../actions'

const EQUIPMENT_ITEMS = [
  { id: 'solar', label: 'Placas solares' },
  { id: 'kitchen', label: 'Cocina' },
  { id: 'bathroom', label: 'Baño' },
  { id: 'shower', label: 'Ducha' },
  { id: 'heating', label: 'Calefacción' },
] as const

type EquipmentKey = (typeof EQUIPMENT_ITEMS)[number]['id']

export function SellerLeadForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<SellerLeadFormValues>({
    resolver: zodResolver(createSellerLeadSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      brand: '',
      model: '',
      conservationState: 'NORMAL',
      location: '',
      length: null,
      desiredPrice: null,
      equipment: {
        solar: false,
        kitchen: false,
        bathroom: false,
        shower: false,
        heating: false,
      },
    },
  })

  async function onSubmit(data: SellerLeadFormValues) {
    setServerError(null)
    const result = await createSellerLead(data)
    if ('error' in result) {
      setServerError('Error al guardar el lead. Revisa los datos e inténtalo de nuevo.')
      return
    }
    router.push(`/vendedores/${result.leadId}`)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Sección: Datos del vendedor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos del vendedor</CardTitle>
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

        {/* Sección: Datos del vehículo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos del vehículo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Tipo */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="CAMPER">Camper</SelectItem>
                        <SelectItem value="AUTOCARAVANA">Autocaravana</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Estado conservación */}
              <FormField
                control={form.control}
                name="conservationState"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado conservación *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="EXCELENTE">Excelente</SelectItem>
                        <SelectItem value="BUENO">Bueno</SelectItem>
                        <SelectItem value="NORMAL">Normal</SelectItem>
                        <SelectItem value="DETERIORADO">Deteriorado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Marca */}
              <FormField
                control={form.control}
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marca *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Hymer, Carado, Fiat…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Modelo */}
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modelo *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Ducato, Grand California…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Año */}
              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Año *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1980}
                        max={2030}
                        placeholder={String(new Date().getFullYear())}
                        value={Number.isNaN(field.value) ? '' : (field.value ?? '')}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Km */}
              <FormField
                control={form.control}
                name="km"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kilómetros *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Ej: 85000"
                        value={Number.isNaN(field.value) ? '' : (field.value ?? '')}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Plazas */}
              <FormField
                control={form.control}
                name="seats"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plazas *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        placeholder="Ej: 4"
                        value={Number.isNaN(field.value) ? '' : (field.value ?? '')}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Longitud (opcional) */}
              <FormField
                control={form.control}
                name="length"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitud (m)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="Ej: 6.8"
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

              {/* Precio deseado (opcional) */}
              <FormField
                control={form.control}
                name="desiredPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio deseado (€)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="500"
                        placeholder="Ej: 35000"
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

              {/* Ubicación (opcional) */}
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ubicación</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Barcelona" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Equipamiento */}
            <div>
              <p className="mb-3 text-sm font-medium leading-none">Equipamiento</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {EQUIPMENT_ITEMS.map((item) => (
                  <FormField
                    key={item.id}
                    control={form.control}
                    name={`equipment.${item.id}` as `equipment.${EquipmentKey}`}
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
