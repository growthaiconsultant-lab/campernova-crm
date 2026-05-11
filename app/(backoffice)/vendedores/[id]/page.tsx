import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { SELLER_LEAD_STATUS_LABELS, SELLER_LEAD_STATUS_CLASSES } from '@/lib/state-machine'
import type { SellerLeadStatus } from '@prisma/client'
import { PublicNotesEditor } from '@/components/vehicle-ads/public-notes-editor'
import { GenerateAdButton } from '@/components/vehicle-ads/generate-ad-button'
import { DownloadPhotosButton } from '@/components/vehicle-ads/download-photos-button'
import { CardDescription } from '@/components/ui/card'
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

export default async function FichaVendedorPage({ params }: { params: { id: string } }) {
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
              include: { createdBy: { select: { name: true } } },
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

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{lead.name}</h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${SELLER_LEAD_STATUS_CLASSES[lead.status as SellerLeadStatus] ?? ''}`}
            >
              {SELLER_LEAD_STATUS_LABELS[lead.status as SellerLeadStatus] ?? lead.status}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Lead #{lead.id.slice(-8)} · Canal {lead.canal} ·{' '}
            {new Date(lead.createdAt).toLocaleDateString('es-ES')}
          </p>
        </div>
        <div className="flex gap-2">
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
          <Button asChild variant="ghost" size="sm">
            <Link href="/vendedores">← Volver</Link>
          </Button>
        </div>
      </div>

      {/* Formularios en dos columnas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Vendedor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos del vendedor</CardTitle>
          </CardHeader>
          <CardContent>
            <SellerLeadEditForm
              leadId={lead.id}
              defaultValues={leadDefaultValues}
              agents={agents}
              isAdmin={currentUser.role === 'ADMIN'}
            />
          </CardContent>
        </Card>

        {/* Vehículo */}
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

      {/* Fotos */}
      {v && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fotos</CardTitle>
          </CardHeader>
          <CardContent>
            <VehiclePhotoUploader vehicleId={v.id} initialPhotos={v.photos} />
          </CardContent>
        </Card>
      )}

      {/* Matches */}
      {v &&
        (() => {
          const vehicleMatches: VehicleMatchData[] = (v.matches ?? []).map((m) => ({
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
          return <MatchesSection side="vehicle" matches={vehicleMatches} />
        })()}

      {/* Actividad */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actividad</CardTitle>
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

      {/* Expediente legal */}
      {v &&
        (() => {
          const legalInput: VehicleLegalInput = {
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

          const docSummary: DocumentSummary[] = (
            [
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
            ] as VehicleDocumentCategory[]
          ).map((cat) => ({
            category: cat,
            exists: (v.documents ?? []).some((d) => d.category === cat),
          }))

          const completionPct = calculateCompletionPercent(legalInput, docSummary)

          const isAdminUser = currentUser.role === 'ADMIN'
          const canViewExpediente = ['ADMIN', 'AGENTE', 'ENTREGAS', 'TALLER'].includes(
            currentUser.role
          )
          const canUploadDocs = ['ADMIN', 'AGENTE'].includes(currentUser.role)

          if (!canViewExpediente) return null

          const docsForList: VehicleDocumentItem[] = (v.documents ?? []).map((d) => ({
            id: d.id,
            category: d.category as VehicleDocumentCategory,
            name: d.name,
            url: d.url,
            fileSize: d.fileSize ?? null,
            mimeType: d.mimeType ?? null,
            createdAt: d.createdAt,
            uploadedBy: d.uploadedBy,
          }))

          return (
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
                {/* Campos legales del vehículo */}
                <div>
                  <p className="text-cn-ink-400 mb-3 text-xs font-medium uppercase tracking-wide">
                    Datos legales del vehículo
                  </p>
                  <VehicleLegalFieldsForm
                    vehicleId={v.id}
                    isAdmin={isAdminUser}
                    plate={v.plate ?? null}
                    vin={v.vin ?? null}
                    itvValidUntil={v.itvValidUntil ?? null}
                    titleTransferredAt={v.titleTransferredAt ?? null}
                    chargeCheckedAt={v.chargeCheckedAt ?? null}
                    chargeCheckedByName={v.chargeCheckedBy?.name ?? null}
                  />
                </div>

                {/* Documentos del expediente */}
                <div>
                  <p className="text-cn-ink-400 mb-3 text-xs font-medium uppercase tracking-wide">
                    Documentos del expediente
                  </p>
                  <VehicleDocumentsList
                    vehicleId={v.id}
                    documents={docsForList}
                    isAdmin={isAdminUser}
                    canUpload={canUploadDocs}
                  />
                </div>

                {/* Resumen de qué falta para publicar */}
                {(isAdminUser || currentUser.role === 'AGENTE') && (
                  <MissingForPublishCard vehicle={legalInput} docs={docSummary} />
                )}
              </CardContent>
            </Card>
          )
        })()}

      {/* Anuncios y publicación */}
      {v &&
        (() => {
          const lastWallapopAd = v.ads?.find((a) => a.channel === 'WALLAPOP') ?? null
          const lastCochesNetAd = v.ads?.find((a) => a.channel === 'COCHESNET') ?? null
          return (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Anuncios y publicación</CardTitle>
                <CardDescription>
                  Genera el anuncio listo para copiar y pega en Wallapop o Coches.net. El asistente
                  usa la ficha del vehículo, las notas del agente y las fotos para redactarlo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <PublicNotesEditor vehicleId={v.id} initialValue={v.publicNotes} />
                <div className="flex flex-wrap gap-3">
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
                </div>
              </CardContent>
            </Card>
          )
        })()}

      {/* Costes y margen — solo ADMIN */}
      {v &&
        currentUser.role === 'ADMIN' &&
        (() => {
          const costs = (v.costs ?? []).map((c) => ({
            id: c.id,
            category: c.category as VehicleCostCategory,
            description: c.description,
            amount: Number(c.amount),
            supplier: c.supplier,
            invoiceUrl: c.invoiceUrl,
            createdAt: c.createdAt,
            createdBy: c.createdBy,
          }))

          const margin = calculateVehicleMargin({
            purchasePrice: v.purchasePrice ? Number(v.purchasePrice) : null,
            salePrice: v.salePrice ? Number(v.salePrice) : null,
            marginPercentTarget: v.marginPercent ? Number(v.marginPercent) : 4,
            costs: costs.map((c) => ({ category: c.category, amount: c.amount })),
          })

          return (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Costes y margen</CardTitle>
                <CardDescription>
                  Precios, costes imputados y rentabilidad neta del vehículo. Solo visible para
                  administradores.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Precios y margen objetivo */}
                <div>
                  <p className="text-cn-ink-400 mb-3 text-xs font-medium uppercase tracking-wide">
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

                {/* Resumen de margen */}
                <div>
                  <p className="text-cn-ink-400 mb-3 text-xs font-medium uppercase tracking-wide">
                    Resumen de margen
                  </p>
                  <VehicleMarginSummary margin={margin} />
                </div>

                {/* Costes imputados */}
                <div>
                  <p className="text-cn-ink-400 mb-3 text-xs font-medium uppercase tracking-wide">
                    Costes imputados
                  </p>
                  <VehicleCostsTable
                    vehicleId={v.id}
                    costs={costs}
                    currentUserId={currentUser.id}
                    isAdmin={true}
                  />
                </div>

                {/* Ubicación en nave */}
                <div>
                  <p className="text-cn-ink-400 mb-3 text-xs font-medium uppercase tracking-wide">
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
          )
        })()}

      {/* Tasación */}
      {v && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Tasación</CardTitle>
            <ValuationOverrideForm vehicleId={v.id} />
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Rango actual */}
            {v.valuationRecommended ? (
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">Mínimo</p>
                  <p className="text-lg font-semibold">
                    {Number(v.valuationMin).toLocaleString('es-ES', {
                      style: 'currency',
                      currency: 'EUR',
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Recomendado</p>
                  <p className="text-campernova-accent text-xl font-bold">
                    {Number(v.valuationRecommended).toLocaleString('es-ES', {
                      style: 'currency',
                      currency: 'EUR',
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Máximo</p>
                  <p className="text-lg font-semibold">
                    {Number(v.valuationMax).toLocaleString('es-ES', {
                      style: 'currency',
                      currency: 'EUR',
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sin tasación — guarda los datos del vehículo para calcularla automáticamente.
              </p>
            )}

            {/* Historial */}
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
  )
}
