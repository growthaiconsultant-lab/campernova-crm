import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { requireCanViewVehicleReception } from '@/lib/auth'
import { loadReceptionQuestionnaire } from '@/lib/vehicle-reception/load'
import { VehicleReceptionQuestionnaire } from '@/components/vehicle-reception/questionnaire-form'

export default async function VehicleReceptionPage({ params }: { params: { id: string } }) {
  const actor = await requireCanViewVehicleReception()
  const questionnaire = await loadReceptionQuestionnaire(actor, params.id)
  if (!questionnaire) notFound()

  return (
    <div className="space-y-6">
      <Link
        href={actor.role === 'TALLER' ? '/taller' : '/vehiculos'}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {actor.role === 'TALLER' ? 'Volver a Taller' : 'Volver a vehículos'}
      </Link>
      <VehicleReceptionQuestionnaire data={questionnaire} />
    </div>
  )
}
