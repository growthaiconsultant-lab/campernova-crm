import { AddBuyerInterestButton } from '../../components/add-buyer-interest-button'
import { useState } from 'react'
import { type BuyerCallInput } from '../../components/buyer-call-form'
import { createRoot } from 'react-dom/client'
import { BuyerNotesPanel, type BuyerCommercialNote } from '../../components/buyer-notes-panel'
import { BuyerAgendaRow } from '../../components/buyer-agenda-row'
import { buyerAgendaPage, type BuyerAgendaEntry } from '../../lib/buyer-agenda'
import { BuyerActionsPanel } from '../../components/buyer-actions-panel'
import type { CreateCalendarEventInput } from '../../lib/validators/calendar-event'

declare global {
  interface Window {
    followupHarness: {
      mode: 'ok' | 'error' | 'throw'
      calls: BuyerCallInput[]
      noteCalls: number
      actionCalls: CreateCalendarEventInput[]
    }
  }
}
window.followupHarness = { mode: 'ok', noteCalls: 0, actionCalls: [], calls: [] }
const delay = () => new Promise((resolve) => setTimeout(resolve, 180))

function Fixture() {
  const [selected, setSelected] = useState(false)
  const [notes, setNotes] = useState<BuyerCommercialNote[]>([
    {
      id: 'old',
      content: 'Prefiere cama fija y baño. Volver a hablar el jueves.',
      author: 'Marta (ejemplo)',
      createdAt: '2026-10-20T09:00:00Z',
    },
  ])
  const [actions, setActions] = useState<BuyerAgendaEntry[]>([])
  async function addNote(content: string) {
    window.followupHarness.noteCalls++
    await delay()
    if (window.followupHarness.mode === 'throw') throw Error('network fixture')
    if (window.followupHarness.mode === 'error')
      return { error: 'Error de prueba al guardar la nota' }
    setNotes((items) => [
      {
        id: String(items.length),
        content,
        author: 'Comercial de prueba',
        createdAt: new Date().toISOString(),
      },
      ...items,
    ])
    return { ok: true }
  }
  async function createAction(input: CreateCalendarEventInput) {
    window.followupHarness.actionCalls.push(input)
    await delay()
    if (window.followupHarness.mode === 'throw') throw Error('network fixture')
    if (window.followupHarness.mode === 'error')
      return { error: 'No se puede agendar para un lead archivado' }
    const id = String(window.followupHarness.actionCalls.length)
    setActions((items) => [
      ...items,
      {
        eventId: id,
        title: input.title,
        description: input.description ?? null,
        due: new Date(input.startAt),
        assignee: 'Comercial de prueba',
      },
    ])
    return { id }
  }
  const ordered = [...actions].sort((a, b) => Number(a.due) - Number(b.due))
  const agenda = buyerAgendaPage(ordered[0], ordered, undefined, 1, 10)
  return (
    <main className="crm-theme min-h-screen bg-background p-4 text-foreground md:p-8">
      <h1 className="mb-2 text-2xl font-semibold">Comprador de ejemplo</h1>
      <p className="mb-6 text-sm text-muted-foreground">Vista de prueba con datos ficticios</p>
      <AddBuyerInterestButton
        selected={selected}
        save={async () => {
          await delay()
          if (window.followupHarness.mode === 'error')
            return { ok: false, error: 'Vehículo no disponible' }
          setSelected(true)
          return { ok: true, saved: true }
        }}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <BuyerNotesPanel notes={notes} addNote={addNote} />
        <BuyerActionsPanel
          buyerLeadId="buyer-1"
          actorId="agent-1"
          archived={false}
          count={ordered.length}
          page={1}
          firstAction={agenda.first && <BuyerAgendaRow entry={agenda.first} />}
          otherActions={agenda.others.map((entry) => (
            <BuyerAgendaRow key={entry.eventId} entry={entry} />
          ))}
          saveCall={async (input) => {
            window.followupHarness.calls.push(input)
            await delay()
            return window.followupHarness.mode === 'ok'
              ? { ok: true }
              : { error: 'Error de conexión' }
          }}
          createAction={createAction}
        />
      </div>
    </main>
  )
}
createRoot(document.getElementById('root')!).render(<Fixture />)
