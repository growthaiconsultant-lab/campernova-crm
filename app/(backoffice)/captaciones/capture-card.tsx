'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ExternalLink,
  MessageCircle,
  Pencil,
  Check,
  CalendarClock,
  FilePlus2,
  ChevronDown,
  Phone,
  ListChecks,
} from 'lucide-react'
import {
  convertCaptureToSellerLead,
  scheduleEntrada,
  updateCapture,
  updateCaptureStatus,
} from './actions'
import {
  CAPTURE_STATUS_COLORS,
  CAPTURE_OPEN_STAGES,
  captureViewOf,
  CAPTURE_STATUS_LABELS,
  PORTAL_LABELS,
  captureAnchorId,
} from '@/lib/captacion'
import { LOST_REASON_OPTIONS } from '@/lib/lost-reason'
import { buildWhatsAppUrl } from '@/lib/whatsapp'
import { cn } from '@/lib/utils'
import type { CaptureStatus, CapturePortal, LostReason } from '@prisma/client'

export type CaptureCardData = {
  id: string
  listingUrl: string | null
  phone: string | null
  portal: CapturePortal
  title: string | null
  askingPrice: number | null
  status: CaptureStatus
  notes: string | null
  rejectionReason: LostReason | null
  arrivalAt: string | null
  visitScheduledAt: string | null
  entradaScheduledAt: string | null
  assignedToId: string | null
  assignedToName: string | null
  sellerLeadId: string | null
}

type Agent = { id: string; name: string }

const EUR = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

export function CaptureCard({
  c,
  agents,
  focused = false,
}: {
  c: CaptureCardData
  agents: Agent[]
  focused?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [scheduling, setScheduling] = useState<'ENTRADA_AGENDADA' | 'VISITA_CONFIRMADA' | null>(
    null
  )
  const [entradaAt, setEntradaAt] = useState('')
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState(c.notes ?? '')
  const [phone, setPhone] = useState(c.phone ?? '')
  const [assignedToId, setAssignedToId] = useState(c.assignedToId ?? '')
  const [converting, startConvert] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function changeStatus(next: CaptureStatus) {
    if (next === 'RECHAZADO') return setRejecting(true)
    if (next === 'ENTRADA_AGENDADA' || next === 'VISITA_CONFIRMADA') return setScheduling(next)
    setError(null)
    startTransition(async () => {
      const res = await updateCaptureStatus(c.id, next)
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }

  function confirmReject() {
    if (!reason) return setError('Elige un motivo')
    setError(null)
    startTransition(async () => {
      const res = await updateCaptureStatus(c.id, 'RECHAZADO', reason)
      if (res.error) setError(res.error)
      else {
        setRejecting(false)
        router.refresh()
      }
    })
  }

  function confirmSchedule() {
    if (!entradaAt || !scheduling) return setError('Indica fecha y hora de la entrada')
    setError(null)
    startTransition(async () => {
      const res = await scheduleEntrada(c.id, new Date(entradaAt).toISOString(), scheduling)
      if (res.error) setError(res.error)
      else {
        setScheduling(null)
        router.refresh()
      }
    })
  }

  function convert() {
    setError(null)
    startConvert(async () => {
      const res = await convertCaptureToSellerLead(c.id)
      if (res.error) setError(res.error)
      else if (res.sellerLeadId) router.push(`/vendedores/${res.sellerLeadId}`)
    })
  }

  const original = useRef({ phone, notes, assignedToId })
  function edit() {
    original.current = {
      phone: c.phone ?? '',
      notes: c.notes ?? '',
      assignedToId: c.assignedToId ?? '',
    }
    setPhone(c.phone ?? '')
    setNotes(c.notes ?? '')
    setAssignedToId(c.assignedToId ?? '')
    setError(null)
    setEditing(true)
  }
  function saveEdit() {
    setError(null)
    startTransition(async () => {
      const res = await updateCapture(c.id, {
        ...(notes !== original.current.notes && { notes }),
        ...(assignedToId !== original.current.assignedToId && { assignedToId }),
        ...(phone.trim() !== original.current.phone && { phone }),
      })
      if (res.error) setError(res.error)
      else {
        setEditing(false)
        router.refresh()
      }
    })
  }

  const view = captureViewOf(c)
  const primary =
    'inline-flex min-h-8 w-full items-center justify-start gap-2 rounded-md border border-transparent bg-brand-tint px-2.5 py-1.5 text-left font-hanken text-[12px] font-semibold leading-4 text-brand transition-colors hover:border-brand hover:bg-brand hover:text-white focus-visible:outline-brand disabled:opacity-50 [&>svg]:shrink-0'
  const dot = CAPTURE_STATUS_COLORS[c.status]
  const idle = !editing && !rejecting && !scheduling

  return (
    <article
      aria-label={c.title || 'Vehículo sin título'}
      id={captureAnchorId(c.id)}
      className={cn(
        'scroll-mt-24 rounded-[11px] border border-line bg-card p-[11px] shadow-[0_1px_2px_rgba(20,25,34,0.04)]',
        focused && 'ring-2 ring-brand ring-offset-2 ring-offset-canvas'
      )}
    >
      {/* Portal + precio */}
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="rounded-[5px] bg-track px-1.5 py-[3px] font-mono text-[9px] font-semibold tracking-[0.03em] text-ink2">
          {PORTAL_LABELS[c.portal]}
        </span>
        {c.askingPrice != null && (
          <span className="font-mono text-[11px] font-semibold text-ink">{EUR(c.askingPrice)}</span>
        )}
      </div>

      {/* Título */}
      <p className="break-words font-hanken text-[14px] font-semibold leading-[1.25] text-ink">
        {c.title || 'Vehículo sin título'}
      </p>

      {/* Teléfono (WhatsApp) + responsable */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {c.listingUrl && (
            <a
              href={c.listingUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Ver anuncio"
              className="text-ink3 transition-colors hover:text-ink"
            >
              <ExternalLink size={13} strokeWidth={2} />
            </a>
          )}
          {c.phone ? (
            <a
              href={buildWhatsAppUrl(c.phone, 'Hola, te contacto de CampersNova por tu anuncio.')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-[10.5px] text-ink3 transition-colors hover:text-brand"
            >
              <MessageCircle size={12} strokeWidth={2} className="text-[#25D366]" />
              {c.phone}
            </a>
          ) : (
            <span className="font-mono text-[10.5px] text-ink3">Sin teléfono</span>
          )}
        </div>
        <span className="min-w-0 break-words text-right text-xs text-ink2">
          {c.assignedToName || 'Sin asignar'}
        </span>
      </div>

      {!editing && c.notes && (
        <p className="mt-1.5 whitespace-pre-wrap font-hanken text-[12px] text-ink2">{c.notes}</p>
      )}

      {view === 'rechazadas' && (
        <p className="mt-1 font-hanken text-[11px] text-bad">
          Motivo:{' '}
          {LOST_REASON_OPTIONS.find((o) => o.value === c.rejectionReason)?.label ?? 'Sin registrar'}
        </p>
      )}

      {c.arrivalAt && (
        <p className="mt-2 text-xs">
          Recepción ·{' '}
          {new Date(c.arrivalAt).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })}
        </p>
      )}
      {c.status === 'VISITA_CONFIRMADA' && c.visitScheduledAt && (
        <p className="mt-2 text-xs">
          Visita ·{' '}
          {new Date(c.visitScheduledAt).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}
        </p>
      )}
      {c.entradaScheduledAt && c.status === 'ENTRADA_AGENDADA' && (
        <p className="mt-1.5 inline-flex items-center gap-1 font-mono text-[11px] font-medium text-info">
          <CalendarClock size={12} strokeWidth={2} /> Entrada ·
          {new Date(c.entradaScheduledAt).toLocaleString('es-ES', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Madrid',
          })}
        </p>
      )}

      {idle && (
        <div className="mt-2 border-t border-line pt-2 empty:hidden">
          {view === 'abiertas' &&
            (c.status === 'NO_CONTACTADO' || c.status === 'NO_CONTESTA') &&
            (c.phone || c.listingUrl ? (
              <a
                className={primary}
                target="_blank"
                rel="noopener noreferrer"
                href={
                  c.phone
                    ? buildWhatsAppUrl(c.phone, 'Hola, te contacto de CampersNova por tu anuncio.')
                    : c.listingUrl!
                }
              >
                {c.phone ? <MessageCircle size={14} aria-hidden /> : <ExternalLink size={14} aria-hidden />}
                {c.phone ? 'Abrir WhatsApp' : 'Abrir anuncio'}
              </a>
            ) : (
              <button type="button" className={primary} onClick={edit}>
                <Phone size={14} aria-hidden />
                Añadir teléfono
              </button>
            ))}
          {view === 'abiertas' && c.status === 'CONTACTADO' && (
            <button
              type="button"
              className={primary}
              disabled={pending}
              onClick={() => changeStatus('EN_CURSO')}
            >
              <ListChecks size={14} aria-hidden />
              Iniciar seguimiento
            </button>
          )}
          {view === 'abiertas' &&
            (c.status === 'EN_CURSO' ||
              c.status === 'VISITA_CONFIRMADA' ||
              (c.status === 'ENTRADA_AGENDADA' && !c.entradaScheduledAt)) && (
              <button
                type="button"
                className={primary}
                onClick={() =>
                  changeStatus(c.status === 'EN_CURSO' ? 'VISITA_CONFIRMADA' : 'ENTRADA_AGENDADA')
                }
              >
                <CalendarClock size={14} aria-hidden />
                {c.status === 'EN_CURSO' ? 'Confirmar visita' : 'Agendar entrega'}
              </button>
            )}
          {view === 'abiertas' && c.status === 'ENTRADA_AGENDADA' && c.entradaScheduledAt && (
            <button type="button" className={primary} onClick={convert} disabled={converting}>
              <FilePlus2 size={14} aria-hidden />
              {converting ? 'Creando ficha…' : 'Crear ficha vendedor'}
            </button>
          )}
          {(view === 'convertidas' || view === 'stock') &&
            (c.sellerLeadId ? (
              <Link
                href={'/vendedores/' + c.sellerLeadId}
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand underline"
              >
                Ver ficha del vendedor
              </Link>
            ) : (
              <p className="text-sm text-ink2">
                Conversión sin ficha vinculada. Revisa el registro antes de reabrirlo.
              </p>
            ))}
          {view === 'rechazadas' && <p className="text-sm text-ink2">Sin acción pendiente.</p>}
        </div>
      )}

      {/* Agendar entrada inline */}
      {scheduling && (
        <div className="border-info/30 mt-2 space-y-2 rounded-[9px] border bg-info-tint p-2">
          <p className="font-hanken text-[11px] font-medium text-info">
            {scheduling === 'VISITA_CONFIRMADA'
              ? '¿Cuándo es la visita de valoración?'
              : '¿Cuándo trae el vehículo?'}
          </p>
          <input
            aria-label="Fecha y hora de la cita"
            type="datetime-local"
            value={entradaAt}
            onChange={(e) => setEntradaAt(e.target.value)}
            className="w-full rounded-[8px] border border-line px-2 py-1 font-hanken text-[12px] outline-none"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={confirmSchedule}
              disabled={pending}
              className="rounded-[8px] bg-info px-2 py-1 font-hanken text-[11px] font-semibold text-white disabled:opacity-50"
            >
              Guardar cita
            </button>
            <button
              type="button"
              onClick={() => setScheduling(null)}
              className="rounded-[8px] border border-line px-2 py-1 font-hanken text-[11px] text-ink2"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Edición inline */}
      {editing && (
        <div className="mt-2 space-y-2">
          <label className="grid gap-1 text-xs font-medium">
            Teléfono de contacto
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-md border bg-background p-2 text-sm"
            />
          </label>
          <textarea
            aria-label="Notas de la captación"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Observaciones…"
            className="w-full rounded-[8px] border border-line px-2 py-1 font-hanken text-[12px] outline-none focus:border-brand"
          />
          <select
            aria-label="Asignar responsable"
            value={assignedToId}
            onChange={(e) => setAssignedToId(e.target.value)}
            className="w-full rounded-[8px] border border-line px-2 py-1 font-hanken text-[12px]"
          >
            <option value="">Sin asignar</option>
            {c.assignedToId && !agents.some((a) => a.id === c.assignedToId) && (
              <option value={c.assignedToId}>{c.assignedToName ?? 'Responsable anterior'}</option>
            )}
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={saveEdit}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-[8px] bg-brand px-2 py-1 font-hanken text-[11px] font-semibold text-white disabled:opacity-50"
            >
              <Check size={12} strokeWidth={2.4} /> Guardar
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-[8px] border border-line px-2 py-1 font-hanken text-[11px] text-ink2"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Rechazo inline */}
      {rejecting && (
        <div className="border-bad/30 mt-2 space-y-2 rounded-[9px] border bg-bad-tint p-2">
          <select
            aria-label="Motivo del rechazo"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-[8px] border border-line px-2 py-1 font-hanken text-[12px]"
          >
            <option value="">Motivo del rechazo…</option>
            {LOST_REASON_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={confirmReject}
              disabled={pending}
              className="rounded-[8px] bg-bad px-2 py-1 font-hanken text-[11px] font-semibold text-white disabled:opacity-50"
            >
              Rechazar
            </button>
            <button
              type="button"
              onClick={() => setRejecting(false)}
              className="rounded-[8px] border border-line px-2 py-1 font-hanken text-[11px] text-bad"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-1 font-hanken text-[11px] text-bad">{error}</p>}

      {/* Acciones: selector de estado + editar */}
      {idle && (
        <div className="mt-2.5 flex items-center gap-1.5">
          {!c.sellerLeadId && (
            <label className="relative min-w-0 flex-1 rounded-md focus-within:ring-2 focus-within:ring-brand">
              <span
                className={cn(
                  'flex min-h-7 items-center gap-1.5 rounded-md border border-line px-2 font-hanken text-[11.5px] font-medium text-ink2'
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
                {CAPTURE_STATUS_LABELS[c.status]}
                <ChevronDown size={12} className="ml-auto shrink-0" aria-hidden />
              </span>
              <select
                aria-label="Cambiar etapa"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                value={c.status}
                onChange={(e) => changeStatus(e.target.value as CaptureStatus)}
                disabled={pending}
              >
                {c.status === 'CONVERTIDO' && <option value="CONVERTIDO">Convertido</option>}
                {[
                  ...CAPTURE_OPEN_STAGES,
                  'SIN_INTERES' as const,
                  'RECHAZADO' as const,
                  ...(c.status === 'CONTACTADO' ? ['CONTACTADO' as const] : []),
                ].map((s) => (
                  <option key={s} value={s}>
                    {CAPTURE_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={edit}
            aria-label="Editar captación"
            title="Editar captación"
            className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-line text-ink2 transition-colors hover:bg-canvas"
          >
            <Pencil size={13} strokeWidth={2} />
          </button>
        </div>
      )}
    </article>
  )
}
