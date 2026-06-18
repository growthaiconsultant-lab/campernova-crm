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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateVehicleSchema, type UpdateVehicleValues } from '@/lib/validators/seller-lead'
import { updateVehicle } from './actions'
import {
  VEHICLE_TRANSITIONS,
  VEHICLE_STATUS_LABELS,
  VEHICLE_STATUS_CLASSES,
} from '@/lib/state-machine'
import type { VehicleStatus } from '@prisma/client'

const EQUIPMENT_ITEMS = [
  { id: 'solar', label: 'Placas solares' },
  { id: 'kitchen', label: 'Cocina' },
  { id: 'bathroom', label: 'Baño' },
  { id: 'shower', label: 'Ducha' },
  { id: 'heating', label: 'Calefacción' },
] as const

type EquipmentKey = (typeof EQUIPMENT_ITEMS)[number]['id']

// ── Opciones taxonomía RV (Fase #3) ──
const CATEGORY_OPTIONS = [
  { value: 'MINI_CAMPER', label: 'Mini camper' },
  { value: 'CAMPER', label: 'Camper compacta' },
  { value: 'GRAN_VOLUMEN', label: 'Gran volumen (furgón)' },
  { value: 'PERFILADA', label: 'Perfilada' },
  { value: 'CAPUCHINA', label: 'Capuchina' },
  { value: 'INTEGRAL', label: 'Integral' },
] as const
const BED_OPTIONS = [
  { value: 'TRANSVERSAL', label: 'Transversal' },
  { value: 'LONGITUDINAL', label: 'Longitudinal' },
  { value: 'GEMELAS', label: 'Camas gemelas' },
  { value: 'ISLA', label: 'Cama isla' },
  { value: 'FRANCESA', label: 'Cama francesa' },
  { value: 'BASCULANTE', label: 'Basculante (techo)' },
  { value: 'LITERAS', label: 'Literas' },
  { value: 'TECHO_ELEVABLE', label: 'Cama en techo elevable' },
  { value: 'DINETTE', label: 'Dinette convertible' },
] as const
const BATHROOM_OPTIONS = [
  { value: 'NINGUNO', label: 'Sin baño' },
  { value: 'HUMEDO', label: 'Baño húmedo (ducha + WC)' },
  { value: 'SEPARADO', label: 'Ducha / WC separados' },
] as const
const HEATING_OPTIONS = [
  { value: 'NINGUNA', label: 'Sin calefacción' },
  { value: 'GAS', label: 'Gas' },
  { value: 'DIESEL', label: 'Diésel' },
  { value: 'ELECTRICA', label: 'Eléctrica' },
] as const

const RV_BOOLEANS = [
  { id: 'winterized', label: 'Preparada invierno' },
  { id: 'hasGarage', label: 'Garaje (bici/moto)' },
  { id: 'offGrid', label: 'Autonomía off-grid' },
] as const

type RvBoolKey = (typeof RV_BOOLEANS)[number]['id']

const NONE = '__none__'

type Props = {
  vehicleId: string
  defaultValues: UpdateVehicleValues
}

export function VehicleEditForm({ vehicleId, defaultValues }: Props) {
  const [saved, setSaved] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const currentStatus = defaultValues.status as VehicleStatus
  const allowedStatuses: VehicleStatus[] = [
    currentStatus,
    ...(VEHICLE_TRANSITIONS[currentStatus] ?? []),
  ]
  const isTerminal = !VEHICLE_TRANSITIONS[currentStatus]

  const form = useForm<UpdateVehicleValues>({
    resolver: zodResolver(updateVehicleSchema),
    defaultValues,
  })

  async function onSubmit(data: UpdateVehicleValues) {
    setSaved(false)
    setServerError(null)
    const result = await updateVehicle(vehicleId, data)
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
          {/* Tipo */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
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

          {/* Estado vehículo */}
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado vehículo</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={isTerminal}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${VEHICLE_STATUS_CLASSES[field.value as VehicleStatus]}`}
                        >
                          {VEHICLE_STATUS_LABELS[field.value as VehicleStatus]}
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {allowedStatuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${VEHICLE_STATUS_CLASSES[s]}`}
                        >
                          {VEHICLE_STATUS_LABELS[s]}
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

          {/* Marca */}
          <FormField
            control={form.control}
            name="brand"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Marca</FormLabel>
                <FormControl>
                  <Input {...field} />
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
                <FormLabel>Modelo</FormLabel>
                <FormControl>
                  <Input {...field} />
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
                <FormLabel>Año</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1980}
                    max={new Date().getFullYear() + 1}
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
                <FormLabel>Kilómetros</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
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
                <FormLabel>Plazas</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={Number.isNaN(field.value) ? '' : (field.value ?? '')}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                  />
                </FormControl>
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
                <FormLabel>Estado conservación</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
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

          {/* Longitud */}
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

          {/* Precio deseado */}
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

          {/* Ubicación */}
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ubicación</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ''} />
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
                      <Checkbox checked={field.value as boolean} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="cursor-pointer font-normal">{item.label}</FormLabel>
                  </FormItem>
                )}
              />
            ))}
          </div>
        </div>

        {/* Ficha técnica (RV) — alimenta el matching */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium leading-none">Ficha técnica (RV)</p>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">
            Cuanto más completes, mejor cuadra el matching con los compradores. Déjalo en blanco si
            no lo sabes.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Categoría / carrocería */}
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Distribución</FormLabel>
                  <Select
                    value={field.value ?? NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin especificar" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>Sin especificar</SelectItem>
                      {CATEGORY_OPTIONS.map((o) => (
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

            {/* Tipo de cama */}
            <FormField
              control={form.control}
              name="bedLayout"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de cama</FormLabel>
                  <Select
                    value={field.value ?? NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin especificar" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>Sin especificar</SelectItem>
                      {BED_OPTIONS.map((o) => (
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

            {/* Baño */}
            <FormField
              control={form.control}
              name="bathroomType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Baño</FormLabel>
                  <Select
                    value={field.value ?? NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin especificar" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>Sin especificar</SelectItem>
                      {BATHROOM_OPTIONS.map((o) => (
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

            {/* Calefacción */}
            <FormField
              control={form.control}
              name="heatingType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Calefacción</FormLabel>
                  <Select
                    value={field.value ?? NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin especificar" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>Sin especificar</SelectItem>
                      {HEATING_OPTIONS.map((o) => (
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

            {/* Plazas para dormir */}
            <FormField
              control={form.control}
              name="sleepingPlaces"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plazas para dormir</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={12}
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

            {/* MMA / peso máximo */}
            <FormField
              control={form.control}
              name="maxMassKg"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>MMA — peso máximo (kg)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step="50"
                      placeholder="p. ej. 3500"
                      value={field.value ?? ''}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? null : Number(e.target.value))
                      }
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {'>'} 3.500 kg exige carnet C1 al comprador.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Altura */}
            <FormField
              control={form.control}
              name="heightM"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Altura (m)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.05"
                      min="0"
                      placeholder="p. ej. 2.85"
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
          </div>

          {/* Flags RV */}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {RV_BOOLEANS.map((item) => (
              <FormField
                key={item.id}
                control={form.control}
                name={item.id as RvBoolKey}
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value === true} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="cursor-pointer font-normal">{item.label}</FormLabel>
                  </FormItem>
                )}
              />
            ))}
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
