import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BuyerNotesPanel, type BuyerCommercialNote } from '../../components/buyer-notes-panel'
import { BuyerActionsPanel, type BuyerPendingAction } from '../../components/buyer-actions-panel'
import type { CreateCalendarEventInput } from '../../lib/validators/calendar-event'

declare global {
  interface Window {
    followupHarness: {
      mode: 'ok' | 'error' | 'throw'
      noteCalls: number
      actionCalls: CreateCalendarEventInput[]
    }
  }
}
window.followupHarness = { mode: 'ok', noteCalls: 0, actionCalls: [] }
const delay = () => new Promise((resolve) => setTimeout(resolve, 180))

function Fixture() {
  const [notes, setNotes] = useState<BuyerCommercialNote[]>([
    {
      id: 'old',
      content: 'Prefiere cama fija y baño. Volver a hablar el jueves.',
      author: 'Marta (ejemplo)',
      createdAt: '2026-10-20T09:00:00Z',
    },
  ])
  const [actions, setActions] = useState<BuyerPendingAction[]>([])
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
        id,
        title: input.title,
        description: input.description ?? null,
        startAt: input.startAt,
        assignee: 'Comercial de prueba',
        overdue: false,
      },
    ])
    return { id }
  }
  return (
    <main className="crm-theme min-h-screen bg-background p-4 text-foreground md:p-8">
      <h1 className="mb-2 text-2xl font-semibold">Comprador de ejemplo</h1>
      <p className="mb-6 text-sm text-muted-foreground">Vista de prueba con datos ficticios</p>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <BuyerNotesPanel notes={notes} addNote={addNote} />
        <BuyerActionsPanel
          buyerLeadId="buyer-1"
          actorId="agent-1"
          archived={false}
          actions={actions}
          createAction={createAction}
        />
      </div>
    </main>
  )
}
createRoot(document.getElementById('root')!).render(<Fixture />)
