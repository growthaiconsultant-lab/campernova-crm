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
import { ActivityTimeline } from '@/components/activity-timeline'
import type { ActivityItem } from '@/components/activity-timeline'
import { NoteForm } from '@/components/note-form'
import { addSellerLeadNote } from './actions'
import { WhatsAppButton } from '@/components/whatsapp-button'
import { sellerWhatsAppMessage } from '@/lib/whatsapp'
import {
  SELLER_LEAD_TRANSITIONS,
  SELLER_LEAD_STATUS_LABELS,
  SELLER_LEAD_STATUS_CLASSES,
} from '@/lib/state-machine'
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
import { generateLeadInsights, getNextAction } from '@/lib/lead-insights'
import { LeadTabNav } from './lead-tab-nav'
import type { LeadTab } from './lead-tab-nav'
import { AlertTriangle, Info, CheckCircle2, Phone, Mail, MapPin, ChevronRight } from 'lucide-react'
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

  const vehicleMatches: VehicleMatchData[] = (v?.matches ?? []).map((m) => ({
    id: m.id,
    score: m.score,
    status: m.status,
    buyerLead: {
      id: m.buyerLead.id,
      name: m.buyerLead.name,
      vehicleType: m.buyerLead.vehicleType,
      minSeats: m.buyerLead.minSeats,
      maxBudget: m.buyerLead.maxBudget ? Number(m.buyerLead.maxBudget) : null,
      criticalEquipment: (m.buyerLead.criticalEquipment ?? {}) as Record<string, boolean>,
    },
  }))

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
    { key: 'vehiculo', label: 'Vehículo' },
    ...(v ? [{ key: 'fotos', label: 'Fotos', badge: v.photos.length }] : []),
    ...(v ? [{ key: 'compradores', label: 'Compradores', badge: vehicleMatches.length }] : []),
    { key: 'actividad', label: 'Actividad', badge: activities.length },
    ...(v && legalInput
      ? [{ key: 'expediente', label: 'Expediente legal', badge: `${completionPct}%` }]
      : []),
    ...(v ? [{ key: 'publicacion', label: 'Publicación' }] : []),
    ...(isAdmin && v ? [{ key: 'costes', label: 'Costes' }] : []),
    ...(v ? [{ key: 'tasacion', label: 'Tasación' }] : []),
  ]

  // ── Form default values ────────────────────────────────────────────────────
  const leadDefaultValues = {
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    status: lead.status,
    agentId: lead.agentId,
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
      {/* ── Cabecera ── */}
      <div className="border-b bg-background px-6 pb-0 pt-4">
        {/* Breadcrumb */}
        <nav className="mb-3 flex items-center gap-1 text-xs text-muted-foreground">
          <span className="font-semibold text-sidebar-primary">CRM</span>
          <ChevronRight className="h-3 w-3" />
          <Link href="/vendedores" className="hover:text-foreground">
            Vendedores
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{lead.name}</span>
        </nav>

        {/* Lead identity row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-foreground text-lg font-bold text-background">
              {lead.name
                .split(' ')
                .slice(0, 2)
                .map((w) => w[0])
                .join('')
                .toUpperCase()}
            </div>

            {/* Name + info */}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold leading-tight">{lead.name}</h1>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${SELLER_LEAD_STATUS_CLASSES[lead.status as SellerLeadStatus] ?? ''}`}
                >
                  {SELLER_LEAD_STATUS_LABELS[lead.status as SellerLeadStatus] ?? lead.status}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {lead.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {lead.email}
                  </span>
                )}
                {lead.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {lead.phone}
                  </span>
                )}
                {v?.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {v.location}
                  </span>
                )}
                <span
                  className={`rounded px-1.5 py-0.5 font-semibold uppercase tracking-wide ${lead.canal === 'PRO' ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-600'}`}
                >
                  Canal {lead.canal}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2">
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
              <QuickAdvanceButton
                leadId={lead.id}
                nextStatus={primaryNextStatus}
                label={`Mover a ${SELLER_LEAD_STATUS_LABELS[primaryNextStatus as SellerLeadStatus]}`}
              />
            )}
          </div>
        </div>

        {/* KPI bar — full width, no wrap */}
        {v && (
          <div className="mt-0 flex items-stretch divide-x divide-border border-t">
            {/* ── Vehículo ── */}
            <div className="flex min-w-0 flex-1 flex-col justify-center px-5 py-4">
              <div className="mb-1 flex items-center gap-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Vehículo
                </p>
                <InfoTooltip
                  text="Marca, modelo, año y kilometraje del vehículo en consignación."
                  side="bottom"
                />
              </div>
              <p className="text-sm font-bold leading-snug">
                {v.brand} {v.model}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {v.year} · {v.km?.toLocaleString('es-ES')} km
                {v.length ? ` · ${v.length}m` : ''}
              </p>
            </div>

            {/* ── Precio salida ── */}
            <div className="flex min-w-0 flex-1 flex-col justify-center px-5 py-4">
              <div className="mb-1 flex items-center gap-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Precio salida
                </p>
                <InfoTooltip
                  text="Precio de venta al público fijado. Si aún no hay precio de venta, muestra el precio deseado por el vendedor."
                  side="bottom"
                />
              </div>
              <p className="text-xl font-bold text-sidebar-primary">
                {(v.salePrice ?? v.desiredPrice) ? EUR(Number(v.salePrice ?? v.desiredPrice)) : '—'}
              </p>
              {v.valuationRecommended && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Tasación: {Math.round(Number(v.valuationMin ?? v.valuationRecommended) / 1000)}k–
                  {Math.round(Number(v.valuationMax ?? v.valuationRecommended) / 1000)}k
                </p>
              )}
            </div>

            {/* ── Margen objetivo (solo admin) ── */}
            {isAdmin && margin && (
              <div className="flex min-w-0 flex-1 flex-col justify-center px-5 py-4">
                <div className="mb-1 flex items-center gap-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Margen objetivo
                  </p>
                  <InfoTooltip
                    text="Beneficio neto estimado: precio venta − compra − todos los costes imputados (taller, gestión, publicación…). Solo visible para administradores."
                    side="bottom"
                  />
                </div>
                <p
                  className={`text-xl font-bold ${(margin.netMargin ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}
                >
                  {margin.netMargin !== null ? EUR(margin.netMargin) : '—'}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {margin.marginPercentReal !== null
                    ? `${margin.marginPercentReal.toFixed(1)}% sobre PVP`
                    : `${margin.marginPercentTarget}% objetivo`}
                </p>
              </div>
            )}

            {/* ── Días en pipeline ── */}
            <div className="flex min-w-0 flex-1 flex-col justify-center px-5 py-4">
              <div className="mb-1 flex items-center gap-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Días en pipeline
                </p>
                <InfoTooltip
                  text="Días desde que entró el lead hasta hoy. Más de 60 días sin cierre reduce significativamente la probabilidad de conversión."
                  side="bottom"
                />
              </div>
              <p
                className={`text-xl font-bold ${daysPipeline > 60 ? 'text-red-500' : daysPipeline > 30 ? 'text-amber-500' : 'text-foreground'}`}
              >
                {daysPipeline} días
              </p>
              <p
                className={`mt-0.5 text-[11px] ${daysSinceActivity > 7 ? 'text-red-500' : 'text-muted-foreground'}`}
              >
                {lastActivity
                  ? `Contacto hace ${daysSinceActivity}d`
                  : 'Sin contacto desde entrada'}
              </p>
            </div>

            {/* ── Lead score ── */}
            <div className="flex min-w-0 flex-1 flex-col justify-center px-5 py-4">
              <div className="mb-1 flex items-center gap-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Lead score
                </p>
                <InfoTooltip
                  text="Puntuación de calidad 0-100 calculada automáticamente: completud del vehículo, fotos, matches activos, actividad reciente y canal de entrada."
                  side="bottom"
                />
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-xl font-bold ${leadScoreColor(leadScore)}`}>
                  {leadScore}
                </span>
                <span className="text-sm text-muted-foreground">/ 100</span>
              </div>
              <div className="mt-1.5 flex h-1.5 w-28 gap-0.5">
                {[20, 40, 60, 80, 100].map((threshold) => (
                  <div
                    key={threshold}
                    className={`flex-1 rounded-sm transition-colors ${
                      leadScore >= threshold
                        ? leadScore >= 75
                          ? 'bg-green-500'
                          : leadScore >= 50
                            ? 'bg-sidebar-primary'
                            : 'bg-amber-400'
                        : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* ── Cambiar estado ── */}
            <div className="flex shrink-0 items-center px-5 py-4">
              <Link
                href={`/vendedores/${lead.id}?tab=vehiculo`}
                className="flex items-center gap-0.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
                <span>Cambiar estado</span>
              </Link>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mt-2">
          <Suspense fallback={<div className="h-12 border-b border-border" />}>
            <LeadTabNav tabs={tabs} />
          </Suspense>
        </div>
      </div>

      {/* ── Contenido principal ── */}
      <div className="flex flex-1 gap-0">
        {/* Main content */}
        <div className="min-w-0 flex-1 p-6">
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
                      href={`/vendedores/${lead.id}?tab=vehiculo`}
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
                      href={`/vendedores/${lead.id}?tab=fotos`}
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
                      href={`/vendedores/${lead.id}?tab=expediente`}
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

          {/* ─────────────── VEHÍCULO ─────────────── */}
          {activeTab === 'vehiculo' && (
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

          {/* ─────────────── FOTOS ─────────────── */}
          {activeTab === 'fotos' && v && (
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
            <MatchesSection side="vehicle" matches={vehicleMatches} />
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

          {/* ─────────────── EXPEDIENTE ─────────────── */}
          {activeTab === 'expediente' && v && legalInput && isAgente && (
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
              </CardContent>
            </Card>
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

          {/* ─────────────── COSTES ─────────────── */}
          {activeTab === 'costes' && v && isAdmin && (
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

          {/* ─────────────── TASACIÓN ─────────────── */}
          {activeTab === 'tasacion' && v && (
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

        {/* ── Sidebar derecha ── */}
        <aside className="hidden w-72 shrink-0 border-l bg-muted/20 xl:block">
          <div className="space-y-0 divide-y divide-border">
            {/* Próxima acción */}
            <div className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Próxima acción
                </p>
                <span
                  className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                    nextAction.urgency === 'urgente'
                      ? 'bg-red-100 text-red-600'
                      : nextAction.urgency === 'alta'
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-blue-100 text-blue-600'
                  }`}
                >
                  {nextAction.urgency}
                </span>
              </div>
              <p className="text-sm font-semibold">{nextAction.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {nextAction.description}
              </p>
              <div className="mt-3 flex gap-2">
                {lead.phone && (
                  <Button asChild size="sm" className="flex-1 text-xs">
                    <a href={`tel:${lead.phone}`}>📞 Llamar ahora</a>
                  </Button>
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
              </div>
            </div>

            {/* Asignación */}
            <div className="p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Asignación
              </p>
              {lead.agent ? (
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
                    {lead.agent.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{lead.agent.name}</p>
                    <p className="text-xs text-muted-foreground">Agente asignado</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin agente asignado</p>
              )}
              {isAdmin && (
                <Button asChild variant="outline" size="sm" className="mt-2 w-full text-xs">
                  <Link href={`/vendedores/${lead.id}?tab=vehiculo`}>
                    {lead.agent ? 'Reasignar agente' : 'Asignar agente'}
                  </Link>
                </Button>
              )}
            </div>

            {/* Tasación interna */}
            {v && v.valuationRecommended && (
              <div className="p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Tasación interna · Análisis de precio
                </p>
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Cliente pide</p>
                    <p className="text-base font-bold">
                      {v.desiredPrice ? EUR(Number(v.desiredPrice)) : '—'}
                    </p>
                  </div>
                  <span className="mb-1 text-muted-foreground">→</span>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Nuestra tasación</p>
                    <p className="text-base font-bold text-sidebar-primary">
                      {Math.round(Number(v.valuationMin) / 1000)}k–
                      {Math.round(Number(v.valuationMax) / 1000)}k €
                    </p>
                  </div>
                </div>
                {v.desiredPrice && v.valuationRecommended && (
                  <p
                    className={`mt-1 text-xs ${Number(v.desiredPrice) > Number(v.valuationRecommended) * 1.05 ? 'text-amber-600' : 'text-green-600'}`}
                  >
                    {Number(v.desiredPrice) > Number(v.valuationRecommended) * 1.05
                      ? `${Math.round(((Number(v.desiredPrice) - Number(v.valuationRecommended)) / Number(v.valuationRecommended)) * 100)}% por encima mediana`
                      : 'Dentro del rango de mercado'}
                  </p>
                )}
              </div>
            )}

            {/* Estimación costes (admin) */}
            {isAdmin && margin && (
              <div className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Estimación de costes · Margen objetivo
                  </p>
                  <Link
                    href={`/vendedores/${lead.id}?tab=costes`}
                    className="text-[10px] text-sidebar-primary hover:underline"
                  >
                    Editar →
                  </Link>
                </div>
                <div className="space-y-1.5 text-xs">
                  {margin.purchasePrice && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Precio compra a vendedor</span>
                      <span className="font-medium">{EUR(margin.purchasePrice)}</span>
                    </div>
                  )}
                  {margin.totalCosts > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reacondicionado + gastos</span>
                      <span className="font-medium">{EUR(margin.totalCosts)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1.5">
                    <span className="font-semibold">Coste total estimado</span>
                    <span className="font-bold">
                      {EUR((margin.purchasePrice ?? 0) + margin.totalCosts)}
                    </span>
                  </div>
                  {margin.netMargin !== null && (
                    <div
                      className={`mt-2 flex justify-between rounded-lg p-2 ${margin.netMargin >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
                    >
                      <span className="font-semibold">Margen neto</span>
                      <span className="font-bold">
                        {EUR(margin.netMargin)}
                        {margin.marginPercentReal !== null
                          ? ` · ${margin.marginPercentReal.toFixed(1)}% s/PVP`
                          : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Resumen stats */}
            <div className="p-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Resumen
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Origen</span>
                  <span className="font-medium">
                    {lead.canal === 'PRO' ? 'Web · Pro' : 'Backoffice · CN'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Días en pipeline</span>
                  <span className="font-medium">{daysPipeline} días</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Etapa actual</span>
                  <span className="font-medium">
                    {SELLER_LEAD_STATUS_LABELS[lead.status as SellerLeadStatus] ?? lead.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Última actividad</span>
                  <span className="font-medium">
                    {lastActivity ? `hace ${daysSinceActivity}d` : 'Sin actividad'}
                  </span>
                </div>
                <div className="flex justify-between">
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
    </div>
  )
}
