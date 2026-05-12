'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { MessageSquare, Phone, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { buildWhatsAppUrl, sellerWhatsAppMessage } from '@/lib/whatsapp'
import { logWhatsApp } from '@/app/(backoffice)/whatsapp-actions'

export type LeadRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
  status: string
  canal: string
  createdAt: string
  lastActivityAt: string
  daysSince: number
  flag: 'hot' | 'warn' | null
  vehicle: {
    brand: string | null
    model: string | null
    year: number | null
    km: number | null
    seats: number | null
    type: string | null
    price: number | null
  } | null
  agent: { id: string; name: string } | null
}

const STATUS_STYLES: Record<string, { bg: string; color: string; dot: string }> = {
  NUEVO: { bg: 'rgba(10,10,10,0.06)', color: '#0a0a0a', dot: '#0a0a0a' },
  CONTACTADO: { bg: 'rgba(88,71,56,0.10)', color: '#584738', dot: '#584738' },
  CUALIFICADO: { bg: 'rgba(122,100,80,0.12)', color: '#7a6450', dot: '#7a6450' },
  EN_NEGOCIACION: { bg: 'rgba(181,158,125,0.18)', color: '#9d8666', dot: '#b59e7d' },
  CERRADO: { bg: 'rgba(107,122,78,0.14)', color: '#6b7a4e', dot: '#6b7a4e' },
  DESCARTADO: { bg: 'rgba(107,100,92,0.10)', color: '#6b645c', dot: '#b3aca0' },
}

const STATUS_LABELS: Record<string, string> = {
  NUEVO: 'Nuevo',
  CONTACTADO: 'Contactado',
  CUALIFICADO: 'Cualificado',
  EN_NEGOCIACION: 'Negociación',
  CERRADO: 'Cerrado',
  DESCARTADO: 'Descartado',
}

const CANAL_LABELS: Record<string, string> = {
  CN: 'CN',
  PRO: 'PRO',
}

const MONO = {
  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
}

function formatPrice(n: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

function formatKm(km: number): string {
  return new Intl.NumberFormat('es-ES').format(km) + ' km'
}

function formatRelative(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'ahora'
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  if (diff < 2592000) return `${Math.floor(diff / 604800)} sem`
  return `${Math.floor(diff / 2592000)} mes`
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

const BULK_ACTIONS = ['Asignar agente', 'Cambiar estado', 'Exportar', 'Archivar'] as const

export function SellerLeadsTable({ leads }: { leads: LeadRow[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === leads.length ? new Set() : new Set(leads.map((l) => l.id))
    )
  }, [leads])

  const allSelected = leads.length > 0 && selectedIds.size === leads.length
  const someSelected = selectedIds.size > 0 && !allSelected

  function handleWhatsApp(lead: LeadRow) {
    if (!lead.phone) return
    logWhatsApp({ leadId: lead.id, leadType: 'seller', phone: lead.phone }).catch(console.error)
    const v = lead.vehicle
    let vehicleArg: { type: string; brand: string; model: string } | undefined
    if (v && v.brand && v.model && v.type) {
      vehicleArg = { type: v.type, brand: v.brand, model: v.model }
    }
    window.open(
      buildWhatsAppUrl(lead.phone, sellerWhatsAppMessage(lead.name, vehicleArg)),
      '_blank',
      'noopener,noreferrer'
    )
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm" style={{ color: '#6b645c' }}>
          No hay leads con los filtros aplicados.
        </p>
        <p className="mt-1 text-xs" style={{ color: '#b3aca0' }}>
          Prueba a cambiar los filtros o la vista activa.
        </p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* ── Bulk action bar ── */}
      {selectedIds.size > 0 && (
        <div
          className="sticky top-[73px] z-10 mb-3 flex items-center gap-3 rounded-xl px-5 py-3"
          style={{ background: '#0a0a0a', color: '#fff' }}
        >
          <span style={{ ...MONO, fontSize: '12px' }}>
            {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {BULK_ACTIONS.map((label) => (
              <button
                key={label}
                className="rounded-md px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                style={{
                  background: 'rgba(255,255,255,0.10)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                {label === 'Exportar' ? `${label} (${selectedIds.size})` : label}
              </button>
            ))}
            <button
              className="ml-2 text-xs transition-opacity hover:opacity-60"
              style={{ color: 'rgba(255,255,255,0.5)', ...MONO }}
              onClick={() => setSelectedIds(new Set())}
            >
              Limpiar
            </button>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #e6dfd0' }}>
        <table
          className="w-full"
          style={{ tableLayout: 'fixed', minWidth: '920px', borderCollapse: 'collapse' }}
        >
          <colgroup>
            <col style={{ width: '40px' }} />
            <col style={{ width: '23%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '21%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '76px' }} />
          </colgroup>

          {/* Head */}
          <thead>
            <tr style={{ borderBottom: '1px solid #e6dfd0', background: '#faf6ed' }}>
              {/* Checkbox */}
              <th className="px-3 py-2.5 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected
                  }}
                  onChange={toggleAll}
                  className="h-3.5 w-3.5 cursor-pointer rounded"
                  style={{ accentColor: '#0a0a0a' }}
                />
              </th>
              {['Lead', 'Contacto', 'Vehículo', 'Estado', 'Agente', 'Entrada', ''].map((h, i) => (
                <th
                  key={i}
                  className="px-3 py-2.5 text-left"
                  style={{
                    ...MONO,
                    fontSize: '10.5px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#6b645c',
                    fontWeight: 500,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {leads.map((lead) => {
              const st = STATUS_STYLES[lead.status] ?? STATUS_STYLES.NUEVO
              const isSelected = selectedIds.has(lead.id)

              return (
                <tr
                  key={lead.id}
                  className="group relative transition-colors"
                  style={{
                    borderBottom: '1px solid #e6dfd0',
                    background: isSelected ? 'rgba(181,158,125,0.07)' : undefined,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected)
                      (e.currentTarget as HTMLTableRowElement).style.background = '#faf6ed'
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = ''
                  }}
                >
                  {/* ── Checkbox + row flag ── */}
                  <td className="relative px-3 py-0" style={{ verticalAlign: 'middle' }}>
                    {lead.flag && (
                      <div
                        className="absolute inset-y-[18%] left-0 w-[3px] rounded-r"
                        style={{ background: lead.flag === 'hot' ? '#a85636' : '#8a6a3f' }}
                      />
                    )}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(lead.id)}
                      className="h-3.5 w-3.5 cursor-pointer rounded"
                      style={{ accentColor: '#0a0a0a' }}
                    />
                  </td>

                  {/* ── Lead ── */}
                  <td className="px-3 py-2.5">
                    <Link href={`/vendedores/${lead.id}`} className="flex items-start gap-2.5">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                        style={{ background: '#584738', fontSize: '13px', fontWeight: 600 }}
                      >
                        {getInitials(lead.name)}
                      </div>
                      <div className="min-w-0">
                        <span
                          className="block truncate font-semibold hover:underline"
                          style={{ color: '#0a0a0a', fontSize: '14px' }}
                        >
                          {lead.name}
                        </span>
                        <span
                          className="block truncate"
                          style={{
                            ...MONO,
                            fontSize: '10.5px',
                            color: '#6b645c',
                            marginTop: '2px',
                          }}
                        >
                          #{lead.id.substring(0, 8)} ·{' '}
                          <span
                            style={{
                              color: lead.canal === 'PRO' ? '#584738' : '#6b645c',
                            }}
                          >
                            {CANAL_LABELS[lead.canal] ?? lead.canal}
                          </span>
                          {lead.flag && lead.daysSince > 0 && (
                            <>
                              {' · '}
                              <span
                                style={{
                                  color: lead.flag === 'hot' ? '#a85636' : '#8a6a3f',
                                }}
                              >
                                Sin contacto {lead.daysSince}d
                              </span>
                            </>
                          )}
                        </span>
                      </div>
                    </Link>
                  </td>

                  {/* ── Contacto ── */}
                  <td className="px-3 py-2.5">
                    {lead.email && (
                      <a
                        href={`mailto:${lead.email}`}
                        className="block truncate hover:underline"
                        style={{ color: '#2a2622', fontSize: '13px' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {lead.email}
                      </a>
                    )}
                    {lead.phone && (
                      <a
                        href={`tel:${lead.phone}`}
                        className="mt-0.5 block"
                        style={{ ...MONO, fontSize: '12px', color: '#6b645c' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {lead.phone}
                      </a>
                    )}
                    {!lead.email && !lead.phone && (
                      <span style={{ color: '#b3aca0', fontSize: '12px' }}>—</span>
                    )}
                  </td>

                  {/* ── Vehículo ── */}
                  <td className="px-3 py-2.5">
                    {lead.vehicle ? (
                      <div>
                        <span
                          className="block truncate font-semibold"
                          style={{ color: '#0a0a0a', fontSize: '13.5px' }}
                        >
                          {[lead.vehicle.brand, lead.vehicle.model].filter(Boolean).join(' ') ||
                            '—'}
                        </span>
                        <span
                          className="mt-0.5 block"
                          style={{ ...MONO, fontSize: '10.5px', color: '#6b645c' }}
                        >
                          {[
                            lead.vehicle.year,
                            lead.vehicle.km != null ? formatKm(lead.vehicle.km) : null,
                            lead.vehicle.seats ? `${lead.vehicle.seats} pl.` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                        {lead.vehicle.price != null && (
                          <span
                            className="mt-0.5 block font-semibold"
                            style={{ color: '#584738', fontSize: '12.5px' }}
                          >
                            {formatPrice(lead.vehicle.price)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#b3aca0', fontSize: '12px', fontStyle: 'italic' }}>
                        Sin vehículo
                      </span>
                    )}
                  </td>

                  {/* ── Estado ── */}
                  <td className="px-3 py-2.5">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{ background: st.bg, color: st.color, fontSize: '12px' }}
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: st.dot }}
                      />
                      {STATUS_LABELS[lead.status] ?? lead.status}
                    </span>
                  </td>

                  {/* ── Agente ── */}
                  <td className="px-3 py-2.5">
                    {lead.agent ? (
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                          style={{ background: '#584738', fontSize: '9px', fontWeight: 700 }}
                        >
                          {getInitials(lead.agent.name)}
                        </div>
                        <span className="truncate" style={{ fontSize: '12.5px', color: '#2a2622' }}>
                          {lead.agent.name}
                        </span>
                      </div>
                    ) : (
                      <span
                        className="rounded-md px-2 py-0.5 text-xs italic"
                        style={{
                          border: '1px dashed #e6dfd0',
                          color: '#b3aca0',
                          fontSize: '11px',
                        }}
                      >
                        Sin asignar
                      </span>
                    )}
                  </td>

                  {/* ── Entrada ── */}
                  <td className="px-3 py-2.5">
                    <span className="block" style={{ ...MONO, fontSize: '12px', color: '#2a2622' }}>
                      {new Date(lead.createdAt).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                      })}
                    </span>
                    <span
                      className="mt-0.5 block"
                      style={{ ...MONO, fontSize: '10.5px', color: '#6b645c' }}
                    >
                      {formatRelative(lead.createdAt)}
                    </span>
                  </td>

                  {/* ── Actions ── */}
                  <td className="px-2 py-2.5">
                    <div
                      className={cn(
                        'flex items-center gap-0.5 transition-opacity',
                        'opacity-0 group-hover:opacity-100'
                      )}
                    >
                      {/* WhatsApp */}
                      <button
                        onClick={() => handleWhatsApp(lead)}
                        disabled={!lead.phone}
                        className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[#f5f0e6] disabled:cursor-not-allowed disabled:opacity-30"
                        title="WhatsApp"
                        style={{ color: '#6b645c' }}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </button>
                      {/* Llamar */}
                      <a
                        href={lead.phone ? `tel:${lead.phone}` : undefined}
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[#f5f0e6]',
                          !lead.phone && 'pointer-events-none opacity-30'
                        )}
                        title="Llamar"
                        style={{ color: '#6b645c' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                      {/* Más */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[#f5f0e6]"
                            title="Más opciones"
                            style={{ color: '#6b645c' }}
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/vendedores/${lead.id}`}>Ver ficha</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              navigator.clipboard.writeText(
                                window.location.origin + `/vendedores/${lead.id}`
                              )
                            }
                          >
                            Copiar enlace
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a
                              href={`/vendedores/${lead.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Abrir en nueva pestaña
                            </a>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
