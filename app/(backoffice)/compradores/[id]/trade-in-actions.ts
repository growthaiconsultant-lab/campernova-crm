'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { personLabel } from '@/lib/display'
import { defaultNextActionData } from '@/lib/next-action'
import { runAndSavePreliminaryValuation } from '@/lib/valuation/save'
import { recalculateMatchesForVehicle } from '@/lib/matching'
import { convertTradeInTx, ConversionConflictError } from '@/lib/capture-conversion'
import {
  isStockEligibleTradeIn,
  isValidTradeInType,
  tradeInTypeToVehicleType,
  TRADE_IN_TYPE_LABELS,
} from '@/lib/trade-in'
import type { TradeInVehicleType } from '@prisma/client'

type TradeInInput = {
  hasTradeIn: boolean
  type: string | null
  brand: string | null
  model: string | null
  year: number | null
  km: number | null
  financePending: boolean
  notes: string | null
}

/**
 * CAM-63: guarda el vehículo de parte de pago del comprador.
 */
export async function updateTradeIn(
  leadId: string,
  input: TradeInInput
): Promise<{ error?: string }> {
  await requireAgente()

  let type: TradeInVehicleType | null = null
  if (input.hasTradeIn && input.type) {
    if (!isValidTradeInType(input.type)) return { error: 'Tipo de vehículo no válido' }
    type = input.type
  }

  const lead = await db.buyerLead.findUnique({ where: { id: leadId }, select: { id: true } })
  if (!lead) return { error: 'Lead no encontrado' }

  await db.buyerLead.update({
    where: { id: leadId },
    data: input.hasTradeIn
      ? {
          hasTradeIn: true,
          tradeInType: type,
          tradeInBrand: input.brand?.trim() || null,
          tradeInModel: input.model?.trim() || null,
          tradeInYear: input.year ?? null,
          tradeInKm: input.km ?? null,
          tradeInFinancePending: input.financePending,
          tradeInNotes: input.notes?.trim().slice(0, 1000) || null,
        }
      : {
          // Marca "no tiene trade-in" sin borrar un lead de vendedor ya generado
          hasTradeIn: false,
          tradeInType: null,
          tradeInBrand: null,
          tradeInModel: null,
          tradeInYear: null,
          tradeInKm: null,
          tradeInFinancePending: null,
          tradeInNotes: null,
        },
  })

  revalidatePath(`/compradores/${leadId}`)
  return {}
}

/**
 * CAM-63: crea un lead de vendedor (canal CN) a partir del trade-in del comprador.
 * Solo aplica a campers/autocaravanas (captación de stock para el depósito-venta).
 */
export async function createSellerLeadFromTradeIn(
  leadId: string
): Promise<{ error?: string; sellerLeadId?: string }> {
  const actor = await requireAgente()

  const buyer = await db.buyerLead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      hasTradeIn: true,
      tradeInType: true,
      tradeInBrand: true,
      tradeInModel: true,
      tradeInYear: true,
      tradeInKm: true,
      tradeInNotes: true,
      tradeInSellerLeadId: true,
    },
  })
  if (!buyer) return { error: 'Lead no encontrado' }
  if (buyer.tradeInSellerLeadId) {
    return { error: 'Ya existe un lead de vendedor para este vehículo' }
  }
  if (!buyer.hasTradeIn || !isStockEligibleTradeIn(buyer.tradeInType)) {
    return { error: 'Solo se puede crear stock desde una camper o autocaravana' }
  }
  const vehicleType = tradeInTypeToVehicleType(buyer.tradeInType)
  if (!vehicleType) return { error: 'Tipo de vehículo no válido para stock' }

  // CAP-1 — captación progresiva: NO se exige marca/modelo/año/km para crear el lead de
  // vendedor. Los datos que falten se persisten como `null` y el agente los completa en la
  // ficha del vehículo (las columnas son nullable). Solo el tipo (camper/autocaravana) es
  // condición de elegibilidad para generar stock.
  const brand = buyer.tradeInBrand
  const model = buyer.tradeInModel
  const year = buyer.tradeInYear
  const km = buyer.tradeInKm
  const tradeInLabel = TRADE_IN_TYPE_LABELS[buyer.tradeInType]
  const vehicleLabelText = [brand, model].filter(Boolean).join(' ') || 'vehículo sin identificar'

  const buyerLabel = personLabel(buyer.name, { role: 'comprador sin identificar', id: buyer.id })
  const originNote = `Origen: parte de pago del comprador ${buyerLabel} (ficha /compradores/${buyer.id}).${
    buyer.tradeInNotes ? ` Notas: ${buyer.tradeInNotes}` : ''
  }`

  // Conversión ATÓMICA: vendedor + vehículo + CAS-vínculo del comprador + trazas en una
  // única transacción. El CAS sobre `tradeInSellerLeadId` (único) impide doble procesamiento.
  let result: { sellerLeadId: string; vehicleId: string }
  try {
    result = await db.$transaction((tx) =>
      convertTradeInTx(tx, {
        buyerLeadId: leadId,
        sellerData: {
          name: buyer.name,
          email: buyer.email,
          phone: buyer.phone,
          canal: 'CN',
          status: 'NUEVO',
          ...defaultNextActionData(),
          vehicle: {
            create: {
              type: vehicleType,
              brand,
              model,
              year,
              km,
              seats: 4, // valor por defecto — el agente lo ajusta en la ficha
              conservationState: 'NORMAL',
              equipment: {},
              status: 'NUEVO',
            },
          },
          activities: {
            create: { type: 'NOTA', content: originNote },
          },
        },
        linkingNotePrefix: `Creado lead de vendedor desde el vehículo de parte de pago (${tradeInLabel} ${vehicleLabelText}).`,
      })
    )
  } catch (err) {
    // Conflicto de negocio esperado (ya procesado / carrera) → mensaje claro.
    if (err instanceof ConversionConflictError) return { error: err.message }
    // Error técnico inesperado → propágalo (no ocultarlo como conflicto).
    throw err
  }

  // Enriquecimiento derivado, tras el commit (no bloqueante, recomputable). A3: valoración
  // PRELIMINAR — no transiciona ni escribe denormalizados oficiales.
  await runAndSavePreliminaryValuation(
    result.vehicleId,
    { brand, model, type: vehicleType, year, km, conservationState: 'NORMAL', equipment: {} },
    actor.id
  )
  await recalculateMatchesForVehicle(result.vehicleId, db)

  revalidatePath(`/compradores/${leadId}`)
  revalidatePath('/vendedores')
  return { sellerLeadId: result.sellerLeadId }
}
