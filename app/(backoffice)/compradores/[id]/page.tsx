import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { BuyerLeadEditForm } from './buyer-lead-edit-form'
import { BuyerTopbarActions } from './buyer-topbar-actions'
import { ProximaAccionCard } from './proxima-accion-card'
import { MatchesSection } from '@/components/matches-section'
import type { BuyerMatchData } from '@/components/matches-section'
import { ActivityTimeline } from '@/components/activity-timeline'
import type { ActivityItem } from '@/components/activity-timeline'
import { NoteForm } from '@/components/note-form'
import { ChatTranscript } from '@/components/chat-transcript'
import type { ChatMessage } from '@/components/chat-transcript'
import { addBuyerLeadNote } from './actions'
import { WhatsAppButton } from '@/components/whatsapp-button'
import { buyerWhatsAppMessage } from '@/lib/whatsapp'
import { LeadTabNav } from '@/app/(backoffice)/vendedores/[id]/lead-tab-nav'
import type { LeadTab } from '@/app/(backoffice)/vendedores/[id]/lead-tab-nav'
import {
  BUYER_LEAD_STATUS_LABELS,
  BUYER_LEAD_STATUS_CLASSES,
  BUYER_LEAD_TRANSITIONS,
} from '@/lib/state-machine'
import type { BuyerLeadStatus } from '@prisma/client'
import { ChevronLeft, Phone, Mail, Shield, MessagesSquare } from 'lucide-react'

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
  if (lead.phone) score += 10
  score += 5
  if (lead.vehicleType) score += 8
  if (lead.maxBudget) score += 12
  if (lead.minSeats) score += 5
  if (lead.useZone) score += 5
  if (lead.purchaseTimeline) score += 5
  if (bestMatchScore >= 80) score += 25
  else if (bestMatchScore >= 60) score += 18
  else if (bestMatchScore >= 40) score += 10
  else if (bestMatchScore > 0) score += 5
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

export default async function FichaCompradorPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { tab?: string }
}) {
  const activeTab = searchParams.tab ?? 'ficha'

  const [currentUser, lead, agents, activities] = await Promise.all([
    requireAuth(),
    db.buyerLead.findUnique({
      where: { id: params.id },
      include: {
        agent: true,
        chatSession: {
          select: {
            messages: true,
            status: true,
            startedAt: true,
            lastMessageAt: true,
            completedAt: true,
            totalTokens: true,
            llmModel: true,
          },
        },
        warranty: {
          include: {
            tickets: {
              where: { status: { in: ['ABIERTO', 'EN_PROGRESO'] } },
              select: { id: true, priority: true, title: true, status: true },
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

  // Chat session (CAM-55) — leads originados en el chat /comprar
  const chatSession = lead.chatSession
  const chatMessages: ChatMessage[] = Array.isArray(chatSession?.messages)
    ? (chatSession.messages as unknown as ChatMessage[])
    : []
  const chatUserMsgCount = chatMessages.filter((m) => m.role === 'user').length
  const hasChat = !!chatSession

  // Tabs definition
  const tabs: LeadTab[] = [
    { key: 'ficha', label: 'Ficha' },
    { key: 'actividad', label: 'Actividad', badge: activities.length },
    { key: 'matches', label: 'Vehículos sugeridos', badge: lead.matches.length },
    ...(hasChat
      ? [{ key: 'conversacion', label: 'Conversación', badge: chatUserMsgCount } as LeadTab]
      : []),
    { key: 'postventa', label: 'Postventa', badge: hasAlert ? '!' : undefined },
    { key: 'documentos', label: 'Documentos' },
  ]

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
          <BuyerTopbarActions leadId={lead.id} isTerminal={isTerminal} />
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
          <div className="border-l border-[#f1f5f9] px-6 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#94a3b8]">
              Garantía
            </p>
            <p className="mt-1 text-[22px] font-semibold leading-tight text-[#0a0a0a]">
              {warrantyMonthsLeft !== null ? `${warrantyMonthsLeft} m` : '—'}
            </p>
          </div>
        </div>

        {/* Tabs — via LeadTabNav (client, URL-driven) */}
        <div className="-mx-8">
          <Suspense fallback={<div className="h-12 border-t border-[#e2e8f0]" />}>
            <LeadTabNav tabs={tabs} defaultTab="ficha" />
          </Suspense>
        </div>
      </section>

      {/* ── Body grid ── */}
      <div className="grid flex-1 grid-cols-[1fr_320px]">
        {/* ── Main content ── */}
        <div className="min-w-0 p-8 pb-16">
          {/* ── TAB: FICHA ── */}
          {activeTab === 'ficha' && (
            <BuyerLeadEditForm
              leadId={lead.id}
              defaultValues={defaultValues}
              agents={agents}
              isAdmin={isAdmin}
            />
          )}

          {/* ── TAB: ACTIVIDAD ── */}
          {activeTab === 'actividad' && (
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
                {activities.length === 0 && (
                  <p className="text-center text-[13px] text-[#94a3b8]">
                    Sin actividad registrada todavía
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: MATCHES ── */}
          {activeTab === 'matches' && (
            <>
              {buyerMatches.length > 0 ? (
                <MatchesSection side="buyer" matches={buyerMatches} />
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-[#e2e8f0] bg-white py-16">
                  <p className="text-[15px] font-medium text-[#0a0a0a]">Sin vehículos sugeridos</p>
                  <p className="mt-1 text-[13px] text-[#94a3b8]">
                    Los matches se calculan automáticamente cuando hay vehículos compatibles
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── TAB: CONVERSACIÓN (CAM-55) ── */}
          {activeTab === 'conversacion' &&
            (hasChat ? (
              <ChatTranscript
                messages={chatMessages}
                status={chatSession!.status}
                startedAt={chatSession!.startedAt}
                lastMessageAt={chatSession!.lastMessageAt}
                completedAt={chatSession!.completedAt}
                totalTokens={chatSession!.totalTokens}
                llmModel={chatSession!.llmModel}
              />
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-[#e2e8f0] bg-white py-16">
                <MessagesSquare className="mb-3 h-8 w-8 text-[#e2e8f0]" />
                <p className="text-[15px] font-medium text-[#0a0a0a]">Sin conversación</p>
                <p className="mt-1 text-[13px] text-[#94a3b8]">
                  Este lead no se originó desde el chat del portal
                </p>
              </div>
            ))}

          {/* ── TAB: POSTVENTA ── */}
          {activeTab === 'postventa' && (
            <>
              {warranty ? (
                <div className="space-y-5">
                  {/* Warranty card */}
                  <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white">
                    <div className="border-b border-[#e2e8f0] px-6 py-4">
                      <div className="flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[#0a0a0a]">
                          <Shield className="h-4 w-4 text-[#294e4c]" />
                          Garantía activa
                        </h2>
                        <span className="rounded-full bg-[#f0f7f6] px-2.5 py-1 text-[11px] font-medium text-[#294e4c]">
                          {warrantyMonthsLeft} meses restantes
                        </span>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                        {[
                          {
                            label: 'Inicio',
                            value: new Date(warranty.startDate).toLocaleDateString('es-ES'),
                          },
                          {
                            label: 'Vencimiento',
                            value: new Date(warranty.endDate).toLocaleDateString('es-ES'),
                          },
                          {
                            label: 'Meses restantes',
                            value: `${warrantyMonthsLeft}`,
                          },
                          {
                            label: 'Estado',
                            value: warrantyMonthsLeft! > 0 ? 'Activa' : 'Vencida',
                          },
                        ].map((row) => (
                          <div key={row.label}>
                            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#94a3b8]">
                              {row.label}
                            </p>
                            <p className="mt-1 text-[14px] font-medium text-[#0a0a0a]">
                              {row.value}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#f1f5f9]">
                        <div
                          className="h-full rounded-full bg-[#294e4c] transition-all"
                          style={{ width: `${Math.max(2, 100 - warrantyElapsedPct)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tickets */}
                  {openTickets.length > 0 && (
                    <div className="overflow-hidden rounded-xl border border-amber-200 bg-white">
                      <div className="border-b border-amber-200 bg-amber-50 px-6 py-4">
                        <h2 className="text-[14px] font-semibold text-amber-800">
                          Incidencias abiertas ({openTickets.length})
                        </h2>
                      </div>
                      <div className="divide-y divide-[#f1f5f9]">
                        {openTickets.map((t) => (
                          <div key={t.id} className="flex items-center justify-between px-6 py-4">
                            <p className="text-[13px] font-medium text-[#0a0a0a]">{t.title}</p>
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  t.priority === 'CRITICA'
                                    ? 'bg-red-100 text-red-700'
                                    : t.priority === 'ALTA'
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-[#f1f5f9] text-[#64748b]'
                                }`}
                              >
                                {t.priority}
                              </span>
                              <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[10px] text-[#64748b]">
                                {t.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-[#f1f5f9] px-6 py-3">
                        <Link
                          href={`/postventa/${warranty.id}`}
                          className="text-[12px] font-medium text-[#294e4c] hover:underline"
                        >
                          Ver en módulo postventa →
                        </Link>
                      </div>
                    </div>
                  )}

                  {openTickets.length === 0 && (
                    <div className="flex items-center gap-3 rounded-xl border border-[#e2e8f0] bg-white px-6 py-4">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f0f7f6] text-[#294e4c]">
                        ✓
                      </span>
                      <div>
                        <p className="text-[13px] font-medium text-[#0a0a0a]">
                          Sin incidencias abiertas
                        </p>
                        <Link
                          href={`/postventa/${warranty.id}`}
                          className="text-[12px] text-[#294e4c] hover:underline"
                        >
                          Ver historial completo →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-[#e2e8f0] bg-white py-16">
                  <Shield className="mb-3 h-8 w-8 text-[#e2e8f0]" />
                  <p className="text-[15px] font-medium text-[#0a0a0a]">Sin garantía activa</p>
                  <p className="mt-1 text-[13px] text-[#94a3b8]">
                    La garantía se genera automáticamente al completar la entrega del vehículo
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── TAB: DOCUMENTOS ── */}
          {activeTab === 'documentos' && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-[#e2e8f0] bg-white py-16">
              <p className="text-[15px] font-medium text-[#0a0a0a]">Próximamente</p>
              <p className="mt-1 text-[13px] text-[#94a3b8]">
                La gestión documental del comprador estará disponible en una próxima versión
              </p>
            </div>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <aside className="border-l border-[#e2e8f0]">
          <div className="sticky top-[130px] space-y-4 p-5">
            {/* Próxima acción — dark gradient card (client, logs WhatsApp) */}
            <ProximaAccionCard
              phone={lead.phone}
              leadId={lead.id}
              leadName={lead.name}
              status={lead.status}
            />

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

            {/* Operación */}
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
