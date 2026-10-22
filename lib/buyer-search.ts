import type { Prisma } from '@prisma/client'

/** Return the canonical buyer when a user searches any of the original contact/name variants. */
export function buyerSearchWhere(query: string): Prisma.BuyerLeadWhereInput {
  const contains = { contains: query.trim(), mode: 'insensitive' as const }
  const contact = [{ name: contains }, { email: contains }, { phone: contains }]
  return {
    mergedIntoId: null,
    OR: [...contact, { mergedFrom: { some: { OR: contact } } }],
  }
}
