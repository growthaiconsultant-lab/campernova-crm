'use client'

/**
 * PR-A2 (corrección 7.5) — Panel operable de la entrada oficial en la ficha del vendedor.
 *
 * Cablea las server actions de `entry-actions.ts` a controles reales:
 *   · registrar la llegada física (AGENTE) — hito previo a validar;
 *   · clasificar la disposición documental por categoría (AGENTE);
 *   · validar la entrada oficial con ubicación de aparcamiento + custodia de llaves (AGENTE);
 *   · anular la entrada (ADMIN) con motivo estructurado y notas obligatorias en «Otro».
 *
 * Muestra el estado (llegada / validada / anulada con actor + fecha), el checklist documental
 * derivado y un enlace a la orden de inspección creada en Taller. Los `EntryError` que devuelven las
 * acciones ya son mensajes amables: se surfacean con toast + banner inline.
 */
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  CheckCircle2,
  Truck,
  KeyRound,
  ShieldX,
  AlertTriangle,
  ClipboardCheck,
  ExternalLink,
} from 'lucide-react'
import {
  registerPhysicalArrival,
  validateEntry,
  annulEntry,
  setDocumentDisposition,
} from './entry-actions'
import { ENTRY_REQUIRE_PRECONDITIONS } from '@/lib/entry/config'

// ── Tipos serializados desde el RSC ─────────────────────────────────────────────

export type DocChecklistRow = {
  category: string
  label: string
  /** RECIBIDO | PENDIENTE | NO_DISPONIBLE | NO_APLICABLE | SIN_CLASIFICAR */
  state: string
  /** true para CONTRATO_GESTION: no se satisface con disposición (requiere doc vigente). */
  requiresDocument: boolean
}

export type EntryPanelProps = {
  vehicleId: string
  isAdmin: boolean
  responsibleName: string | null
  arrivalAt: string | null
  arrivalByName: string | null
  validatedAt: string | null
  validatedByName: string | null
  annulledAt: string | null
  annulledByName: string | null
  annulmentReason: string | null
  annulmentNotes: string | null
  keysCount: number | null
  keysLocation: string | null
  keysNotes: string | null
  parkingLocation: string | null
  checklist: DocChecklistRow[]
  /** Orden INSPECCION_ENTRADA activa creada al validar (para el enlace a Taller). */
  inspectionOrderId: string | null
}

const ANNULMENT_REASON_OPTIONS: { value: string; label: string }[] = [
  { value: 'PROPIETARIO_DESISTE', label: 'El propietario desiste' },
  { value: 'VEHICULO_RETIRADO', label: 'Vehículo retirado' },
  { value: 'CONTRATO_ANULADO', label: 'Contrato anulado' },
  { value: 'DATOS_DOCUMENTACION_INVALIDOS', label: 'Datos/documentación inválidos' },
  { value: 'VEHICULO_NO_ACEPTADO', label: 'Vehículo no aceptado' },
  { value: 'DUPLICADO', label: 'Duplicado' },
  { value: 'ERROR_ADMINISTRATIVO', label: 'Error administrativo' },
  { value: 'OTRO', label: 'Otro (requiere notas)' },
]

const DISPOSITION_OPTIONS: { value: string; label: string }[] = [
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'NO_DISPONIBLE', label: 'No disponible' },
  { value: 'NO_APLICABLE', label: 'No aplicable' },
]

const STATE_META: Record<string, { label: string; className: string }> = {
  RECIBIDO: { label: 'Recibido', className: 'bg-green-100 text-green-700' },
  PENDIENTE: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700' },
  NO_DISPONIBLE: { label: 'No disponible', className: 'bg-slate-100 text-slate-600' },
  NO_APLICABLE: { label: 'No aplicable', className: 'bg-slate-100 text-slate-600' },
  SIN_CLASIFICAR: { label: 'Sin clasificar', className: 'bg-red-100 text-red-700' },
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

const selectClass =
  'h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

export function EntryPanel(props: EntryPanelProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const isAnnulled = props.annulledAt != null
  const isValidated = props.validatedAt != null && !isAnnulled
  const hasArrival = props.arrivalAt != null
  // Estado terminal de la entrada: anulada. Activa: validada y no anulada.
  const canRegisterArrival = !hasArrival && !isValidated && !isAnnulled
  // Fase de arranque: la llegada física deja de ser requisito para validar (ENTRY_REQUIRE_PRECONDITIONS).
  const canValidate =
    !isValidated && !isAnnulled && (ENTRY_REQUIRE_PRECONDITIONS ? hasArrival : true)
  const canAnnul = props.isAdmin && isValidated

  // ── Sub-acciones ─────────────────────────────────────────────────────────────
  const [arrivalPending, startArrival] = useTransition()
  const [validatePending, startValidate] = useTransition()
  const [annulPending, startAnnul] = useTransition()

  const [parking, setParking] = useState(props.parkingLocation ?? '')
  const [keysCount, setKeysCount] = useState(
    props.keysCount != null ? String(props.keysCount) : '1'
  )
  const [keysLocation, setKeysLocation] = useState(props.keysLocation ?? '')
  const [keysNotes, setKeysNotes] = useState(props.keysNotes ?? '')

  const [annulReason, setAnnulReason] = useState('DUPLICADO')
  const [annulNotes, setAnnulNotes] = useState('')

  function handleArrival() {
    setError(null)
    startArrival(async () => {
      const res = await registerPhysicalArrival({ vehicleId: props.vehicleId })
      if (res.ok) {
        toast.success(
          res.data?.alreadyRegistered ? 'La llegada ya estaba registrada' : 'Llegada registrada'
        )
        router.refresh()
      } else {
        setError(res.error)
        toast.error(res.error)
      }
    })
  }

  function handleValidate() {
    setError(null)
    startValidate(async () => {
      const res = await validateEntry({
        vehicleId: props.vehicleId,
        parkingLocation: parking,
        keysCount,
        keysLocation,
        keysNotes: keysNotes.trim() || null,
      })
      if (res.ok) {
        toast.success('Entrada oficial validada')
        router.refresh()
      } else {
        setError(res.error)
        toast.error(res.error)
      }
    })
  }

  function handleAnnul() {
    setError(null)
    startAnnul(async () => {
      const res = await annulEntry({
        vehicleId: props.vehicleId,
        reason: annulReason,
        notes: annulNotes.trim() || null,
      })
      if (res.ok) {
        toast.success('Entrada anulada')
        router.refresh()
      } else {
        setError(res.error)
        toast.error(res.error)
      }
    })
  }

  function handleDisposition(category: string, value: string) {
    setError(null)
    setDocumentDisposition({
      vehicleId: props.vehicleId,
      category,
      disposition: value === '' ? null : value,
    }).then((res) => {
      if (res.ok) {
        toast.success('Disposición actualizada')
        router.refresh()
      } else {
        setError(res.error)
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Estado de la entrada */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StateTile
          icon={<Truck className="h-4 w-4" />}
          title="Llegada física"
          done={hasArrival}
          detail={
            hasArrival
              ? `${fmt(props.arrivalAt)}${props.arrivalByName ? ` · ${props.arrivalByName}` : ''}`
              : 'No registrada'
          }
        />
        <StateTile
          icon={<CheckCircle2 className="h-4 w-4" />}
          title="Entrada validada"
          done={isValidated}
          detail={
            isValidated
              ? `${fmt(props.validatedAt)}${props.validatedByName ? ` · ${props.validatedByName}` : ''}`
              : 'Pendiente'
          }
        />
        <StateTile
          icon={<ShieldX className="h-4 w-4" />}
          title="Anulación"
          done={isAnnulled}
          tone="danger"
          detail={
            isAnnulled
              ? `${fmt(props.annulledAt)}${props.annulledByName ? ` · ${props.annulledByName}` : ''}`
              : '—'
          }
        />
      </div>

      {isAnnulled && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="font-medium">
            Entrada anulada (terminal){props.annulmentReason ? ` · ${props.annulmentReason}` : ''}
          </p>
          {props.annulmentNotes && <p className="mt-1 text-red-600">{props.annulmentNotes}</p>}
        </div>
      )}

      {/* Enlace a la orden de inspección */}
      {props.inspectionOrderId && (
        <Link
          href={`/taller/${props.inspectionOrderId}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ClipboardCheck className="h-4 w-4" />
          Ver orden de inspección de entrada en Taller
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      )}

      {/* Checklist documental derivado + disposiciones */}
      <div className="rounded-xl border border-cn-line p-4">
        <p className="mb-1 text-sm font-medium text-cn-ink-700">Checklist documental</p>
        <p className="text-cn-ink-400 mb-3 text-xs">
          Clasifica cada documento requerido: recibido (sube el documento), pendiente, no disponible
          o no aplicable. El contrato de gestión debe estar recibido de verdad.
        </p>
        <div className="space-y-2">
          {props.checklist.map((row) => {
            const meta = STATE_META[row.state] ?? STATE_META.SIN_CLASIFICAR
            const received = row.state === 'RECIBIDO'
            const dispositionValue = ['PENDIENTE', 'NO_DISPONIBLE', 'NO_APLICABLE'].includes(
              row.state
            )
              ? row.state
              : ''
            return (
              <div
                key={row.category}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-cn-line pb-2 last:border-0"
              >
                <div className="min-w-[180px] flex-1">
                  <p className="text-sm text-cn-ink-700">{row.label}</p>
                  {row.requiresDocument && (
                    <p className="text-cn-ink-400 text-[11px]">Requiere documento vigente</p>
                  )}
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.className}`}
                >
                  {meta.label}
                </span>
                {!received && (
                  <select
                    aria-label={`Disposición de ${row.label}`}
                    className={`${selectClass} w-auto min-w-[150px]`}
                    value={dispositionValue}
                    disabled={isAnnulled}
                    onChange={(e) => handleDisposition(row.category, e.target.value)}
                  >
                    <option value="">Sin clasificar</option>
                    {DISPOSITION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Registrar llegada física */}
      {canRegisterArrival && (
        <div className="rounded-xl border border-cn-line p-4">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-cn-ink-700">Registrar llegada física</p>
          </div>
          <p className="text-cn-ink-400 mt-0.5 text-xs">
            Confirma que el vehículo está físicamente en la nave. Es el paso previo a validar la
            entrada oficial.
          </p>
          <Button size="sm" className="mt-3 h-9" onClick={handleArrival} disabled={arrivalPending}>
            {arrivalPending ? 'Registrando…' : 'Registrar llegada'}
          </Button>
        </div>
      )}

      {/* Validar entrada (llaves + aparcamiento) */}
      {canValidate && (
        <div className="rounded-xl border border-cn-line p-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-cn-ink-700">Validar entrada oficial</p>
          </div>
          <p className="text-cn-ink-400 mt-0.5 text-xs">
            Registra la ubicación de aparcamiento y la custodia de llaves. Al validar se crea la
            orden de inspección de entrada en Taller.
            {ENTRY_REQUIRE_PRECONDITIONS
              ? props.responsibleName
                ? ''
                : ' Asigna antes un comercial responsable.'
              : ' De momento no es obligatorio rellenar estos campos ni la documentación.'}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="entry-parking" className="text-xs font-medium">
                Ubicación de aparcamiento en la nave{ENTRY_REQUIRE_PRECONDITIONS ? ' *' : ''}
              </Label>
              <Input
                id="entry-parking"
                value={parking}
                onChange={(e) => setParking(e.target.value)}
                placeholder="Nave A · plaza 3"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="entry-keys-count" className="text-xs font-medium">
                Nº de llaves{ENTRY_REQUIRE_PRECONDITIONS ? ' *' : ''}
              </Label>
              <Input
                id="entry-keys-count"
                type="number"
                min={1}
                value={keysCount}
                onChange={(e) => setKeysCount(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="entry-keys-location" className="text-xs font-medium">
                Ubicación de las llaves{ENTRY_REQUIRE_PRECONDITIONS ? ' *' : ''}
              </Label>
              <Input
                id="entry-keys-location"
                value={keysLocation}
                onChange={(e) => setKeysLocation(e.target.value)}
                placeholder="Panel de llaves"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="entry-keys-notes" className="text-xs font-medium">
                Notas de llaves (opcional)
              </Label>
              <Textarea
                id="entry-keys-notes"
                value={keysNotes}
                onChange={(e) => setKeysNotes(e.target.value)}
                rows={2}
                className="text-sm"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" className="h-9" onClick={handleValidate} disabled={validatePending}>
              {validatePending ? 'Validando…' : 'Validar entrada'}
            </Button>
          </div>
        </div>
      )}

      {/* Datos de la entrada validada (lectura) */}
      {isValidated && (
        <div className="rounded-xl border border-cn-line p-4 text-sm">
          <p className="mb-2 text-sm font-medium text-cn-ink-700">Custodia registrada</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Readout label="Aparcamiento" value={props.parkingLocation} />
            <Readout
              label="Llaves"
              value={props.keysCount != null ? String(props.keysCount) : null}
            />
            <Readout label="Ubicación llaves" value={props.keysLocation} />
          </div>
          {props.keysNotes && (
            <p className="text-cn-ink-400 mt-2 text-xs">Notas: {props.keysNotes}</p>
          )}
        </div>
      )}

      {/* Anular entrada (ADMIN) */}
      {canAnnul && (
        <div className="rounded-xl border border-red-200 p-4">
          <div className="flex items-center gap-2">
            <ShieldX className="h-4 w-4 text-red-500" />
            <p className="text-sm font-medium text-red-700">Anular entrada (Dirección)</p>
          </div>
          <p className="mt-0.5 text-xs text-red-600">
            La anulación es terminal: no se revalida. Se cerrará la orden de inspección activa.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="annul-reason" className="text-xs font-medium">
                Motivo *
              </Label>
              <select
                id="annul-reason"
                className={selectClass}
                value={annulReason}
                onChange={(e) => setAnnulReason(e.target.value)}
              >
                {ANNULMENT_REASON_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="annul-notes" className="text-xs font-medium">
                Notas {annulReason === 'OTRO' ? '*' : '(opcional)'}
              </Label>
              <Textarea
                id="annul-notes"
                value={annulNotes}
                onChange={(e) => setAnnulNotes(e.target.value)}
                rows={2}
                className="text-sm"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              variant="destructive"
              className="h-9"
              onClick={handleAnnul}
              disabled={annulPending}
            >
              {annulPending ? 'Anulando…' : 'Anular entrada'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function StateTile({
  icon,
  title,
  done,
  detail,
  tone = 'success',
}: {
  icon: React.ReactNode
  title: string
  done: boolean
  detail: string
  tone?: 'success' | 'danger'
}) {
  const activeClass =
    tone === 'danger'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-green-200 bg-green-50 text-green-700'
  return (
    <div
      className={`rounded-lg border p-3 ${done ? activeClass : 'text-cn-ink-400 border-cn-line bg-transparent'}`}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
        {icon}
        {title}
      </div>
      <p className="mt-1 text-xs">{detail}</p>
    </div>
  )
}

function Readout({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-cn-ink-400 text-[11px] uppercase tracking-wide">{label}</p>
      <p className="text-cn-ink-700">{value ?? '—'}</p>
    </div>
  )
}
