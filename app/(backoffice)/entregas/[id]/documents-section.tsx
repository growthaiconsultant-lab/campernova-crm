'use client'

import { useState, useRef, useTransition } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { uploadDeliveryDocument, deleteDeliveryDocument } from '../actions'
import type { DeliveryDocumentCategory } from '@prisma/client'

const CATEGORY_LABELS: Record<DeliveryDocumentCategory, string> = {
  CONTRATO_FINAL: 'Contrato final',
  FACTURA: 'Factura',
  DOCUMENTO_ENTREGA: 'Documento de entrega',
  FOTO_ENTREGA: 'Foto de entrega',
  OTRO: 'Otro',
}

interface DocumentItem {
  id: string
  name: string
  category: DeliveryDocumentCategory
  signedUrl: string | null
  uploadedByName: string | null
}

interface Props {
  deliveryId: string
  documents: DocumentItem[]
  isTerminal: boolean
  isAdmin: boolean
}

export function DocumentsSection({ deliveryId, documents, isTerminal, isAdmin }: Props) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const [category, setCategory] = useState<DeliveryDocumentCategory>('CONTRATO_FINAL')
  const [docName, setDocName] = useState('')

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadError(null)

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const path = `${deliveryId}/${safeName}`

      const { error } = await supabase.storage.from('vehicle-documents').upload(path, file)
      if (error) throw new Error(error.message)

      startTransition(async () => {
        await uploadDeliveryDocument(deliveryId, {
          category,
          name: docName.trim() || file.name,
          url: path,
        })
      })

      setDocName('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error al subir el archivo')
    } finally {
      setUploading(false)
    }
  }

  function handleDelete(docId: string) {
    if (!confirm('¿Eliminar este documento? Esta acción no se puede deshacer.')) return
    startTransition(async () => {
      await deleteDeliveryDocument(docId)
    })
  }

  return (
    <div className="space-y-6">
      {!isTerminal && (
        <form
          onSubmit={handleUpload}
          className="space-y-4 rounded-xl border border-cn-line bg-white p-5"
        >
          <h3 className="text-sm font-semibold text-cn-ink-700">Adjuntar documento</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-cn-ink-400 block text-xs font-medium">Categoría</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as DeliveryDocumentCategory)}
                className="h-9 w-full rounded-lg border border-cn-line bg-white px-3 text-sm focus:outline-none"
              >
                {(Object.keys(CATEGORY_LABELS) as DeliveryDocumentCategory[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-cn-ink-400 block text-xs font-medium">Nombre (opcional)</label>
              <input
                type="text"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="Usar nombre del archivo si se deja vacío"
                className="h-9 w-full rounded-lg border border-cn-line px-3 text-sm focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-cn-ink-400 block text-xs font-medium">Archivo</label>
              <input
                ref={fileRef}
                type="file"
                required
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                className="h-9 w-full cursor-pointer rounded-lg border border-cn-line px-2 text-sm file:mr-2 file:border-0 file:bg-transparent file:text-xs file:font-medium focus:outline-none"
              />
            </div>
          </div>
          {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
          <button
            type="submit"
            disabled={uploading || isPending}
            className="inline-flex h-9 items-center rounded-lg bg-cn-teal-900 px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? 'Subiendo…' : 'Adjuntar'}
          </button>
        </form>
      )}

      {documents.length === 0 ? (
        <p className="text-cn-ink-400 text-sm">No hay documentos adjuntos.</p>
      ) : (
        <div className="divide-y divide-cn-line overflow-hidden rounded-xl border border-cn-line">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-cn-cream-50"
            >
              <div>
                <p className="text-sm font-medium text-cn-ink-700">{doc.name}</p>
                <p className="text-cn-ink-400 text-xs">
                  {CATEGORY_LABELS[doc.category]} · {doc.uploadedByName ?? '—'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {doc.signedUrl ? (
                  <a
                    href={doc.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-cn-teal-900 hover:underline"
                  >
                    Ver →
                  </a>
                ) : (
                  <span className="text-xs text-cn-ink-300">No disponible</span>
                )}
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(doc.id)}
                    disabled={isPending}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
