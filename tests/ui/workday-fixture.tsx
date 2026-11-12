import { createRoot } from 'react-dom/client'
import { WorkdayView } from '../../app/(backoffice)/dashboard/commercial-home'
import type { DayRow } from '../../lib/dashboard/workday'

const now = new Date('2026-11-12T10:00:00Z')
const tasks: DayRow[] = Array.from({ length: 8 }, (_, i) => ({
  href: '/compradores/b' + i + '?tab=ficha#seguimiento',
  title: 'Llamar',
  context: 'Comprador ' + i,
  owner: i === 0 ? 'Admin' : null,
  when: now,
  label: 'Hoy · 11:00',
}))
const meeting: DayRow = {
  href: '/calendario/cita',
  title: 'Visita a la exposición',
  context: 'Adria Twin',
  owner: 'Comercial',
  when: now,
  label: '11:00',
}
const query = new URLSearchParams(location.search)
Object.assign(window, { inventoryNavigate: (url: string) => location.assign(url) })
const admin = !query.has('comercial')
const team = admin && query.get('vista') !== 'mi-trabajo'
createRoot(document.getElementById('root')!).render(
  <main data-crm-shell className="crm-theme p-4">
    <WorkdayView
      admin={admin}
      team={team}
      owner={team ? (query.get('agent') ?? undefined) : 'actor'}
      now={now}
      agents={[
        { id: 'actor', name: 'Admin' },
        ...[
          'Alba',
          'Bruno',
          'Clara',
          'Diego',
          'Elena',
          'Hugo',
          'Irene',
          'Julia',
          'Marta',
          'Nora',
          'Vera',
        ].map((name) => ({ id: name.toLowerCase(), name })),
      ]}
      day={{ tasks: team ? tasks : tasks.slice(0, 1), agenda: team ? [meeting] : [] }}
    />
  </main>
)
