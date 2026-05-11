import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { listMissingRequirements } from '@/lib/vehicle-legal'
import type { VehicleLegalInput, DocumentSummary, MissingRequirement } from '@/lib/vehicle-legal'

interface Props {
  vehicle: VehicleLegalInput
  docs: DocumentSummary[]
}

function RequirementRow({ req }: { req: MissingRequirement }) {
  if (req.severity === 'warning') {
    return (
      <li className="flex items-start gap-2 text-sm text-amber-600">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{req.message}</span>
      </li>
    )
  }
  return (
    <li className="flex items-start gap-2 text-sm text-destructive">
      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{req.message}</span>
    </li>
  )
}

export function MissingForPublishCard({ vehicle, docs }: Props) {
  const missing = listMissingRequirements(vehicle, 'PUBLICADO', docs)
  const errors = missing.filter((m) => m.severity === 'error')
  const warnings = missing.filter((m) => m.severity === 'warning')
  const allGood = errors.length === 0

  return (
    <div
      className={`rounded-lg border p-4 ${
        allGood ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50/50'
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        {allGood ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : (
          <AlertCircle className="h-5 w-5 text-amber-600" />
        )}
        <p className={`text-sm font-semibold ${allGood ? 'text-green-700' : 'text-amber-700'}`}>
          {allGood
            ? 'Listo para publicar'
            : `Faltan ${errors.length + warnings.length} requisito${errors.length + warnings.length > 1 ? 's' : ''} para publicar`}
        </p>
      </div>

      {allGood ? (
        <p className="text-sm text-green-600">
          El expediente legal está completo. Puedes cambiar el estado a PUBLICADO.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {errors.map((r) => (
            <RequirementRow key={r.field} req={r} />
          ))}
          {warnings.map((r) => (
            <RequirementRow key={r.field} req={r} />
          ))}
        </ul>
      )}
    </div>
  )
}
