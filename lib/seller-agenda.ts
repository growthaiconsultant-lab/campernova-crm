import type { NextActionType, Prisma } from '@prisma/client'
import { NEXT_ACTION_LABELS } from './next-action'

export const pendingSellerCalendarEvents = {
  where: { status: { in: ['PROGRAMADO', 'CONFIRMADO', 'EN_CURSO'] } },
  orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
  select: { id: true, title: true, startAt: true, assignedTo: { select: { name: true } } },
} satisfies Prisma.CalendarEventFindManyArgs

export type SellerCalendarEvent = Prisma.CalendarEventGetPayload<typeof pendingSellerCalendarEvents>
export type SellerStep = {
  id: string | null
  title: string
  due: Date | null
  owner: string | null
}

export function sellerSteps(
  events: SellerCalendarEvent[],
  reminderType: NextActionType | null,
  reminderDue: Date | null,
  agent: string | null
) {
  const steps: SellerStep[] = events.map((e) => ({
    id: e.id,
    title: e.title,
    due: e.startAt,
    owner: e.assignedTo?.name ?? null,
  }))
  if (reminderType)
    steps.push({
      id: null,
      title: NEXT_ACTION_LABELS[reminderType],
      due: reminderDue,
      owner: agent,
    })
  steps.sort((a, b) => (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity))
  return steps
}
