import { VehicleGalleryButton } from '@/components/vehicle-gallery-button'
import { PublicVehicleGallery } from '@/components/catalog/public-vehicle-gallery'
import { createRoot } from 'react-dom/client'
import { VehiclePhotoUploader, type VehiclePhoto } from '@/components/vehicle-photo-uploader'
import {
  VehicleDocumentsList,
  type VehicleDocumentItem,
} from '@/components/vehicle-legal/vehicle-documents-list'
import { MissingForPublishCard } from '@/components/vehicle-legal/missing-for-publish-card'
import { PUBLICADO_REQUIRED_DOCS, listMissingRequirements } from '@/lib/vehicle-legal'
import type { VehicleDocumentCategory } from '@prisma/client'

const root = createRoot(document.getElementById('root')!)
const makeDoc = (category: VehicleDocumentCategory): VehicleDocumentItem => ({
  category,
  id: category,
  name: 'Archivo anterior ' + category + '.pdf',
  url: 'qa/' + category,
  fileSize: 200,
  mimeType: 'application/pdf',
  createdAt: new Date(),
  uploadedBy: null,
})
const docs = PUBLICADO_REQUIRED_DOCS.filter((c) => c !== 'PERMISO_CIRCULACION').map(makeDoc)
const photos: VehiclePhoto[] = Array.from({ length: 4 }, (_, i) => ({
  id: 'f' + i,
  order: i,
  url: '/muestra-' + i + '.png',
  category: null,
}))
const vehicleId = 'test-preparacion'

function render() {
  const vehicle = {
    id: vehicleId,
    plate: '0000XXX',
    vin: 'QA',
    desiredPrice: 7200,
    purchasePrice: 7100,
    salePrice: 7500,
    chargeCheckedAt: new Date(),
    itvValidUntil: new Date(Date.now() + 20 * 86400000),
    photoCount: photos.length,
    workOrdersBlockingCount: 0,
  }
  const missing = listMissingRequirements(
    vehicle,
    'PUBLICADO',
    docs.map((d) => ({ category: d.category, exists: true }))
  )
  root.render(
    <main className="crm-theme p-4">
      <VehicleGalleryButton
        compact
        vehicleId={vehicleId}
        title="Fiat de prueba"
        cover={photos[0]?.url ?? null}
        count={photos.length}
      />
      <PublicVehicleGallery photos={photos.map((p) => ({ url: p.url, alt: p.id }))} />
      <MissingForPublishCard
        archived={false}
        vehicle={vehicle}
        vehicleStatus="TASADO"
        missing={missing}
        sellerId="seller-qa"
        isAdmin={false}
      />
      <details>
        <summary>Documentos del expediente</summary>
        <VehicleDocumentsList documents={docs} vehicleId={vehicleId} canUpload isAdmin={false} />
      </details>
      <details>
        <summary>Galería del vehículo</summary>
        <div id="prep-gallery" tabIndex={-1}>
          <VehiclePhotoUploader vehicleId={vehicleId} initialPhotos={[...photos]} />
        </div>
      </details>
    </main>
  )
}
Object.assign(window, {
  preparationFixture: {
    list: () => photos.map((p) => ({ ...p })),
    reorder: (ids: string[]) => {
      const next = ids.map((id, order) => ({ ...photos.find((p) => p.id === id)!, order }))
      photos.splice(0, photos.length, ...next)
      render()
      return { ok: true }
    },
    remove: (id: string) => {
      photos.splice(
        photos.findIndex((p) => p.id === id),
        1
      )
      render()
      return { ok: true }
    },
    document: (id: string, data: FormData) => {
      if (id !== vehicleId || data.get('category') !== 'PERMISO_CIRCULACION' || !data.get('file'))
        throw Error('Destino documental incorrecto')
      docs.push(makeDoc('PERMISO_CIRCULACION'))
      render()
      return { ok: true }
    },
    photo: (data: FormData) => {
      if (data.get('vehicleId') !== vehicleId || !data.get('file'))
        throw Error('Destino de foto incorrecto')
      const photo = { id: 'nueva', order: 4, url: '/muestra.png', category: null }
      photos.push(photo)
      render()
      return { photo }
    },
  },
})
render()
