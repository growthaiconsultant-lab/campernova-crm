import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function VendedoresPage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vendedores</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Leads de vendedor — listado completo en CAM-14
          </p>
        </div>
        <Button asChild>
          <Link href="/vendedores/nuevo">+ Nuevo lead vendedor</Link>
        </Button>
      </div>
    </div>
  )
}
