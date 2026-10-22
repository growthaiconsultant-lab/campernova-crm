import { normalizePhone } from './phone'

type ContactLead = {
  id: string
  phone: string | null
  email: string | null
  agentId: string | null
}

/** A shared contact is a review candidate, never an instruction to merge people. */
export function leadDuplicateGroups<T extends ContactLead>(leads: T[]) {
  const groups: { criterion: 'phone' | 'email'; leads: T[] }[] = []
  for (const criterion of ['phone', 'email'] as const) {
    const byContact = new Map<string, T[]>()
    for (const lead of leads) {
      const key =
        criterion === 'phone' ? normalizePhone(lead.phone ?? '') : lead.email?.trim().toLowerCase()
      if (!key || (criterion === 'phone' && key.length < 9)) continue
      byContact.set(key, [...(byContact.get(key) ?? []), lead])
    }
    for (const matches of Array.from(byContact.values())) {
      if (new Set(matches.map((lead) => lead.agentId).filter(Boolean)).size >= 2)
        groups.push({ criterion, leads: matches })
    }
  }
  return groups
}
