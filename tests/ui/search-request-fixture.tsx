import { createRoot } from 'react-dom/client'
import { SearchRequestBadge } from '../../components/search-request-badge'
import { SearchRequestCard } from '../../components/search-request-card'
import { QUESTION_SECTIONS } from '../../lib/search-request/questions'

const answers: Record<string, string> = {
  name: 'Cliente de ejemplo',
  phone: '600000000',
  email: 'cliente@example.invalid',
  vehicle: 'Camper',
  condition: 'Usado',
  location: 'Barcelona (ejemplo)',
  budget: '25000',
  budgetLimit: '35000',
  deadline: '2026-12-24',
  finance: 'La necesito',
  seats: '4',
  sleeping: '2',
  children: '0',
  minInteriorHeight: '1.95',
  maxKm: '125000',
  essential1: 'Cama fija sin montar el salón',
  essential2: 'Baño interior',
  comments:
    'Preferimos una distribución cómoda.\nNos gusta esta referencia: https://example.invalid/' +
    'referencia'.repeat(30),
}
const content = [
  'FICHA DE BÚSQUEDA WEB · /busqueda-bajo-pedido',
  'Versión 2026-10-21. Solicitud de contacto; no constituye un encargo firmado.',
  'Acepta el tratamiento de los datos para atender la solicitud conforme a /privacidad.',
  ...QUESTION_SECTIONS.flatMap((section) => [
    '',
    section.title.toUpperCase(),
    ...section.questions.map((q) => `${q.label}: ${answers[q.key] ?? 'Sin indicar'}`),
  ]),
].join('\n')
const mode = document.documentElement.dataset.snapshotMode
const fallback =
  'Formato antiguo\nComentario literal: <img src=x onerror="window.snapshotExecuted=true">'
createRoot(document.getElementById('root')!).render(
  <main className="crm-theme min-h-screen bg-background p-4 text-foreground md:p-8">
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">Comprador de ejemplo · Web · Nuevo</p>
      <SearchRequestBadge leadId={'search_request_' + 'a'.repeat(40)} />
    </div>
    <div aria-label="Otro comprador">
      <SearchRequestBadge leadId="landing_buyer_123" />
    </div>
    <SearchRequestCard content={mode === 'legacy' ? fallback : content} receivedAt="21/10/2026" />
  </main>
)
