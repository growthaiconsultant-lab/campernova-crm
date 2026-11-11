import { SellerPriceComparison } from '@/components/seller-price-comparison'
import { formatEur } from '@/lib/format/currency'
import { sellerSale } from '@/lib/seller-sale'
import { SellerSaleOverview, SellerSaleChannels } from '@/components/seller-sale-overview'
import { pendingSellerCalendarEvents, sellerSteps } from '@/lib/seller-agenda'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { LandingAttribution } from '@/components/landing-attribution'
import { DocumentsPanel } from '@/components/operations/documents-panel'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { completedSalesQuery } from '@/lib/completed-sales'
import { CompletedSaleCard } from '@/components/completed-sale-card'
import { ManualAssociationsCard } from '@/components/manual-associations-card'
import { personLabel, vehicleLabel } from '@/lib/display'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { VehiclePhotoUploader } from '@/components/vehicle-photo-uploader'
import { ValuationTimeline } from '@/components/valuation-timeline'
import { ValuationAttempts } from '@/components/valuation-attempts'
import { SellerLeadEditForm } from './seller-lead-edit-form'
import { VehicleEditForm } from './vehicle-edit-form'
import { OfficialValuationPanel } from './official-valuation-panel'
import { MatchesSection } from '@/components/matches-section'
import { currentMatches } from '@/lib/matching/current-matches'
import { readCatalog } from '@/lib/matching/catalog'
import type { VehicleMatchData } from '@/components/matches-section'
import { OffersSection } from '@/components/offers-section'
import { isBuyerEligible, isVehicleEligible, prismaMatchingDeps } from '@/lib/matching'
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
import { UnpublishButton } from './unpublish-button'
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
import { countPhotosByCategory } from '@/lib/vehicle-legal/config'
import { PUBLICADO_REQUIRED_DOCS, listMissingRequirements } from '@/lib/vehicle-legal'
import { WORK_ORDER_STATUS_LABELS } from '@/lib/taller/transitions'
import { calculateCompletionPercent, DOC_LABELS } from '@/lib/vehicle-legal'
import type { VehicleLegalInput, DocumentSummary } from '@/lib/vehicle-legal'
import {
  getEntryChecklistSignals,
  deriveDocumentChecklist,
  ENTRY_SIGNAL_CATEGORIES,
} from '@/lib/entry'
import { EntryPanel } from './entry-panel'
import type { VehicleDocumentCategory } from '@prisma/client'
import { calculateLeadScore, calculateClosureProbability, leadScoreColor } from '@/lib/lead-score'
import { sellerAcquisitionScore, ACTIVE_DEMAND_MATCH_THRESHOLD } from '@/lib/scoring'
import { ScoreInfo } from '@/components/score-info'
import { buildTrustPassport } from '@/lib/trust-passport'
import { getTrustPassportInput } from '@/lib/trust-passport/prisma-deps'
import { TrustPassportPanel } from '@/components/trust-passport-panel'
import { generateLeadInsights } from '@/lib/lead-insights'
import { LeadTabNav } from './lead-tab-nav'
import type { LeadTab } from './lead-tab-nav'
import { SellerTopbarActions } from './seller-topbar-actions'
import { SellerFollowupPanel } from '@/components/seller-followup-panel'
import {
  SELLER_DEAL_TYPE_LABELS,
  SELLER_URGENCY_LABELS,
  SELLER_URGENCY_COLORS,
  SELLER_RISK_LABELS,
  SELLER_RISK_COLORS,
} from '@/lib/deal-terms'
import { StatusPill } from '@/components/status-pill'
import { AlertTriangle, Info, CheckCircle2, Phone, Mail, UserRound } from 'lucide-react'
import { QuickAdvanceButton } from './quick-advance-button'
import { InfoTooltip } from '@/components/info-tooltip'
import { SellerIntakePanel } from './seller-intake-panel'

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
  const currentUser = await requireAgente()
  const [lead, agents, activities] = await Promise.all([
    db.sellerLead.findUnique({
      where: { id: params.id },
      include: {
        vehicle: {
          include: {
            deliveries: completedSalesQuery,
            photos: { orderBy: { order: 'asc' } },
            valuations: {
              include: { createdBy: { select: { name: true } } },
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
            valuationAttempts: {
              include: { createdBy: { select: { name: true } } },
              orderBy: { createdAt: 'desc' },
              take: 12,
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
                    status: true,
                    archivedAt: true,
                  },
                },
              },
              orderBy: { score: 'desc' },
            },
            offers: {
              orderBy: { createdAt: 'desc' },
              include: { buyerLead: { select: { id: true, name: true } } },
            },
            ads: {
              include: { createdBy: { select: { name: true } } },
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              distinct: ['channel'],
            },
            portalListings:
              searchParams.tab === 'compradores' || searchParams.tab === 'publicacion',
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
            physicalArrivalBy: { select: { name: true } },
            entryValidatedBy: { select: { name: true } },
            entryAnnulledBy: { select: { name: true } },
            workOrders: {
              where: {
                status: { in: ['PENDIENTE', 'EN_DIAGNOSTICO', 'PRESUPUESTADA', 'EN_CURSO'] },
              },
              select: { id: true, kind: true, description: true, status: true },
            },
          },
        },
        agent: true,
        calendarEvents: pendingSellerCalendarEvents,
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

  const isAdmitted = lead.intakeStatus === 'ADMITIDO'

  // Una solicitud todavía no admitida puede revisarse y conservar su actividad, pero no entra
  // en las superficies operativas (preparación, publicación, matching o economía).
  const requestedTab = searchParams.tab ?? 'resumen'
  const validTabs = isAdmitted
    ? [
        'resumen',
        'actividad',
        'preparacion',
        'vendedor',
        ...(v ? ['compradores', 'economia', 'publicacion'] : []),
      ]
    : ['resumen', 'actividad']
  const activeTab = validTabs.includes(requestedTab) ? requestedTab : 'resumen'
  const saleTab = ['compradores', 'economia', 'publicacion'].includes(activeTab)
  const groupTab = saleTab
    ? 'compradores'
    : activeTab === 'actividad' && isAdmitted
      ? 'resumen'
      : activeTab

  const showHeaderStep = isAdmitted && activeTab !== 'resumen'
  const nextStep = showHeaderStep
    ? sellerSteps(
        lead.calendarEvents,
        lead.nextActionType,
        lead.nextActionDueAt,
        lead.agent?.name ?? null
      )[0]
    : undefined

  // A3 — gate de la tasación oficial: entrada activa + inspección de entrada COMPLETADA + estado
  // elegible. Determina si el panel de tasación oficial se habilita (la barrera dura vive en el
  // núcleo transaccional; esto es solo la señal de UI).
  const completedInspectionCount =
    v && activeTab === 'economia'
      ? await db.workOrder.count({
          where: { vehicleId: v.id, kind: 'INSPECCION_ENTRADA', status: 'COMPLETADA' },
        })
      : 0
  const entryActive = !!(v && v.entryValidatedAt && !v.entryAnnulledAt)
  const officialGateReady =
    !!v &&
    entryActive &&
    completedInspectionCount > 0 &&
    !['VENDIDO', 'DESCARTADO'].includes(v.status)
  const officialGateReason = !v
    ? ''
    : !entryActive
      ? 'Requiere una entrada oficial activa.'
      : completedInspectionCount === 0
        ? 'Requiere la inspección de entrada COMPLETADA en Taller.'
        : ['VENDIDO', 'DESCARTADO'].includes(v.status)
          ? 'El vehículo no admite tasación oficial en su estado actual.'
          : ''
  // A3 — última valoración PRELIMINAR con cifras (orientativa; NUNCA es el precio oficial).
  const latestPreliminary =
    v?.valuationAttempts.find((a) => a.purpose === 'PRELIMINAR' && a.outcome === 'COMPLETADA') ??
    null

  // M1 — re-filtrado de matches persistidos por elegibilidad (lectura):
  // si el SUJETO (vehículo) no es elegible, no se muestran matches; y de los que
  // haya, se ocultan aquellos cuya contraparte comprador no es elegible.
  const subjectVehicleEligible = v
    ? isVehicleEligible({
        status: v.status,
        sellerArchivedAt: lead.archivedAt,
        entryValidatedAt: v.entryValidatedAt,
        entryAnnulledAt: v.entryAnnulledAt,
      })
    : false
  const eligibleMatches = subjectVehicleEligible
    ? (v?.matches ?? []).filter((m) =>
        isBuyerEligible({ status: m.buyerLead.status, archivedAt: m.buyerLead.archivedAt })
      )
    : []

  const deps = prismaMatchingDeps(db)
  const subject = eligibleMatches.length ? await deps.getVehicle(v!.id) : null
  const visibleMatches = await currentMatches(eligibleMatches, async (m) => [
    subject,
    await deps.getBuyer(m.buyerLead.id),
  ])

  // ── Cálculos derivados ────────────────────────────────────────────────────
  const daysPipeline = daysSince(lead.createdAt)
  const lastActivity = activities[0]?.createdAt ?? null
  const daysSinceActivity = lastActivity ? daysSince(lastActivity) : daysPipeline

  const vehicleMatches: VehicleMatchData[] = visibleMatches.map((m) => ({
    id: m.id,
    score: m.score,
    status: m.status,
    generatedBy: m.generatedBy,
    explanation: m.explanation,
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
  const offerCandidates = visibleMatches.map((m) => ({
    id: m.buyerLead.id,
    label: personLabel(m.buyerLead.name, { role: 'Comprador sin identificar', id: m.buyerLead.id }),
  }))
  const offerRows = (v?.offers ?? []).map((o) => ({
    id: o.id,
    buyerId: o.buyerLeadId,
    amount: Number(o.amount),
    createdAt: o.createdAt.toISOString(),
    depositAmount: o.depositAmount ? Number(o.depositAmount) : null,
    status: o.status,
    reservedUntil: o.reservedUntil ? o.reservedUntil.toISOString() : null,
    notes: o.notes,
    counterpartLabel: personLabel(o.buyerLead.name, {
      role: 'Comprador sin identificar',
      id: o.buyerLead.id,
    }),
    counterpartHref: `/compradores/${o.buyerLead.id}`,
  }))

  const portalPanel =
    v && (activeTab === 'compradores' || activeTab === 'publicacion') ? (
      <SellerSaleChannels
        vehicle={v}
        sellerId={lead.id}
        editable={!lead.archivedAt}
        listings={v.portalListings}
        ads={v.ads.filter((ad) => ad.content?.trim())}
        showToolsLink={activeTab === 'compradores'}
        renderTextTool={
          activeTab === 'publicacion'
            ? (channel) => {
                const ad = v.ads.find((row) => row.channel === channel)
                return (
                  <GenerateAdButton
                    vehicleId={v.id}
                    channel={channel}
                    lastAd={
                      ad
                        ? {
                            id: ad.id,
                            content: ad.content,
                            createdAt: ad.createdAt,
                            author: ad.createdBy?.name ?? null,
                            canEdit: isAdmin || ad.createdById === currentUser.id,
                          }
                        : null
                    }
                  />
                )
              }
            : undefined
        }
        webAction={
          activeTab === 'publicacion' &&
          (v.status === 'PUBLICADO' ? (
            <UnpublishButton vehicleId={v.id} />
          ) : (
            (v.status === 'NUEVO' || v.status === 'TASADO') && (
              <Link
                className="text-sm text-brand underline"
                href={`/vendedores/${lead.id}?tab=preparacion`}
              >
                Ver qué falta para publicar
              </Link>
            )
          ))
        }
      >
        {activeTab === 'publicacion' && (
          <footer className="space-y-4 border-t pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold">Fotos del vehículo</h3>
                <p className="text-sm text-muted-foreground">
                  {v.photos.length
                    ? 'Las mismas fotos para todos los portales.'
                    : 'Añade fotos en Vehículo y documentos.'}
                </p>
              </div>
              {v.photos.length ? (
                <DownloadPhotosButton sellerLeadId={lead.id} photoCount={v.photos.length} />
              ) : (
                <Link
                  className="text-sm text-brand underline"
                  href={`/vendedores/${lead.id}?tab=preparacion`}
                >
                  Añadir fotos
                </Link>
              )}
            </div>
            <details className="border-t pt-3">
              <summary className="cursor-pointer text-sm font-medium">
                Notas para preparar los anuncios
              </summary>
              <div className="mt-3">
                <PublicNotesEditor vehicleId={v.id} initialValue={v.publicNotes} />
              </div>
            </details>
          </footer>
        )}
      </SellerSaleChannels>
    ) : null
  const saleOverview = activeTab === 'compradores' && v ? sellerSale(offerRows, v.matches) : null
  const interestedIds = new Set(saleOverview?.interested.map((buyer) => buyer.buyerId))
  const suggestedMatches = vehicleMatches.filter(
    (m) => m.status === 'SUGERIDO' && m.generatedBy === 'auto' && !interestedIds.has(m.buyerLead.id)
  )
  const suggestedIds = new Set(suggestedMatches.map((m) => m.id))
  const followedMatches = vehicleMatches.filter((m) => !suggestedIds.has(m.id))
  const visibleIds = new Set(vehicleMatches.map((m) => m.id))
  const earlierMatches =
    activeTab === 'compradores'
      ? (v?.matches ?? []).filter(
          (m) => !visibleIds.has(m.id) && (m.generatedBy === 'manual' || m.status !== 'SUGERIDO')
        )
      : []
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
        photosByCategory: countPhotosByCategory(v.photos),
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

  const missingForPublication =
    activeTab === 'preparacion' && legalInput
      ? listMissingRequirements(legalInput, 'PUBLICADO', docSummary)
      : []
  const receivedCount = PUBLICADO_REQUIRED_DOCS.filter((cat) =>
    docSummary.some((doc) => doc.category === cat && doc.exists)
  ).length
  const dataChecks = [
    ['plate', 'Matrícula'],
    ['vin', 'Número de bastidor'],
    ['desiredPrice', 'Precio deseado'],
    ['purchasePrice', 'Precio de compra'],
    ['salePrice', 'Precio de venta'],
    ['itvValidUntil', 'ITV en vigor'],
    ['chargeCheckedAt', 'Verificación de cargas DGT'],
    ['workOrders', 'Taller sin órdenes pendientes'],
  ]
  const passedChecks = dataChecks.filter(
    ([field]) =>
      !missingForPublication.some((req) => req.field === field && req.severity === 'error')
  )
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
  const trustInput = v && activeTab === 'preparacion' ? await getTrustPassportInput(db, v.id) : null
  const trustPassport = trustInput ? buildTrustPassport(trustInput) : null

  // PR-A2 (corrección 7.5) — datos del panel de entrada oficial (checklist documental derivado +
  // orden de inspección activa para el enlace a Taller).
  const entrySignals =
    v && activeTab === 'preparacion'
      ? await getEntryChecklistSignals(db, v.id, ENTRY_SIGNAL_CATEGORIES)
      : []
  const entryChecklist = deriveDocumentChecklist({ signals: entrySignals }).map((row) => ({
    category: row.category as string,
    label: DOC_LABELS[row.category],
    state: row.state as string,
    requiresDocument: row.category === 'CONTRATO_GESTION',
  }))
  const inspectionOrderId = v?.workOrders.find((w) => w.kind === 'INSPECCION_ENTRADA')?.id ?? null

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
    isGenerated: Boolean(c.workOrderId || c.postventaTicketId),
  }))

  const margin = v
    ? calculateVehicleMargin({
        purchasePrice: v.purchasePrice ? Number(v.purchasePrice) : null,
        salePrice: v.salePrice ? Number(v.salePrice) : null,
        marginPercentTarget: v.marginPercent ? Number(v.marginPercent) : 4,
        costs: costs.map((c) => ({ category: c.category, amount: c.amount })),
      })
    : null

  // Próxima transición de estado lead
  const nextLeadStatuses = SELLER_LEAD_TRANSITIONS[lead.status as SellerLeadStatus] ?? []
  const primaryNextStatus = nextLeadStatuses.find((s) => s !== 'DESCARTADO') ?? null

  // ── Tabs definición ────────────────────────────────────────────────────────
  const tabs: LeadTab[] = isAdmitted
    ? [
        { key: 'resumen', label: 'Seguimiento' },
        { key: 'vendedor', label: 'Vendedor' },
        { key: 'preparacion', label: 'Vehículo y documentos' },
        ...(v ? [{ key: 'compradores', label: 'Venta' }] : []),
      ]
    : [
        { key: 'resumen', label: 'Solicitud' },
        { key: 'actividad', label: 'Actividad' },
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
    <div className="-mx-6 -mt-6 flex min-h-[calc(100%_+_1.5rem)] flex-col lg:-mb-6 lg:min-h-[calc(100%_+_3rem)]">
      <SellerIntakePanel leadId={lead.id} status={lead.intakeStatus} />
      <header className="border-b border-border bg-card px-4 pt-4 sm:px-7 sm:pt-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:min-w-64">
            <span
              aria-hidden="true"
              className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-tint text-lg font-bold text-brand sm:flex"
            >
              {lead.name
                ?.trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part.charAt(0))
                .join('')
                .toUpperCase() || <UserRound size={18} />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">
                  {personLabel(lead.name, { role: 'Vendedor sin identificar' })}
                </h1>
                <span className="sr-only">Estado del contacto</span>
                <StatusPill status={lead.status} entity="seller" />
                {lead.archivedAt && <strong>Archivado</strong>}
              </div>
              <p className="mt-1 text-sm">
                {v
                  ? [vehicleLabel(v), v.km != null ? v.km.toLocaleString('es-ES') + ' km' : null]
                      .filter(Boolean)
                      .join(' · ')
                  : 'Sin vehículo vinculado'}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <UserRound size={14} aria-hidden /> Responsable ·{' '}
                {lead.agent?.name ?? 'Sin asignar'}
              </p>
            </div>
          </div>
          <div className="flex w-full min-w-0 flex-wrap items-start gap-2 sm:w-auto">
            <details className="min-w-0 max-w-full">
              <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-lg border bg-card px-3 text-sm font-semibold hover:bg-muted">
                <Phone size={16} aria-hidden /> Contactar
              </summary>
              <div className="mt-2 grid max-w-64 gap-2 rounded-lg border bg-card p-3 text-sm">
                {' '}
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
                {!lead.phone && !lead.email && <p>Contacto pendiente de completar.</p>}
                {isAdmitted && (
                  <Link
                    className="text-brand underline"
                    href={'/vendedores/' + lead.id + '?tab=vendedor'}
                  >
                    Ver datos del vendedor
                  </Link>
                )}
              </div>
            </details>
            {isAdmitted && (
              <SellerTopbarActions leadId={lead.id} isTerminal={!nextLeadStatuses.length} />
            )}
          </div>
        </div>
        {isAdmitted && primaryNextStatus && (
          <div className="mb-2">
            <QuickAdvanceButton
              leadId={lead.id}
              nextStatus={primaryNextStatus}
              label={`Mover a ${SELLER_LEAD_STATUS_LABELS[primaryNextStatus as SellerLeadStatus]}`}
              variant="outline"
            />
          </div>
        )}
        {v && (
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-sidebar-primary/5 px-3 py-2 text-sm">
            {isAdmitted && (
              <>
                <span>Vehículo</span>
                <StatusPill status={v.status} entity="vehicle" />
              </>
            )}
            {isAdmitted && v.salePrice != null && (
              <span>
                {v.status === 'PUBLICADO' ? 'Precio anunciado' : 'Precio de venta'} ·{' '}
                <strong>{EUR(Number(v.salePrice))}</strong>
              </span>
            )}
            {v.desiredPrice != null && <span>Precio deseado · {EUR(Number(v.desiredPrice))}</span>}
          </div>
        )}
        {showHeaderStep && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
            <div className="min-w-0">
              <span className="text-muted-foreground">Próxima acción</span>
              <p className="break-words font-semibold">
                {nextStep?.title ?? 'Sin próxima acción programada'}
              </p>
              {nextStep && (
                <p className="text-xs text-muted-foreground">
                  {nextStep.due
                    ? nextStep.due.toLocaleString('es-ES', {
                        timeZone: 'Europe/Madrid',
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }) + ' · Madrid'
                    : 'Sin fecha'}{' '}
                  · {nextStep.owner ?? 'Sin responsable'}
                </p>
              )}
            </div>
            <Link
              className="inline-flex min-h-10 items-center font-semibold text-brand underline"
              href={'/vendedores/' + lead.id + '?tab=resumen#seller-next'}
            >
              Ir a seguimiento →
            </Link>
          </div>
        )}
        {/* Tabs */}
        <div className="-mx-4 sm:-mx-7">
          <Suspense fallback={<div className="h-12 border-b border-border" />}>
            <LeadTabNav tabs={tabs} activeKey={groupTab} />
          </Suspense>
        </div>
      </header>

      {/* ── Contenido principal ── */}
      <div className="mx-auto w-full max-w-5xl flex-1">
        {/* Main content */}
        <div className="ph-mask min-w-0 space-y-4 p-4 pb-10 md:p-6 md:pb-16" data-sentry-mask>
          {activeTab === 'resumen' && isAdmitted && (
            <SellerFollowupPanel
              id={lead.id}
              archived={!!lead.archivedAt}
              agent={lead.agent?.name ?? null}
              actor={currentUser.name}
              reminderType={lead.nextActionType}
              reminderDue={lead.nextActionDueAt}
              events={lead.calendarEvents}
              vehicle={
                v
                  ? {
                      status: v.status,
                      publishedAt: v.publishedAt,
                      salePrice: v.salePrice != null ? Number(v.salePrice) : null,
                    }
                  : null
              }
              offers={offerRows}
            />
          )}
          {!isAdmitted && activeTab === 'resumen' && (
            <section className="space-y-3 rounded-xl border bg-card p-4">
              <h2 className="font-semibold">Datos de la solicitud</h2>
              <p>
                {lead.email ?? 'Sin correo registrado'} · {lead.phone ?? 'Sin teléfono registrado'}
              </p>
              {v && <p>{[vehicleLabel(v), v.location, v.plate].filter(Boolean).join(' · ')}</p>}
              {v?.photos.length ? (
                <div className="flex flex-wrap gap-2">
                  {v.photos.map((photo) => (
                    <a
                      key={photo.id}
                      href={photo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm underline"
                    >
                      Foto {photo.order + 1}
                    </a>
                  ))}
                </div>
              ) : null}
              <LandingAttribution activities={activities} />
            </section>
          )}
          {activeTab === 'resumen' && (
            <details className="rounded-xl border bg-card p-4">
              <summary className="cursor-pointer font-semibold">Historial de actividad</summary>
              <div className="mt-3 space-y-3">
                <Link
                  className="text-sm text-sidebar-primary underline"
                  href={`/vendedores/${lead.id}?tab=actividad`}
                >
                  Ver actividad y añadir nota →
                </Link>
                {activities.length ? (
                  <ActivityTimeline
                    activities={activities.slice(0, 5) as ActivityItem[]}
                    currentUserId={currentUser.id}
                  />
                ) : (
                  <p className="text-sm">Todavía no hay actividad.</p>
                )}
              </div>
            </details>
          )}
          {activeTab === 'resumen' && isAdmitted && (
            <details className="rounded-xl border bg-card p-4">
              <summary className="cursor-pointer font-semibold">Información comercial</summary>
              <div className="mt-4 space-y-3">
                <LandingAttribution activities={activities} />
                {v && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {' '}
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
                      <p
                        className={`text-xl font-bold tracking-[-0.02em] ${leadScoreColor(leadScore)}`}
                      >
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
                        Expediente completado
                      </p>
                      <p
                        className={`text-xl font-bold tracking-[-0.02em] ${completionPct >= 90 ? 'text-green-600' : completionPct >= 60 ? 'text-amber-500' : 'text-muted-foreground'}`}
                      >
                        {completionPct}%
                      </p>
                    </div>
                  </div>
                )}
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
                      <Link href={`/vendedores/${lead.id}?tab=vendedor`}>
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
            </details>
          )}
          {saleTab && (
            <nav aria-label="Apartados de venta" className="flex flex-wrap gap-2">
              {[
                { key: 'compradores', label: 'Resumen de venta' },
                { key: 'publicacion', label: 'Publicación y anuncios' },
                { key: 'economia', label: 'Tasación y economía' },
              ].map((tab) => (
                <Link
                  key={tab.key}
                  aria-current={activeTab === tab.key ? 'page' : undefined}
                  className="rounded-md border px-3 py-2 text-sm aria-[current=page]:bg-muted aria-[current=page]:font-semibold"
                  href={`/vendedores/${lead.id}?tab=${tab.key}`}
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
          )}
          {activeTab === 'preparacion' && v && vehicleDefaultValues && (
            <section
              id="checklist-match"
              aria-labelledby="checklist-match-title"
              tabIndex={-1}
              className="scroll-mt-4 space-y-3 rounded-xl border bg-card p-4 sm:p-5"
            >
              <h2 id="checklist-match-title" className="text-lg font-semibold">
                Checklist de entrada para el match
              </h2>
              <VehicleEditForm
                key={v.updatedAt.toISOString()}
                vehicleId={v.id}
                version={v.updatedAt.toISOString()}
                catalog={readCatalog(v.matchCatalog)}
                defaultValues={vehicleDefaultValues}
                salePrice={v.salePrice == null ? null : Number(v.salePrice)}
              />
            </section>
          )}
          {activeTab === 'preparacion' && v && legalInput && (
            <>
              <MissingForPublishCard
                vehicle={legalInput}
                missing={missingForPublication}
                archived={!!lead.archivedAt}
                sellerId={lead.id}
                isAdmin={isAdmin}
                vehicleStatus={v.status}
              />
              <section
                aria-labelledby="prep-received"
                className="space-y-2 rounded-xl border bg-card p-4 sm:p-5"
              >
                <h2 id="prep-received" className="mb-2 font-semibold">
                  Ya tenemos
                </h2>
                <details className="border-b pb-2">
                  <summary className="cursor-pointer py-2 text-sm">
                    <strong>Documentos del expediente</strong> · {receivedCount} de{' '}
                    {PUBLICADO_REQUIRED_DOCS.length} recibidos
                  </summary>
                  <VehicleDocumentsList
                    vehicleId={v.id}
                    documents={docsForList}
                    isAdmin={isAdmin}
                    canUpload={isAgente}
                  />
                </details>
                <details className="border-b pb-2">
                  <summary className="cursor-pointer py-2 text-sm">
                    <strong>Datos, precios y comprobaciones</strong> · {passedChecks.length} de{' '}
                    {dataChecks.length} completos
                  </summary>
                  {passedChecks.length > 0 && (
                    <ul className="my-3 flex flex-wrap gap-2">
                      {passedChecks.map(([field, label]) => (
                        <li
                          key={field}
                          className="rounded-md bg-sidebar-primary/5 px-2 py-1 text-xs"
                        >
                          ✓ {label}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="space-y-4">
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
                    <div id="prep-workshop" tabIndex={-1} className="rounded-xl border p-4">
                      <p className="text-sm font-medium text-cn-ink-700">Taller</p>
                      <ul className="divide-y">
                        {v.workOrders.map((order) => (
                          <li key={order.id} className="py-2">
                            <Link
                              className="text-sm text-sidebar-primary underline"
                              href={'/taller/' + order.id}
                            >
                              {order.description || 'Ver orden de taller'} ·{' '}
                              {WORK_ORDER_STATUS_LABELS[order.status]}
                            </Link>
                          </li>
                        ))}
                      </ul>
                      <p className="text-cn-ink-400 mt-0.5 text-xs">
                        Crea una orden de trabajo para preparar este vehículo. Luego podrás
                        planificarla y bloquearla en la agenda del taller.
                      </p>
                      <a
                        href={`/taller/nueva?vehicleId=${v.id}`}
                        className="mt-3 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-white hover:opacity-90"
                      >
                        Crear orden de taller
                      </a>
                    </div>
                  </div>
                </details>
                <details>
                  <summary className="cursor-pointer py-2 text-sm">
                    <strong>Galería del vehículo</strong> · {v.photos.length}{' '}
                    {v.photos.length === 1 ? 'foto' : 'fotos'}
                  </summary>
                  <div id="prep-gallery" tabIndex={-1}>
                    <VehiclePhotoUploader vehicleId={v.id} initialPhotos={v.photos} />
                  </div>
                </details>
              </section>
            </>
          )}
          {activeTab === 'vendedor' && (
            <section aria-label="Vendedor" className="space-y-4">
              <div className="rounded-xl border bg-card p-4 sm:p-5">
                <h2 className="text-lg font-semibold">Datos del vendedor</h2>
                <dl className="my-4 grid gap-3 text-sm sm:grid-cols-2">
                  {[
                    ['Nombre', lead.name],
                    ['Teléfono', lead.phone],
                    ['Correo electrónico', lead.email],
                    ['Responsable', lead.agent?.name],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="break-words font-medium">{value || 'Sin registrar'}</dd>
                    </div>
                  ))}
                </dl>
                <details>
                  <summary className="cursor-pointer py-2 text-sm font-semibold text-brand">
                    Editar datos del vendedor
                  </summary>
                  <div className="mt-3">
                    <SellerLeadEditForm
                      leadId={lead.id}
                      defaultValues={leadDefaultValues}
                      agents={agents}
                      isAdmin={isAdmin}
                    />
                  </div>
                </details>
              </div>
              {v && (
                <Link
                  href={'/vendedores/' + lead.id + '?tab=preparacion#prep-received'}
                  className="inline-flex py-2 font-medium text-brand underline"
                >
                  Consultar DNI y contratos en el expediente del vehículo →
                </Link>
              )}
              <DocumentsPanel
                key={lead.id}
                initialTarget={{ type: 'sellerLead', id: lead.id }}
                fixedTarget
              />
            </section>
          )}
          {activeTab === 'preparacion' && (
            <Link
              href={'/vendedores/' + lead.id + '?tab=vendedor'}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline"
            >
              Datos y documentos del vendedor →
            </Link>
          )}
          {activeTab === 'preparacion' && !v && (
            <p className="rounded-xl border bg-card p-4">
              Sin vehículo vinculado. Puedes consultar los datos y los documentos del vendedor.
            </p>
          )}
          {activeTab === 'preparacion' && (
            <details className="rounded-xl border bg-card p-4" open={!v}>
              <summary className="cursor-pointer py-1 font-semibold">Más del expediente</summary>
              <div className="mt-2 space-y-3">
                {/* ─────────────── ENTRADA OFICIAL (PR-A2, corrección 7.5) ─────────────── */}
                {v && isAgente && (
                  <details className="rounded-xl border bg-card p-4">
                    <summary className="cursor-pointer py-1 font-semibold">Entrada oficial</summary>
                    <div className="mt-3">
                      <Card className="mt-6">
                        <CardHeader>
                          <CardTitle className="text-base">Entrada oficial</CardTitle>
                          <CardDescription>
                            Registra la llegada física, clasifica los documentos, valida la entrada
                            en custodia (crea la orden de inspección) y, si procede, anúlala.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <EntryPanel
                            vehicleId={v.id}
                            isAdmin={isAdmin}
                            responsibleName={lead.agent?.name ?? null}
                            arrivalAt={
                              v.physicalArrivalAt ? v.physicalArrivalAt.toISOString() : null
                            }
                            arrivalByName={v.physicalArrivalBy?.name ?? null}
                            validatedAt={
                              v.entryValidatedAt ? v.entryValidatedAt.toISOString() : null
                            }
                            validatedByName={v.entryValidatedBy?.name ?? null}
                            annulledAt={v.entryAnnulledAt ? v.entryAnnulledAt.toISOString() : null}
                            annulledByName={v.entryAnnulledBy?.name ?? null}
                            annulmentReason={v.entryAnnulmentReason ?? null}
                            annulmentNotes={v.entryAnnulmentNotes ?? null}
                            keysCount={v.keysCount ?? null}
                            keysLocation={v.keysLocation ?? null}
                            keysNotes={v.keysNotes ?? null}
                            parkingLocation={v.naveLocation ?? null}
                            checklist={entryChecklist}
                            inspectionOrderId={inspectionOrderId}
                          />
                        </CardContent>
                      </Card>
                    </div>
                  </details>
                )}

                {/* ─────────────── TRUST PASSPORT (Block 20) ─────────────── */}
                {v && trustPassport && (
                  <details className="rounded-xl border bg-card p-4">
                    <summary className="cursor-pointer py-1 font-semibold">
                      Pasaporte de confianza
                    </summary>
                    <div className="mt-3">
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
                    </div>
                  </details>
                )}
              </div>
            </details>
          )}
          {/* ─────────────── COMPRADORES ─────────────── */}
          {activeTab === 'compradores' && v && saleOverview && (
            <div className="space-y-4">
              <SellerSaleOverview
                sale={saleOverview}
                price={v.salePrice != null ? Number(v.salePrice) : null}
              >
                {portalPanel}
              </SellerSaleOverview>

              {suggestedMatches.length > 0 && (
                <details className="rounded-xl border bg-card p-4">
                  <summary className="cursor-pointer font-semibold">
                    Compradores sugeridos por el CRM · {suggestedMatches.length}
                  </summary>
                  <div className="mt-3">
                    <MatchesSection side="vehicle" matches={suggestedMatches} defaultOpen />
                  </div>
                </details>
              )}
              <details className="rounded-xl border bg-card p-4">
                <summary className="cursor-pointer font-semibold">
                  Gestionar asociaciones y seguimiento
                </summary>
                <div className="mt-3 space-y-3">
                  {followedMatches.length > 0 && (
                    <MatchesSection side="vehicle" matches={followedMatches} defaultOpen />
                  )}
                  {earlierMatches.length > 0 && (
                    <section>
                      <h3 className="font-semibold">Seguimiento anterior</h3>
                      <ul>
                        {earlierMatches.map((m) => (
                          <li key={m.id}>
                            <Link
                              className="text-sm text-brand underline"
                              href={'/compradores/' + m.buyerLead.id}
                            >
                              {personLabel(m.buyerLead.name, {
                                role: 'Comprador sin identificar',
                                id: m.buyerLead.id,
                              })}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {v && (
                    <ManualAssociationsCard
                      side="vehicle"
                      fixedId={v.id}
                      entries={vehicleMatches
                        .filter((m) => m.generatedBy === 'manual')
                        .map((m) => ({
                          id: m.id,
                          label: personLabel(m.buyerLead.name, {
                            role: 'Comprador sin identificar',
                            id: m.buyerLead.id,
                          }),
                          href: `/compradores/${m.buyerLead.id}`,
                          detail: `Manual${m.status === 'RECHAZADO' ? ' · Rechazado' : ''}`,
                        }))}
                      listHref={`/vendedores/${lead.id}?tab=compradores`}
                      disabledReason={
                        subjectVehicleEligible
                          ? undefined
                          : 'Disponible para vehículos tasados o publicados, con entrada validada y vendedor activo.'
                      }
                    />
                  )}
                </div>
              </details>
              <section
                id="venta-ofertas"
                className="scroll-mt-16"
                aria-label="Operaciones del vehículo"
              >
                {' '}
                <OffersSection
                  side="vehicle"
                  fixedId={v.id}
                  candidates={offerCandidates}
                  offers={offerRows}
                />
              </section>
              <CompletedSaleCard side="seller" sales={v.deliveries} />
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

          {/* ─────────────── PUBLICACIÓN ─────────────── */}
          {activeTab === 'publicacion' && portalPanel}
          {activeTab === 'economia' && v && (
            <SellerPriceComparison
              sellerId={lead.id}
              minimum={lead.minPrice == null ? null : Number(lead.minPrice)}
              salePrice={v.salePrice == null ? null : Number(v.salePrice)}
              offers={offerRows}
              published={v.status === 'PUBLICADO'}
              archived={!!lead.archivedAt}
            />
          )}
          {/* ─────────────── ECONOMÍA · tasación (A3) ─────────────── */}
          {activeTab === 'economia' && v && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base">Tasación oficial</CardTitle>
                <OfficialValuationPanel
                  vehicleId={v.id}
                  gateReady={officialGateReady}
                  gateReason={officialGateReason}
                />
              </CardHeader>
              <CardContent className="space-y-5">
                {v.valuationRecommended != null ? (
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span>Precio recomendado</span>
                    <strong className="text-xl text-sidebar-primary">
                      {formatEur(Number(v.valuationRecommended), 'cents')}
                    </strong>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {officialGateReady
                      ? 'Pendiente de registrar la tasación oficial.'
                      : 'Tasación oficial pendiente.'}
                  </p>
                )}
                <details className="space-y-3 border-t pt-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    Ver rango e historial de tasación
                  </summary>
                  {v.valuationMin != null || v.valuationMax != null ? (
                    <dl className="flex flex-wrap gap-6 text-sm">
                      {v.valuationMin != null && (
                        <div>
                          <dt>Mínimo de tasación</dt>
                          <dd>{formatEur(Number(v.valuationMin), 'cents')}</dd>
                        </div>
                      )}
                      {v.valuationMax != null && (
                        <div>
                          <dt>Máximo de tasación</dt>
                          <dd>{formatEur(Number(v.valuationMax), 'cents')}</dd>
                        </div>
                      )}
                    </dl>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sin rango oficial registrado.</p>
                  )}
                  {/* Valoración PRELIMINAR (orientativa) — NUNCA es el precio oficial. */}
                  {latestPreliminary && (
                    <div className="rounded-md border border-dashed border-border bg-muted/30 p-3">
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Valoración preliminar (orientativa)
                      </p>
                      <p className="text-sm">
                        {EUR(Number(latestPreliminary.recommended))}{' '}
                        <span className="text-muted-foreground">
                          ({EUR(Number(latestPreliminary.min))} –{' '}
                          {EUR(Number(latestPreliminary.max))})
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        No es un precio de venta ni habilita publicación/matching.
                      </p>
                    </div>
                  )}

                  {v.valuations.length > 0 && (
                    <div className="border-t pt-4">
                      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Historial de valoraciones
                      </p>
                      <ValuationTimeline valuations={v.valuations} />
                    </div>
                  )}

                  {v.valuationAttempts.length > 0 && (
                    <div className="border-t pt-4">
                      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Intentos (incluye sin referencia / fallos)
                      </p>
                      <ValuationAttempts attempts={v.valuationAttempts} />
                    </div>
                  )}
                </details>
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
                {margin && (
                  <dl className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <dt className="text-sm text-muted-foreground">Costes registrados</dt>
                      <dd>{formatEur(margin.totalCosts, 'cents')}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Precio de compra</dt>
                      <dd>
                        {margin.purchasePrice == null
                          ? 'Pendiente'
                          : formatEur(margin.purchasePrice, 'cents')}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Margen neto estimado</dt>
                      <dd>
                        {margin.netMargin != null
                          ? formatEur(margin.netMargin, 'cents')
                          : margin.purchasePrice == null
                            ? 'Pendiente del precio de compra'
                            : 'Pendiente del precio de venta'}
                      </dd>
                    </div>
                  </dl>
                )}
                <div id="precios-vehiculo" className="scroll-mt-24">
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
                <details className="space-y-4 border-t pt-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    Ver costes y desglose del margen
                  </summary>
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
                </details>
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
        </div>
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
