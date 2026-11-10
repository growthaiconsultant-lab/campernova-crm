import { createRoot } from 'react-dom/client'
import { DocumentsPanel } from '../../components/operations/documents-panel'
import type { OperationalDocumentCategory } from '../../lib/operations-policy'
import type { OperationalTarget } from '../../lib/operations-input'

const scenario = new URLSearchParams(location.search).get('scenario')
const budget = (id: number) => ({
  id: 'b' + id,
  name: 'Presupuesto ' + id + '.pdf',
  category: 'PRESUPUESTO',
  createdAt: new Date(Date.UTC(2025, 0, id + 1)).toISOString(),
  fileSize: 1024,
})
const rows =
  scenario === 'empty'
    ? []
    : [
        ...Array.from({ length: 22 }, (_, i) => budget(22 - i)),
        { ...budget(0), id: 'old', name: 'Plano anterior.pdf', category: 'OPERATIVO' },
      ]
let listFailed = false,
  firstAttempt = ''
Object.assign(window, {
  docsFixture: {
    async list(target: OperationalTarget, page: number, category: OperationalDocumentCategory) {
      if (target.id !== 'buyer-test') throw Error('Destino incorrecto')
      if (scenario === 'error' && category === 'OPERATIVO' && !listFailed) {
        listFailed = true
        return { ok: false, error: 'Fallo de lectura de prueba.' }
      }
      const items = rows.filter((x) => x.category === category)
      return {
        ok: true,
        items: items.slice(page * 20, (page + 1) * 20),
        hasMore: items.length > (page + 1) * 20,
      }
    },
    async upload(
      input: {
        target: OperationalTarget
        operationId: string
        category: OperationalDocumentCategory
        name: string
      },
      body: FormData
    ) {
      if (input.target.id !== 'buyer-test' || !(body.get('file') instanceof File))
        throw Error('Archivo o destino incorrecto')
      if (!firstAttempt) {
        firstAttempt = input.operationId
        return { ok: false, error: 'Subida pendiente de confirmar.' }
      }
      if (firstAttempt !== input.operationId) throw Error('Se perdió la solicitud original')
      rows.unshift({ ...budget(24), id: 'new', category: input.category, name: input.name })
      return { ok: true, id: 'new' }
    },
    async open(id: string, target: OperationalTarget) {
      return target.id === 'buyer-test' && rows.some((r) => r.id === id)
        ? { ok: true, url: location.origin + '/download/' + id }
        : { ok: false, error: 'Archivo no disponible' }
    },
  },
})
createRoot(document.getElementById('root')!).render(
  <main className="crm-theme p-3">
    <DocumentsPanel fixedTarget initialTarget={{ type: 'buyerLead', id: 'buyer-test' }} />
  </main>
)
