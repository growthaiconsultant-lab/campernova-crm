import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BuyerLeadEditForm } from './buyer-lead-edit-form'
import { MatchesSection } from '@/components/matches-section'
import type { BuyerMatchData } from '@/components/matches-section'
import { ActivityTimeline } from '@/components/activity-timeline'
import type { ActivityItem } from '@/components/activity-timeline'
import { NoteForm } from '@/components/note-form'
import { addBuyerLeadNote } from './actions'
import { WhatsAppButton } from '@/components/whatsapp-button'
import { buyerWhatsAppMessage } from '@/lib/whatsapp'
import { BUYER_LEAD_STATUS_LABELS, BUYER_LEAD_STATUS_CLASSES } from '@/lib/state-machine'
import type { BuyerLeadStatus } from '@prisma/client'

const EQUIPMENT_LABELS: Record<string, string> = {
  solar: 'Placas solares',
  kitchen: 'Cocina',
  bathroom: 'Baño',
  shower: 'Ducha',
  heating: 'Calefacción',
}

export default async function FichaCompradorPage({ params }: { params: { id: string } }) {
  const [currentUser, lead, agents, activities] = await Promise.all([
    requireAuth(),
    db.buyerLead.findUnique({
      where: { id: params.id },
      include: {
        agent: true,
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

  const equipment = (lead.criticalEquipment ?? {}) as Record<string, boolean>
  const activeEquipment = Object.entries(equipment)
    .filter(([, v]) => v)
    .map(([k]) => EQUIPMENT_LABELS[k] ?? k)

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

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{lead.name}</h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BUYER_LEAD_STATUS_CLASSES[lead.status as BuyerLeadStatus] ?? ''}`}
            >
              {BUYER_LEAD_STATUS_LABELS[lead.status as BuyerLeadStatus] ?? lead.status}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Lead #{lead.id.slice(-8)} · {new Date(lead.createdAt).toLocaleDateString('es-ES')}
          </p>
        </div>
        <div className="flex gap-2">
          {lead.phone && (
            <WhatsAppButton
              phone={lead.phone}
              message={buyerWhatsAppMessage(lead.name)}
              leadId={lead.id}
              leadType="buyer"
            />
          )}
          <Button asChild variant="ghost" size="sm">
            <Link href="/compradores">← Volver</Link>
          </Button>
        </div>
      </div>

      {/* Resumen de preferencias (solo lectura, rápido de ver) */}
      {(lead.vehicleType ||
        lead.maxBudget ||
        lead.minSeats ||
        activeEquipment.length > 0 ||
        lead.useZone ||
        lead.purchaseTimeline) && (
        <div className="flex flex-wrap gap-2 text-sm">
          {lead.vehicleType && (
            <span className="rounded-full bg-muted px-3 py-1">
              {lead.vehicleType === 'CAMPER' ? 'Camper' : 'Autocaravana'}
            </span>
          )}
          {lead.minSeats && (
            <span className="rounded-full bg-muted px-3 py-1">{lead.minSeats}+ plazas</span>
          )}
          {lead.maxBudget && (
            <span className="rounded-full bg-muted px-3 py-1">
              hasta{' '}
              {Number(lead.maxBudget).toLocaleString('es-ES', {
                style: 'currency',
                currency: 'EUR',
                maximumFractionDigits: 0,
              })}
            </span>
          )}
          {activeEquipment.map((e) => (
            <span key={e} className="rounded-full bg-muted px-3 py-1">
              {e}
            </span>
          ))}
          {lead.useZone && <span className="rounded-full bg-muted px-3 py-1">{lead.useZone}</span>}
          {lead.purchaseTimeline && (
            <span className="rounded-full bg-muted px-3 py-1">
              {lead.purchaseTimeline.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      )}

      {/* Formulario editable */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del comprador</CardTitle>
        </CardHeader>
        <CardContent>
          <BuyerLeadEditForm
            leadId={lead.id}
            defaultValues={defaultValues}
            agents={agents}
            isAdmin={currentUser.role === 'ADMIN'}
          />
        </CardContent>
      </Card>

      {/* Actividad */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actividad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <NoteForm addNote={addBuyerLeadNote.bind(null, lead.id)} />
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

      {/* Matches */}
      {(() => {
        const buyerMatches: BuyerMatchData[] = (lead.matches ?? []).map((m) => {
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
        return <MatchesSection side="buyer" matches={buyerMatches} />
      })()}
    </div>
  )
}
