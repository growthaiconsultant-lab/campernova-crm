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
const admin = !query.has('comercial')
const team = admin && query.get('vista') !== 'mi-trabajo'
createRoot(document.getElementById('root')!).render(
  <main className="crm-theme p-4">
    <WorkdayView
      admin={admin}
      team={team}
      owner={team ? undefined : 'actor'}
      now={now}
      agents={[{ id: 'actor', name: 'Admin' }]}
      day={{ tasks: team ? tasks : tasks.slice(0, 1), agenda: team ? [meeting] : [] }}
    />
  </main>
)
