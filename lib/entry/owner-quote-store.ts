import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { db } from '@/lib/db'
import { withLockedRoots } from '@/lib/locking'
import { draftInput, quoteLines } from './owner-quote'

export class QuoteError extends Error {}
const stale = 'El presupuesto ha cambiado. Actualiza la inspección y revisa la versión actual.'
const changed =
  'Las reparaciones marcadas han cambiado. Actualiza la inspección y guarda el borrador de nuevo.'

async function lockInspection<T>(
  orderId: string,
  run: (tx: Prisma.TransactionClient) => Promise<T>
) {
  const order = await db.workOrder.findFirst({
    where: { id: orderId, kind: 'INSPECCION_ENTRADA' },
    select: { vehicleId: true, vehicle: { select: { sellerLeadId: true } } },
  })
  if (!order) throw new QuoteError('No se encuentra la inspección.')
  return withLockedRoots(
    [
      { type: 'vehicle', id: order.vehicleId },
      { type: 'sellerLead', id: order.vehicle.sellerLeadId },
    ],
    run
  )
}

function latest(tx: Prisma.TransactionClient, workOrderId: string) {
  return tx.inspectionOwnerQuote.findFirst({ where: { workOrderId }, orderBy: { version: 'desc' } })
}

async function markedLines(
  tx: Prisma.TransactionClient,
  workOrderId: string,
  lines: z.infer<typeof draftInput>['lines']
) {
  const items = await tx.workOrderChecklist.findMany({
    where: { workOrderId, ownerQuote: true },
    orderBy: [{ category: 'asc' }, { item: 'asc' }, { id: 'asc' }],
    select: { id: true, item: true },
  })
  const byId = new Map(lines.map((line) => [line.itemId, line]))
  if (!items.length || items.length !== lines.length || items.length !== byId.size)
    throw new QuoteError(changed)
  return items.map((item) => {
    const line = byId.get(item.id)
    if (!line) throw new QuoteError(changed)
    return { ...line, item: item.item }
  })
}

export function saveOwnerDraft(orderId: string, input: z.infer<typeof draftInput>) {
  return lockInspection(orderId, async (tx) => {
    const previous = await latest(tx, orderId)
    if ((previous?.version ?? 0) !== input.version || (previous?.revision ?? 0) !== input.revision)
      throw new QuoteError(stale)
    const lines = await markedLines(tx, orderId, input.lines)
    if (previous?.status === 'BORRADOR')
      return tx.inspectionOwnerQuote.update({
        where: { id: previous.id },
        data: { lines, revision: { increment: 1 } },
      })
    return tx.inspectionOwnerQuote.create({
      data: { workOrderId: orderId, version: input.version + 1, lines },
    })
  })
}

export function claimQuoteDelivery(
  orderId: string,
  version: number,
  revision: number,
  reviewedEmail: string
) {
  return lockInspection(orderId, async (tx) => {
    const q = await latest(tx, orderId)
    if (
      !q ||
      q.version !== version ||
      q.revision !== revision ||
      !['BORRADOR', 'EN_ENVIO'].includes(q.status)
    )
      throw new QuoteError(stale)
    const order = await tx.workOrder.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        vehicle: {
          select: {
            brand: true,
            model: true,
            year: true,
            sellerLead: { select: { name: true, email: true } },
          },
        },
      },
    })
    const { sellerLead: owner, brand, model, year } = order.vehicle
    const email = owner.email?.trim()
    if (!email || !z.string().email().safeParse(email).success)
      throw new QuoteError('Completa el correo del propietario en su ficha antes de enviar.')
    if (email !== reviewedEmail || (q.status === 'EN_ENVIO' && email !== q.ownerEmail))
      throw new QuoteError(
        'El correo del propietario ha cambiado. Revisa el destinatario en la inspección.'
      )
    if (q.status === 'EN_ENVIO') return q
    const lines = quoteLines.parse(q.lines)
    const current = await markedLines(tx, orderId, lines)
    if (current.some((line, i) => line.item !== lines[i]?.item)) throw new QuoteError(changed)
    if (lines.some((line) => !line.description || line.cents === null))
      throw new QuoteError('Completa el trabajo y el importe de cada reparación antes de enviar.')
    return tx.inspectionOwnerQuote.update({
      where: { id: q.id },
      data: {
        status: 'EN_ENVIO',
        revision: { increment: 1 },
        ownerName: owner.name,
        ownerEmail: email,
        vehicleLabel: [brand, model, year].filter(Boolean).join(' ') || 'Vehículo de la inspección',
      },
    })
  })
}

// Delivery acknowledgement and owner response share the same lock, including retries.
export async function recordQuoteDelivery(
  id: string,
  decision?: 'ACEPTADO' | 'RECHAZADO',
  reason?: string
) {
  const ref = await db.inspectionOwnerQuote.findUnique({
    where: { id },
    select: { workOrderId: true },
  })
  if (!ref) return null
  return lockInspection(ref.workOrderId, async (tx) => {
    let q = await tx.inspectionOwnerQuote.findUniqueOrThrow({ where: { id } })
    if (q.status === 'BORRADOR') return null
    if (q.status === 'EN_ENVIO') {
      await tx.inspectionOwnerQuote.updateMany({
        where: {
          workOrderId: q.workOrderId,
          version: { lt: q.version },
          status: { in: ['EN_ENVIO', 'PENDIENTE'] },
        },
        data: { status: 'SUSTITUIDO', revision: { increment: 1 } },
      })
      q = await tx.inspectionOwnerQuote.update({
        where: { id },
        data: { status: 'PENDIENTE', sentAt: new Date(), revision: { increment: 1 } },
      })
    }
    if (decision && q.status === 'PENDIENTE') {
      q = await tx.inspectionOwnerQuote.update({
        where: { id },
        data: {
          status: decision,
          answeredAt: new Date(),
          reason: decision === 'RECHAZADO' ? reason?.trim() || null : null,
          revision: { increment: 1 },
        },
      })
    }
    return q
  })
}
