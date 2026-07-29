'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { forcePublishVehicle, publishVehicle } from '@/app/(backoffice)/vendedores/[id]/actions'

interface Props {
  vehicleId: string
  force?: boolean
}

export function PublishVehicleButton({ vehicleId, force = false }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handlePublish() {
    if (
      force &&
      !window.confirm(
        'El vehículo se publicará aunque el expediente legal esté incompleto. ¿Quieres continuar?'
      )
    ) {
      return
    }

    startTransition(async () => {
      const result = force ? await forcePublishVehicle(vehicleId) : await publishVehicle(vehicleId)
      if ('error' in result) {
        toast.error(result.error.formErrors[0] ?? 'No se pudo publicar el vehículo')
        return
      }

      toast.success(force ? 'Vehículo publicado de forma forzada' : 'Vehículo publicado')
      router.refresh()
    })
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={force ? 'outline' : 'default'}
      className={
        force
          ? 'border-amber-500 bg-amber-100 text-amber-900 hover:bg-amber-200 hover:text-amber-950'
          : undefined
      }
      disabled={pending}
      onClick={handlePublish}
    >
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : force ? (
        <AlertTriangle className="mr-2 h-4 w-4" />
      ) : null}
      {pending
        ? force
          ? 'Publicando de todas formas…'
          : 'Publicando…'
        : force
          ? 'Publicar de todas formas'
          : 'Publicar'}
    </Button>
  )
}
