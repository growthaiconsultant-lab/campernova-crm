import { NextRequest, NextResponse } from 'next/server'
import { VehicleType, ConservationState } from '@prisma/client'
import { calculateValuation, prismaValuationDeps } from '@/lib/valuation'
import { db } from '@/lib/db'

// Public endpoint — no auth required. Called by the landing calculator.
// GET /api/valuation?type=CAMPER&brand=Volkswagen&model=California&year=2019&km=45000

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  const type = searchParams.get('type')
  const brand = searchParams.get('brand')
  const model = searchParams.get('model')
  const yearRaw = searchParams.get('year')
  const kmRaw = searchParams.get('km')

  // Validate required params
  if (!type || !brand || !model || !yearRaw || !kmRaw) {
    return NextResponse.json(
      { error: 'Faltan parámetros: type, brand, model, year, km' },
      { status: 400 }
    )
  }

  if (!Object.values(VehicleType).includes(type as VehicleType)) {
    return NextResponse.json(
      { error: `Tipo no válido. Usa: ${Object.values(VehicleType).join(', ')}` },
      { status: 400 }
    )
  }

  const year = parseInt(yearRaw, 10)
  const km = parseInt(kmRaw, 10)
  const currentYear = new Date().getFullYear()

  if (isNaN(year) || year < 1990 || year > currentYear + 1) {
    return NextResponse.json({ error: 'Año no válido' }, { status: 400 })
  }

  if (isNaN(km) || km < 0 || km > 1_000_000) {
    return NextResponse.json({ error: 'Kilómetros no válidos' }, { status: 400 })
  }

  try {
    const result = await calculateValuation(
      {
        type: type as VehicleType,
        brand: brand.trim(),
        model: model.trim(),
        year,
        km,
        // Public calculator uses BUENO as default — user refines in the full form
        conservationState: ConservationState.BUENO,
        equipment: {},
      },
      prismaValuationDeps(db)
    )

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Error al calcular la tasación' }, { status: 500 })
  }
}
