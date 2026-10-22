import type { Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'
import { normalizePhone } from './phone'
import { KPI_EVENTS } from './kpi/events'

export class BuyerIdentityConflict extends Error {
  constructor() {
    super(
      'El contacto coincide con varias fichas. Un administrador debe revisarlas antes de darlo de alta.'
    )
  }
}

/** All five creation paths and merging share this lock, before any other identity locks. */
export async function lockBuyerIdentity(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('buyer-identity:v1', 0))`
}

export async function findBuyerIdentity(
  tx: Prisma.TransactionClient,
  contact: { phone?: string | null; email?: string | null }
) {
  const phone = normalizePhone(contact.phone ?? '')
  const email = contact.email?.trim().toLowerCase()
  const rows = await tx.buyerLead.findMany({
    select: { id: true, phone: true, email: true, mergedIntoId: true },
  })
  const matches = rows.filter(
    (row) =>
      (phone.length >= 6 && normalizePhone(row.phone) === phone) ||
      (email && row.email?.trim().toLowerCase() === email)
  )
  const contacts = await tx.buyerContact.findMany({
    where: { hash: { in: buyerContactHashes(contact) } },
    select: { buyerLeadId: true },
  })
  const canonicalById = new Map(rows.map((row) => [row.id, row.mergedIntoId ?? row.id]))
  const ids = Array.from(
    new Set([
      ...matches.map((row) => row.mergedIntoId ?? row.id),
      ...contacts.map((row) => canonicalById.get(row.buyerLeadId) ?? row.buyerLeadId),
    ])
  )
  if (ids.length > 1) throw new BuyerIdentityConflict()
  if (!ids.length) return null
  const canonical = await tx.buyerLead.findUniqueOrThrow({ where: { id: ids[0] } })
  if (canonical.mergedIntoId) throw new BuyerIdentityConflict()
  return canonical
}

export function buyerContactHashes(contact: { phone?: string | null; email?: string | null }) {
  const phone = normalizePhone(contact.phone ?? '')
  const email = contact.email?.trim().toLowerCase()
  return [phone.length >= 6 ? `phone:${phone}` : null, email ? `email:${email}` : null]
    .filter((value): value is string => !!value)
    .map((value) => createHash('sha256').update(value).digest('hex'))
    .sort()
}

export async function rememberBuyerContact(
  tx: Prisma.TransactionClient,
  leadId: string,
  contact: { phone?: string | null; email?: string | null }
) {
  for (const hash of buyerContactHashes(contact)) {
    const existing = await tx.buyerContact.findUnique({ where: { hash } })
    if (existing && existing.buyerLeadId !== leadId) throw new BuyerIdentityConflict()
    if (!existing) await tx.buyerContact.create({ data: { hash, buyerLeadId: leadId } })
  }
}

export const BUYER_CAPTURE_EVENT = KPI_EVENTS.BUYER_CAPTURE_RECEIVED

export async function recordBuyerCapture(
  tx: Prisma.TransactionClient,
  input: {
    id: string
    leadId: string
    channel: string
    ipHash: string
    now: Date
  }
) {
  await tx.kpiEvent.create({
    data: {
      id: `capture_${input.id}`,
      eventName: BUYER_CAPTURE_EVENT,
      entityType: 'buyer',
      entityId: input.leadId,
      source: 'system',
      createdAt: input.now,
      metadata: { channel: input.channel, ipHash: input.ipHash },
    },
  })
}
