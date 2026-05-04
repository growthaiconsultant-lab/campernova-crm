import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { downloadVehiclePhotosZip, buildZipFilename } from '@/lib/ads/download-photos'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // params.id is the sellerLead id; find the vehicle
  const vehicle = await db.vehicle.findUnique({
    where: { sellerLeadId: params.id },
    select: {
      id: true,
      brand: true,
      model: true,
      year: true,
      sellerLead: { select: { id: true } },
    },
  })

  if (!vehicle) {
    return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 })
  }

  const zipBuffer = await downloadVehiclePhotosZip(vehicle.id)
  const filename = buildZipFilename(vehicle)

  // Log activity — fire-and-forget
  db.activity
    .create({
      data: {
        type: 'FOTOS_DESCARGADAS',
        content: `Fotos descargadas como ZIP (${filename})`,
        sellerLeadId: vehicle.sellerLead?.id ?? null,
      },
    })
    .catch(console.error)

  return new Response(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(zipBuffer.length),
    },
  })
}
