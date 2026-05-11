'use client'

import { useRef, useTransition } from 'react'
import { toast } from 'sonner'
import { FileText, Upload, Trash2, ExternalLink, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  uploadVehicleDocument,
  deleteVehicleDocument,
  getVehicleDocumentSignedUrl,
} from '@/app/(backoffice)/vendedores/[id]/legal-actions'
import { DOC_LABELS, PUBLICADO_REQUIRED_DOCS } from '@/lib/vehicle-legal'
import type { VehicleDocumentCategory } from '@prisma/client'

export interface VehicleDocumentItem {
  id: string
  category: VehicleDocumentCategory
  name: string
  url: string
  fileSize: number | null
  mimeType: string | null
  createdAt: Date
  uploadedBy: { name: string } | null
}

const ALL_CATEGORIES: VehicleDocumentCategory[] = [
  'DNI_VENDEDOR',
  'CONTRATO_COMPRAVENTA',
  'FICHA_TECNICA',
  'PERMISO_CIRCULACION',
  'ITV_VIGENTE',
  'JUSTIFICANTE_PAGO',
  'INFORME_CARGAS_DGT',
  'LIBRO_MANTENIMIENTO',
  'FACTURA_COMPRA_ORIGINAL',
  'CONTRATO_FINAL_VENTA',
  'OTRO',
]

const REQUIRED = new Set<VehicleDocumentCategory>(PUBLICADO_REQUIRED_DOCS)

interface Props {
  vehicleId: string
  documents: VehicleDocumentItem[]
  isAdmin: boolean
  canUpload: boolean
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function UploadInline({
  vehicleId,
  category,
}: {
  vehicleId: string
  category: VehicleDocumentCategory
}) {
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    startTransition(async () => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('category', category)
      fd.append('name', DOC_LABELS[category])
      const res = await uploadVehicleDocument(vehicleId, fd)
      if (res.ok) {
        toast.success('Documento subido')
      } else {
        toast.error(res.error)
      }
      if (inputRef.current) inputRef.current.value = ''
    })
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        id={`upload-${category}`}
        onChange={handleFile}
        disabled={isPending}
      />
      <Label
        htmlFor={`upload-${category}`}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
      >
        <Upload className="h-3 w-3" />
        {isPending ? 'Subiendo…' : 'Subir documento'}
      </Label>
    </div>
  )
}

function DocumentCard({ doc, isAdmin }: { doc: VehicleDocumentItem; isAdmin: boolean }) {
  const [isDeleting, startDeleteTransition] = useTransition()
  const [isOpening, startOpenTransition] = useTransition()

  function handleOpen() {
    startOpenTransition(async () => {
      const res = await getVehicleDocumentSignedUrl(doc.id)
      if (res.ok) {
        window.open(res.url, '_blank')
      } else {
        toast.error(res.error)
      }
    })
  }

  function handleDelete() {
    if (!confirm(`¿Eliminar "${doc.name}"? Esta acción no se puede deshacer.`)) return
    startDeleteTransition(async () => {
      const res = await deleteVehicleDocument(doc.id)
      if (res.ok) {
        toast.success('Documento eliminado')
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{doc.name}</p>
          <p className="text-xs text-muted-foreground">
            {doc.createdAt.toLocaleDateString('es-ES')}
            {doc.uploadedBy ? ` · ${doc.uploadedBy.name}` : ''}
            {doc.fileSize ? ` · ${formatBytes(doc.fileSize)}` : ''}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleOpen}
          disabled={isOpening}
          title="Ver documento"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
        {isAdmin && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            title="Eliminar documento"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}

export function VehicleDocumentsList({ vehicleId, documents, isAdmin, canUpload }: Props) {
  const byCategory = new Map<VehicleDocumentCategory, VehicleDocumentItem[]>()
  for (const doc of documents) {
    const existing = byCategory.get(doc.category) ?? []
    byCategory.set(doc.category, [...existing, doc])
  }

  return (
    <div className="space-y-3">
      {ALL_CATEGORIES.map((cat) => {
        const docs = byCategory.get(cat) ?? []
        const isRequired = REQUIRED.has(cat)
        const hasDocs = docs.length > 0

        return (
          <div key={cat} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium">{DOC_LABELS[cat]}</p>
                {isRequired && !hasDocs && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                    <AlertCircle className="h-2.5 w-2.5" />
                    Pendiente
                  </span>
                )}
                {!isRequired && !hasDocs && (
                  <span className="text-[10px] text-muted-foreground">Opcional</span>
                )}
              </div>
              {canUpload && !hasDocs && <UploadInline vehicleId={vehicleId} category={cat} />}
            </div>
            {hasDocs && (
              <div className="space-y-1">
                {docs.map((d) => (
                  <DocumentCard key={d.id} doc={d} isAdmin={isAdmin} />
                ))}
                {canUpload && <UploadInline vehicleId={vehicleId} category={cat} />}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
