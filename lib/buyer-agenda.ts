export type BuyerAgendaEntry = {
  eventId: string | null
  title: string
  due: Date | null
  description?: string | null
  assignee?: string | null
}

const timestamp = (entry: BuyerAgendaEntry) => entry.due?.getTime() ?? Infinity

/** Calendar pagination includes one lookahead. Insert the independent reminder on exactly one page. */
export function buyerAgendaPage(
  firstEvent: BuyerAgendaEntry | undefined,
  events: BuyerAgendaEntry[],
  reminder: BuyerAgendaEntry | undefined,
  page: number,
  pageSize: number
) {
  const first =
    reminder && (!firstEvent || timestamp(reminder) < timestamp(firstEvent)) ? reminder : firstEvent
  const rows = events.slice(0, pageSize)
  if (reminder && first !== reminder) {
    const lower = events[0]
    const upper = events[pageSize]
    if (
      (page === 1 || (lower && timestamp(reminder) >= timestamp(lower))) &&
      (!upper || timestamp(reminder) < timestamp(upper))
    ) {
      const position = rows.findIndex((entry) => timestamp(entry) > timestamp(reminder))
      rows.splice(position === -1 ? rows.length : position, 0, reminder)
    }
  }
  return { first, others: rows.filter((entry) => entry.eventId !== first?.eventId) }
}
