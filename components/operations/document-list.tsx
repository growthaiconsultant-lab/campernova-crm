'use client'

import { useEffect, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { listOperationalDocuments } from '@/app/(backoffice)/operaciones/documentos/actions'
import type { OperationalTarget } from '@/lib/operations-input'
import type { OperationalDocumentCategory } from '@/lib/operations-policy'

type Result = Extract<Awaited<ReturnType<typeof listOperationalDocuments>>, { ok: true }>
type ListProps = {
  target: OperationalTarget
  busy: boolean
  download: (id: string) => void
}

function useDocumentPage({ type, id }: OperationalTarget, category?: OperationalDocumentCategory) {
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setResult(null)
    setError('')
    listOperationalDocuments({ type, id }, page, category)
      .then((response) => {
        if (!active) return
        if (response.ok) setResult(response)
        else setError(response.error)
      })
      .catch(() => {
        if (active) setError('No se pudieron cargar los documentos.')
      })
    return () => {
      active = false
    }
  }, [type, id, category, page, revision])
  return { page, setPage, result, error, reload: () => setRevision((r) => r + 1) }
}

const textButton =
  'rounded-md px-2 py-2 text-sm font-medium text-sidebar-primary hover:underline disabled:opacity-50'
function DocumentRows({
  view,
  busy,
  download,
  group,
}: Omit<ListProps, 'target'> & { view: ReturnType<typeof useDocumentPage>; group?: string }) {
  const { page, setPage, result, error, reload } = view
  if (error)
    return (
      <div role="alert" className="text-sm">
        <p>{error}</p>
        <button type="button" className={textButton} onClick={reload}>
          Reintentar
        </button>
      </div>
    )
  if (!result)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Cargando documentos…
      </p>
    )
  const paginated = page > 0 || result.hasMore
  return (
    <>
      {result.items.length ? (
        <ul className="divide-y divide-border">
          {result.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3"
            >
              <div className="min-w-0 flex-1 basis-40">
                <p className="break-words text-sm font-semibold">{item.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {!group &&
                    (item.category === 'PRESUPUESTO' ? 'Presupuesto · ' : 'Documento operativo · ')}
                  <time dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleDateString('es-ES', {
                      timeZone: 'Europe/Madrid',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </time>
                  {item.fileSize != null && ` · ${Math.ceil(item.fileSize / 1024)} KiB`}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => download(item.id)}
                aria-label={`Descargar ${item.name}`}
                className={textButton + ' inline-flex items-center gap-1.5'}
              >
                <Download aria-hidden className="h-4 w-4" />
                Descargar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {group
            ? page
              ? 'No hay archivos en esta página.'
              : 'Todavía no hay archivos en este apartado.'
            : 'No hay documentos operativos en este destino.'}
        </p>
      )}
      {(paginated || !group) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {paginated && (
            <nav
              aria-label={`Páginas de ${group ?? 'documentos'}`}
              className="flex flex-wrap items-center gap-2"
            >
              <button
                type="button"
                className={textButton}
                disabled={!page || busy}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </button>
              <span>Página {page + 1}</span>
              <button
                type="button"
                className={textButton}
                disabled={!result.hasMore || busy}
                onClick={() => setPage(page + 1)}
              >
                Siguiente
              </button>
            </nav>
          )}
          {!group && (
            <button
              type="button"
              className={textButton + ' ml-auto'}
              disabled={busy}
              onClick={reload}
            >
              Actualizar lista
            </button>
          )}
        </div>
      )}
    </>
  )
}

export function OperationalDocumentList(props: ListProps) {
  const view = useDocumentPage(props.target)
  return <DocumentRows {...props} view={view} />
}

export function LeadDocumentList({ target, busy, download }: ListProps) {
  const budgets = useDocumentPage(target, 'PRESUPUESTO')
  const other = useDocumentPage(target, 'OPERATIVO')
  const empty =
    budgets.page === 0 &&
    other.page === 0 &&
    budgets.result?.items.length === 0 &&
    other.result?.items.length === 0
  return (
    <div className="space-y-4">
      {empty ? (
        <p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
          {target.type === 'sellerLead'
            ? 'Aún no hay documentos para este vendedor.'
            : 'Aún no hay documentos para este comprador.'}
        </p>
      ) : (
        (
          [
            ['Presupuestos', budgets],
            ['Otros documentos operativos', other],
          ] as const
        ).map(([group, view]) => (
          <section key={group} aria-label={group} className="space-y-1 border-t border-border pt-4">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <FileText aria-hidden className="h-4 w-4 text-muted-foreground" />
              {group}
            </h3>
            <DocumentRows view={view} busy={busy} download={download} group={group} />
          </section>
        ))
      )}
      <button
        type="button"
        className={textButton}
        disabled={busy}
        onClick={() => {
          budgets.reload()
          other.reload()
        }}
      >
        Actualizar lista
      </button>
    </div>
  )
}
