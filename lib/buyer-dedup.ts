import type { PrismaClient } from '@prisma/client'
import { normalizePhone, phonesMatch } from './phone'

export type DuplicateBuyer = {
  id: string
  name: string
  status: string
}

type BuyerRow = { id: string; name: string; phone: string; status: string }

/** Deps inyectables — facilita los tests sin Prisma. */
export type BuyerDedupDeps = {
  listBuyersWithPhone: () => Promise<BuyerRow[]>
}

/**
 * CAM-66: busca un comprador existente con el mismo teléfono (normalizado).
 * Devuelve el primero que coincida, o null. No crea nada.
 */
export async function findDuplicateBuyerByPhone(
  phone: string,
  deps: BuyerDedupDeps
): Promise<DuplicateBuyer | null> {
  if (normalizePhone(phone).length === 0) return null
  const rows = await deps.listBuyersWithPhone()
  const hit = rows.find((r) => phonesMatch(r.phone, phone))
  return hit ? { id: hit.id, name: hit.name, status: hit.status } : null
}

/** Adapter real con Prisma. */
export function prismaBuyerDedupDeps(db: PrismaClient): BuyerDedupDeps {
  return {
    listBuyersWithPhone: () =>
      db.buyerLead.findMany({
        select: { id: true, name: true, phone: true, status: true },
        orderBy: { createdAt: 'desc' },
      }),
  }
}
