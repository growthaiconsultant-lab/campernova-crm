'use client'
import { useEffect, useRef, useState } from 'react'
import type { OperationalTarget } from '@/lib/operations-input'
import { MAX_OPERATIONAL_DOCUMENT_BYTES } from '@/lib/operations-limits'
import { TargetPicker } from './target-picker'
import {
  listOperationalDocuments,
  openOperationalDocument,
  uploadOperationalDocument,
} from '@/app/(backoffice)/operaciones/documentos/actions'

type Item = {
  id: string
  name: string
  category: string
  createdAt: string
  fileSize: number | null
}
export function DocumentsPanel({
  initialTarget,
  fixedTarget = false,
}: {
  initialTarget?: OperationalTarget
  fixedTarget?: boolean
}) {
  const [type, setType] = useState<OperationalTarget['type']>(initialTarget?.type ?? 'vehicle')
  const [id, setId] = useState(initialTarget?.id ?? '')
  const [category, setCategory] = useState<'PRESUPUESTO' | 'OPERATIVO'>('PRESUPUESTO')
  const [name, setName] = useState(''),
    [file, setFile] = useState<File | null>(null)
  const [items, setItems] = useState<Item[]>([]),
    [page, setPage] = useState(0),
    [more, setMore] = useState(false)
  const [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0)
  const [error, setError] = useState(''),
    [listError, setListError] = useState(''),
    [notice, setNotice] = useState('')
  const operationId = useRef<string>(),
    fileInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    let cancelled = false
    setItems([])
    setListError('')
    setMore(false)
    if (!id) {
      setLoading(false)
      return
    }
    setLoading(true)
    void listOperationalDocuments({ type, id }, page)
      .then((result) => {
        if (cancelled) return
        if (!result.ok) setListError(result.error)
        else {
          setItems(result.items)
          setMore(result.hasMore)
        }
      })
      .catch(() => {
        if (!cancelled) setListError('No se pudieron cargar los documentos.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [type, id, page, revision])
  async function upload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !id || busy) return
    setError('')
    setNotice('')
    if (file.size > MAX_OPERATIONAL_DOCUMENT_BYTES) {
      setError('El archivo supera los 3 MiB.')
      return
    }
    setBusy(true)
    operationId.current ??= crypto.randomUUID()
    const body = new FormData()
    body.set('file', file)
    try {
      const result = await uploadOperationalDocument(
        { target: { type, id }, category, name, operationId: operationId.current },
        body
      )
      if (!result.ok) setError(result.error)
      else {
        setNotice('Documento guardado.')
        setFile(null)
        setName('')
        operationId.current = undefined
        if (fileInput.current) fileInput.current.value = ''
        setPage(0)
        setRevision((r) => r + 1)
      }
    } catch {
      setError('No se pudo confirmar la subida. Reintenta sin cambiar el archivo ni el destino.')
    } finally {
      setBusy(false)
    }
  }
  async function download(documentId: string) {
    setBusy(true)
    setError('')
    try {
      const result = await openOperationalDocument(documentId, { type, id })
      if (!result.ok) setError(result.error)
      else window.location.assign(result.url)
    } catch {
      setError('No se pudo preparar la descarga. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">Presupuestos y documentos operativos</h2>
        <p className="text-sm text-muted-foreground">
          Archivos privados compartidos con Administración, Comerciales y Taller. Sin oferta ni
          orden de trabajo obligatoria. No adjuntes aquí DNI ni contratos comerciales.
        </p>
      </div>
      <form onSubmit={upload} className="space-y-3">
        <fieldset disabled={busy} className="space-y-3">
          {!fixedTarget && (
            <>
              <label className="block text-sm">
                Destino
                <select
                  className="ml-2 rounded border p-2"
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value as OperationalTarget['type'])
                    setId('')
                    setPage(0)
                    setNotice('')
                  }}
                >
                  <option value="vehicle">Vehículo</option>
                  <option value="buyerLead">Comprador</option>
                  <option value="sellerLead">Vendedor</option>
                </select>
              </label>
              <TargetPicker
                key={type}
                type={type}
                label="Destino del documento"
                value={id}
                onChange={(newId) => {
                  setId(newId)
                  setPage(0)
                  setNotice('')
                }}
              />
            </>
          )}
          <label className="block text-sm">
            Categoría
            <select
              className="ml-2 rounded border p-2"
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
            >
              <option value="PRESUPUESTO">Presupuesto</option>
              <option value="OPERATIVO">Otro documento operativo</option>
            </select>
          </label>
          <label className="block text-sm">
            Archivo (PDF, JPEG, PNG o WebP; hasta 3 MiB)
            <input
              ref={fileInput}
              type="file"
              required
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="mt-1 block w-full"
              onChange={(e) => {
                const selected = e.target.files?.[0] ?? null
                setFile(selected)
                setName(selected?.name ?? '')
              }}
            />
          </label>
          <label className="block text-sm">
            Nombre
            <input
              className="mt-1 w-full rounded border p-2"
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={!id || !file}
            className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          >
            {busy ? 'Procesando…' : 'Guardar documento'}
          </button>
          {error && operationId.current && (
            <button
              type="button"
              className="ml-3 underline"
              onClick={() => {
                if (
                  window.confirm(
                    'Si la subida anterior llegó a guardarse, una solicitud nueva podría duplicarla. Revisa la lista antes de continuar. ¿Iniciar una nueva solicitud?'
                  )
                ) {
                  operationId.current = undefined
                  setError('')
                  setRevision((r) => r + 1)
                }
              }}
            >
              Iniciar otra solicitud
            </button>
          )}
        </fieldset>
      </form>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-green-700">
          {notice}
        </p>
      )}
      {!id ? (
        <p>Selecciona el destino para ver sus documentos.</p>
      ) : loading ? (
        <p role="status">Cargando documentos…</p>
      ) : listError ? (
        <div role="alert">
          <p>{listError}</p>
          <button type="button" className="underline" onClick={() => setRevision((r) => r + 1)}>
            Reintentar
          </button>
        </div>
      ) : (
        <>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay documentos operativos en este destino.
            </p>
          ) : (
            <ul className="divide-y">
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="break-words font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.category === 'PRESUPUESTO' ? 'Presupuesto' : 'Documento operativo'} ·{' '}
                      {new Date(item.createdAt).toLocaleDateString('es-ES')}
                      {item.fileSize != null && ` · ${Math.ceil(item.fileSize / 1024)} KiB`}
                    </p>
                  </div>
                  <button
                    disabled={busy}
                    type="button"
                    className="shrink-0 underline"
                    onClick={() => download(item.id)}
                  >
                    Descargar
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-3 text-sm">
            <button type="button" disabled={!page || busy} onClick={() => setPage(page - 1)}>
              Anterior
            </button>
            <span>Página {page + 1}</span>
            <button type="button" disabled={!more || busy} onClick={() => setPage(page + 1)}>
              Siguiente
            </button>
            <button
              type="button"
              disabled={busy}
              className="ml-auto underline"
              onClick={() => setRevision((r) => r + 1)}
            >
              Actualizar lista
            </button>
          </div>
        </>
      )}
    </section>
  )
}
