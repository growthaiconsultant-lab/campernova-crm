import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { DocumentsPanel } from '@/components/operations/documents-panel'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { completedSalesQuery } from '@/lib/completed-sales'
import { CompletedSaleCard } from '@/components/completed-sale-card'
import { ManualAssociationsCard } from '@/components/manual-associations-card'
import { vehicleLabel } from '@/lib/display'
import { BuyerLeadEditForm } from './buyer-lead-edit-form'
import { buyerSourceLabel, isBuyerSource } from '@/lib/buyer-source'
import { LandingAttribution } from '@/components/landing-attribution'
import { SearchRequestBadge } from '@/components/search-request-badge'
import { SearchRequestCard } from '@/components/search-request-card'
import { TradeInCard } from './trade-in-card'
import { BuyerTopbarActions } from './buyer-topbar-actions'
import { NextActionEditor } from '@/components/next-action-editor'
import { buyerAgendaPage, type BuyerAgendaEntry } from '@/lib/buyer-agenda'
import { BuyerAgendaRow } from '@/components/buyer-agenda-row'
import { BuyerCallForm } from '@/components/buyer-call-form'
import { registerBuyerCall } from './call-actions'
import { NEXT_ACTION_LABELS } from '@/lib/next-action'
import { BuyerNotesPanel } from '@/components/buyer-notes-panel'
import { BuyerActionsPanel } from '@/components/buyer-actions-panel'
import {
  buyerCommercialNotesWhere,
  isBuyerCommercialNote,
  followupPage,
  FOLLOWUP_PAGE_SIZE,
} from '@/lib/buyer-followup'
import { createCalendarEvent } from '@/app/(backoffice)/calendario/actions'
import { MatchesSection } from '@/components/matches-section'
import { currentMatches } from '@/lib/matching/current-matches'
import { CatalogEditor } from '@/components/match-catalog-editor'
import { BuyerCatalogResults } from '@/components/buyer-catalog-results'
import { readCatalog } from '@/lib/matching/catalog'
import { OffersSection } from '@/components/offers-section'
import { isActiveHold } from '@/lib/offers'
import { buyerScore } from '@/lib/scoring'
import { ScoreInfo } from '@/components/score-info'
import { isBuyerEligible, isVehicleEligible, prismaMatchingDeps } from '@/lib/matching'
import { classifyBuyerCriteria } from '@/lib/buyer-criteria'
import type { BuyerMatchData } from '@/components/matches-section'
import { ActivityTimeline } from '@/components/activity-timeline'
import { ChatTranscript } from '@/components/chat-transcript'
import type { ChatMessage } from '@/components/chat-transcript'
import { addBuyerLeadNote } from './actions'
import { WhatsAppButton } from '@/components/whatsapp-button'
import { buyerWhatsAppMessage } from '@/lib/whatsapp'
import { BuyerStatusSelect } from '../buyer-status-select'
import { TemperatureChip } from './temperature-chip'
import { InfoTooltip } from '@/components/info-tooltip'
import { BUYER_LEAD_STATUS_LABELS, BUYER_LEAD_TRANSITIONS } from '@/lib/state-machine'
import type { BuyerLeadStatus, Prisma } from '@prisma/client'
import { CalendarClock, Phone, Mail, Shield, UserRound } from 'lucide-react'

// ── Helpers ────────────────────────────────────────────────────────────────────

const pendingEvents = {
  status: { notIn: ['CANCELADO', 'COMPLETADO', 'NO_SHOW'] },
} satisfies Prisma.CalendarEventWhereInput
const agendaEventFields = {
  id: true,
  title: true,
  startAt: true,
  description: true,
  assignedTo: { select: { name: true } },
} satisfies Prisma.CalendarEventSelect

function calendarEntry(
  event: Prisma.CalendarEventGetPayload<{ select: typeof agendaEventFields }>
): BuyerAgendaEntry {
  return {
    eventId: event.id,
    title: event.title,
    due: event.startAt,
    description: event.description,
    assignee: event.assignedTo?.name,
  }
}

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function FichaCompradorPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: {
    tab?: string
    notesPage?: string
    actionsPage?: string
    ver?: string
    historial?: string
  }
}) {
  const requested = searchParams.tab ?? 'ficha'
  const activeTab = ['busqueda', 'vehiculos', 'documentos', 'postventa'].includes(requested)
    ? requested
    : 'ficha'
  const notesPage = followupPage(searchParams.notesPage)
  const actionsPage = activeTab === 'ficha' ? followupPage(searchParams.actionsPage) : 1

  const currentUser = await requireAgente()
  const legacyTabs: Record<string, string> = {
    actividad: 'ficha#historial',
    conversacion: 'ficha&ver=chat#conversacion',
    ofertas: 'vehiculos#ofertas',
    matches: 'vehiculos#intereses',
  }
  const [lead, agents, activities, commercialNotes, searchRequest, lastContact, firstScheduled] =
    await Promise.all([
      db.buyerLead.findUnique({
        where: { id: params.id },
        include: {
          agent: true,
          chatSessions: {
            orderBy: { startedAt: 'asc' },
            select: {
              id: true,
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
          deliveries: completedSalesQuery,
          matches: {
            include: {
              vehicle: {
                select: {
                  id: true,
                  brand: true,
                  model: true,
                  year: true,
                  plate: true,
                  km: true,
                  status: true,
                  entryValidatedAt: true,
                  entryAnnulledAt: true,
                  desiredPrice: true,
                  salePrice: true,
                  photos: { select: { url: true }, orderBy: { order: 'asc' }, take: 1 },
                  sellerLead: { select: { id: true, archivedAt: true } },
                },
              },
            },
            orderBy: { score: 'desc' },
          },
          _count: { select: { calendarEvents: { where: pendingEvents } } },
          calendarEvents: {
            where: pendingEvents,
            orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
            skip: (actionsPage - 1) * FOLLOWUP_PAGE_SIZE,
            take: FOLLOWUP_PAGE_SIZE + 1,
            select: agendaEventFields,
          },
          offers: {
            orderBy: { createdAt: 'desc' },
            include: {
              vehicle: { select: { brand: true, model: true, year: true, sellerLeadId: true } },
            },
          },
        },
      }),
      db.user.findMany({
        where: { active: true, role: { in: ['ADMIN', 'AGENTE'] } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      db.activity.findMany({
        where: { buyerLeadId: params.id },
        include: { agent: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      db.activity.findMany({
        where: buyerCommercialNotesWhere(params.id),
        select: { id: true, content: true, createdAt: true, agent: { select: { name: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (notesPage - 1) * FOLLOWUP_PAGE_SIZE,
        take: FOLLOWUP_PAGE_SIZE + 1,
      }),
      db.activity.findFirst({
        where: { id: { startsWith: 'search_answers_' }, buyerLeadId: params.id, agentId: null },
        orderBy: { createdAt: 'desc' },
        select: { content: true, createdAt: true },
      }),
      activeTab === 'ficha'
        ? db.activity.findFirst({
            where: {
              buyerLeadId: params.id,
              OR: [
                { type: { in: ['LLAMADA', 'EMAIL', 'WHATSAPP_INICIADO'] } },
                buyerCommercialNotesWhere(params.id),
              ],
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            select: {
              id: true,
              type: true,
              content: true,
              createdAt: true,
              agent: { select: { name: true } },
            },
          })
        : null,
      activeTab === 'ficha' && actionsPage > 1
        ? db.calendarEvent.findFirst({
            where: {
              buyerLeadId: params.id,
              ...pendingEvents,
            },
            orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
            select: agendaEventFields,
          })
        : null,
    ])

  if (!lead) notFound()
  if (lead.mergedIntoId)
    redirect(`/compradores/${lead.mergedIntoId}?tab=${encodeURIComponent(requested)}`)

  if (Object.prototype.hasOwnProperty.call(legacyTabs, requested))
    redirect(`/compradores/${params.id}?tab=${legacyTabs[requested]}`)
  const events = lead.calendarEvents.map(calendarEntry)
  const firstEvent =
    actionsPage === 1 ? events[0] : firstScheduled ? calendarEntry(firstScheduled) : undefined
  const reminder = lead.nextActionType
    ? { eventId: null, title: NEXT_ACTION_LABELS[lead.nextActionType], due: lead.nextActionDueAt }
    : undefined
  const agenda = buyerAgendaPage(firstEvent, events, reminder, actionsPage, FOLLOWUP_PAGE_SIZE)
  const pendingCount = lead._count.calendarEvents + Number(Boolean(reminder))
  const reminderEditor = lead.nextActionType && (
    <NextActionEditor
      key={lead.id}
      leadType="buyer"
      leadId={lead.id}
      nextActionType={lead.nextActionType}
      nextActionDueAt={lead.nextActionDueAt?.toISOString() ?? null}
      fallbackText=""
      editLabel="Editar recordatorio"
    />
  )
  const saveCall = registerBuyerCall.bind(null, lead.id)

  const dateTime = (date: Date) =>
    date.toLocaleString('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Europe/Madrid',
    })

  function pagination(kind: 'notesPage' | 'actionsPage', page: number, hasMore: boolean) {
    if (page === 1 && !hasMore) return null
    const href = (next: number) => {
      const query = new URLSearchParams({
        tab: 'ficha',
        notesPage: String(notesPage),
        actionsPage: String(actionsPage),
      })
      if (searchParams.historial) query.set('historial', searchParams.historial)
      query.set(kind, String(next))
      return `/compradores/${params.id}?${query}#${kind === 'notesPage' ? 'buyer-notes-title' : 'buyer-actions-title'}`
    }
    return (
      <nav
        aria-label={kind === 'notesPage' ? 'Páginas de notas' : 'Páginas de acciones'}
        className="mt-3 flex items-center gap-4 text-sm"
      >
        {page > 1 && (
          <Link className="underline" href={href(page - 1)}>
            Anterior
          </Link>
        )}
        <span className="text-muted-foreground">Página {page}</span>
        {hasMore && (
          <Link className="underline" href={href(page + 1)}>
            Siguiente
          </Link>
        )}
      </nav>
    )
  }

  const isTerminal = !BUYER_LEAD_TRANSITIONS[lead.status as BuyerLeadStatus]
  const statusLabel = BUYER_LEAD_STATUS_LABELS[lead.status as BuyerLeadStatus] ?? lead.status

  // M1 — re-filtrado de matches persistidos por elegibilidad (lectura):
  // si el SUJETO (comprador) no es elegible, no se muestran matches; y de los que
  // haya, se ocultan aquellos cuya contraparte vehículo no es elegible.
  const subjectBuyerEligible = isBuyerEligible({
    status: lead.status,
    archivedAt: lead.archivedAt,
  })
  const eligibleMatches = subjectBuyerEligible
    ? lead.matches.filter((m) =>
        isVehicleEligible({
          status: m.vehicle.status,
          sellerArchivedAt: m.vehicle.sellerLead.archivedAt,
          entryValidatedAt: m.vehicle.entryValidatedAt,
          entryAnnulledAt: m.vehicle.entryAnnulledAt,
        })
      )
    : []

  const deps = prismaMatchingDeps(db)
  const subject = eligibleMatches.length ? await deps.getBuyer(lead.id) : null
  const visibleMatches = await currentMatches(eligibleMatches, async (m) => [
    await deps.getVehicle(m.vehicle.id),
    subject,
  ])

  // Resumen de la necesidad — la unidad de trabajo del comprador
  const tipoLabel =
    lead.vehicleType === 'CAMPER'
      ? 'camper'
      : lead.vehicleType === 'AUTOCARAVANA'
        ? 'autocaravana'
        : 'vehículo'
  const needSummary = [
    `Busca ${tipoLabel}`,
    lead.maxBudget ? `hasta ${EUR(Number(lead.maxBudget))}` : null,
    lead.minSeats ? `${lead.minSeats}+ plazas` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const bestMatch = visibleMatches[0]
  const bestMatchScore = bestMatch ? bestMatch.score : 0
  const hasActiveOffer = lead.offers.some((o) => isActiveHold(o.status))
  const scoreResult = buyerScore({
    phone: lead.phone,
    email: lead.email,
    vehicleType: lead.vehicleType,
    minSeats: lead.minSeats,
    maxBudget: lead.maxBudget ? Number(lead.maxBudget) : null,
    financingNeeded: lead.financingNeeded,
    purchaseTimeline: lead.purchaseTimeline,
    temperature: lead.temperature,
    status: lead.status,
    bestMatchScore,
    hasActiveOffer,
  })
  const leadScore = scoreResult.score

  const equipment = (lead.criticalEquipment ?? {}) as Record<string, boolean>
  const activeEquipment = Object.entries(equipment)
    .filter(([, v]) => v)
    .map(([k]) => EQUIPMENT_LABELS[k] ?? k)

  const daysInPipeline = daysSince(lead.createdAt)
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
    source: isBuyerSource(lead.source) ? lead.source : lead.source ? undefined : null,
    status: lead.status,
    agentId: lead.agentId,
    vehicleType: lead.vehicleType ?? null,
    minSeats: lead.minSeats ?? null,
    maxBudget: lead.maxBudget ? Number(lead.maxBudget) : null,
    financingNeeded: lead.financingNeeded ?? null,
    maxMonthlyPayment: lead.maxMonthlyPayment ? Number(lead.maxMonthlyPayment) : null,
    criticalEquipment: {
      solar: equipment.solar ?? false,
      kitchen: equipment.kitchen ?? false,
      bathroom: equipment.bathroom ?? false,
      shower: equipment.shower ?? false,
      heating: equipment.heating ?? false,
    },
    useZone: lead.useZone ?? '',
    purchaseTimeline: lead.purchaseTimeline ?? null,
    preferredCategory: lead.preferredCategory ?? null,
    preferredBedLayout: lead.preferredBedLayout ?? null,
    sleepingPlacesRequired: lead.sleepingPlacesRequired ?? null,
    bathroomRequired: lead.bathroomRequired ?? null,
    licenseType: lead.licenseType ?? null,
    needsWinter: lead.needsWinter ?? null,
    needsGarage: lead.needsGarage ?? null,
    maxLengthM: lead.maxLengthM ?? null,
    maxHeightM: lead.maxHeightM ?? null,
    hasKids: lead.hasKids ?? null,
  }

  const buyerMatches: BuyerMatchData[] = visibleMatches.map((m) => {
    const rawPrice = m.vehicle.salePrice ?? m.vehicle.desiredPrice
    return {
      id: m.id,
      score: m.score,
      status: m.status,
      generatedBy: m.generatedBy,
      explanation: m.explanation,
      vehicle: {
        id: m.vehicle.id,
        brand: m.vehicle.brand,
        model: m.vehicle.model,
        year: m.vehicle.year,
        plate: m.vehicle.plate,
        km: m.vehicle.km,
        price: rawPrice ? Number(rawPrice) : null,
        photoUrl: m.vehicle.photos[0]?.url ?? null,
        sellerLeadId: m.vehicle.sellerLead.id,
      },
    }
  })

  // Block 18 — ofertas del comprador + candidatos (vehículos matcheados)
  const offerCandidates = visibleMatches.map((m) => ({
    id: m.vehicle.id,
    label: `${m.vehicle.brand} ${m.vehicle.model} (${m.vehicle.year})`,
  }))
  const offerRows = lead.offers.map((o) => ({
    id: o.id,
    amount: Number(o.amount),
    depositAmount: o.depositAmount ? Number(o.depositAmount) : null,
    status: o.status,
    reservedUntil: o.reservedUntil ? o.reservedUntil.toISOString() : null,
    notes: o.notes,
    counterpartLabel: `${o.vehicle.brand} ${o.vehicle.model} (${o.vehicle.year})`,
    counterpartHref: `/vendedores/${o.vehicle.sellerLeadId}`,
  }))

  // CAM-65: criterios excluyentes vs preferencias
  const buyerCriteria = classifyBuyerCriteria({
    vehicleType: lead.vehicleType,
    minSeats: lead.minSeats,
    maxBudget: lead.maxBudget ? Number(lead.maxBudget) : null,
    sleepingPlacesRequired: lead.sleepingPlacesRequired,
    bathroomRequired: lead.bathroomRequired,
    licenseType: lead.licenseType,
    maxLengthM: lead.maxLengthM,
    maxHeightM: lead.maxHeightM,
    preferredCategory: lead.preferredCategory,
    preferredBedLayout: lead.preferredBedLayout,
    criticalEquipment: (lead.criticalEquipment ?? {}) as Record<string, boolean>,
    useZone: lead.useZone,
    needsWinter: lead.needsWinter,
    needsGarage: lead.needsGarage,
    hasKids: lead.hasKids,
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
    NO_CONTESTA: 15,
    BAJO_PEDIDO: 15,
    CONTACTADO: 35,
    CUALIFICADO: 60,
    EN_NEGOCIACION: 80,
    CERRADO: 100,
    PERDIDO: 0,
  }
  const scoreEngagement = statusEngagementMap[lead.status] ?? 15
  const scoreColor = (s: number) => (s >= 70 ? '#1a9d5f' : s >= 45 ? '#c9820a' : '#8b94a3')

  // Chat session (CAM-55) — leads originados en el chat /comprar
  const chatMessages: ChatMessage[] = lead.chatSessions.flatMap((session) =>
    Array.isArray(session.messages) ? (session.messages as unknown as ChatMessage[]) : []
  )
  const chatUserMsgCount = chatMessages.filter((m) => m.role === 'user').length
  const hasChat = lead.chatSessions.length > 0
  const showPostventa = Boolean(
    warranty || lead.deliveries.length || lead.status === 'CERRADO' || activeTab === 'postventa'
  )
  const tabs = [
    { key: 'ficha', label: 'Seguimiento' },
    { key: 'busqueda', label: 'Qué busca' },
    { key: 'vehiculos', label: 'Vehículos y ofertas' },
    { key: 'documentos', label: 'Documentos' },
    ...(showPostventa ? [{ key: 'postventa', label: 'Postventa' }] : []),
  ]
  const manualInterests = buyerMatches.filter((match) => match.generatedBy === 'manual')
  const path = `/compradores/${lead.id}`
  const historyFilters = ['Todo', 'Contactos', 'Notas', 'Cambios']
  const historyFilter = historyFilters.find((value) => value === searchParams.historial) ?? 'Todo'
  const history = activities.filter((activity) => {
    const contact = ['LLAMADA', 'EMAIL', 'WHATSAPP_INICIADO'].includes(activity.type)
    const note = isBuyerCommercialNote(activity)
    return (
      historyFilter === 'Todo' ||
      (historyFilter === 'Contactos'
        ? contact
        : historyFilter === 'Notas'
          ? note
          : !contact && !note)
    )
  })
  const columns = 'grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]'
  const stack = 'min-w-0 space-y-4'
  const card = 'min-w-0 rounded-xl border border-border bg-card p-5'
  const textLink =
    'inline-flex items-center text-sm font-semibold text-sidebar-primary underline underline-offset-4'
  const timelineLabel = lead.purchaseTimeline
    ? (PURCHASE_TIMELINE_LABELS[lead.purchaseTimeline] ?? lead.purchaseTimeline)
    : 'Por concretar'

  return (
    <div className="-mx-6 -mt-6 flex min-h-[calc(100%_+_1.5rem)] flex-col lg:-mb-6 lg:min-h-[calc(100%_+_3rem)]">
      <header className="border-b border-border bg-card px-4 pt-4 sm:px-7 sm:pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:min-w-64">
            <span
              aria-hidden="true"
              className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-tint text-lg font-bold text-brand sm:flex"
            >
              {lead.name
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part.charAt(0))
                .join('')
                .toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">
                  {lead.name}
                </h1>
                <BuyerStatusSelect leadId={lead.id} status={lead.status} buyerName={lead.name} />
                <SearchRequestBadge leadId={lead.id} />
                {isTerminal && <span className="text-xs text-muted-foreground">Estado final</span>}
              </div>
              <p className="mt-1 text-sm">{needSummary}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <UserRound size={14} aria-hidden="true" />
                Responsable · {lead.agent?.name ?? 'Sin asignar'}
              </p>
            </div>
          </div>
          <div className="flex w-full min-w-0 items-start gap-2 sm:w-auto">
            <details className="group min-w-0 max-w-full">
              <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold hover:bg-muted [&::-webkit-details-marker]:hidden">
                <Phone size={16} aria-hidden="true" /> Contactar
              </summary>
              <div className="mt-2 grid max-w-64 gap-2 rounded-lg border bg-card p-3 text-sm">
                {lead.phone && (
                  <>
                    <a
                      href={`tel:${lead.phone}`}
                      className="inline-flex min-h-10 items-center gap-2 break-all text-brand underline"
                    >
                      <Phone size={15} aria-hidden="true" /> {lead.phone}
                    </a>
                    <WhatsAppButton
                      phone={lead.phone}
                      message={buyerWhatsAppMessage(lead.name)}
                      leadId={lead.id}
                      leadType="buyer"
                    />
                  </>
                )}
                {lead.email && (
                  <a
                    href={`mailto:${lead.email}`}
                    className="inline-flex min-h-10 items-center gap-2 break-all text-brand underline"
                  >
                    <Mail size={15} className="shrink-0" aria-hidden="true" /> {lead.email}
                  </a>
                )}
                {!lead.phone && !lead.email && <p>Contacto pendiente de completar.</p>}
                <Link className={textLink} href={`${path}?tab=busqueda&ver=editar#editar`}>
                  Editar datos de contacto
                </Link>
              </div>
            </details>
            <BuyerTopbarActions key={lead.id} leadId={lead.id} isTerminal={isTerminal}>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="mb-1 font-medium">Temperatura</p>
                  <TemperatureChip leadId={lead.id} temperature={lead.temperature} />
                </div>
                <p>Origen · {buyerSourceLabel(lead.source)}</p>
              </div>
            </BuyerTopbarActions>
          </div>
        </div>
        {activeTab !== 'ficha' && (
          <section
            aria-labelledby="buyer-next-heading"
            className="mt-4 rounded-xl bg-brand-tint p-4 sm:px-5"
          >
            <BuyerCallForm key={lead.id} archived={Boolean(lead.archivedAt)} save={saveCall}>
              <div className="flex min-w-0 items-start gap-2.5">
                <CalendarClock
                  size={19}
                  className="mt-0.5 shrink-0 text-brand"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <h2 id="buyer-next-heading" className="text-xs font-semibold text-brand">
                    Próximo paso
                  </h2>
                  {agenda.first ? (
                    <>
                      <Link
                        href={
                          agenda.first.eventId
                            ? `/calendario/${agenda.first.eventId}`
                            : `${path}?tab=ficha#buyer-actions-title`
                        }
                        className="break-words text-lg font-semibold hover:underline"
                      >
                        {agenda.first.title}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {agenda.first.due
                          ? `${agenda.first.due < new Date() ? 'Vencida · ' : ''}${dateTime(agenda.first.due)} · hora de Madrid`
                          : 'Sin fecha'}
                      </p>
                    </>
                  ) : (
                    <p className="text-base font-medium">Sin acciones pendientes.</p>
                  )}
                </div>
              </div>
            </BuyerCallForm>
          </section>
        )}
        <nav
          aria-label="Apartados de la ficha"
          className="mt-5 flex flex-wrap gap-x-2 border-t border-border"
        >
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={`${path}?tab=${tab.key}`}
              aria-current={activeTab === tab.key ? 'page' : undefined}
              className={`border-b-2 px-2 py-3 text-sm font-medium sm:px-4 ${activeTab === tab.key ? 'border-sidebar-primary text-sidebar-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {tab.label}
              {tab.key === 'postventa' && hasAlert && (
                <span className="ml-1 text-amber-700">({openTickets.length})</span>
              )}
            </Link>
          ))}
        </nav>
      </header>
      <div className="mx-auto w-full max-w-[1440px] flex-1 p-4 pb-12 md:p-8">
        {activeTab === 'ficha' && (
          <div id="seguimiento" className="mx-auto max-w-4xl space-y-5">
            <BuyerActionsPanel
              key={lead.id}
              buyerLeadId={lead.id}
              actorId={currentUser.id}
              archived={Boolean(lead.archivedAt)}
              count={pendingCount}
              expandOtherActions={Boolean(searchParams.actionsPage)}
              page={actionsPage}
              saveCall={saveCall}
              createAction={createCalendarEvent}
              firstAction={
                agenda.first && (
                  <BuyerAgendaRow
                    entry={agenda.first}
                    reminderEditor={agenda.first.eventId ? undefined : reminderEditor}
                  />
                )
              }
              otherActions={
                <ol className="divide-y divide-border">
                  {agenda.others.map((entry) => (
                    <li
                      key={entry.eventId ? 'event-' + entry.eventId : 'reminder'}
                      className="py-3"
                    >
                      <BuyerAgendaRow
                        entry={entry}
                        reminderEditor={entry.eventId ? undefined : reminderEditor}
                      />
                    </li>
                  ))}
                </ol>
              }
              pagination={pagination(
                'actionsPage',
                actionsPage,
                events.length > FOLLOWUP_PAGE_SIZE
              )}
            />
            <section id="historial" className={card + ' scroll-mt-20'}>
              <h2 className="text-lg font-semibold">Historial</h2>
              <p className="text-sm text-muted-foreground">
                {activities.length === 50
                  ? 'Últimos 50 registros'
                  : `${activities.length} ${activities.length === 1 ? 'registro' : 'registros'}`}
              </p>
              <div className="mt-4 space-y-2">
                {' '}
                <details open={Boolean(searchParams.notesPage) || undefined} className="min-w-0">
                  <summary className="cursor-pointer rounded-lg border border-border bg-card px-4 py-3 text-sm font-semibold">
                    Añadir nota o consultar notas anteriores
                  </summary>
                  <BuyerNotesPanel
                    notes={commercialNotes.slice(0, FOLLOWUP_PAGE_SIZE).map((note) => ({
                      id: note.id,
                      content: note.content,
                      createdAt: note.createdAt.toISOString(),
                      author: note.agent?.name ?? 'Comercial',
                    }))}
                    addNote={addBuyerLeadNote.bind(null, lead.id)}
                    afterSaveHref={
                      notesPage > 1
                        ? `/compradores/${lead.id}?tab=ficha&notesPage=1&actionsPage=${actionsPage}#buyer-notes-title`
                        : undefined
                    }
                    pagination={pagination(
                      'notesPage',
                      notesPage,
                      commercialNotes.length > FOLLOWUP_PAGE_SIZE
                    )}
                  />
                </details>
                {hasChat && (
                  <details
                    id="conversacion"
                    open={searchParams.ver === 'chat' || undefined}
                    className={card + ' scroll-mt-20'}
                  >
                    <summary className="cursor-pointer font-semibold">
                      Conversación del chat · {chatUserMsgCount}{' '}
                      {chatUserMsgCount === 1 ? 'mensaje' : 'mensajes'} del comprador
                    </summary>
                    <div className="space-y-6">
                      {lead.chatSessions.map((session) => (
                        <ChatTranscript
                          key={session.id}
                          messages={
                            Array.isArray(session.messages)
                              ? (session.messages as unknown as ChatMessage[])
                              : []
                          }
                          status={session.status}
                          startedAt={session.startedAt}
                          lastMessageAt={session.lastMessageAt}
                          completedAt={session.completedAt}
                          totalTokens={session.totalTokens}
                          llmModel={session.llmModel}
                        />
                      ))}
                    </div>
                  </details>
                )}
              </div>
              <nav aria-label="Filtrar historial" className="my-4 flex flex-wrap gap-2">
                {historyFilters.map((filter) => (
                  <Link
                    key={filter}
                    aria-current={historyFilter === filter ? 'true' : undefined}
                    href={`${path}?tab=ficha&historial=${filter}#historial`}
                    className={`rounded-full border px-3 py-1.5 text-sm ${historyFilter === filter ? 'border-sidebar-primary bg-sidebar-primary text-white' : 'border-border'}`}
                  >
                    {filter}
                  </Link>
                ))}
              </nav>
              {history.length ? (
                <>
                  <ActivityTimeline
                    activities={history.slice(0, 5)}
                    currentUserId={currentUser.id}
                  />
                  {history.length > 5 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-semibold">
                        Ver los {history.length - 5} registros anteriores
                      </summary>
                      <div className="mt-4">
                        <ActivityTimeline
                          activities={history.slice(5)}
                          currentUserId={currentUser.id}
                        />
                      </div>
                    </details>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Sin registros en esta vista.</p>
              )}
              {lastContact && !activities.some((activity) => activity.id === lastContact.id) && (
                <details className="mt-4 border-t pt-3">
                  <summary className="cursor-pointer text-sm font-semibold">
                    {lastContact.type === 'NOTA'
                      ? 'Última nota comercial'
                      : 'Último contacto registrado'}
                  </summary>
                  <p className="mt-2 text-sm font-medium">
                    {lastContact.type === 'LLAMADA'
                      ? 'Llamada'
                      : lastContact.type === 'EMAIL'
                        ? 'Email'
                        : lastContact.type === 'NOTA'
                          ? 'Nota'
                          : 'WhatsApp iniciado'}{' '}
                    · {dateTime(lastContact.createdAt)} · hora de Madrid
                  </p>
                  {lastContact.agent && (
                    <p className="text-xs text-muted-foreground">{lastContact.agent.name}</p>
                  )}
                  {lastContact.content && (
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                      {lastContact.content}
                    </p>
                  )}
                </details>
              )}
            </section>
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
                    href={`${path}?tab=postventa`}
                    className="mt-2 block text-[11px] font-medium text-amber-700 underline hover:text-amber-900"
                  >
                    Ver en postventa →
                  </Link>
                )}
              </div>
            )}
            <details className={card}>
              <summary className="cursor-pointer font-semibold">Información comercial</summary>
              <section className="mt-3">
                <h2 className="text-sm font-medium text-muted-foreground">Qué busca</h2>
                <p className="mt-2 text-lg font-semibold">{needSummary}</p>
                <p className="mt-1 text-sm">Plazo de compra · {timelineLabel}</p>
                {activeEquipment.length > 0 && (
                  <p className="my-1 break-words text-sm">{activeEquipment.join(' · ')}</p>
                )}
                <Link href={`${path}?tab=busqueda`} className={textLink + ' mt-3'}>
                  Ver preferencias →
                </Link>
              </section>

              <div className="mt-2 text-xs text-muted-foreground">
                Referencia #{lead.id.slice(-8)} · Alta {lead.createdAt.toLocaleDateString('es-ES')}
              </div>
              <LandingAttribution activities={activities} />
              <p className="my-2 text-sm">
                Mejor coincidencia con el stock ·{' '}
                {bestMatch ? `${bestMatchScore}%` : 'Sin sugerencias'}
              </p>
              <div className="mt-4 border-t pt-4">
                <div className="mb-3 flex items-center gap-2 font-medium">
                  Prioridad comercial <ScoreInfo breakdown={scoreResult.breakdown} side="bottom" />
                </div>
                <div className="flex items-center gap-4">
                  <div
                    className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: `conic-gradient(${
                        leadScore >= 75 ? '#1a9d5f' : leadScore >= 50 ? '#c9820a' : '#d64545'
                      } ${leadScore * 3.6}deg, #eef1f5 0)`,
                    }}
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-card">
                      <span
                        className="text-[14px] font-bold"
                        style={{
                          color:
                            leadScore >= 75 ? '#1a9d5f' : leadScore >= 50 ? '#c9820a' : '#d64545',
                        }}
                      >
                        {leadScore}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-foreground">
                      {leadScore >= 75 ? 'Alto potencial' : leadScore >= 50 ? 'Moderado' : 'Bajo'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
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
                    { label: 'Afinidad con el stock', value: scoreMatches },
                    { label: 'Avance comercial', value: scoreEngagement },
                  ].map((row) => (
                    <div key={row.label}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">{row.label}</span>
                        <span
                          className="text-[11px] font-medium"
                          style={{ color: scoreColor(row.value) }}
                        >
                          {row.value}%
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-muted">
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
              <div className="rounded-xl border border-border bg-card p-5">
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Resumen
                </p>
                <div className="space-y-2">
                  {(
                    [
                      {
                        label: 'Días en seguimiento',
                        value: `${daysInPipeline}d`,
                        warn: daysInPipeline > 60,
                      },
                      { label: 'Estado', value: statusLabel },
                      { label: 'Vehículos vinculados', value: String(visibleMatches.length) },
                      lead.financingNeeded != null
                        ? {
                            label: 'Financiación',
                            value: lead.financingNeeded
                              ? lead.maxMonthlyPayment
                                ? `Sí · ${EUR(Number(lead.maxMonthlyPayment))}/mes`
                                : 'Sí'
                              : 'No',
                          }
                        : null,
                      { label: 'Origen de captación', value: buyerSourceLabel(lead.source) },
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
                        <span className="text-[11px] text-muted-foreground">{row!.label}</span>
                        <span
                          className={`text-[12px] font-medium ${
                            row!.warn ? 'text-amber-600' : 'text-foreground'
                          }`}
                        >
                          {row!.value}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </details>
          </div>
        )}
        {activeTab === 'busqueda' && (
          <div className={columns}>
            <div className={stack}>
              <section className={card}>
                <h2 className="text-lg font-semibold">Preferencias de compra</h2>
                <p className="mt-2 font-medium">{needSummary}</p>
                <dl className="my-4 grid gap-3 text-sm sm:grid-cols-2">
                  {[
                    [
                      'Presupuesto máximo',
                      lead.maxBudget ? EUR(Number(lead.maxBudget)) : 'Por concretar',
                    ],
                    ['Plazo de compra', timelineLabel],
                    ['Zona de uso', lead.useZone || 'Por concretar'],
                    [
                      'Financiación',
                      lead.financingNeeded == null
                        ? 'Por concretar'
                        : lead.financingNeeded
                          ? lead.maxMonthlyPayment
                            ? `Hasta ${EUR(Number(lead.maxMonthlyPayment))}/mes`
                            : 'Sí'
                          : 'No',
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="break-words font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
                <details
                  id="editar"
                  open={searchParams.ver === 'editar' || undefined}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <summary className="cursor-pointer font-semibold">
                    Editar datos y preferencias de compra
                  </summary>
                  <BuyerLeadEditForm
                    key={lead.id}
                    leadId={lead.id}
                    defaultValues={defaultValues}
                    agents={agents}
                    legacySource={lead.source && !isBuyerSource(lead.source) ? lead.source : null}
                  />
                </details>
              </section>
              {buyerCriteria.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Requisitos del vehículo
                    </p>
                    <InfoTooltip
                      text="Los requisitos imprescindibles determinan qué vehículos encajan. Las preferencias ayudan a ordenarlos."
                      side="left"
                    />
                  </div>
                  <div className="space-y-1.5">
                    {buyerCriteria.map((c, i) => (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 break-words text-[12px] text-muted-foreground">
                          {c.label}: <span className="text-foreground">{c.value}</span>
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                            c.kind === 'excluyente'
                              ? 'bg-red-50 text-red-600'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {c.kind === 'excluyente' ? 'Imprescindible' : 'Preferencia'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <details className="rounded-xl border border-border bg-card p-4">
                <summary className="cursor-pointer font-semibold">
                  Características del vehículo buscado
                </summary>
                <CatalogEditor
                  side="buyer"
                  id={lead.id}
                  initial={readCatalog(lead.matchCatalog)}
                  family={lead.vehicleType}
                />
              </details>
            </div>
            <aside className={stack}>
              {searchRequest && (
                <details className="mt-3 rounded-lg border border-border bg-card px-4 py-2">
                  <summary className="cursor-pointer text-sm font-medium">
                    Ver solicitud bajo pedido
                  </summary>
                  <SearchRequestCard
                    content={searchRequest.content}
                    receivedAt={searchRequest.createdAt.toLocaleDateString('es-ES')}
                  />
                </details>
              )}
              <TradeInCard
                leadId={lead.id}
                hasTradeIn={lead.hasTradeIn}
                type={lead.tradeInType}
                brand={lead.tradeInBrand}
                model={lead.tradeInModel}
                year={lead.tradeInYear}
                km={lead.tradeInKm}
                financePending={lead.tradeInFinancePending}
                notes={lead.tradeInNotes}
                sellerLeadId={lead.tradeInSellerLeadId}
              />
            </aside>
          </div>
        )}
        {activeTab === 'vehiculos' && (
          <div className={columns}>
            <div className={stack} id="intereses">
              <a href="#ofertas" className={textLink + ' lg:hidden'}>
                Ir a ofertas y reservas ↓
              </a>
              <ManualAssociationsCard
                side="buyer"
                fixedId={lead.id}
                entries={manualInterests.map((m) => ({
                  id: m.id,
                  label: vehicleLabel(m.vehicle),
                  href: `/vendedores/${m.vehicle.sellerLeadId}`,
                  detail: `${m.vehicle.plate || 'Sin matrícula'} · Manual${m.status === 'RECHAZADO' ? ' · Rechazado' : ''}`,
                }))}
                listHref="#sugerencias"
                disabledReason={
                  subjectBuyerEligible
                    ? undefined
                    : 'Esta ficha está cerrada, perdida o archivada. No admite nuevos intereses.'
                }
              />
              <div id="sugerencias" className="scroll-mt-20">
                {buyerMatches.length > 0 && (
                  <MatchesSection side="buyer" matches={buyerMatches} defaultOpen />
                )}
              </div>
              {subjectBuyerEligible && (
                <BuyerCatalogResults
                  id={lead.id}
                  selectedVehicleIds={manualInterests.map((match) => match.vehicle.id)}
                />
              )}
              <Link
                className="my-4 inline-block text-sm font-medium text-brand underline"
                href={`/compradores/${lead.id}?tab=ficha&notesPage=1#buyer-note`}
              >
                Anotar una recomendación de vehículo
              </Link>
            </div>
            <aside id="ofertas" className={stack + ' scroll-mt-20'}>
              <OffersSection
                side="buyer"
                fixedId={lead.id}
                candidates={offerCandidates}
                offers={offerRows}
              />
              {showPostventa && (
                <Link href={`${path}?tab=postventa`} className={textLink}>
                  Ver entrega y postventa →
                </Link>
              )}
            </aside>
          </div>
        )}
        {activeTab === 'postventa' && (
          <div className="space-y-5">
            <CompletedSaleCard side="buyer" sales={lead.deliveries} />
            {warranty ? (
              <div className="space-y-5">
                {/* Warranty card */}
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="border-b border-border px-6 py-4">
                    <div className="flex items-center justify-between">
                      <h2 className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
                        <Shield className="h-4 w-4 text-sidebar-primary" />
                        {warrantyMonthsLeft ? 'Garantía activa' : 'Garantía vencida'}
                      </h2>
                      <span className="rounded-full bg-sidebar-primary/10 px-2.5 py-1 text-[11px] font-medium text-sidebar-primary">
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
                          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                            {row.label}
                          </p>
                          <p className="mt-1 text-[14px] font-medium text-foreground">
                            {row.value}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-sidebar-primary transition-all"
                        style={{ width: `${Math.max(2, 100 - warrantyElapsedPct)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Tickets */}
                {openTickets.length > 0 && (
                  <div className="overflow-hidden rounded-xl border border-amber-200 bg-card">
                    <div className="border-b border-amber-200 bg-amber-50 px-6 py-4">
                      <h2 className="text-[14px] font-semibold text-amber-800">
                        Incidencias abiertas ({openTickets.length})
                      </h2>
                    </div>
                    <div className="divide-y divide-border">
                      {openTickets.map((t) => (
                        <div key={t.id} className="flex items-center justify-between px-6 py-4">
                          <p className="text-[13px] font-medium text-foreground">{t.title}</p>
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                t.priority === 'CRITICA'
                                  ? 'bg-red-100 text-red-700'
                                  : t.priority === 'ALTA'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {t.priority}
                            </span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                              {t.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-border px-6 py-3">
                      <Link
                        href={`/postventa/${warranty.id}`}
                        className="text-[12px] font-medium text-sidebar-primary hover:underline"
                      >
                        Ver en módulo postventa →
                      </Link>
                    </div>
                  </div>
                )}

                {openTickets.length === 0 && (
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-6 py-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary/10 text-sidebar-primary">
                      ✓
                    </span>
                    <div>
                      <p className="text-[13px] font-medium text-foreground">
                        Sin incidencias abiertas
                      </p>
                      <Link
                        href={`/postventa/${warranty.id}`}
                        className="text-[12px] text-sidebar-primary hover:underline"
                      >
                        Ver historial completo →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16">
                <Shield className="mb-3 h-8 w-8 text-muted-foreground/30" />
                <p className="text-[15px] font-medium text-foreground">Sin garantía activa</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  La garantía se genera automáticamente al completar la entrega del vehículo
                </p>
              </div>
            )}
          </div>
        )}
        {activeTab === 'documentos' && (
          <DocumentsPanel
            key={lead.id}
            initialTarget={{ type: 'buyerLead', id: lead.id }}
            fixedTarget
          />
        )}
      </div>
    </div>
  )
}
