import type { Prisma, PrismaClient } from '@prisma/client'

type Rotation = { agent_ids: string[]; next_index: number; enabled: boolean }

/** Privileged operator only. Caller must verify environment and human-approved identities. */
export async function activateBuyerAssignment(
  db: PrismaClient,
  agentIds: string[],
  expectedUnassigned?: number
) {
  if (agentIds.length !== 4 || new Set(agentIds).size !== 4) throw Error('INVALID_POOL')
  return db.$transaction(
    async (tx: Prisma.TransactionClient) => {
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '10s'")
      // Lock table before singleton: INSERT takes the table lock before the trigger's row lock.
      await tx.$executeRawUnsafe('LOCK TABLE public.buyer_leads IN SHARE ROW EXCLUSIVE MODE')
      const users = await tx.user.findMany({
        where: { id: { in: agentIds }, active: true, role: { in: ['ADMIN', 'AGENTE'] } },
        select: { id: true },
      })
      if (users.length !== 4) throw Error('INVALID_ACTIVE_USERS')
      const existing = await tx.$queryRaw<
        Rotation[]
      >`SELECT agent_ids, next_index, enabled FROM buyer_lead_assignment WHERE id = 1 FOR UPDATE`
      if (existing.length && JSON.stringify(existing[0].agent_ids) !== JSON.stringify(agentIds))
        throw Error('POOL_MISMATCH')
      const before = await tx.buyerLead.findMany({
        select: { id: true, agentId: true, updatedAt: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })
      const unassigned = before.filter((lead) => lead.agentId === null).length
      if (expectedUnassigned !== undefined && unassigned !== expectedUnassigned)
        throw Error('PREFLIGHT_COUNT_CHANGED')
      let cursor = existing[0]?.next_index ?? 0
      const counts = Object.fromEntries(agentIds.map((id) => [id, 0]))
      const assigned = await tx.$queryRaw<{ id: string; agent_id: string }[]>`
        WITH pending AS (
          SELECT id, row_number() OVER (ORDER BY created_at, id) - 1 AS position
          FROM public.buyer_leads WHERE agent_id IS NULL
        )
        UPDATE public.buyer_leads AS lead
        SET agent_id = (${agentIds}::text[])[1 + ((pending.position + ${cursor}) % 4)::int],
            updated_at = CURRENT_TIMESTAMP
        FROM pending WHERE lead.id = pending.id AND lead.agent_id IS NULL
        RETURNING lead.id, lead.agent_id`
      if (assigned.length !== unassigned) throw Error('ASSIGNMENT_CONFLICT')
      if (assigned.length) {
        await tx.activity.createMany({
          data: assigned.map((lead) => ({
            type: 'NOTA',
            buyerLeadId: lead.id,
            agentId: lead.agent_id,
            content: 'COM-9: asignación automática inicial por turno rotativo.',
          })),
        })
      }
      for (const lead of assigned) counts[lead.agent_id]++
      cursor = (cursor + assigned.length) % 4
      // Parameters stay bound, including the array (no interpolated SQL identifiers).
      await tx.$executeRaw`INSERT INTO buyer_lead_assignment (id, enabled, agent_ids, next_index)
      VALUES (1, true, ${agentIds}::text[], ${cursor})
      ON CONFLICT (id) DO UPDATE SET enabled = true, next_index = EXCLUDED.next_index`
      const after = await tx.buyerLead.findMany({
        select: { id: true, agentId: true, updatedAt: true },
      })
      const byId = new Map(after.map((lead) => [lead.id, lead]))
      for (const lead of before.filter((lead) => lead.agentId !== null)) {
        const current = byId.get(lead.id)
        if (
          current?.agentId !== lead.agentId ||
          current.updatedAt.getTime() !== lead.updatedAt.getTime()
        )
          throw Error('EXISTING_ASSIGNMENT_CHANGED')
      }
      if (after.some((lead) => lead.agentId === null)) throw Error('UNASSIGNED_REMAIN')
      return {
        assigned: Object.values(counts).reduce((a, b) => a + b, 0),
        counts,
        preserved: before.filter((lead) => lead.agentId !== null).length,
        nextIndex: cursor,
        unassigned: 0,
      }
    },
    { timeout: 120_000, maxWait: 15_000 }
  )
}
