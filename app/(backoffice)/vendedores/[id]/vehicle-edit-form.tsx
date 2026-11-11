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
import { toast } from 'sonner'
import { formatEur } from '@/lib/format/currency'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateVehicleSchema, type UpdateVehicleValues } from '@/lib/validators/seller-lead'
import { RV_HEATING_OPTIONS, RV_NONE } from '@/lib/rv-taxonomy'
import { CatalogFields } from '@/components/match-catalog-fields'
import type { Catalog } from '@/lib/matching/catalog'
import { editableCharacteristics, inferredPresence } from '@/lib/matching/vehicle-characteristics'
import { Sparkles, Loader2 } from 'lucide-react'
import { updateVehicle } from './actions'
import { suggestVehicleRvTaxonomy } from './rv-suggest-actions'
import {
  VEHICLE_TRANSITIONS,
  VEHICLE_STATUS_LABELS,
  VEHICLE_STATUS_CLASSES,
} from '@/lib/state-machine'
import type { VehicleStatus } from '@prisma/client'

const HEATING_OPTIONS = RV_HEATING_OPTIONS
const NONE = RV_NONE

const RV_BOOLEANS = [
  { id: 'winterized', label: 'Preparada invierno' },

  { id: 'offGrid', label: 'Autonomía off-grid' },
] as const

type RvBoolKey = (typeof RV_BOOLEANS)[number]['id']

const drivingFields = ['format', 'gearbox']
const sleepingFields = ['beds', 'lounge']
const kitchenBathFields = [
  'interiorBath',
  'wc',
  'showerOptions',
  'shower',
  'kitchen',
  'kitchenMount',
]
const autonomyFields = ['solar', 'battery', 'autonomy', 'hotWater', 'garage', 'garageBikes']
const primaryFields = [...drivingFields, ...sleepingFields, ...kitchenBathFields, ...autonomyFields]

function ChecklistGroup({
  title,
  answers,
  children,
}: {
  title: string
  answers: unknown[]
  children: React.ReactNode
}) {
  const reviewed = answers.filter(
    (value) => value !== null && value !== undefined && value !== ''
  ).length
  return (
    <details className="rounded-lg border">
      <summary className="cursor-pointer px-3 py-3 font-medium">
        {title}{' '}
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          {reviewed} de {answers.length} revisados
        </span>
      </summary>
      <div className="grid gap-3 border-t p-3 sm:grid-cols-2">{children}</div>
    </details>
  )
}

type Props = {
  catalog: Catalog
  salePrice: number | null
  version: string
  vehicleId: string
  defaultValues: UpdateVehicleValues
}

export function VehicleEditForm({ vehicleId, defaultValues, catalog, version, salePrice }: Props) {
  const [serverError, setServerError] = useState<string | null>(null)

  const [features, setFeatures] = useState(() => editableCharacteristics(catalog, defaultValues))
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

  function changeFeatures(next: Catalog) {
    if (features.interiorBath && !next.interiorBath) form.setValue('equipment.bathroom', false)
    setFeatures(next)
  }
  const values = form.watch()
  const answers = (ids: string[]) =>
    ids.map((id) => features[id]?.values[0] ?? inferredPresence(features, id))
  const catalogInputs = (ids: string[]) =>
    ids.map((id) => (
      <CatalogFields
        key={id}
        fieldId={id}
        buyer={false}
        unifiedVehicle
        family={values.type}
        value={features}
        onChange={changeFeatures}
      />
    ))
  const [suggesting, setSuggesting] = useState(false)
  const [suggestNote, setSuggestNote] = useState<string | null>(null)
  const [suggestError, setSuggestError] = useState<string | null>(null)

  async function handleSuggest() {
    setSuggesting(true)
    setSuggestNote(null)
    setSuggestError(null)
    try {
      const res = await suggestVehicleRvTaxonomy(vehicleId)
      if ('error' in res) {
        setSuggestError(res.error)
        return
      }
      const s = res.suggestion
      const dirty = { shouldDirty: true } as const
      // La IA solo AÑADE información: rellena lo que propone con criterio y no borra
      // lo que ya hubiera (los null se ignoran; el equipamiento solo se activa, no se apaga).
      setFeatures((current) => editableCharacteristics(current, s))
      if (!features.heating && s.heatingType !== null)
        form.setValue('heatingType', s.heatingType, dirty)
      if (form.getValues('sleepingPlaces') == null && s.sleepingPlaces !== null)
        form.setValue('sleepingPlaces', s.sleepingPlaces, dirty)
      if (form.getValues('maxMassKg') == null && s.maxMassKg !== null)
        form.setValue('maxMassKg', s.maxMassKg, dirty)
      if (form.getValues('heightM') == null && s.heightM !== null)
        form.setValue('heightM', s.heightM, dirty)
      if (form.getValues('length') == null && s.length !== null)
        form.setValue('length', s.length, dirty)
      if (form.getValues('winterized') == null && s.winterized !== null)
        form.setValue('winterized', s.winterized, dirty)
      if (form.getValues('offGrid') == null && s.offGrid !== null)
        form.setValue('offGrid', s.offGrid, dirty)
      setSuggestNote(
        s.notes
          ? `Sugerido por IA — revisa y guarda. ${s.notes}`
          : 'Sugerido por IA — revisa los campos y pulsa Guardar.'
      )
    } catch {
      setSuggestError('No se pudieron analizar las fotos. Puedes seguir completando el checklist.')
    } finally {
      setSuggesting(false)
    }
  }

  async function onSubmit(data: UpdateVehicleValues) {
    setServerError(null)
    try {
      const result = await updateVehicle(vehicleId, data, { catalog: features, version })
      if ('error' in result) {
        const fe = (result.error as { formErrors?: string[] })?.formErrors
        setServerError(fe?.[0] ?? 'Error al guardar. Revisa los datos.')
        return
      }
      toast.success('Checklist guardado.')
    } catch {
      setServerError('No se pudo confirmar el guardado. Revisa la conexión y vuelve a intentarlo.')
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, () =>
          setServerError('Revisa los campos marcados antes de guardar.')
        )}
        className="space-y-3"
      >
        <fieldset disabled={form.formState.isSubmitting} className="min-w-0 space-y-3">
          <p className="text-sm text-muted-foreground">
            Registra lo que hayas comprobado. Puedes guardar ahora y continuar en la próxima visita.
          </p>
          <p className="text-sm font-medium">
            {[
              [values.brand, values.model, values.year].filter(Boolean).join(' '),
              salePrice == null
                ? 'Sin precio de venta'
                : 'Precio de venta · ' + formatEur(salePrice, 'cents'),
              salePrice == null && values.desiredPrice != null && values.desiredPrice !== ''
                ? 'Precio deseado · ' + formatEur(Number(values.desiredPrice), 'cents')
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <ChecklistGroup
            title="Vehículo y conducción"
            answers={[
              values.type,
              values.brand,
              values.model,
              values.year,
              values.km,
              values.seats,
              values.length,
              values.heightM,
              values.maxMassKg,
              ...answers(drivingFields),
            ]}
          >
            {/* Tipo */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? undefined}>
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
            {/* Marca */}
            <FormField
              control={form.control}
              name="brand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Marca</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
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
                    <Input {...field} value={field.value ?? ''} />
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
                      value={typeof field.value === 'number' ? field.value : ''}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? null : e.target.valueAsNumber)
                      }
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
                      value={typeof field.value === 'number' ? field.value : ''}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? null : e.target.valueAsNumber)
                      }
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
                  <FormLabel>Plazas homologadas para viajar</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={typeof field.value === 'number' ? field.value : ''}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? null : e.target.valueAsNumber)
                      }
                    />
                  </FormControl>
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
                      value={typeof field.value === 'number' ? field.value : ''}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? null : Number(e.target.value))
                      }
                    />
                  </FormControl>
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
            {catalogInputs(drivingFields)}
          </ChecklistGroup>
          <ChecklistGroup
            title="Distribución y descanso"
            answers={[values.sleepingPlaces, ...answers(sleepingFields)]}
          >
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
            {catalogInputs(sleepingFields)}
          </ChecklistGroup>
          <ChecklistGroup title="Baño y cocina" answers={answers(kitchenBathFields)}>
            {catalogInputs(kitchenBathFields)}
          </ChecklistGroup>
          <ChecklistGroup
            title="Autonomía y equipamiento"
            answers={[
              values.winterized,
              values.offGrid,
              ...answers(['heating', ...autonomyFields]),
            ]}
          >
            {/* Calefacción */}
            <FormField
              control={form.control}
              name="heatingType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Calefacción</FormLabel>
                  <Select
                    value={
                      features.heating?.values[0] === 'No'
                        ? 'NINGUNA'
                        : features.heating
                          ? field.value && field.value !== 'NINGUNA'
                            ? field.value
                            : 'PRESENTE'
                          : NONE
                    }
                    onValueChange={(v) => {
                      field.onChange(v === NONE || v === 'PRESENTE' ? null : v)
                      const next = { ...features }
                      if (v === NONE) delete next.heating
                      else next.heating = { values: [v === 'NINGUNA' ? 'No' : 'Sí'] }
                      setFeatures(next)
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Por comprobar" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>Por comprobar</SelectItem>
                      <SelectItem value="PRESENTE">Sí, fuente por confirmar</SelectItem>
                      {HEATING_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.value === 'NINGUNA' ? 'No tiene' : o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {RV_BOOLEANS.map((item) => (
              <FormField
                key={item.id}
                control={form.control}
                name={item.id as RvBoolKey}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{item.label}</FormLabel>
                    <FormControl>
                      <select
                        className="block w-full rounded-md border bg-background p-2 text-sm"
                        value={field.value == null ? '' : field.value ? 'yes' : 'no'}
                        onChange={(ev) =>
                          field.onChange(ev.target.value === '' ? null : ev.target.value === 'yes')
                        }
                      >
                        <option value="">Por comprobar</option>
                        <option value="yes">Sí</option>
                        <option value="no">No tiene</option>
                      </select>
                    </FormControl>
                  </FormItem>
                )}
              />
            ))}
            {catalogInputs(autonomyFields)}
          </ChecklistGroup>
          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer font-medium">
              Otras características del vehículo
            </summary>
            <div className="mt-3">
              <CatalogFields
                buyer={false}
                family={values.type}
                value={features}
                onChange={changeFeatures}
                unifiedVehicle
                excludedFields={primaryFields}
              />
            </div>
          </details>
          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer font-medium">Datos de gestión del vehículo</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {/* Estado vehículo */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado vehículo</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isTerminal}
                    >
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
              {/* Precio deseado */}
              <FormField
                control={form.control}
                name="desiredPrice"
                render={({ field }) => (
                  <FormItem id="prep-desired-price" tabIndex={-1}>
                    <FormLabel>Precio deseado (€)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="500"
                        value={typeof field.value === 'number' ? field.value : ''}
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
          </details>
          {suggestNote && (
            <p className="mb-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              {suggestNote}
            </p>
          )}
          {suggestError && <p className="mb-3 text-xs text-destructive">{suggestError}</p>}

          {serverError && (
            <p role="alert" className="text-sm text-destructive">
              {serverError}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={form.formState.isSubmitting || suggesting}>
              {form.formState.isSubmitting ? 'Guardando…' : 'Guardar checklist'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSuggest}
              disabled={suggesting}
              className="shrink-0"
            >
              {suggesting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              {suggesting ? 'Analizando fotos…' : 'Sugerir con IA'}
            </Button>
          </div>
        </fieldset>
      </form>
    </Form>
  )
}
