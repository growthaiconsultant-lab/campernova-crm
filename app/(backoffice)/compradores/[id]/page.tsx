import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { BuyerLeadEditForm } from './buyer-lead-edit-form'
import { MatchesSection } from '@/components/matches-section'
import type { BuyerMatchData } from '@/components/matches-section'
import { ActivityTimeline } from '@/components/activity-timeline'
import type { ActivityItem } from '@/components/activity-timeline'
import { NoteForm } from '@/components/note-form'
import { addBuyerLeadNote } from './actions'
import { WhatsAppButton } from '@/components/whatsapp-button'
import { buyerWhatsAppMessage } from '@/lib/whatsapp'
import {
  BUYER_LEAD_STATUS_LABELS,
  BUYER_LEAD_STATUS_CLASSES,
  BUYER_LEAD_TRANSITIONS,
} from '@/lib/state-machine'
import type { BuyerLeadStatus } from '@prisma/client'
import {
  ChevronLeft,
  Phone,
  Mail,
  MessageCircle,
  Archive,
  MoreHorizontal,
  Shield,
} from 'lucide-react'

// ── Helpers ────────────────────────────────────────────────────────────────────

const EUR = (v: number) =>
  v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000)
}

function monthsRemainingFrom(endDate: Date): number {
  const now = new Date()
  const diff = endDate.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (30 * 24 * 60 * 60 * 1000)))
}

const PURCHASE_TIMELINE_LABELS: Record<string, string> = {
  menos_1_mes: '< 1 mes',
  '1_3_meses': '1–3 meses',
  '3_6_meses': '3–6 meses',
  mas_6_meses: '> 6 meses',
  sin_prisa: 'Sin prisa',
}

const EQUIPMENT_LABELS: Record<string, string> = {
  solar: 'Placas solares',
  kitchen: 'Cocina',
  bathroom: 'Baño',
  shower: 'Ducha',
  heating: 'Calefacción',
}

function calcBuyerScore(
  lead: {
    phone: string | null
    vehicleType: string | null
    maxBudget: unknown
    minSeats: number | null
    useZone: string | null
    purchaseTimeline: string | null
    status: string
  },
  bestMatchScore: number
): number {
  let score = 0
  // Contact (15)
  if (lead.phone) score += 10
  score += 5 // always has name+email
  // Preferences (35)
  if (lead.vehicleType) score += 8
  if (lead.maxBudget) score += 12
  if (lead.minSeats) score += 5
  if (lead.useZone) score += 5
  if (lead.purchaseTimeline) score += 5
  // Matches (25)
  if (bestMatchScore >= 80) score += 25
  else if (bestMatchScore >= 60) score += 18
  else if (bestMatchScore >= 40) score += 10
  else if (bestMatchScore > 0) score += 5
  // Status (25)
  const statusBonus: Record<string, number> = {
    NUEVO: 0,
    CONTACTADO: 8,
    CUALIFICADO: 15,
    EN_NEGOCIACION: 20,
    CERRADO: 25,
    PERDIDO: 0,
  }
  score += statusBonus[lead.status] ?? 0
  return Math.min(100, score)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function FichaCompradorPage({ params }: { params: { id: string } }) {
  const [currentUser, lead, agents, activities] = await Promise.all([
    requireAuth(),
    db.buyerLead.findUnique({
      where: { id: params.id },
      include: {
        agent: true,
        warranty: {
          include: {
            tickets: {
              where: { status: { in: ['ABIERTO', 'EN_PROGRESO'] } },
              select: { id: true, priority: true, title: true },
            },
          },
        },
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            vehicle: {
              select: {
                id: true,
                brand: true,
                model: true,
                year: true,
                salePrice: true,
              },
            },
          },
        },
        matches: {
          include: {
            vehicle: {
              select: {
                id: true,
                brand: true,
                model: true,
                year: true,
                km: true,
                desiredPrice: true,
                valuationRecommended: true,
                photos: { select: { url: true }, orderBy: { order: 'asc' }, take: 1 },
                sellerLead: { select: { id: true } },
              },
            },
          },
          orderBy: { score: 'desc' },
          take: 10,
        },
      },
    }),
    db.user.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.activity.findMany({
      where: { buyerLeadId: params.id },
      include: { agent: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])

  if (!lead) notFound()

  const isAdmin = currentUser.role === 'ADMIN'
  const isTerminal = !BUYER_LEAD_TRANSITIONS[lead.status as BuyerLeadStatus]
  const statusLabel = BUYER_LEAD_STATUS_LABELS[lead.status as BuyerLeadStatus] ?? lead.status
  const statusClass = BUYER_LEAD_STATUS_CLASSES[lead.status as BuyerLeadStatus] ?? ''

  const bestMatch = lead.matches[0]
  const bestMatchScore = bestMatch ? bestMatch.score : 0
  const leadScore = calcBuyerScore(lead, bestMatchScore)

  const equipment = (lead.criticalEquipment ?? {}) as Record<string, boolean>
  const activeEquipment = Object.entries(equipment)
    .filter(([, v]) => v)
    .map(([k]) => EQUIPMENT_LABELS[k] ?? k)

  const daysInPipeline = daysSince(lead.createdAt)
  const delivery = lead.deliveries[0] ?? null
  const warranty = lead.warranty
  const openTickets = warranty?.tickets ?? []
  const hasAlert = openTickets.length > 0

  const warrantyMonthsLeft = warranty ? monthsRemainingFrom(warranty.endDate) : null
  const warrantyElapsedPct = warranty
    ? Math.min(
        100,
        Math.round(
          ((Date.now() - warranty.startDate.getTime()) /
            (warranty.endDate.getTime() - warranty.startDate.getTime())) *
            100
        )
      )
    : 0

  const defaultValues = {
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    status: lead.status,
    agentId: lead.agentId,
    vehicleType: lead.vehicleType ?? null,
    minSeats: lead.minSeats ?? null,
    maxBudget: lead.maxBudget ? Number(lead.maxBudget) : null,
    criticalEquipment: {
      solar: equipment.solar ?? false,
      kitchen: equipment.kitchen ?? false,
      bathroom: equipment.bathroom ?? false,
      shower: equipment.shower ?? false,
      heating: equipment.heating ?? false,
    },
    useZone: lead.useZone ?? '',
    purchaseTimeline: lead.purchaseTimeline ?? null,
  }

  const buyerMatches: BuyerMatchData[] = lead.matches.map((m) => {
    const rawPrice = m.vehicle.desiredPrice ?? m.vehicle.valuationRecommended
    return {
      id: m.id,
      score: m.score,
      status: m.status,
      vehicle: {
        id: m.vehicle.id,
        brand: m.vehicle.brand,
        model: m.vehicle.model,
        year: m.vehicle.year,
        km: m.vehicle.km,
        price: rawPrice ? Number(rawPrice) : null,
        photoUrl: m.vehicle.photos[0]?.url ?? null,
        sellerLeadId: m.vehicle.sellerLead.id,
      },
    }
  })

  // Score breakdown (0-100 each)
  const scoreContacto = lead.phone ? 100 : 70
  const prefCount = [
    lead.vehicleType,
    lead.maxBudget,
    lead.minSeats,
    lead.useZone,
    lead.purchaseTimeline,
  ].filter(Boolean).length
  const scorePref = Math.min(100, prefCount * 20)
  const scoreMatches = Math.min(100, bestMatchScore)
  const statusEngagementMap: Record<string, number> = {
    NUEVO: 15,
    CONTACTADO: 35,
    CUALIFICADO: 60,
    EN_NEGOCIACION: 80,
    CERRADO: 100,
    PERDIDO: 0,
  }
  const scoreEngagement = statusEngagementMap[lead.status] ?? 15

  const scoreColor = (s: number) => (s >= 70 ? '#1f8a5b' : s >= 45 ? '#d97706' : '#94a3b8')

  return (
    <div className="-mx-6 -mt-6 flex min-h-full flex-col">
      {/* ── Topbar ── */}
      <header className="sticky top-0 z-20 flex h-[73px] items-center gap-3 border-b border-[#e2e8f0] bg-white px-8">
        <Link
          href="/compradores"
          className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#64748b] transition-colors hover:text-[#0a0a0a]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Compradores
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#c8d4e0]">/</span>
        <span className="max-w-[220px] truncate font-mono text-[11px] uppercase tracking-[0.12em] text-[#0a0a0a]">
          {lead.name}
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e2e8f0] text-[#64748b] transition-colors hover:bg-[#f8fafc]"
            title="Archivar"
          >
            <Archive className="h-4 w-4" />
          </button>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e2e8f0] text-[#64748b] transition-colors hover:bg-[#f8fafc]"
            title="Más acciones"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {lead.phone && (
            <WhatsAppButton
              phone={lead.phone}
              message={buyerWhatsAppMessage(lead.name)}
              leadId={lead.id}
              leadType="buyer"
            />
          )}
        </div>
      </header>

      {/* ── Hero section ── */}
      <section className="border-b border-[#e2e8f0] bg-white px-8 pb-0 pt-6">
        {/* Identity row */}
        <div className="flex items-start gap-5">
          {/* Avatar circle */}
          <div
            className="relative flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full text-[28px] font-semibold text-white"
            style={{
              background: 'linear-gradient(135deg, #294e4c 0%, #3d7573 100%)',
              boxShadow: '0 0 0 4px #fff, 0 0 0 6px #e2e8f0',
            }}
          >
            {lead.name.charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            {/* Name + status */}
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[28px] font-semibold leading-tight text-[#0a0a0a]">
                {lead.name}
              </h1>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusClass}`}
              >
                {statusLabel}
              </span>
              {isTerminal && <span className="text-[11px] text-[#94a3b8]">🔒 Estado final</span>}
            </div>

            {/* Meta row */}
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#64748b]">
              <span>#{lead.id.slice(-8)}</span>
              <span>
                Alta:{' '}
                {new Date(lead.createdAt).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              {lead.agent && (
                <span className="flex items-center gap-1.5">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#294e4c] text-[8px] font-bold text-white">
                    {lead.agent.name.charAt(0).toUpperCase()}
                  </span>
                  {lead.agent.name}
                </span>
              )}
              {lead.source && (
                <span className="rounded bg-[#f1f5f9] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[#64748b]">
                  {lead.source}
                </span>
              )}
            </div>

            {/* Contact bar */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="flex items-center gap-1.5 rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-3 py-1 text-[12px] text-[#374151] transition-colors hover:bg-white"
                >
                  <Mail className="h-3 w-3 text-[#94a3b8]" />
                  {lead.email}
                </a>
              )}
              {lead.phone && (
                <a
                  href={`tel:${lead.phone}`}
                  className="flex items-center gap-1.5 rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-3 py-1 text-[12px] text-[#374151] transition-colors hover:bg-white"
                >
                  <Phone className="h-3 w-3 text-[#94a3b8]" />
                  {lead.phone}
                </a>
              )}
              {/* Preferences tags */}
              {activeEquipment.slice(0, 3).map((e) => (
                <span
                  key={e}
                  className="rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-3 py-1 text-[11px] text-[#64748b]"
                >
                  {e}
                </span>
              ))}
              {activeEquipment.length > 3 && (
                <span className="text-[11px] text-[#94a3b8]">
                  +{activeEquipment.length - 3} más
                </span>
              )}
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div className="mt-6 grid grid-cols-[repeat(4,1fr)_auto] border-t border-[#f1f5f9]">
          {[
            {
              label: 'Presupuesto',
              value: lead.maxBudget ? EUR(Number(lead.maxBudget)) : '—',
              color: 'text-[#0a0a0a]',
            },
            {
              label: 'Compra final',
              value: delivery?.vehicle?.salePrice ? EUR(Number(delivery.vehicle.salePrice)) : '—',
              color: delivery?.vehicle?.salePrice ? 'text-[#1f8a5b]' : 'text-[#0a0a0a]',
            },
            {
              label: 'Plazo',
              value: lead.purchaseTimeline
                ? (PURCHASE_TIMELINE_LABELS[lead.purchaseTimeline] ?? lead.purchaseTimeline)
                : '—',
              color: 'text-[#0a0a0a]',
            },
            {
              label: 'Lead score',
              value: `${leadScore}/100`,
              color:
                leadScore >= 75
                  ? 'text-[#1f8a5b]'
                  : leadScore >= 50
                    ? 'text-[#d97706]'
                    : 'text-[#94a3b8]',
            },
          ].map((kpi, i) => (
            <div key={i} className={`px-6 py-4 ${i > 0 ? 'border-l border-[#f1f5f9]' : ''}`}>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#94a3b8]">
                {kpi.label}
              </p>
              <p className={`mt-1 text-[22px] font-semibold leading-tight ${kpi.color}`}>
                {kpi.value}
              </p>
            </div>
          ))}
          {/* Garantía */}
          <div className="border-l border-[#f1f5f9] px-6 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#94a3b8]">
              Garantía
            </p>
            <p className="mt-1 text-[22px] font-semibold leading-tight text-[#0a0a0a]">
              {warrantyMonthsLeft !== null ? `${warrantyMonthsLeft} m` : '—'}
            </p>
          </div>
        </div>

        {/* Tabs bar */}
        <div className="-mx-8 flex items-center border-t border-[#e2e8f0] px-8">
          {[
            { label: 'Ficha', active: true },
            { label: 'Actividad', count: activities.length },
            { label: 'Vehículos sugeridos', count: lead.matches.length },
            { label: 'Postventa', alert: hasAlert },
            { label: 'Documentos' },
          ].map((tab) => (
            <button
              key={tab.label}
              className={`relative flex items-center gap-1.5 px-4 py-3 text-[13px] font-medium transition-colors ${
                tab.active
                  ? 'text-[#0a0a0a] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#0a0a0a]'
                  : 'text-[#64748b] hover:text-[#0a0a0a]'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#f1f5f9] px-1 font-mono text-[10px] text-[#64748b]">
                  {tab.count}
                </span>
              )}
              {tab.alert && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
            </button>
          ))}
        </div>
      </section>

      {/* ── Body grid ── */}
      <div className="grid flex-1 grid-cols-[1fr_320px]">
        {/* ── Main content ── */}
        <div className="min-w-0 space-y-5 p-8 pb-16">
          {/* Datos del comprador + Preferencias (single form) */}
          <BuyerLeadEditForm
            leadId={lead.id}
            defaultValues={defaultValues}
            agents={agents}
            isAdmin={isAdmin}
          />

          {/* Actividad */}
          <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white">
            <div className="border-b border-[#e2e8f0] px-6 py-4">
              <h2 className="text-[14px] font-semibold text-[#0a0a0a]">
                Actividad
                <span className="ml-2 font-mono text-[11px] font-normal text-[#94a3b8]">
                  {activities.length} entradas
                </span>
              </h2>
            </div>
            <div className="space-y-4 p-6">
              <NoteForm addNote={addBuyerLeadNote.bind(null, lead.id)} />
              {activities.length > 0 && (
                <div className="border-t border-[#f1f5f9] pt-4">
                  <ActivityTimeline
                    activities={activities as ActivityItem[]}
                    currentUserId={currentUser.id}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Vehículos sugeridos */}
          {buyerMatches.length > 0 && <MatchesSection side="buyer" matches={buyerMatches} />}
        </div>

        {/* ── Right sidebar ── */}
        <aside className="border-l border-[#e2e8f0]">
          <div className="sticky top-[130px] space-y-4 p-5">
            {/* Próxima acción — dark gradient card */}
            <div
              className="relative overflow-hidden rounded-xl p-5"
              style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #2a221c 100%)' }}
            >
              {/* Glow blob */}
              <div
                className="pointer-events-none absolute right-[-40px] top-[-40px] h-[140px] w-[140px] rounded-full opacity-40"
                style={{ background: '#294e4c', filter: 'blur(40px)' }}
              />
              <p
                className="font-mono text-[10px] uppercase tracking-[0.12em]"
                style={{ color: '#b59e7d' }}
              >
                Próxima acción
              </p>
              <p className="relative mt-2 text-[15px] font-semibold leading-snug text-white">
                {lead.status === 'NUEVO'
                  ? 'Contactar al comprador'
                  : lead.status === 'CONTACTADO'
                    ? 'Cualificar sus necesidades'
                    : lead.status === 'CUALIFICADO'
                      ? 'Presentar vehículos match'
                      : lead.status === 'EN_NEGOCIACION'
                        ? 'Cerrar la operación'
                        : lead.status === 'CERRADO'
                          ? 'Coordinar la entrega'
                          : 'Revisar el lead'}
              </p>
              {lead.phone && (
                <div className="relative mt-4 flex gap-2">
                  <a
                    href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-medium text-[#0a0a0a] transition-opacity hover:opacity-90"
                    style={{ background: '#b59e7d' }}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp
                  </a>
                  <a
                    href={`tel:${lead.phone}`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-medium text-white transition-opacity hover:opacity-80"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.15)',
                    }}
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Llamar
                  </a>
                </div>
              )}
            </div>

            {/* Alert: open tickets */}
            {hasAlert && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="flex items-center gap-2 text-[12.5px] font-semibold text-amber-800">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  {openTickets.length} incidencia{openTickets.length !== 1 ? 's' : ''} abierta
                  {openTickets.length !== 1 ? 's' : ''}
                </p>
                <div className="mt-2 space-y-1">
                  {openTickets.slice(0, 2).map((t) => (
                    <p key={t.id} className="text-[11px] text-amber-700">
                      · {t.title}
                    </p>
                  ))}
                </div>
                {warranty && (
                  <Link
                    href={`/postventa/${warranty.id}`}
                    className="mt-2 block text-[11px] font-medium text-amber-700 underline hover:text-amber-900"
                  >
                    Ver en postventa →
                  </Link>
                )}
              </div>
            )}

            {/* Operación — only when delivery exists */}
            {delivery && delivery.vehicle && (
              <div className="rounded-xl border border-[#e2e8f0] bg-white p-5">
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#94a3b8]">
                  Operación
                </p>
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] text-[#64748b]">Vehículo</span>
                    <span className="text-right text-[12px] font-medium text-[#0a0a0a]">
                      {delivery.vehicle.brand} {delivery.vehicle.model}
                      {delivery.vehicle.year ? ` (${delivery.vehicle.year})` : ''}
                    </span>
                  </div>
                  {delivery.vehicle.salePrice && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#64748b]">Precio final</span>
                      <span className="text-[13px] font-semibold text-[#1f8a5b]">
                        {EUR(Number(delivery.vehicle.salePrice))}
                      </span>
                    </div>
                  )}
                  {delivery.vehicle.salePrice && lead.maxBudget && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#64748b]">vs presupuesto</span>
                      <span
                        className={`text-[12px] font-medium ${
                          Number(delivery.vehicle.salePrice) <= Number(lead.maxBudget)
                            ? 'text-[#1f8a5b]'
                            : 'text-[#d97706]'
                        }`}
                      >
                        {Math.round(
                          (Number(delivery.vehicle.salePrice) / Number(lead.maxBudget)) * 100
                        )}
                        %
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#64748b]">Días en pipeline</span>
                    <span className="text-[12px] text-[#0a0a0a]">{daysInPipeline} días</span>
                  </div>
                </div>
              </div>
            )}

            {/* Garantía */}
            {warranty && (
              <div className="rounded-xl border border-[#e2e8f0] bg-white p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#94a3b8]">
                    Garantía
                  </p>
                  <Shield className="h-3.5 w-3.5 text-[#294e4c]" />
                </div>
                <p className="text-[22px] font-semibold leading-tight text-[#0a0a0a]">
                  {warrantyMonthsLeft} meses
                </p>
                <p className="text-[11px] text-[#64748b]">restantes</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#f1f5f9]">
                  <div
                    className="h-full rounded-full bg-[#294e4c] transition-all"
                    style={{ width: `${Math.max(2, 100 - warrantyElapsedPct)}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-[#94a3b8]">
                  <span>
                    {new Date(warranty.startDate).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <span>
                    {new Date(warranty.endDate).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            )}

            {/* Calidad del lead */}
            <div className="rounded-xl border border-[#e2e8f0] bg-white p-5">
              <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.12em] text-[#94a3b8]">
                Calidad del lead
              </p>
              {/* Score donut */}
              <div className="flex items-center gap-4">
                <div
                  className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: `conic-gradient(${
                      leadScore >= 75 ? '#1f8a5b' : leadScore >= 50 ? '#d97706' : '#dc2626'
                    } ${leadScore * 3.6}deg, #f1f5f9 0)`,
                  }}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
                    <span
                      className="text-[14px] font-bold"
                      style={{
                        color:
                          leadScore >= 75 ? '#1f8a5b' : leadScore >= 50 ? '#d97706' : '#dc2626',
                      }}
                    >
                      {leadScore}
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-[#0a0a0a]">
                    {leadScore >= 75 ? 'Alto potencial' : leadScore >= 50 ? 'Moderado' : 'Bajo'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#64748b]">
                    {leadScore >= 75
                      ? 'Perfil muy completo'
                      : leadScore >= 50
                        ? 'Completar preferencias'
                        : 'Contactar y completar datos'}
                  </p>
                </div>
              </div>
              {/* Breakdown bars */}
              <div className="mt-4 space-y-2.5">
                {[
                  { label: 'Contacto', value: scoreContacto },
                  { label: 'Preferencias', value: scorePref },
                  { label: 'Matches', value: scoreMatches },
                  { label: 'Engagement', value: scoreEngagement },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[11px] text-[#64748b]">{row.label}</span>
                      <span
                        className="text-[11px] font-medium"
                        style={{ color: scoreColor(row.value) }}
                      >
                        {row.value}%
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-[#f1f5f9]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${row.value}%`, background: scoreColor(row.value) }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Resumen rápido */}
            <div className="rounded-xl border border-[#e2e8f0] bg-white p-5">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#94a3b8]">
                Resumen
              </p>
              <div className="space-y-2">
                {(
                  [
                    {
                      label: 'Días en pipeline',
                      value: `${daysInPipeline}d`,
                      warn: daysInPipeline > 60,
                    },
                    { label: 'Estado', value: statusLabel },
                    { label: 'Matches activos', value: String(lead.matches.length) },
                    lead.source ? { label: 'Canal origen', value: lead.source } : null,
                    lead.vehicleType
                      ? {
                          label: 'Tipo buscado',
                          value: lead.vehicleType === 'CAMPER' ? 'Camper' : 'Autocaravana',
                        }
                      : null,
                  ] as Array<{ label: string; value: string; warn?: boolean } | null>
                )
                  .filter(Boolean)
                  .map((row) => (
                    <div key={row!.label} className="flex items-center justify-between">
                      <span className="text-[11px] text-[#64748b]">{row!.label}</span>
                      <span
                        className={`text-[12px] font-medium ${
                          row!.warn ? 'text-amber-600' : 'text-[#0a0a0a]'
                        }`}
                      >
                        {row!.value}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
