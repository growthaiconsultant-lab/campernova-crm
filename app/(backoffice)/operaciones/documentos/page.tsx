import { requireRole } from '@/lib/auth'
import { OPERATIONAL_DOCUMENT_ROLES } from '@/lib/operations-policy'
import { operationalTargetSchema } from '@/lib/operations-input'
import { DocumentsPanel } from '@/components/operations/documents-panel'

export default async function OperationalDocumentsPage({
  searchParams,
}: {
  searchParams: { type?: string; id?: string }
}) {
  await requireRole(OPERATIONAL_DOCUMENT_ROLES)
  const target = operationalTargetSchema.safeParse(searchParams)
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <h1 className="text-2xl font-semibold">Documentos operativos</h1>
      <DocumentsPanel
        key={target.success ? `${target.data.type}:${target.data.id}` : 'new'}
        initialTarget={target.success ? target.data : undefined}
      />
    </div>
  )
}
