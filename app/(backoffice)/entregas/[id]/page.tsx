import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { requireCanViewEntregas } from '@/lib/auth'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { deliveryDocumentSignedUrl } from '@/lib/supabase/storage'
import { PRIVATE_DOC_SIGNED_URL_TTL_SECONDS } from '@/lib/storage/private-documents'
import { DeliveryTabs, TabPanel } from './delivery-tabs'
import { ChecklistSection } from './checklist-section'
import { DocumentsSection } from './documents-section'
import { SignForm } from './sign-form'
import { DeliveryControls } from '@/components/operations/delivery-controls'
import { canManageOperationalDeliveries, canUseOperationalDocuments } from '@/lib/operations-policy'
import type { DeliveryStatus } from '@prisma/client'
import { DELIVERY_KIND_LABELS } from '@/lib/delivery-kind'

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
  const currentUser = await requireCanViewEntregas()

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
      recipientSellerLead: { select: { id: true, name: true, email: true, phone: true } },
      responsable: { select: { id: true, name: true } },
      checklist: {
        orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
      },
      documents: {
        where: currentUser.role === 'TALLER' ? { id: { in: [] } } : {},
        include: {
          uploadedBy: { select: { name: true } },
          currentVersion: { select: { objectPath: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      warranty: { select: { id: true } },
    },
  })

  if (!delivery) notFound()

  const recipient = delivery.buyerLead ?? delivery.recipientSellerLead
  const recipientHref =
    currentUser.role === 'TALLER' && recipient
      ? `/operaciones/documentos?type=${delivery.buyerLead ? 'buyerLead' : 'sellerLead'}&id=${recipient.id}`
      : delivery.buyerLead
        ? `/compradores/${delivery.buyerLead.id}`
        : delivery.recipientSellerLead
          ? `/vendedores/${delivery.recipientSellerLead.id}`
          : null
  // La firma y los adjuntos históricos conservan su canal y permisos originales.
  const legacyEditable = delivery.kind === 'VENTA' && !!delivery.offerId && !!delivery.buyerLeadId

  const pendingChecklist = delivery.checklist.filter((c) => c.result === 'PENDIENTE').length
  const isSigned = !!(delivery.signedByName && delivery.signedByDni && delivery.signatureUrl)
  const canEdit = canManageOperationalDeliveries(currentUser)
  const isTerminal = delivery.status === 'COMPLETADA' || delivery.status === 'CANCELADA'
  const isAdmin = currentUser.role === 'ADMIN'

  // URLs firmadas de corta duración (300 s) para documentos privados. Se prioriza el objectPath
  // de la VERSIÓN ACTUAL (PR5B1); fallback legacy al `url` para filas sin versiones. El bucket es
  // DENY-ALL para authenticated (PR5B2) → se firma con el cliente service_role (server-only); la
  // autorización ya la hizo requireCanViewEntregas. Solo se construye el cliente admin si hay
  // documentos: una entrega SIN documentos sigue renderizando aunque falte la clave service_role.
  const docsWithUrls =
    delivery.documents.length === 0
      ? []
      : await (async () => {
          const supabase = getSupabaseAdminClient()
          return Promise.all(
            delivery.documents.map(async (doc) => ({
              id: doc.id,
              name: doc.name,
              category: doc.category,
              uploadedByName: doc.uploadedBy?.name ?? null,
              signedUrl: await deliveryDocumentSignedUrl(
                supabase,
                doc.currentVersion?.objectPath ?? doc.url,
                PRIVATE_DOC_SIGNED_URL_TTL_SECONDS
              ),
            }))
          )
        })()

  const checklistDone = delivery.checklist.length - pendingChecklist
  const checklistTotal = delivery.checklist.length
  const checklistPct = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0
  const checklistColor =
    checklistTotal === 0 ? '#8b94a3' : pendingChecklist === 0 ? '#1a9d5f' : '#c9820a'

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink2">
        <Link
          href="/entregas"
          className="inline-flex items-center gap-1 transition-colors hover:text-ink"
        >
          <span aria-hidden>‹</span> Entregas
        </Link>
        <span className="text-ink3">/</span>
        <span className="normal-case tracking-normal text-ink3">
          {delivery.vehicle.brand} {delivery.vehicle.model}
        </span>
      </nav>

      {/* Cabecera (mockup ENT2: fecha/hora + checklist con barra) */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-hanken text-[21px] font-bold leading-[1.1] tracking-[-0.01em] text-ink">
              {delivery.vehicle.brand} {delivery.vehicle.model}
            </h1>
            <span
              className={`inline-flex items-center rounded-[6px] px-2 py-[3px] text-[10.5px] font-semibold ${STATUS_COLORS[delivery.status]}`}
            >
              {STATUS_LABELS[delivery.status]}
            </span>
          </div>
          <p className="mt-1 font-hanken text-[13px] text-ink2 first-letter:uppercase">
            {new Date(delivery.scheduledAt).toLocaleDateString('es-ES', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'Europe/Madrid',
            })}{' '}
            ·{' '}
            {new Date(delivery.scheduledAt).toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Europe/Madrid',
            })}{' '}
            · Nave
          </p>
          {/* Progreso del checklist */}
          <div className="mt-2.5 flex items-center gap-2.5">
            <div className="h-[6px] w-[180px] overflow-hidden rounded-[3px] bg-track">
              <div
                className="h-full"
                style={{ width: `${checklistPct}%`, backgroundColor: checklistColor }}
              />
            </div>
            <span
              className="font-hanken text-[11px] font-semibold"
              style={{ color: checklistColor }}
            >
              Checklist {checklistDone}/{checklistTotal}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {canEdit && (
            <DeliveryControls id={delivery.id} kind={delivery.kind} status={delivery.status} />
          )}
        </div>
      </div>

      {/* Panel «al completar» (mockup ENT2): la garantía se activa sola */}
      {delivery.status !== 'COMPLETADA' && delivery.status !== 'CANCELADA' && (
        <div className="rounded-[14px] border border-line bg-card p-4">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-brand2">
            Al completar
          </div>
          <p className="mt-1.5 font-hanken text-[12px] leading-[1.5] text-ink2">
            {delivery.kind === 'VENTA'
              ? 'Esta entrega por venta activa una garantía de 12 meses y los seguimientos de los días 7 y 30.'
              : 'Esta entrega física no registra una venta ni activa una garantía.'}{' '}
            Checklist y firma son opcionales; puedes completar desde Programada o En curso.
          </p>
        </div>
      )}

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
                    {delivery.vehicle.sellerLead ? (
                      <Link
                        href={
                          currentUser.role === 'TALLER'
                            ? `/operaciones/documentos?type=sellerLead&id=${delivery.vehicle.sellerLead.id}`
                            : `/vendedores/${delivery.vehicle.sellerLead.id}`
                        }
                        className="text-cn-teal-900 hover:underline"
                      >
                        {delivery.vehicle.sellerLead?.name ?? '—'}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="space-y-4 rounded-xl border border-cn-line bg-white p-5">
              <h3 className="text-cn-ink-400 text-sm font-semibold uppercase tracking-wide">
                Destinatario · {DELIVERY_KIND_LABELS[delivery.kind]}
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-cn-ink-400">Nombre</dt>
                  <dd className="font-medium">
                    {recipientHref ? (
                      <Link href={recipientHref} className="text-cn-teal-900 hover:underline">
                        {recipient?.name ?? 'Sin nombre registrado'}
                      </Link>
                    ) : (
                      'Sin destinatario registrado'
                    )}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-cn-ink-400">Email</dt>
                  <dd>
                    <a
                      href={recipient?.email ? `mailto:${recipient.email}` : undefined}
                      className="text-cn-teal-900 hover:underline"
                    >
                      {recipient?.email ?? '—'}
                    </a>
                  </dd>
                </div>
                {recipient?.phone && (
                  <div className="flex justify-between">
                    <dt className="text-cn-ink-400">Teléfono</dt>
                    <dd>
                      <a href={`tel:${recipient.phone}`}>{recipient.phone}</a>
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
                    {delivery.warranty && currentUser.role === 'TALLER' ? (
                      'Activa'
                    ) : delivery.warranty ? (
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
          <ChecklistSection items={delivery.checklist} disabled={!canEdit || isTerminal} />
        </TabPanel>

        {/* Documentos */}
        <TabPanel tab="documentos">
          {canUseOperationalDocuments(currentUser) && (
            <Link
              className="mb-4 block text-primary underline"
              href={`/operaciones/documentos?type=vehicle&id=${delivery.vehicleId}`}
            >
              Presupuestos y documentos operativos del vehículo
            </Link>
          )}
          {currentUser.role !== 'TALLER' && (
            <DocumentsSection
              deliveryId={delivery.id}
              documents={docsWithUrls}
              isTerminal={isTerminal || !legacyEditable}
              isAdmin={isAdmin}
            />
          )}
        </TabPanel>

        {/* Firma */}
        <TabPanel tab="firma">
          {legacyEditable && currentUser.role !== 'TALLER' ? (
            <SignForm
              deliveryId={delivery.id}
              isSigned={isSigned}
              signedByName={delivery.signedByName}
              signedByDni={delivery.signedByDni}
              canComplete={false}
              status={delivery.status}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              La firma no es obligatoria. Puedes adjuntar un justificante desde Documentos
              operativos.
            </p>
          )}
        </TabPanel>
      </DeliveryTabs>
    </div>
  )
}
