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
