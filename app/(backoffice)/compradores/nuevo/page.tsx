import { requireAgente } from '@/lib/auth'
import { BuyerLeadForm } from './buyer-lead-form'

export default async function NuevoCompradorPage() {
  await requireAgente()

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Nuevo lead comprador</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Datos del comprador y origen de captación
        </p>
      </div>
      <BuyerLeadForm />
    </div>
  )
}
