'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RV_BED_OPTIONS } from '@/lib/rv-taxonomy'
import {
  ACCESS_STEP_OPTIONS,
  AUX_BATTERY_OPTIONS,
  CAB_BLACKOUT_OPTIONS,
  DINING_TABLE_OPTIONS,
  DRIVETRAIN_OPTIONS,
  ELECTRICAL_SYSTEM_OPTIONS,
  ENERGY_SOURCE_OPTIONS,
  EXTERIOR_CONNECTION_OPTIONS,
  FRIDGE_OPTIONS,
  FUEL_OPTIONS,
  INCLUDED_ACCESSORY_OPTIONS,
  INTERIOR_SOCKET_OPTIONS,
  KITCHEN_POWER_OPTIONS,
  LIFT_BED_OPTIONS,
  LIVING_AC_OPTIONS,
  RECEPTION_VEHICLE_KIND_OPTIONS,
  SWIVEL_SEAT_OPTIONS,
  TRANSMISSION_OPTIONS,
} from '@/lib/vehicle-reception/contracts'
import type {
  CommercialReceptionValues,
  ReceptionQuestionnaireDto,
  ReceptionStatus,
  TechnicalReceptionValues,
} from '@/lib/vehicle-reception/model'
import {
  reviewReceptionSection,
  saveCommercialReception,
  saveTechnicalReception,
  type ReceptionActionResult,
} from '@/app/(backoffice)/vehiculos/[id]/recepcion/actions'

type Option = { readonly value: string; readonly label: string }

function countUnanswered(values: Record<string, unknown>) {
  return Object.values(values).filter(
    (value) =>
      value === null ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0)
  ).length
}

function FieldShell({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function TextField({
  id,
  label,
  value,
  onChange,
  disabled,
  type = 'text',
}: {
  id: string
  label: string
  value: string | null
  onChange: (value: string | null) => void
  disabled: boolean
  type?: 'text' | 'email' | 'tel' | 'date'
}) {
  return (
    <FieldShell label={label} htmlFor={id}>
      <Input
        id={id}
        type={type}
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value || null)}
      />
    </FieldShell>
  )
}

function NumberField({
  id,
  label,
  value,
  onChange,
  disabled,
  min = 0,
  max,
  step = 1,
}: {
  id: string
  label: string
  value: number | null
  onChange: (value: number | null) => void
  disabled: boolean
  min?: number
  max?: number
  step?: number
}) {
  return (
    <FieldShell label={label} htmlFor={id}>
      <Input
        id={id}
        type="number"
        value={value ?? ''}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) =>
          onChange(event.target.value === '' ? null : Number(event.target.value))
        }
      />
    </FieldShell>
  )
}

function TextAreaField({
  id,
  label,
  value,
  onChange,
  disabled,
  maxLength,
}: {
  id: string
  label: string
  value: string | null
  onChange: (value: string | null) => void
  disabled: boolean
  maxLength: number
}) {
  return (
    <FieldShell label={label} htmlFor={id}>
      <Textarea
        id={id}
        value={value ?? ''}
        maxLength={maxLength}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value || null)}
      />
    </FieldShell>
  )
}

function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  id: string
  label: string
  value: T | null
  options: readonly Option[]
  onChange: (value: T | null) => void
  disabled: boolean
}) {
  return (
    <FieldShell label={label} htmlFor={id}>
      <select
        id={id}
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange((event.target.value || null) as T | null)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">Sin responder</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}

function TriStateField({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string
  label: string
  value: boolean | null
  onChange: (value: boolean | null) => void
  disabled: boolean
}) {
  return (
    <SelectField
      id={id}
      label={label}
      value={value === null ? null : value ? 'SI' : 'NO'}
      options={[
        { value: 'SI', label: 'Sí' },
        { value: 'NO', label: 'No' },
      ]}
      onChange={(next) => onChange(next === null ? null : next === 'SI')}
      disabled={disabled}
    />
  )
}

function MultiSelectField({
  legend,
  values,
  options,
  onChange,
  disabled,
}: {
  legend: string
  values: string[]
  options: readonly Option[]
  onChange: (value: string[]) => void
  disabled: boolean
}) {
  return (
    <fieldset className="rounded-md border border-border p-3">
      <legend className="px-1 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {options.map((option) => {
          const checked = values.includes(option.value)
          return (
            <label key={option.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() =>
                  onChange(
                    checked
                      ? values.filter((value) => value !== option.value)
                      : [...values, option.value]
                  )
                }
                className="h-4 w-4 rounded border-input"
              />
              {option.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function Feedback({ result }: { result: ReceptionActionResult | null }) {
  if (!result) return null
  return (
    <div
      role="status"
      className={`rounded-md px-3 py-2 text-sm ${
        result.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
      }`}
    >
      {result.ok ? 'Cambios guardados.' : result.error}
      {!result.ok && result.conflict && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="ml-2 font-semibold underline underline-offset-2"
        >
          Recargar
        </button>
      )}
    </div>
  )
}

function SectionActions({
  pending,
  dirty,
  reviewed,
  unansweredCount,
  canEdit,
  onSave,
  onReview,
}: {
  pending: boolean
  dirty: boolean
  reviewed: boolean
  unansweredCount: number
  canEdit: boolean
  onSave: () => void
  onReview: () => void
}) {
  if (!canEdit) return null
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
      <Button type="button" onClick={onSave} disabled={pending || !dirty}>
        <Save className="mr-2 h-4 w-4" />
        {pending ? 'Guardando…' : 'Guardar borrador'}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={onReview}
        disabled={pending || dirty || reviewed}
      >
        <CheckCircle2 className="mr-2 h-4 w-4" />
        {reviewed ? 'Sección revisada' : 'Marcar sección revisada'}
      </Button>
      {dirty && (
        <span className="text-xs text-amber-700">Guarda los cambios antes de revisar.</span>
      )}
      {!dirty && !reviewed && (
        <span className="text-xs text-muted-foreground">
          {unansweredCount === 0
            ? 'Todos los campos tienen respuesta.'
            : `${unansweredCount} ${unansweredCount === 1 ? 'campo queda' : 'campos quedan'} sin responder.`}
        </span>
      )}
    </div>
  )
}

function CommercialSection({
  vehicleId,
  initial,
  revision: initialRevision,
  reviewed: initiallyReviewed,
  canEdit,
  onResult,
}: {
  vehicleId: string
  initial: CommercialReceptionValues
  revision: number
  reviewed: boolean
  canEdit: boolean
  onResult: (result: ReceptionActionResult) => void
}) {
  const [values, setValues] = useState(initial)
  const [revision, setRevision] = useState(initialRevision)
  const [reviewed, setReviewed] = useState(initiallyReviewed)
  const [dirty, setDirty] = useState(false)
  const [result, setResult] = useState<ReceptionActionResult | null>(null)
  const [pending, startTransition] = useTransition()
  const unansweredCount = countUnanswered(values)

  const update = <K extends keyof CommercialReceptionValues>(
    key: K,
    value: CommercialReceptionValues[K]
  ) => {
    setValues((current) => ({ ...current, [key]: value }))
    setDirty(true)
    setResult(null)
  }

  const save = () => {
    startTransition(async () => {
      const next = await saveCommercialReception(vehicleId, {
        expectedRevision: revision,
        ...values,
      })
      setResult(next)
      onResult(next)
      if (next.ok && next.revision !== undefined) {
        setRevision(next.revision)
        setReviewed(false)
        setDirty(false)
      }
    })
  }

  const review = () => {
    if (
      !window.confirm(
        unansweredCount === 0
          ? '¿Confirmas que esta sección ha sido revisada?'
          : `Quedan ${unansweredCount} ${unansweredCount === 1 ? 'campo' : 'campos'} sin responder. ¿Confirmas que la sección ha sido revisada igualmente?`
      )
    ) {
      return
    }
    startTransition(async () => {
      const next = await reviewReceptionSection(vehicleId, {
        section: 'commercial',
        expectedRevision: revision,
      })
      setResult(next)
      onResult(next)
      if (next.ok) setReviewed(true)
    })
  }

  return (
    <Section
      title="Cliente y condiciones de recepción"
      description="Sección comercial. Taller no recibe estos datos."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TextField
          id="reception-name"
          label="Nombre y apellidos"
          value={values.name}
          onChange={(v) => update('name', v)}
          disabled={!canEdit}
        />
        <TextField
          id="reception-phone"
          label="Teléfono"
          type="tel"
          value={values.phone}
          onChange={(v) => update('phone', v)}
          disabled={!canEdit}
        />
        <TextField
          id="reception-email"
          label="Email"
          type="email"
          value={values.email}
          onChange={(v) => update('email', v)}
          disabled={!canEdit}
        />
        <TextField
          id="reception-date"
          label="Fecha de recepción / tasación"
          type="date"
          value={values.receptionDate}
          onChange={(v) => update('receptionDate', v)}
          disabled={!canEdit}
        />
        <NumberField
          id="reception-owners"
          label="Propietarios anteriores"
          value={values.previousOwners}
          onChange={(v) => update('previousOwners', v)}
          disabled={!canEdit}
          max={100}
        />
        <TriStateField
          id="reception-maintenance"
          label="Historial de mantenimiento disponible"
          value={values.maintenanceHistoryAvailable}
          onChange={(v) => update('maintenanceHistoryAvailable', v)}
          disabled={!canEdit}
        />
        <NumberField
          id="reception-min-price"
          label="Precio mínimo (€)"
          value={values.minPrice}
          onChange={(v) => update('minPrice', v)}
          disabled={!canEdit}
          min={0.01}
          step={0.01}
        />
      </div>
      <TextAreaField
        id="reception-sale-reason"
        label="Motivo de la venta"
        value={values.saleReason}
        onChange={(v) => update('saleReason', v)}
        disabled={!canEdit}
        maxLength={1000}
      />
      <Feedback result={result} />
      <SectionActions
        pending={pending}
        dirty={dirty}
        reviewed={reviewed}
        unansweredCount={unansweredCount}
        canEdit={canEdit}
        onSave={save}
        onReview={review}
      />
    </Section>
  )
}

function TechnicalSection({
  vehicleId,
  initial,
  revision: initialRevision,
  reviewed: initiallyReviewed,
  canEdit,
  onResult,
}: {
  vehicleId: string
  initial: TechnicalReceptionValues
  revision: number
  reviewed: boolean
  canEdit: boolean
  onResult: (result: ReceptionActionResult) => void
}) {
  const [values, setValues] = useState(initial)
  const [revision, setRevision] = useState(initialRevision)
  const [reviewed, setReviewed] = useState(initiallyReviewed)
  const [dirty, setDirty] = useState(false)
  const [result, setResult] = useState<ReceptionActionResult | null>(null)
  const [pending, startTransition] = useTransition()
  const unansweredCount = countUnanswered(values)

  const update = <K extends keyof TechnicalReceptionValues>(
    key: K,
    value: TechnicalReceptionValues[K]
  ) => {
    setValues((current) => ({ ...current, [key]: value }))
    setDirty(true)
    setResult(null)
  }

  const save = () => {
    startTransition(async () => {
      const next = await saveTechnicalReception(vehicleId, {
        expectedRevision: revision,
        ...values,
      })
      setResult(next)
      onResult(next)
      if (next.ok && next.revision !== undefined) {
        setRevision(next.revision)
        setReviewed(false)
        setDirty(false)
      }
    })
  }

  const review = () => {
    if (
      !window.confirm(
        unansweredCount === 0
          ? '¿Confirmas que esta sección ha sido revisada?'
          : `Quedan ${unansweredCount} ${unansweredCount === 1 ? 'campo' : 'campos'} sin responder. ¿Confirmas que la sección ha sido revisada igualmente?`
      )
    ) {
      return
    }
    startTransition(async () => {
      const next = await reviewReceptionSection(vehicleId, {
        section: 'technical',
        expectedRevision: revision,
      })
      setResult(next)
      onResult(next)
      if (next.ok) setReviewed(true)
    })
  }

  return (
    <div className="space-y-5">
      <Section title="Datos generales del vehículo">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            id="technical-brand"
            label="Marca"
            value={values.brand}
            onChange={(v) => update('brand', v)}
            disabled={!canEdit}
          />
          <TextField
            id="technical-model"
            label="Modelo"
            value={values.model}
            onChange={(v) => update('model', v)}
            disabled={!canEdit}
          />
          <TextField
            id="technical-version"
            label="Versión"
            value={values.modelVersion}
            onChange={(v) => update('modelVersion', v)}
            disabled={!canEdit}
          />
          <NumberField
            id="technical-year"
            label="Año de matriculación"
            value={values.year}
            onChange={(v) => update('year', v)}
            disabled={!canEdit}
            min={1980}
            max={new Date().getFullYear() + 1}
          />
          <SelectField
            id="technical-kind"
            label="Tipo de vehículo"
            value={values.vehicleKind}
            options={RECEPTION_VEHICLE_KIND_OPTIONS}
            onChange={(v) => update('vehicleKind', v)}
            disabled={!canEdit}
          />
          <SelectField
            id="technical-bed"
            label="Distribución interior"
            value={values.bedLayout}
            options={RV_BED_OPTIONS}
            onChange={(v) => update('bedLayout', v)}
            disabled={!canEdit}
          />
          <TextField
            id="technical-engine"
            label="Motor"
            value={values.engine}
            onChange={(v) => update('engine', v)}
            disabled={!canEdit}
          />
          <NumberField
            id="technical-power"
            label="Potencia (CV)"
            value={values.powerCv}
            onChange={(v) => update('powerCv', v)}
            disabled={!canEdit}
            min={1}
            max={1500}
          />
          <SelectField
            id="technical-transmission"
            label="Cambio"
            value={values.transmission}
            options={TRANSMISSION_OPTIONS}
            onChange={(v) => update('transmission', v)}
            disabled={!canEdit}
          />
          <SelectField
            id="technical-drivetrain"
            label="Tracción"
            value={values.drivetrain}
            options={DRIVETRAIN_OPTIONS}
            onChange={(v) => update('drivetrain', v)}
            disabled={!canEdit}
          />
          <SelectField
            id="technical-fuel"
            label="Combustible"
            value={values.fuelType}
            options={FUEL_OPTIONS}
            onChange={(v) => update('fuelType', v)}
            disabled={!canEdit}
          />
          <NumberField
            id="technical-km"
            label="Kilometraje actual"
            value={values.km}
            onChange={(v) => update('km', v)}
            disabled={!canEdit}
            max={10_000_000}
          />
          <NumberField
            id="technical-seats"
            label="Plazas para viajar"
            value={values.seats}
            onChange={(v) => update('seats', v)}
            disabled={!canEdit}
            min={1}
            max={20}
          />
          <NumberField
            id="technical-sleeping"
            label="Plazas para dormir"
            value={values.sleepingPlaces}
            onChange={(v) => update('sleepingPlaces', v)}
            disabled={!canEdit}
            max={20}
          />
          <TextField
            id="technical-itv"
            label="ITV vigente hasta"
            type="date"
            value={values.itvValidUntil}
            onChange={(v) => update('itvValidUntil', v)}
            disabled={!canEdit}
          />
          <TextField
            id="technical-service"
            label="Última revisión"
            type="date"
            value={values.lastServiceDate}
            onChange={(v) => update('lastServiceDate', v)}
            disabled={!canEdit}
          />
        </div>
      </Section>

      <Section title="Estado y accesorios">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextAreaField
            id="technical-exterior-damage"
            label="Daños exteriores"
            value={values.externalDamageNotes}
            onChange={(v) => update('externalDamageNotes', v)}
            disabled={!canEdit}
            maxLength={2000}
          />
          <TextAreaField
            id="technical-interior-damage"
            label="Daños interiores"
            value={values.internalDamageNotes}
            onChange={(v) => update('internalDamageNotes', v)}
            disabled={!canEdit}
            maxLength={2000}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField
            id="technical-skylights"
            label="Número de claraboyas"
            value={values.skylightCount}
            onChange={(v) => update('skylightCount', v)}
            disabled={!canEdit}
            max={50}
          />
          <NumberField
            id="technical-windows"
            label="Número de ventanas"
            value={values.windowCount}
            onChange={(v) => update('windowCount', v)}
            disabled={!canEdit}
            max={100}
          />
          <TriStateField
            id="technical-awning"
            label="Toldo lateral"
            value={values.hasSideAwning}
            onChange={(v) => update('hasSideAwning', v)}
            disabled={!canEdit}
          />
          <TriStateField
            id="technical-bike-rack"
            label="Portabicicletas"
            value={values.hasBikeRack}
            onChange={(v) => update('hasBikeRack', v)}
            disabled={!canEdit}
          />
          <SelectField
            id="technical-step"
            label="Escalón de acceso"
            value={values.accessStepType}
            options={ACCESS_STEP_OPTIONS}
            onChange={(v) => update('accessStepType', v)}
            disabled={!canEdit}
          />
          <TriStateField
            id="technical-outdoor-shower"
            label="Ducha exterior"
            value={values.hasOutdoorShower}
            onChange={(v) => update('hasOutdoorShower', v)}
            disabled={!canEdit}
          />
          <SelectField
            id="technical-lift-bed"
            label="Cama elevable"
            value={values.liftBedType}
            options={LIFT_BED_OPTIONS}
            onChange={(v) => update('liftBedType', v)}
            disabled={!canEdit}
          />
          <TriStateField
            id="technical-bunks"
            label="Literas"
            value={values.hasBunkBeds}
            onChange={(v) => update('hasBunkBeds', v)}
            disabled={!canEdit}
          />
          <SelectField
            id="technical-swivel"
            label="Asientos giratorios"
            value={values.swivelSeats}
            options={SWIVEL_SEAT_OPTIONS}
            onChange={(v) => update('swivelSeats', v)}
            disabled={!canEdit}
          />
          <SelectField
            id="technical-table"
            label="Mesa comedor"
            value={values.diningTableType}
            options={DINING_TABLE_OPTIONS}
            onChange={(v) => update('diningTableType', v)}
            disabled={!canEdit}
          />
          <TriStateField
            id="technical-led"
            label="Iluminación LED interior"
            value={values.hasInteriorLed}
            onChange={(v) => update('hasInteriorLed', v)}
            disabled={!canEdit}
          />
          <SelectField
            id="technical-blackout"
            label="Oscurecedores cabina"
            value={values.cabBlackoutType}
            options={CAB_BLACKOUT_OPTIONS}
            onChange={(v) => update('cabBlackoutType', v)}
            disabled={!canEdit}
          />
          <TriStateField
            id="technical-tv"
            label="Sistema multimedia / TV"
            value={values.hasMultimediaTv}
            onChange={(v) => update('hasMultimediaTv', v)}
            disabled={!canEdit}
          />
        </div>
        <MultiSelectField
          legend="Tomas exteriores"
          values={values.exteriorConnections}
          options={EXTERIOR_CONNECTION_OPTIONS}
          onChange={(v) =>
            update('exteriorConnections', v as TechnicalReceptionValues['exteriorConnections'])
          }
          disabled={!canEdit}
        />
      </Section>

      <Section title="Cocina y agua">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField
            id="technical-fridge"
            label="Nevera"
            value={values.fridgeType}
            options={FRIDGE_OPTIONS}
            onChange={(v) => update('fridgeType', v)}
            disabled={!canEdit}
          />
          <TriStateField
            id="technical-sink"
            label="Fregadero"
            value={values.hasSink}
            onChange={(v) => update('hasSink', v)}
            disabled={!canEdit}
          />
          <TriStateField
            id="technical-bathroom"
            label="Baño completo"
            value={values.hasFullBathroom}
            onChange={(v) => update('hasFullBathroom', v)}
            disabled={!canEdit}
          />
          <TriStateField
            id="technical-wc"
            label="WC químico / cassette extraíble"
            value={values.hasRemovableCassetteToilet}
            onChange={(v) => update('hasRemovableCassetteToilet', v)}
            disabled={!canEdit}
          />
          <NumberField
            id="technical-fresh-water"
            label="Aguas limpias (l)"
            value={values.freshWaterLiters}
            onChange={(v) => update('freshWaterLiters', v)}
            disabled={!canEdit}
            max={5000}
          />
          <NumberField
            id="technical-grey-water"
            label="Aguas grises (l)"
            value={values.greyWaterLiters}
            onChange={(v) => update('greyWaterLiters', v)}
            disabled={!canEdit}
            max={5000}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <MultiSelectField
            legend="Cocina"
            values={values.kitchenPowerSources}
            options={KITCHEN_POWER_OPTIONS}
            onChange={(v) =>
              update('kitchenPowerSources', v as TechnicalReceptionValues['kitchenPowerSources'])
            }
            disabled={!canEdit}
          />
          <MultiSelectField
            legend="Calentador de agua"
            values={values.waterHeaterSources}
            options={ENERGY_SOURCE_OPTIONS}
            onChange={(v) =>
              update('waterHeaterSources', v as TechnicalReceptionValues['waterHeaterSources'])
            }
            disabled={!canEdit}
          />
          <MultiSelectField
            legend="Calefacción"
            values={values.heatingSources}
            options={ENERGY_SOURCE_OPTIONS}
            onChange={(v) =>
              update('heatingSources', v as TechnicalReceptionValues['heatingSources'])
            }
            disabled={!canEdit}
          />
        </div>
      </Section>

      <Section title="Energía, autonomía y climatización">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField
            id="technical-battery"
            label="Batería auxiliar"
            value={values.auxBatteryType}
            options={AUX_BATTERY_OPTIONS}
            onChange={(v) => update('auxBatteryType', v)}
            disabled={!canEdit}
          />
          <NumberField
            id="technical-battery-ah"
            label="Capacidad batería (Ah)"
            value={values.auxBatteryCapacityAh}
            onChange={(v) => update('auxBatteryCapacityAh', v)}
            disabled={!canEdit}
            max={5000}
          />
          <SelectField
            id="technical-electrical"
            label="Sistema eléctrico"
            value={values.electricalSystem}
            options={ELECTRICAL_SYSTEM_OPTIONS}
            onChange={(v) => update('electricalSystem', v)}
            disabled={!canEdit}
          />
          <TriStateField
            id="technical-solar"
            label="Placa solar"
            value={values.hasSolarPanel}
            onChange={(v) => update('hasSolarPanel', v)}
            disabled={!canEdit}
          />
          <NumberField
            id="technical-solar-w"
            label="Potencia solar (W)"
            value={values.solarPowerW}
            onChange={(v) => update('solarPowerW', v)}
            disabled={!canEdit}
            max={10_000}
          />
          <NumberField
            id="technical-regulator-w"
            label="Potencia regulador (W)"
            value={values.solarRegulatorPowerW}
            onChange={(v) => update('solarRegulatorPowerW', v)}
            disabled={!canEdit}
            max={10_000}
          />
          <TriStateField
            id="technical-inverter"
            label="Convertidor / inversor"
            value={values.hasInverter}
            onChange={(v) => update('hasInverter', v)}
            disabled={!canEdit}
          />
          <TriStateField
            id="technical-external-230"
            label="Conexión exterior 230 V"
            value={values.hasExternal230vConnection}
            onChange={(v) => update('hasExternal230vConnection', v)}
            disabled={!canEdit}
          />
          <TriStateField
            id="technical-cab-ac"
            label="Aire acondicionado cabina"
            value={values.hasCabAirConditioning}
            onChange={(v) => update('hasCabAirConditioning', v)}
            disabled={!canEdit}
          />
          <SelectField
            id="technical-living-ac"
            label="Aire acondicionado vivienda"
            value={values.livingAirConditioning}
            options={LIVING_AC_OPTIONS}
            onChange={(v) => update('livingAirConditioning', v)}
            disabled={!canEdit}
          />
          <TriStateField
            id="technical-fans"
            label="Ventiladores / extractores"
            value={values.hasFansExtractors}
            onChange={(v) => update('hasFansExtractors', v)}
            disabled={!canEdit}
          />
        </div>
        <MultiSelectField
          legend="Tomas interiores"
          values={values.interiorSockets}
          options={INTERIOR_SOCKET_OPTIONS}
          onChange={(v) =>
            update('interiorSockets', v as TechnicalReceptionValues['interiorSockets'])
          }
          disabled={!canEdit}
        />
      </Section>

      <Section title="Documentación, accesorios y notas">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TriStateField
            id="technical-homologation"
            label="Homologación camperización"
            value={values.hasCamperizationHomologation}
            onChange={(v) => update('hasCamperizationHomologation', v)}
            disabled={!canEdit}
          />
          <TriStateField
            id="technical-book"
            label="Libro de mantenimiento"
            value={values.hasMaintenanceBook}
            onChange={(v) => update('hasMaintenanceBook', v)}
            disabled={!canEdit}
          />
          <NumberField
            id="technical-keys"
            label="Llaves disponibles declaradas"
            value={values.declaredKeysCount}
            onChange={(v) => update('declaredKeysCount', v)}
            disabled={!canEdit}
            max={10}
          />
        </div>
        <MultiSelectField
          legend="Accesorios incluidos"
          values={values.includedAccessories}
          options={INCLUDED_ACCESSORY_OPTIONS}
          onChange={(v) =>
            update('includedAccessories', v as TechnicalReceptionValues['includedAccessories'])
          }
          disabled={!canEdit}
        />
        <TextAreaField
          id="technical-accessories-other"
          label="Otros accesorios"
          value={values.accessoriesOther}
          onChange={(v) => update('accessoriesOther', v)}
          disabled={!canEdit}
          maxLength={1000}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <TextAreaField
            id="technical-extras"
            label="Extras"
            value={values.extrasNotes}
            onChange={(v) => update('extrasNotes', v)}
            disabled={!canEdit}
            maxLength={4000}
          />
          <TextAreaField
            id="technical-observations"
            label="Observaciones adicionales"
            value={values.additionalObservations}
            onChange={(v) => update('additionalObservations', v)}
            disabled={!canEdit}
            maxLength={4000}
          />
        </div>
        <Feedback result={result} />
        <SectionActions
          pending={pending}
          dirty={dirty}
          reviewed={reviewed}
          unansweredCount={unansweredCount}
          canEdit={canEdit}
          onSave={save}
          onReview={review}
        />
      </Section>
    </div>
  )
}

export function VehicleReceptionQuestionnaire({ data }: { data: ReceptionQuestionnaireDto }) {
  const router = useRouter()
  const [status, setStatus] = useState<ReceptionStatus>(data.status)
  const [completedAt, setCompletedAt] = useState(data.completedAt)

  const handleResult = (result: ReceptionActionResult) => {
    if (!result.ok) return
    setStatus(result.status)
    if ('completedAt' in result && result.completedAt !== undefined) {
      setCompletedAt(result.completedAt)
    } else if (result.status === 'BORRADOR') {
      setCompletedAt(null)
    }
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
        <div>
          <h2 className="text-lg font-semibold">Cuestionario de recepción</h2>
          <p className="text-sm text-muted-foreground">
            Un único expediente compartido por Comercial y Taller. Los campos vacíos significan “sin
            comprobar”.
          </p>
        </div>
        <div className="text-right">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${status === 'COMPLETADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
          >
            {status === 'COMPLETADO' ? (
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            ) : (
              <AlertTriangle className="mr-1 h-3.5 w-3.5" />
            )}
            {status === 'COMPLETADO' ? 'Completo' : 'Borrador'}
          </span>
          {completedAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              Revisado {new Date(completedAt).toLocaleString('es-ES')}
            </p>
          )}
        </div>
      </div>

      {data.commercial.values && (
        <CommercialSection
          vehicleId={data.vehicleId}
          initial={data.commercial.values}
          revision={data.commercial.revision}
          reviewed={data.commercial.reviewed}
          canEdit={data.canEditCommercial}
          onResult={handleResult}
        />
      )}

      <TechnicalSection
        vehicleId={data.vehicleId}
        initial={data.technical.values}
        revision={data.technical.revision}
        reviewed={data.technical.reviewed}
        canEdit={data.canEditTechnical}
        onResult={handleResult}
      />
    </div>
  )
}
