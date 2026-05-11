import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { DeliveryTabs, TabPanel } from './delivery-tabs'
import { ChecklistSection } from './checklist-section'
import { SignForm } from './sign-form'
import type { DeliveryStatus } from '@prisma/client'

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  PROGRAMADA: 'Programada',
  EN_CURSO: 'En curso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
}

const STATUS_COLORS: Record<DeliveryStatus, string> = {
  PROGRAMADA: 'bg-blue-100 text-blue-700',
  EN_CURSO: 'bg-yellow-100 text-yellow-700',
  COMPLETADA: 'bg-green-100 text-green-700',
  CANCELADA: 'bg-red-100 text-red-700',
}

export default async function EntregaDetailPage({ params }: { params: { id: string } }) {
  await requireAuth()

  const delivery = await db.delivery.findUnique({
    where: { id: params.id },
    include: {
      vehicle: {
        select: {
          id: true,
          brand: true,
          model: true,
          year: true,
          km: true,
          type: true,
          sellerLead: { select: { id: true, name: true } },
        },
      },
      buyerLead: { select: { id: true, name: true, email: true, phone: true } },
      responsable: { select: { id: true, name: true } },
      checklist: {
        orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
      },
      documents: {
        include: { uploadedBy: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      },
      warranty: { select: { id: true } },
    },
  })

  if (!delivery) notFound()

  const pendingChecklist = delivery.checklist.filter((c) => c.result === 'PENDIENTE').length
  const isSigned = !!(delivery.signedByName && delivery.signedByDni && delivery.signatureUrl)
  const canComplete = pendingChecklist === 0 && isSigned

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/entregas" className="text-cn-ink-400 text-sm hover:text-cn-ink-700">
              ← Entregas
            </Link>
          </div>
          <h1 className="mt-1 text-2xl font-bold">
            {delivery.vehicle.brand} {delivery.vehicle.model}
          </h1>
          <div className="mt-1 flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[delivery.status]}`}
            >
              {STATUS_LABELS[delivery.status]}
            </span>
            <span className="text-cn-ink-400 text-sm">
              {new Date(delivery.scheduledAt).toLocaleDateString('es-ES', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
        {delivery.status === 'PROGRAMADA' && (
          <form
            action={async () => {
              'use server'
              const { updateDeliveryStatus } = await import('../actions')
              await updateDeliveryStatus(delivery.id, 'EN_CURSO')
            }}
          >
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-lg bg-cn-teal-900 px-4 text-sm font-medium text-white hover:opacity-90"
            >
              Iniciar entrega
            </button>
          </form>
        )}
      </div>

      {/* Tabs */}
      <DeliveryTabs>
        {/* Resumen */}
        <TabPanel tab="resumen">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-4 rounded-xl border border-cn-line bg-white p-5">
              <h3 className="text-cn-ink-400 text-sm font-semibold uppercase tracking-wide">
                Vehículo
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-cn-ink-400">Marca/Modelo</dt>
                  <dd className="font-medium">
                    {delivery.vehicle.brand} {delivery.vehicle.model}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-cn-ink-400">Año / Km</dt>
                  <dd>
                    {delivery.vehicle.year} · {delivery.vehicle.km?.toLocaleString('es-ES')} km
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-cn-ink-400">Vendedor</dt>
                  <dd>
                    <Link
                      href={`/vendedores/${delivery.vehicle.sellerLead?.id}`}
                      className="text-cn-teal-900 hover:underline"
                    >
                      {delivery.vehicle.sellerLead?.name ?? '—'}
                    </Link>
                  </dd>
                </div>
              </dl>
            </div>

            <div className="space-y-4 rounded-xl border border-cn-line bg-white p-5">
              <h3 className="text-cn-ink-400 text-sm font-semibold uppercase tracking-wide">
                Comprador
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-cn-ink-400">Nombre</dt>
                  <dd className="font-medium">
                    <Link
                      href={`/compradores/${delivery.buyerLead.id}`}
                      className="text-cn-teal-900 hover:underline"
                    >
                      {delivery.buyerLead.name}
                    </Link>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-cn-ink-400">Email</dt>
                  <dd>
                    <a
                      href={`mailto:${delivery.buyerLead.email}`}
                      className="text-cn-teal-900 hover:underline"
                    >
                      {delivery.buyerLead.email}
                    </a>
                  </dd>
                </div>
                {delivery.buyerLead.phone && (
                  <div className="flex justify-between">
                    <dt className="text-cn-ink-400">Teléfono</dt>
                    <dd>
                      <a href={`tel:${delivery.buyerLead.phone}`}>{delivery.buyerLead.phone}</a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="space-y-4 rounded-xl border border-cn-line bg-white p-5 md:col-span-2">
              <h3 className="text-cn-ink-400 text-sm font-semibold uppercase tracking-wide">
                Entrega
              </h3>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-cn-ink-400">Fecha programada</dt>
                  <dd className="font-medium">
                    {new Date(delivery.scheduledAt).toLocaleString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </dd>
                </div>
                <div>
                  <dt className="text-cn-ink-400">Responsable</dt>
                  <dd className="font-medium">{delivery.responsable?.name ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-cn-ink-400">Garantía</dt>
                  <dd className="font-medium">
                    {delivery.warranty ? (
                      <Link
                        href={`/postventa/${delivery.warranty.id}`}
                        className="text-green-700 hover:underline"
                      >
                        Activa
                      </Link>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                {delivery.notes && (
                  <div className="col-span-full">
                    <dt className="text-cn-ink-400">Notas</dt>
                    <dd className="mt-0.5 whitespace-pre-wrap">{delivery.notes}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </TabPanel>

        {/* Checklist */}
        <TabPanel tab="checklist">
          <ChecklistSection
            items={delivery.checklist}
            disabled={delivery.status === 'COMPLETADA' || delivery.status === 'CANCELADA'}
          />
        </TabPanel>

        {/* Documentos */}
        <TabPanel tab="documentos">
          <div className="space-y-4">
            {delivery.documents.length === 0 ? (
              <p className="text-cn-ink-400 text-sm">No hay documentos adjuntos.</p>
            ) : (
              <div className="divide-y divide-cn-line overflow-hidden rounded-xl border border-cn-line">
                {delivery.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-cn-cream-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-cn-ink-700">{doc.name}</p>
                      <p className="text-cn-ink-400 text-xs">
                        {doc.category} · {doc.uploadedBy?.name ?? '—'}
                      </p>
                    </div>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cn-teal-900 hover:underline"
                    >
                      Ver →
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabPanel>

        {/* Firma */}
        <TabPanel tab="firma">
          <SignForm
            deliveryId={delivery.id}
            isSigned={isSigned}
            signedByName={delivery.signedByName}
            signedByDni={delivery.signedByDni}
            canComplete={canComplete}
            status={delivery.status}
          />
        </TabPanel>
      </DeliveryTabs>
    </div>
  )
}
