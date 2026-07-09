import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { VehiclePhotoUploader } from '@/components/vehicle-photo-uploader'
import { ValuationTimeline } from '@/components/valuation-timeline'
import { SellerLeadEditForm } from './seller-lead-edit-form'
import { VehicleEditForm } from './vehicle-edit-form'
import { ValuationOverrideForm } from './valuation-override-form'
import { MatchesSection } from '@/components/matches-section'
import type { VehicleMatchData } from '@/components/matches-section'
import { OffersSection } from '@/components/offers-section'
import { prismaMatchingDeps, buildMatchExplanation } from '@/lib/matching'
import { ActivityTimeline } from '@/components/activity-timeline'
import type { ActivityItem } from '@/components/activity-timeline'
import { NoteForm } from '@/components/note-form'
import { addSellerLeadNote } from './actions'
import { WhatsAppButton } from '@/components/whatsapp-button'
import { sellerWhatsAppMessage } from '@/lib/whatsapp'
import { MobileFichaActions } from '@/components/mobile-ficha-actions'
import { SELLER_LEAD_TRANSITIONS, SELLER_LEAD_STATUS_LABELS } from '@/lib/state-machine'
import type { SellerLeadStatus } from '@prisma/client'
import { PublicNotesEditor } from '@/components/vehicle-ads/public-notes-editor'
import { GenerateAdButton } from '@/components/vehicle-ads/generate-ad-button'
import { DownloadPhotosButton } from '@/components/vehicle-ads/download-photos-button'
import { VehicleEconomicsForm } from '@/components/vehicle-economics/vehicle-economics-form'
import { VehicleMarginSummary } from '@/components/vehicle-economics/vehicle-margin-summary'
import { VehicleCostsTable } from '@/components/vehicle-economics/vehicle-costs-table'
import { NaveLocationField } from '@/components/vehicle-economics/nave-location-field'
import { calculateVehicleMargin } from '@/lib/margin'
import type { VehicleCostCategory } from '@prisma/client'
import { VehicleLegalFieldsForm } from '@/components/vehicle-legal/vehicle-legal-fields-form'
import { VehicleDocumentsList } from '@/components/vehicle-legal/vehicle-documents-list'
import type { VehicleDocumentItem } from '@/components/vehicle-legal/vehicle-documents-list'
import { MissingForPublishCard } from '@/components/vehicle-legal/missing-for-publish-card'
import { CompletionBadge } from '@/components/vehicle-legal/completion-badge'
import { calculateCompletionPercent } from '@/lib/vehicle-legal'
import type { VehicleLegalInput, DocumentSummary } from '@/lib/vehicle-legal'
import type { VehicleDocumentCategory } from '@prisma/client'
import { calculateLeadScore, calculateClosureProbability, leadScoreColor } from '@/lib/lead-score'
import { sellerAcquisitionScore, ACTIVE_DEMAND_MATCH_THRESHOLD } from '@/lib/scoring'
import { ScoreInfo } from '@/components/score-info'
import { buildTrustPassport } from '@/lib/trust-passport'
import { getTrustPassportInput } from '@/lib/trust-passport/prisma-deps'
import { TrustPassportPanel } from '@/components/trust-passport-panel'
import { generateLeadInsights, getNextAction } from '@/lib/lead-insights'
import { LeadTabNav } from './lead-tab-nav'
import type { LeadTab } from './lead-tab-nav'
import { SellerTopbarActions } from './seller-topbar-actions'
import { ProximaAccionCard } from './proxima-accion-card'
import {
  SELLER_DEAL_TYPE_LABELS,
  SELLER_URGENCY_LABELS,
  SELLER_URGENCY_COLORS,
  SELLER_RISK_LABELS,
  SELLER_RISK_COLORS,
} from '@/lib/deal-terms'
import { StatusPill } from '@/components/status-pill'
import { AlertTriangle, Info, CheckCircle2, Phone, Mail, ChevronLeft } from 'lucide-react'
import { QuickAdvanceButton } from './quick-advance-button'
import { InfoTooltip } from '@/components/info-tooltip'

// ── Helpers ───────────────────────────────────────────────────────────────────

const EUR = (v: number) =>
  v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function FichaVendedorPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { tab?: string }
}) {
  const [currentUser, lead, agents, activities] = await Promise.all([
    requireAuth(),
    db.sellerLead.findUnique({
      where: { id: params.id },
      include: {
        vehicle: {
          include: {
            photos: { orderBy: { order: 'asc' } },
            valuations: {
              include: { createdBy: { select: { name: true } } },
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
            matches: {
              include: {
                buyerLead: {
                  select: {
                    id: true,
                    name: true,
                    vehicleType: true,
                    minSeats: true,
                    maxBudget: true,
                    criticalEquipment: true,
                  },
                },
              },
              orderBy: { score: 'desc' },
              take: 10,
            },
            offers: {
              orderBy: { createdAt: 'desc' },
              include: { buyerLead: { select: { id: true, name: true } } },
            },
            ads: {
              include: { createdBy: { select: { name: true } } },
              orderBy: { createdAt: 'desc' },
              take: 6,
            },
            costs: {
              include: { createdBy: { select: { id: true, name: true } } },
              orderBy: { createdAt: 'desc' },
            },
            documents: {
              include: { uploadedBy: { select: { name: true } } },
              orderBy: { createdAt: 'asc' },
            },
            chargeCheckedBy: { select: { name: true } },
            trustVerifiedBy: { select: { name: true } },
            workOrders: {
              where: {
                status: { in: ['PENDIENTE', 'EN_DIAGNOSTICO', 'PRESUPUESTADA', 'EN_CURSO'] },
              },
              select: { id: true },
            },
          },
        },
        agent: true,
      },
    }),
    db.user.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.activity.findMany({
      where: { sellerLeadId: params.id },
      include: { agent: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])

  if (!lead) notFound()

  const v = lead.vehicle
  const isAdmin = currentUser.role === 'ADMIN'
  const isAgente = ['ADMIN', 'AGENTE'].includes(currentUser.role)

  // ── Cálculos derivados ────────────────────────────────────────────────────
  const daysPipeline = daysSince(lead.createdAt)
  const lastActivity = activities[0]?.createdAt ?? null
  const daysSinceActivity = lastActivity ? daysSince(lastActivity) : daysPipeline

  // CAM-64: explicación determinista por match (motivos + riesgos)
  const matchDeps = prismaMatchingDeps(db)
  const vehicleMatchInput =
    v && (v.matches?.length ?? 0) > 0 ? await matchDeps.getVehicle(v.id) : null
  const matchExplanations = new Map<string, { reasons: string[]; risks: string[] }>()
  if (vehicleMatchInput) {
    await Promise.all(
      (v?.matches ?? []).map(async (m) => {
        const b = await matchDeps.getBuyer(m.buyerLead.id)
        if (b) matchExplanations.set(m.id, buildMatchExplanation(vehicleMatchInput, b))
      })
    )
  }

  const vehicleMatches: VehicleMatchData[] = (v?.matches ?? []).map((m) => ({
    id: m.id,
    score: m.score,
    status: m.status,
    explanation: matchExplanations.get(m.id) ?? null,
    buyerLead: {
      id: m.buyerLead.id,
      name: m.buyerLead.name,
      vehicleType: m.buyerLead.vehicleType,
      minSeats: m.buyerLead.minSeats,
      maxBudget: m.buyerLead.maxBudget ? Number(m.buyerLead.maxBudget) : null,
      criticalEquipment: (m.buyerLead.criticalEquipment ?? {}) as Record<string, boolean>,
    },
  }))

  // Block 18 — ofertas por el vehículo + candidatos (compradores matcheados)
  const offerCandidates = (v?.matches ?? []).map((m) => ({
    id: m.buyerLead.id,
    label: m.buyerLead.name,
  }))
  const offerRows = (v?.offers ?? []).map((o) => ({
    id: o.id,
    amount: Number(o.amount),
    depositAmount: o.depositAmount ? Number(o.depositAmount) : null,
    status: o.status,
    reservedUntil: o.reservedUntil ? o.reservedUntil.toISOString() : null,
    notes: o.notes,
    counterpartLabel: o.buyerLead.name,
    counterpartHref: `/compradores/${o.buyerLead.id}`,
  }))

  // Comprador de la operación (match cerrado) — para el cruce vehículo↔comprador
  const closedMatch = vehicleMatches.find((m) => m.status === 'CERRADO') ?? null

  // Legal / expediente
  const legalInput: VehicleLegalInput | null = v
    ? {
        id: v.id,
        plate: v.plate ?? null,
        vin: v.vin ?? null,
        itvValidUntil: v.itvValidUntil ?? null,
        chargeCheckedAt: v.chargeCheckedAt ?? null,
        desiredPrice: v.desiredPrice,
        purchasePrice: v.purchasePrice,
        salePrice: v.salePrice,
        photoCount: v.photos.length,
        workOrdersBlockingCount: v.workOrders?.length ?? 0,
      }
    : null

  const docCategories: VehicleDocumentCategory[] = [
    'DNI_VENDEDOR',
    'CONTRATO_COMPRAVENTA',
    'FICHA_TECNICA',
    'PERMISO_CIRCULACION',
    'ITV_VIGENTE',
    'JUSTIFICANTE_PAGO',
    'INFORME_CARGAS_DGT',
    'LIBRO_MANTENIMIENTO',
    'FACTURA_COMPRA_ORIGINAL',
    'CONTRATO_FINAL_VENTA',
    'OTRO',
  ]

  const docSummary: DocumentSummary[] = docCategories.map((cat) => ({
    category: cat,
    exists: (v?.documents ?? []).some((d) => d.category === cat),
  }))

  const completionPct = legalInput ? calculateCompletionPercent(legalInput, docSummary) : 0

  // Score e insights
  const leadScore = calculateLeadScore({
    hasPhone: !!lead.phone,
    hasVehicle: !!v,
    photoCount: v?.photos.length ?? 0,
    hasDesiredPrice: !!v?.desiredPrice,
    conservationState: v?.conservationState ?? null,
    matchCount: vehicleMatches.length,
    bestMatchScore: vehicleMatches[0]?.score ?? 0,
    daysSinceLastActivity: daysSinceActivity,
    isPro: lead.canal === 'PRO',
    vehicleStatus: v?.status ?? null,
  })

  // Block 19 — demanda activa + score de captación
  const activeDemandCount = vehicleMatches.filter(
    (m) => m.score >= ACTIVE_DEMAND_MATCH_THRESHOLD
  ).length
  const acquisition = sellerAcquisitionScore({
    desiredPrice: v?.desiredPrice ? Number(v.desiredPrice) : null,
    minPrice: lead.minPrice ? Number(lead.minPrice) : null,
    valuationRecommended: v?.valuationRecommended ? Number(v.valuationRecommended) : null,
    urgency: lead.urgency,
    riskLevel: lead.riskLevel,
    activeDemandCount,
  })

  // Block 20 — Trust Passport (agregación legal + taller)
  const trustInput = v ? await getTrustPassportInput(db, v.id) : null
  const trustPassport = trustInput ? buildTrustPassport(trustInput) : null

  const insightInput = {
    daysSinceLastActivity: daysSinceActivity,
    daysSincePipeline: daysPipeline,
    matchCount: vehicleMatches.length,
    topMatchScore: vehicleMatches[0]?.score ?? 0,
    topMatchBuyerName: vehicleMatches[0]?.buyerLead.name ?? null,
    desiredPrice: v?.desiredPrice ? Number(v.desiredPrice) : null,
    valuationRecommended: v?.valuationRecommended ? Number(v.valuationRecommended) : null,
    photoCount: v?.photos.length ?? 0,
    vehicleStatus: v?.status ?? null,
    expedientePercent: completionPct,
    leadStatus: lead.status,
  }

  const insights = generateLeadInsights(insightInput)
  const nextAction = getNextAction(insightInput)

  const closureProb = calculateClosureProbability({
    leadStatus: lead.status,
    daysSincePipeline: daysPipeline,
    daysSinceLastActivity: daysSinceActivity,
    matchCount: vehicleMatches.length,
  })

  // Margen
  const costs = (v?.costs ?? []).map((c) => ({
    id: c.id,
    category: c.category as VehicleCostCategory,
    description: c.description,
    amount: Number(c.amount),
    supplier: c.supplier,
    invoiceUrl: c.invoiceUrl,
    createdAt: c.createdAt,
    createdBy: c.createdBy ? { id: c.createdBy.id, name: c.createdBy.name } : null,
  }))

  const margin = v
    ? calculateVehicleMargin({
        purchasePrice: v.purchasePrice ? Number(v.purchasePrice) : null,
        salePrice: v.salePrice ? Number(v.salePrice) : null,
        marginPercentTarget: v.marginPercent ? Number(v.marginPercent) : 4,
        costs: costs.map((c) => ({ category: c.category, amount: c.amount })),
      })
    : null

  // Tab activo
  const activeTab = searchParams.tab ?? 'resumen'

  // Próxima transición de estado lead
  const nextLeadStatuses = SELLER_LEAD_TRANSITIONS[lead.status as SellerLeadStatus] ?? []
  const primaryNextStatus = nextLeadStatuses.find((s) => s !== 'DESCARTADO') ?? null

  // ── Tabs definición ────────────────────────────────────────────────────────
  const tabs: LeadTab[] = [
    { key: 'resumen', label: 'Resumen' },
    ...(v
      ? [
          {
            key: 'preparacion',
            label: 'Preparación',
            ...(legalInput ? { badge: `${completionPct}%` } : {}),
          },
        ]
      : []),
    ...(v ? [{ key: 'publicacion', label: 'Publicación' }] : []),
    ...(v ? [{ key: 'compradores', label: 'Compradores', badge: vehicleMatches.length }] : []),
    { key: 'actividad', label: 'Actividad', badge: activities.length },
    ...(v ? [{ key: 'economia', label: isAdmin ? 'Economía' : 'Tasación' }] : []),
  ]

  // ── Form default values ────────────────────────────────────────────────────
  const leadDefaultValues = {
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    status: lead.status,
    agentId: lead.agentId,
    minPrice: lead.minPrice ? Number(lead.minPrice) : null,
    dealType: lead.dealType ?? null,
    urgency: lead.urgency ?? null,
    riskLevel: lead.riskLevel ?? null,
    riskNotes: lead.riskNotes ?? null,
  }

  const vehicleDefaultValues = v
    ? {
        type: v.type,
        brand: v.brand,
        model: v.model,
        year: v.year,
        km: v.km,
        seats: v.seats,
        length: v.length ?? null,
        conservationState: v.conservationState,
        location: v.location ?? '',
        desiredPrice: v.desiredPrice ? Number(v.desiredPrice) : null,
        equipment: (v.equipment ?? {}) as {
          solar: boolean
          kitchen: boolean
          bathroom: boolean
          shower: boolean
          heating: boolean
        },
        status: v.status,
        category: v.category ?? null,
        bedLayout: v.bedLayout ?? null,
        sleepingPlaces: v.sleepingPlaces ?? null,
        bathroomType: v.bathroomType ?? null,
        heatingType: v.heatingType ?? null,
        winterized: v.winterized ?? null,
        hasGarage: v.hasGarage ?? null,
        maxMassKg: v.maxMassKg ?? null,
        heightM: v.heightM ?? null,
        offGrid: v.offGrid ?? null,
      }
    : null

  const docsForList: VehicleDocumentItem[] = (v?.documents ?? []).map((d) => ({
    id: d.id,
    category: d.category as VehicleDocumentCategory,
    name: d.name,
    url: d.url,
    fileSize: d.fileSize ?? null,
    mimeType: d.mimeType ?? null,
    createdAt: d.createdAt,
    uploadedBy: d.uploadedBy,
  }))

  // ── Layout ─────────────────────────────────────────────────────────────────
  return (
    <div className="-mx-6 -mt-6 flex min-h-full flex-col">
      {/* ── Topbar sticky ── */}
      <header className="z-20 flex min-h-[56px] shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-4 py-2 md:px-8 lg:sticky lg:top-0 lg:h-[60px] lg:py-0">
        <nav className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          <Link
            href="/vendedores"
            className="flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Vendedores
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="font-semibold text-foreground">
            {v ? `${v.brand} ${v.model}` : lead.name}
          </span>
        </nav>
        <div className="flex items-center gap-2">
          <SellerTopbarActions leadId={lead.id} isTerminal={!nextLeadStatuses.length} />
          {lead.phone && (
            <WhatsAppButton
              phone={lead.phone}
              message={sellerWhatsAppMessage(
                lead.name,
                v ? { type: v.type, brand: v.brand, model: v.model } : undefined
              )}
              leadId={lead.id}
              leadType="seller"
            />
          )}
          {primaryNextStatus && (
            <div className="hidden sm:block">
              <QuickAdvanceButton
                leadId={lead.id}
                nextStatus={primaryNextStatus}
                label={`Mover a ${SELLER_LEAD_STATUS_LABELS[primaryNextStatus as SellerLeadStatus]}`}
                variant="outline"
              />
            </div>
          )}
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="border-b border-border bg-background px-4 pb-0 pt-7 md:px-10">
        {/* Identity row — centrado en el vehículo */}
        <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-center">
          {/* Miniatura del vehículo */}
          <div className="h-[76px] w-[110px] shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
            {v?.photos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={v.photos[0].url}
                alt={v ? `${v.brand} ${v.model}` : ''}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-bold text-muted-foreground/40">
                {v ? v.brand.charAt(0).toUpperCase() : '—'}
              </div>
            )}
          </div>

          {/* Vehículo + vendedor */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em]">
                {v ? `${v.brand} ${v.model}` : lead.name}
              </h1>
              {v ? (
                <StatusPill status={v.status} entity="vehicle" />
              ) : (
                <StatusPill status={lead.status} entity="seller" />
              )}
              {v && (
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    lead.canal === 'PRO'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {lead.canal === 'PRO' ? 'Formulario web' : 'Backoffice'}
                </span>
              )}
            </div>
            {v && (
              <p className="mt-1 text-sm text-muted-foreground">
                {[
                  v.year,
                  v.km != null ? `${v.km.toLocaleString('es-ES')} km` : null,
                  v.length ? `${v.length} m` : null,
                  v.plate,
                  v.location,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
            {/* Vendedor + contacto */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                Vendedor · <span className="font-medium text-foreground">{lead.name}</span>
              </span>
              {lead.phone && (
                <a
                  href={`tel:${lead.phone}`}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-green-500 hover:text-green-600"
                >
                  <Phone className="h-3 w-3" />
                  {lead.phone}
                </a>
              )}
              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                >
                  <Mail className="h-3 w-3" />
                  {lead.email}
                </a>
              )}
            </div>
          </div>

          {/* Días en pipeline */}
          <div className="shrink-0 sm:text-right">
            <p
              className={`text-[26px] font-bold leading-none ${daysPipeline > 60 ? 'text-red-500' : daysPipeline > 30 ? 'text-amber-500' : 'text-foreground'}`}
            >
              {daysPipeline}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              días en pipeline
            </p>
          </div>
        </div>

        {/* Tira de métricas clave */}
        {v && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {/* Precio salida */}
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="mb-1 flex items-center gap-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Precio salida
                </p>
                <InfoTooltip
                  text="Precio de venta al público fijado. Si aún no hay precio de venta, muestra el precio deseado por el vendedor."
                  side="bottom"
                />
              </div>
              <p className="text-xl font-bold tracking-[-0.02em] text-sidebar-primary">
                {(v.salePrice ?? v.desiredPrice) ? EUR(Number(v.salePrice ?? v.desiredPrice)) : '—'}
              </p>
            </div>

            {/* Tasación */}
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Tasación
              </p>
              <p className="text-xl font-bold tracking-[-0.02em]">
                {v.valuationRecommended
                  ? `${Math.round(Number(v.valuationMin ?? v.valuationRecommended) / 1000)}–${Math.round(Number(v.valuationMax ?? v.valuationRecommended) / 1000)}k €`
                  : '—'}
              </p>
            </div>

            {/* Margen (solo admin) */}
            {isAdmin && (
              <div className="rounded-xl border border-border bg-card px-4 py-3">
                <div className="mb-1 flex items-center gap-1">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    Margen
                  </p>
                  <InfoTooltip
                    text="Beneficio neto estimado: precio venta − compra − todos los costes imputados. Solo administradores."
                    side="bottom"
                  />
                </div>
                <p
                  className={`text-xl font-bold tracking-[-0.02em] ${margin && (margin.netMargin ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}
                >
                  {margin && margin.netMargin !== null ? EUR(margin.netMargin) : '—'}
                </p>
              </div>
            )}

            {/* Calidad del lead */}
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="mb-1 flex items-center gap-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Calidad lead
                </p>
                <InfoTooltip
                  text="Puntuación 0-100: completud del vehículo, fotos, matches activos, actividad reciente y canal."
                  side="bottom"
                />
              </div>
              <p className={`text-xl font-bold tracking-[-0.02em] ${leadScoreColor(leadScore)}`}>
                {leadScore}
                <span className="text-sm font-normal text-muted-foreground">/100</span>
              </p>
            </div>

            {/* Score de captación (Block 19) */}
            {v && (
              <div className="rounded-xl border border-border bg-card px-4 py-3">
                <div className="mb-1 flex items-center gap-1">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    Score captación
                  </p>
                  <ScoreInfo breakdown={acquisition.breakdown} side="bottom" />
                </div>
                <p
                  className={`text-xl font-bold tracking-[-0.02em] ${acquisition.score >= 70 ? 'text-green-600' : acquisition.score >= 40 ? 'text-amber-600' : 'text-muted-foreground'}`}
                >
                  {acquisition.score}
                  <span className="text-sm font-normal text-muted-foreground">/100</span>
                </p>
              </div>
            )}

            {/* Listo para publicar */}
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Listo p/ publicar
              </p>
              <p
                className={`text-xl font-bold tracking-[-0.02em] ${completionPct >= 90 ? 'text-green-600' : completionPct >= 60 ? 'text-amber-500' : 'text-muted-foreground'}`}
              >
                {completionPct}%
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="-mx-4 md:-mx-10">
          <Suspense fallback={<div className="h-12 border-b border-border" />}>
            <LeadTabNav tabs={tabs} />
          </Suspense>
        </div>
      </section>

      {/* ── Contenido principal ── */}
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[1fr_320px]">
        {/* Main content */}
        <div className="min-w-0 p-4 pb-10 md:p-8 md:pb-16">
          {/* ─────────────── RESUMEN ─────────────── */}
          {activeTab === 'resumen' && (
            <div className="space-y-6">
              {/* Sugerencias del asistente */}
              {insights.length > 0 && (
                <div className="rounded-xl border bg-muted/30 p-4">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Sugerencias del asistente
                  </p>
                  <div className="space-y-2.5">
                    {insights.map((ins, i) => {
                      const Icon =
                        ins.severity === 'warning'
                          ? AlertTriangle
                          : ins.severity === 'success'
                            ? CheckCircle2
                            : Info
                      const iconClass =
                        ins.severity === 'warning'
                          ? 'text-amber-500'
                          : ins.severity === 'success'
                            ? 'text-green-500'
                            : 'text-blue-500'
                      return (
                        <div key={i} className="flex gap-2.5">
                          <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} />
                          <div>
                            <p className="text-sm font-medium leading-snug">{ins.text}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{ins.detail}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Vehículo — resumen */}
              {v && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Vehículo
                    </p>
                    <Link
                      href={`/vendedores/${lead.id}?tab=preparacion`}
                      className="text-xs text-sidebar-primary hover:underline"
                    >
                      Editar datos
                    </Link>
                  </div>
                  <div className="rounded-xl border bg-card p-4">
                    <p className="font-semibold">
                      {v.brand} {v.model} {v.year} · {v.km?.toLocaleString('es-ES')} km
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Matrícula
                        </p>
                        <p className="font-medium">{v.plate ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Bastidor (VIN)
                        </p>
                        <p className="break-all font-medium">{v.vin ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Año / 1ª Matric.
                        </p>
                        <p className="font-medium">{v.year ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Kilometraje
                        </p>
                        <p className="font-medium">
                          {v.km ? `${v.km.toLocaleString('es-ES')} km` : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Campería
                        </p>
                        <p className="font-medium">
                          {v.length ? `${v.length} m` : '—'}
                          {v.seats ? ` · ${v.seats} plazas` : ''}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Estado ITV
                        </p>
                        <p className="font-medium">
                          {v.itvValidUntil
                            ? `Vigente hasta ${new Date(v.itvValidUntil).toLocaleDateString('es-ES')}`
                            : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Fotos resumen */}
              {v && v.photos.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Fotos · {v.photos.length} de 12 recomendadas
                    </p>
                    <Link
                      href={`/vendedores/${lead.id}?tab=preparacion`}
                      className="text-xs text-sidebar-primary hover:underline"
                    >
                      Gestionar →
                    </Link>
                  </div>
                  <p className="mb-2 font-medium">Material visual</p>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {v.photos.slice(0, 6).map((p, idx) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={p.id}
                        src={p.url}
                        alt={`Foto ${idx + 1}`}
                        className="aspect-[4/3] w-full rounded-lg object-cover"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Matches resumen */}
              {vehicleMatches.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {vehicleMatches.length} compradores idóneos · Match automático
                    </p>
                    <Link
                      href={`/vendedores/${lead.id}?tab=compradores`}
                      className="text-xs text-sidebar-primary hover:underline"
                    >
                      Ver todos los matches →
                    </Link>
                  </div>
                  <p className="mb-3 font-medium">Posibles compradores</p>
                  <div className="space-y-2">
                    {vehicleMatches.slice(0, 3).map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                            {m.buyerLead.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{m.buyerLead.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {m.buyerLead.vehicleType === 'CAMPER' ? 'Camper' : 'Autocaravana'}
                              {m.buyerLead.maxBudget
                                ? ` · Hasta ${EUR(m.buyerLead.maxBudget)}`
                                : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-bold ${m.score >= 80 ? 'bg-green-100 text-green-700' : m.score >= 60 ? 'bg-teal-100 text-teal-700' : 'bg-yellow-100 text-yellow-700'}`}
                          >
                            {m.score}%
                          </span>
                          <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                            <Link href={`/compradores/${m.buyerLead.id}`}>Ver perfil</Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expediente resumen */}
              {legalInput && isAgente && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Expediente legal · Documentación de venta
                    </p>
                    <Link
                      href={`/vendedores/${lead.id}?tab=preparacion`}
                      className="text-xs text-sidebar-primary hover:underline"
                    >
                      Plantilla completa →
                    </Link>
                  </div>
                  <p className="mb-3 font-medium">Estado del expediente</p>
                  <div className="rounded-xl border bg-card p-4">
                    <div className="mb-3 flex items-center justify-between text-sm">
                      <span>Completado</span>
                      <span className="font-semibold">
                        {docSummary.filter((d) => d.exists).length} de 7 · {completionPct}%
                      </span>
                    </div>
                    <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${completionPct >= 90 ? 'bg-green-500' : completionPct >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                        style={{ width: `${completionPct}%` }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      {[
                        'PERMISO_CIRCULACION',
                        'FICHA_TECNICA',
                        'DNI_VENDEDOR',
                        'ITV_VIGENTE',
                        'JUSTIFICANTE_PAGO',
                        'INFORME_CARGAS_DGT',
                        'CONTRATO_COMPRAVENTA',
                      ].map((cat) => {
                        const exists = (v?.documents ?? []).some((d) => d.category === cat)
                        const labels: Record<string, string> = {
                          PERMISO_CIRCULACION: 'Permiso de circulación',
                          FICHA_TECNICA: 'Ficha técnica',
                          DNI_VENDEDOR: 'DNI del vendedor',
                          ITV_VIGENTE: 'Última ITV pasada',
                          JUSTIFICANTE_PAGO: 'Justificante pago impuesto circulación',
                          INFORME_CARGAS_DGT: 'Informe cargas DGT',
                          CONTRATO_COMPRAVENTA: 'Contrato de compraventa firmado',
                        }
                        return (
                          <div key={cat} className="flex items-center gap-2 text-sm">
                            <div
                              className={`h-4 w-4 shrink-0 rounded ${exists ? 'bg-green-500' : 'border-2 border-muted-foreground/30'} flex items-center justify-center`}
                            >
                              {exists && (
                                <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 fill-white">
                                  <path
                                    d="M1 4l3 3 5-6"
                                    stroke="white"
                                    strokeWidth="1.5"
                                    fill="none"
                                  />
                                </svg>
                              )}
                            </div>
                            <span className={exists ? 'text-foreground' : 'text-muted-foreground'}>
                              {labels[cat] ?? cat}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Actividad reciente */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Historial · {activities.length} eventos
                  </p>
                  <Link
                    href={`/vendedores/${lead.id}?tab=actividad`}
                    className="text-xs text-sidebar-primary hover:underline"
                  >
                    Ver todo →
                  </Link>
                </div>
                <p className="mb-3 font-medium">Actividad del lead</p>
                <div className="rounded-xl border bg-card p-4">
                  <ActivityTimeline
                    activities={activities.slice(0, 5) as ActivityItem[]}
                    currentUserId={currentUser.id}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ─────────────── PREPARACIÓN · datos ─────────────── */}
          {activeTab === 'preparacion' && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Datos del vendedor</CardTitle>
                </CardHeader>
                <CardContent>
                  <SellerLeadEditForm
                    leadId={lead.id}
                    defaultValues={leadDefaultValues}
                    agents={agents}
                    isAdmin={isAdmin}
                  />
                </CardContent>
              </Card>
              {v && vehicleDefaultValues && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Datos del vehículo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <VehicleEditForm vehicleId={v.id} defaultValues={vehicleDefaultValues} />
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ─────────────── PREPARACIÓN · fotos ─────────────── */}
          {activeTab === 'preparacion' && v && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fotos del vehículo</CardTitle>
              </CardHeader>
              <CardContent>
                <VehiclePhotoUploader vehicleId={v.id} initialPhotos={v.photos} />
              </CardContent>
            </Card>
          )}

          {/* ─────────────── COMPRADORES ─────────────── */}
          {activeTab === 'compradores' && v && (
            <div className="space-y-5">
              <MatchesSection side="vehicle" matches={vehicleMatches} defaultOpen />
              <OffersSection
                side="vehicle"
                fixedId={v.id}
                candidates={offerCandidates}
                offers={offerRows}
              />
            </div>
          )}

          {/* ─────────────── ACTIVIDAD ─────────────── */}
          {activeTab === 'actividad' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actividad del lead</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <NoteForm addNote={addSellerLeadNote.bind(null, lead.id)} />
                {activities.length > 0 && (
                  <div className="border-t pt-4">
                    <ActivityTimeline
                      activities={activities as ActivityItem[]}
                      currentUserId={currentUser.id}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ─────────────── PREPARACIÓN · expediente ─────────────── */}
          {activeTab === 'preparacion' && v && legalInput && isAgente && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Expediente legal</CardTitle>
                    <CardDescription>
                      Documentación obligatoria para publicar y vender el vehículo legalmente.
                    </CardDescription>
                  </div>
                  <CompletionBadge percent={completionPct} />
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Datos legales del vehículo
                  </p>
                  <VehicleLegalFieldsForm
                    vehicleId={v.id}
                    isAdmin={isAdmin}
                    plate={v.plate ?? null}
                    vin={v.vin ?? null}
                    itvValidUntil={v.itvValidUntil ?? null}
                    titleTransferredAt={v.titleTransferredAt ?? null}
                    chargeCheckedAt={v.chargeCheckedAt ?? null}
                    chargeCheckedByName={v.chargeCheckedBy?.name ?? null}
                  />
                </div>
                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Documentos del expediente
                  </p>
                  <VehicleDocumentsList
                    vehicleId={v.id}
                    documents={docsForList}
                    isAdmin={isAdmin}
                    canUpload={isAgente}
                  />
                </div>
                {isAgente && <MissingForPublishCard vehicle={legalInput} docs={docSummary} />}
                <div className="rounded-xl border border-cn-line p-4">
                  <p className="text-sm font-medium text-cn-ink-700">Taller</p>
                  <p className="text-cn-ink-400 mt-0.5 text-xs">
                    Crea una orden de trabajo para preparar este vehículo. Luego podrás planificarla
                    y bloquearla en la agenda del taller.
                  </p>
                  <a
                    href={`/taller/nueva?vehicleId=${v.id}`}
                    className="mt-3 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-white hover:opacity-90"
                  >
                    Crear orden de taller
                  </a>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─────────────── TRUST PASSPORT (Block 20) ─────────────── */}
          {activeTab === 'preparacion' && v && trustPassport && (
            <div className="mt-6">
              <TrustPassportPanel
                vehicleId={v.id}
                sections={trustPassport.sections}
                score={trustPassport.score}
                level={trustPassport.level}
                eligibleForSeal={trustPassport.eligibleForSeal}
                blockers={trustPassport.blockers}
                sealedAt={v.trustVerifiedAt ? v.trustVerifiedAt.toISOString() : null}
                sealedByName={v.trustVerifiedBy?.name ?? null}
              />
            </div>
          )}

          {/* ─────────────── PUBLICACIÓN ─────────────── */}
          {activeTab === 'publicacion' && v && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Anuncios y publicación</CardTitle>
                <CardDescription>
                  Genera el anuncio con IA usando la ficha, las notas del agente y las fotos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <PublicNotesEditor vehicleId={v.id} initialValue={v.publicNotes} />
                <div className="flex flex-wrap gap-3">
                  {(() => {
                    const lastWallapopAd = v.ads?.find((a) => a.channel === 'WALLAPOP') ?? null
                    const lastCochesNetAd = v.ads?.find((a) => a.channel === 'COCHESNET') ?? null
                    return (
                      <>
                        <GenerateAdButton
                          vehicleId={v.id}
                          channel="WALLAPOP"
                          lastAd={
                            lastWallapopAd
                              ? {
                                  id: lastWallapopAd.id,
                                  content: lastWallapopAd.content,
                                  createdAt: lastWallapopAd.createdAt,
                                }
                              : null
                          }
                          agentName={lastWallapopAd?.createdBy?.name ?? undefined}
                        />
                        <GenerateAdButton
                          vehicleId={v.id}
                          channel="COCHESNET"
                          lastAd={
                            lastCochesNetAd
                              ? {
                                  id: lastCochesNetAd.id,
                                  content: lastCochesNetAd.content,
                                  createdAt: lastCochesNetAd.createdAt,
                                }
                              : null
                          }
                          agentName={lastCochesNetAd?.createdBy?.name ?? undefined}
                        />
                        <DownloadPhotosButton sellerLeadId={lead.id} photoCount={v.photos.length} />
                      </>
                    )
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─────────────── ECONOMÍA · costes ─────────────── */}
          {activeTab === 'economia' && v && isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Costes y margen</CardTitle>
                <CardDescription>
                  Precios, costes imputados y rentabilidad neta. Solo visible para administradores.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Precios y objetivo
                  </p>
                  <VehicleEconomicsForm
                    vehicleId={v.id}
                    desiredPrice={v.desiredPrice ? Number(v.desiredPrice) : null}
                    purchasePrice={v.purchasePrice ? Number(v.purchasePrice) : null}
                    salePrice={v.salePrice ? Number(v.salePrice) : null}
                    marginPercent={v.marginPercent ? Number(v.marginPercent) : 4}
                  />
                </div>
                {margin && (
                  <div>
                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Resumen de margen
                    </p>
                    <VehicleMarginSummary margin={margin} />
                  </div>
                )}
                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Costes imputados
                  </p>
                  <VehicleCostsTable
                    vehicleId={v.id}
                    costs={costs}
                    currentUserId={currentUser.id}
                    isAdmin={true}
                  />
                </div>
                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Ubicación en nave
                  </p>
                  <NaveLocationField
                    vehicleId={v.id}
                    entryDate={v.entryDate}
                    naveLocation={v.naveLocation}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─────────────── ECONOMÍA · tasación ─────────────── */}
          {activeTab === 'economia' && v && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base">Tasación</CardTitle>
                <ValuationOverrideForm vehicleId={v.id} />
              </CardHeader>
              <CardContent className="space-y-4">
                {v.valuationRecommended ? (
                  <div className="flex flex-wrap gap-6">
                    <div>
                      <p className="text-xs text-muted-foreground">Mínimo</p>
                      <p className="text-lg font-semibold">{EUR(Number(v.valuationMin))}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Recomendado</p>
                      <p className="text-xl font-bold text-sidebar-primary">
                        {EUR(Number(v.valuationRecommended))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Máximo</p>
                      <p className="text-lg font-semibold">{EUR(Number(v.valuationMax))}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Sin tasación — guarda los datos del vehículo para calcularla automáticamente.
                  </p>
                )}
                {v.valuations.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Historial
                    </p>
                    <ValuationTimeline valuations={v.valuations} />
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Rail derecho persistente (320px) — orientación a la tarea ── */}
        <aside className="border-t border-border lg:border-l lg:border-t-0">
          <div className="divide-y divide-border lg:sticky lg:top-[118px]">
            {/* Próxima acción — persistente en todas las pestañas */}
            <div className="p-5">
              <ProximaAccionCard
                phone={lead.phone}
                leadId={lead.id}
                leadName={lead.name}
                vehicleInfo={v ? { type: v.type, brand: v.brand, model: v.model } : undefined}
                nextAction={nextAction}
                nextActionType={lead.nextActionType}
                nextActionDueAt={lead.nextActionDueAt ? lead.nextActionDueAt.toISOString() : null}
              />
            </div>

            {/* Comprador / operación (match cerrado) — cruce vehículo↔comprador */}
            {closedMatch && (
              <div className="p-5">
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Comprador
                </p>
                <Link
                  href={`/compradores/${closedMatch.buyerLead.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700">
                    {closedMatch.buyerLead.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {closedMatch.buyerLead.name}
                    </p>
                    <p className="text-xs text-muted-foreground">Operación cerrada · ver ficha →</p>
                  </div>
                </Link>
              </div>
            )}

            {/* Demanda activa (Block 19) — el argumento de captación */}
            {v && activeDemandCount > 0 && (
              <div className="p-5">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Demanda activa
                </p>
                <Link
                  href={`/vendedores/${lead.id}?tab=compradores`}
                  className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 transition-colors hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/30"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                    {activeDemandCount}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                      {activeDemandCount} comprador{activeDemandCount === 1 ? '' : 'es'} esperando
                    </p>
                    <p className="text-xs text-emerald-700/80 dark:text-emerald-400/70">
                      Compatibles y activos · ver compradores →
                    </p>
                  </div>
                </Link>
              </div>
            )}

            {/* Condiciones de la operación (Seller Supply Graph, Block 17) */}
            {(lead.minPrice != null || lead.dealType || lead.urgency || lead.riskLevel) && (
              <div className="p-5">
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Operación
                </p>
                <div className="space-y-2">
                  {lead.minPrice != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Precio mínimo</span>
                      <span className="text-[12px] font-medium text-foreground">
                        {EUR(Number(lead.minPrice))}
                      </span>
                    </div>
                  )}
                  {lead.dealType && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Modalidad</span>
                      <span className="text-[12px] font-medium text-foreground">
                        {SELLER_DEAL_TYPE_LABELS[lead.dealType]}
                      </span>
                    </div>
                  )}
                  {lead.urgency && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Urgencia</span>
                      <span
                        className="inline-flex items-center gap-1.5 text-[12px] font-medium"
                        style={{ color: SELLER_URGENCY_COLORS[lead.urgency] }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: SELLER_URGENCY_COLORS[lead.urgency] }}
                        />
                        {SELLER_URGENCY_LABELS[lead.urgency]}
                      </span>
                    </div>
                  )}
                  {lead.riskLevel && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Riesgo</span>
                      <span
                        className="inline-flex items-center gap-1.5 text-[12px] font-medium"
                        style={{ color: SELLER_RISK_COLORS[lead.riskLevel] }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: SELLER_RISK_COLORS[lead.riskLevel] }}
                        />
                        {SELLER_RISK_LABELS[lead.riskLevel]}
                      </span>
                    </div>
                  )}
                  {lead.riskNotes && (
                    <p className="pt-1 text-[11px] text-muted-foreground">{lead.riskNotes}</p>
                  )}
                </div>
              </div>
            )}

            {/* Agente asignado */}
            <div className="p-5">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Agente asignado
              </p>
              {lead.agent ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
                    {lead.agent.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{lead.agent.name}</p>
                    <p className="text-xs text-muted-foreground">Responsable del lead</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border text-xl font-light text-muted-foreground">
                    +
                  </div>
                  <p className="text-sm text-muted-foreground">Sin agente asignado</p>
                </div>
              )}
              {isAdmin && (
                <Button asChild variant="outline" size="sm" className="mt-3 w-full text-xs">
                  <Link href={`/vendedores/${lead.id}?tab=preparacion`}>
                    {lead.agent ? 'Reasignar agente' : 'Asignar agente'}
                  </Link>
                </Button>
              )}
            </div>

            {/* Resumen */}
            <div className="p-5">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Resumen
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Origen</span>
                  <span className="font-medium">
                    {lead.canal === 'PRO' ? 'Web · Formulario' : 'Backoffice'}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Días en pipeline</span>
                  <span className="font-medium">{daysPipeline} días</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Estado del contacto</span>
                  <span className="font-medium">
                    {SELLER_LEAD_STATUS_LABELS[lead.status as SellerLeadStatus] ?? lead.status}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Última actividad</span>
                  <span className="font-medium">
                    {lastActivity ? `hace ${daysSinceActivity}d` : 'Sin actividad'}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Probabilidad cierre</span>
                  <span
                    className={`font-bold ${closureProb >= 60 ? 'text-green-600' : closureProb >= 30 ? 'text-amber-600' : 'text-red-500'}`}
                  >
                    {closureProb}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Barra de acción móvil (mockup MVEN2): Llamar / WhatsApp fijos abajo */}
      {lead.phone && (
        <MobileFichaActions
          phone={lead.phone}
          message={sellerWhatsAppMessage(
            lead.name,
            v ? { type: v.type, brand: v.brand, model: v.model } : undefined
          )}
          leadId={lead.id}
          leadType="seller"
        />
      )}
    </div>
  )
}
