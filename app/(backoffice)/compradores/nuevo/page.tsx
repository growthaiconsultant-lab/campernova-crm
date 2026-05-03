import { BuyerLeadForm } from './buyer-lead-form'

export default function NuevoCompradorPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Nuevo lead comprador</h1>
        <p className="mt-1 text-sm text-muted-foreground">Canal CN — captación en oficina</p>
      </div>
      <BuyerLeadForm />
    </div>
  )
}
