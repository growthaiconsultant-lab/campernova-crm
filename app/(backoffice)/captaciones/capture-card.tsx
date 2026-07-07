'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ExternalLink,
  MessageCircle,
  Pencil,
  Check,
  CalendarClock,
  ArrowRightLeft,
} from 'lucide-react'
import {
  convertCaptureToSellerLead,
  scheduleEntrada,
  updateCapture,
  updateCaptureStatus,
} from './actions'
import { CAPTURE_STATUS_COLORS, CAPTURE_STATUS_LABELS, PORTAL_LABELS } from '@/lib/captacion'
import { LOST_REASON_OPTIONS } from '@/lib/lost-reason'
import { buildWhatsAppUrl } from '@/lib/whatsapp'
import type { CaptureStatus, CapturePortal, LostReason } from '@prisma/client'

export type CaptureCardData = {
  id: string
  listingUrl: string
  phone: string
  portal: CapturePortal
  title: string | null
  askingPrice: number | null
  status: CaptureStatus
  notes: string | null
  rejectionReason: LostReason | null
  entradaScheduledAt: string | null
  assignedToId: string | null
  assignedToName: string | null
  sellerLeadId: string | null
}

type Agent = { id: string; name: string }

const STATUS_ORDER: CaptureStatus[] = [
  'NO_CONTACTADO',
  'CONTACTADO',
  'EN_CURSO',
  'ENTRADA_AGENDADA',
  'CONVERTIDO',
  'RECHAZADO',
]

const EUR = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

export function CaptureCard({ c, agents }: { c: CaptureCardData; agents: Agent[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const [entradaAt, setEntradaAt] = useState('')
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState(c.notes ?? '')
  const [assignedToId, setAssignedToId] = useState(c.assignedToId ?? '')
  const [converting, startConvert] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function changeStatus(next: CaptureStatus) {
    if (next === 'RECHAZADO') {
      setRejecting(true)
      return
    }
    if (next === 'ENTRADA_AGENDADA') {
      setScheduling(true)
      return
    }
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
    if (!entradaAt) return setError('Indica fecha y hora de la entrada')
    setError(null)
    startTransition(async () => {
      const res = await scheduleEntrada(c.id, new Date(entradaAt).toISOString())
      if (res.error) setError(res.error)
      else {
        setScheduling(false)
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

  function saveEdit() {
    setError(null)
    startTransition(async () => {
      const res = await updateCapture(c.id, { notes, assignedToId })
      if (res.error) setError(res.error)
      else {
        setEditing(false)
        router.refresh()
      }
    })
  }

  const dot = CAPTURE_STATUS_COLORS[c.status]

  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white p-3 text-[13px]">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
          {PORTAL_LABELS[c.portal]}
        </span>
        {c.askingPrice != null && (
          <span className="text-[12px] font-semibold text-[#0a0a0a]">{EUR(c.askingPrice)}</span>
        )}
      </div>

      <p className="truncate font-medium text-[#0a0a0a]">{c.title || 'Vehículo sin título'}</p>

      <div className="mt-1.5 flex items-center gap-2">
        <a
          href={c.listingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[12px] text-blue-600 hover:underline"
        >
          <ExternalLink className="h-3 w-3" /> Anuncio
        </a>
        <a
          href={buildWhatsAppUrl(c.phone, 'Hola, te contacto de CampersNova por tu anuncio.')}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[12px] text-green-600 hover:underline"
        >
          <MessageCircle className="h-3 w-3" /> {c.phone}
        </a>
      </div>

      {c.assignedToName && <p className="mt-1 text-[11px] text-[#64748b]">→ {c.assignedToName}</p>}

      {!editing && c.notes && (
        <p className="mt-1.5 whitespace-pre-wrap text-[12px] text-[#475569]">{c.notes}</p>
      )}

      {c.status === 'RECHAZADO' && c.rejectionReason && (
        <p className="mt-1 text-[11px] text-red-600">
          Motivo: {LOST_REASON_OPTIONS.find((o) => o.value === c.rejectionReason)?.label}
        </p>
      )}

      {c.entradaScheduledAt && c.status === 'ENTRADA_AGENDADA' && (
        <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-cyan-700">
          <CalendarClock className="h-3 w-3" />
          Entrada:{' '}
          {new Date(c.entradaScheduledAt).toLocaleString('es-ES', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Madrid',
          })}
        </p>
      )}

      {/* Convertida → enlace a la ficha del vendedor */}
      {c.sellerLeadId && (
        <Link
          href={`/vendedores/${c.sellerLeadId}`}
          className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-emerald-700 hover:underline"
        >
          <ExternalLink className="h-3 w-3" /> Ver ficha de vendedor
        </Link>
      )}

      {/* Convertir a ficha (cuando el vehículo va a entrar) */}
      {!c.sellerLeadId &&
        c.status === 'ENTRADA_AGENDADA' &&
        !editing &&
        !rejecting &&
        !scheduling && (
          <button
            type="button"
            onClick={convert}
            disabled={converting}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded bg-emerald-600 px-2 py-1.5 text-[11.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            {converting ? 'Convirtiendo…' : 'Convertir a ficha de vendedor'}
          </button>
        )}

      {/* Agendar entrada inline */}
      {scheduling && (
        <div className="mt-2 space-y-2 rounded border border-cyan-200 bg-cyan-50 p-2">
          <p className="text-[11px] font-medium text-cyan-800">¿Cuándo trae el vehículo?</p>
          <input
            type="datetime-local"
            value={entradaAt}
            onChange={(e) => setEntradaAt(e.target.value)}
            className="w-full rounded border border-cyan-200 px-2 py-1 text-[12px]"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={confirmSchedule}
              disabled={pending}
              className="rounded bg-cyan-700 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              Agendar entrada
            </button>
            <button
              type="button"
              onClick={() => setScheduling(false)}
              className="rounded border border-cyan-200 px-2 py-1 text-[11px] text-cyan-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Edición inline */}
      {editing && (
        <div className="mt-2 space-y-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Observaciones…"
            className="w-full rounded border border-[#e2e8f0] px-2 py-1 text-[12px] outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={assignedToId}
            onChange={(e) => setAssignedToId(e.target.value)}
            className="w-full rounded border border-[#e2e8f0] px-2 py-1 text-[12px]"
          >
            <option value="">Sin asignar</option>
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
              className="inline-flex items-center gap-1 rounded bg-[#0a0a0a] px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              <Check className="h-3 w-3" /> Guardar
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded border border-[#e2e8f0] px-2 py-1 text-[11px] text-[#64748b]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Rechazo inline */}
      {rejecting && (
        <div className="mt-2 space-y-2 rounded border border-red-200 bg-red-50 p-2">
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded border border-red-200 px-2 py-1 text-[12px]"
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
              className="rounded bg-red-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              Rechazar
            </button>
            <button
              type="button"
              onClick={() => setRejecting(false)}
              className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-600"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}

      {/* Acciones */}
      {!editing && !rejecting && !scheduling && (
        <div className="mt-2 flex items-center gap-1.5">
          <label className="relative flex-1">
            <span
              className="flex items-center gap-1.5 rounded border border-[#e2e8f0] px-2 py-1 text-[11.5px] font-medium"
              style={{ color: dot }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
              {CAPTURE_STATUS_LABELS[c.status]}
            </span>
            <select
              className="absolute inset-0 cursor-pointer opacity-0"
              value={c.status}
              onChange={(e) => changeStatus(e.target.value as CaptureStatus)}
              disabled={pending}
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {CAPTURE_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Editar"
            className="flex h-7 w-7 items-center justify-center rounded border border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
