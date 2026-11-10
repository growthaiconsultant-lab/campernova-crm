'use client'
import { useId, useRef, useState } from 'react'
import type { OperationalTarget } from '@/lib/operations-input'
import { MAX_OPERATIONAL_DOCUMENT_BYTES } from '@/lib/operations-limits'
import { BuyerDocumentList, OperationalDocumentList } from './document-list'
import { Upload } from 'lucide-react'
import { TargetPicker } from './target-picker'
import {
  openOperationalDocument,
  uploadOperationalDocument,
} from '@/app/(backoffice)/operaciones/documentos/actions'

export function DocumentsPanel({
  initialTarget,
  fixedTarget = false,
}: {
  initialTarget?: OperationalTarget
  fixedTarget?: boolean
}) {
  const buyerView = fixedTarget && initialTarget?.type === 'buyerLead'
  const formId = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [type, setType] = useState<OperationalTarget['type']>(initialTarget?.type ?? 'vehicle')
  const [id, setId] = useState(initialTarget?.id ?? '')
  const [category, setCategory] = useState<'PRESUPUESTO' | 'OPERATIVO'>('PRESUPUESTO')
  const [name, setName] = useState(''),
    [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  const operationId = useRef<string>(),
    fileInput = useRef<HTMLInputElement>(null)
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
        if (buyerView) {
          setUploadOpen(false)
          requestAnimationFrame(() => trigger.current?.focus())
        }
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
    <section
      data-sentry-mask={buyerView || undefined}
      className={
        buyerView
          ? 'ph-no-capture ph-mask mx-auto max-w-4xl space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5'
          : 'space-y-4 rounded-xl border bg-card p-5'
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {buyerView ? 'Documentos del comprador' : 'Presupuestos y documentos operativos'}
        </h2>
        {buyerView && (
          <button
            ref={trigger}
            type="button"
            disabled={busy}
            aria-expanded={uploadOpen}
            aria-controls={formId}
            onClick={() => setUploadOpen(!uploadOpen)}
            className="inline-flex items-center gap-2 rounded-lg bg-sidebar-primary px-3 py-2 text-sm font-semibold text-white"
          >
            <Upload aria-hidden className="h-4 w-4" />
            {uploadOpen ? 'Cerrar formulario' : 'Subir documento'}
          </button>
        )}
      </div>
      <form
        id={formId}
        hidden={buyerView && !uploadOpen}
        onSubmit={upload}
        className={
          buyerView ? 'space-y-3 rounded-lg border border-border bg-muted/20 p-4' : 'space-y-3'
        }
      >
        <p className="text-sm text-muted-foreground">
          Archivos privados compartidos con Administración, Comerciales y Taller. Sin oferta ni
          orden de trabajo obligatoria. No adjuntes aquí DNI ni contratos comerciales.
        </p>
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
                  setNotice('')
                }}
              />
            </>
          )}
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
      ) : buyerView ? (
        <BuyerDocumentList
          key={id + ':' + revision}
          target={{ type, id }}
          busy={busy}
          download={download}
        />
      ) : (
        <OperationalDocumentList
          key={type + ':' + id + ':' + revision}
          target={{ type, id }}
          busy={busy}
          download={download}
        />
      )}
    </section>
  )
}
