'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }

const createCostSchema = z.object({
  category: z.enum([
    'PIEZAS',
    'MANO_OBRA_TALLER',
    'INSTALACION',
    'LIMPIEZA',
    'MARKETING',
    'CUSTODIA',
    'POSTVENTA',
    'OTRO',
  ]),
  description: z.string().min(1, 'Descripción requerida').trim(),
  amount: z.coerce.number().positive('El importe debe ser positivo'),
  supplier: z.string().trim().optional(),
  invoiceUrl: z.string().url('URL inválida').optional().or(z.literal('')),
})

const updateEconomicsSchema = z.object({
  purchasePrice: z.coerce.number().positive().optional().nullable(),
  salePrice: z.coerce.number().positive().optional().nullable(),
  marginPercent: z.coerce.number().min(0).max(100).optional(),
})

const naveSchema = z.object({
  entryDate: z.string().optional().nullable(),
  naveLocation: z.string().trim().optional().nullable(),
})

function revalidateVehiclePage(sellerLeadId: string) {
  revalidatePath(`/vendedores/${sellerLeadId}`)
}

async function getSellerLeadId(vehicleId: string): Promise<string | null> {
  const v = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { sellerLeadId: true },
  })
  return v?.sellerLeadId ?? null
}

export async function createVehicleCost(
  vehicleId: string,
  formData: unknown
): Promise<ActionResult> {
  const actor = await requireAdmin()

  const parsed = createCostSchema.safeParse(formData)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const { category, description, amount, supplier, invoiceUrl } = parsed.data

  const sellerLeadId = await getSellerLeadId(vehicleId)
  if (!sellerLeadId) return { ok: false, error: 'Vehículo no encontrado' }

  await db.$transaction([
    db.vehicleCost.create({
      data: {
        vehicleId,
        category,
        description,
        amount,
        supplier: supplier || null,
        invoiceUrl: invoiceUrl || null,
        createdById: actor.id,
      },
    }),
    db.activity.create({
      data: {
        type: 'COSTE_IMPUTADO',
        content: `Coste imputado: ${category} — ${description} (${amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })})`,
        agentId: actor.id,
        sellerLeadId,
      },
    }),
  ])

  revalidateVehiclePage(sellerLeadId)
  return { ok: true }
}

export async function updateVehicleCost(costId: string, formData: unknown): Promise<ActionResult> {
  await requireAdmin()

  const parsed = createCostSchema.safeParse(formData)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const cost = await db.vehicleCost.findUnique({
    where: { id: costId },
    select: { vehicle: { select: { sellerLeadId: true } } },
  })
  if (!cost) return { ok: false, error: 'Coste no encontrado' }

  const { category, description, amount, supplier, invoiceUrl } = parsed.data

  await db.vehicleCost.update({
    where: { id: costId },
    data: {
      category,
      description,
      amount,
      supplier: supplier || null,
      invoiceUrl: invoiceUrl || null,
    },
  })

  revalidateVehiclePage(cost.vehicle.sellerLeadId)
  return { ok: true }
}

export async function deleteVehicleCost(costId: string): Promise<ActionResult> {
  await requireAdmin()

  const cost = await db.vehicleCost.findUnique({
    where: { id: costId },
    select: { vehicle: { select: { sellerLeadId: true } } },
  })
  if (!cost) return { ok: false, error: 'Coste no encontrado' }

  await db.vehicleCost.delete({ where: { id: costId } })
  revalidateVehiclePage(cost.vehicle.sellerLeadId)
  return { ok: true }
}

export async function updateVehicleEconomics(
  vehicleId: string,
  formData: unknown
): Promise<ActionResult> {
  const actor = await requireAdmin()

  const parsed = updateEconomicsSchema.safeParse(formData)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const sellerLeadId = await getSellerLeadId(vehicleId)
  if (!sellerLeadId) return { ok: false, error: 'Vehículo no encontrado' }

  const { purchasePrice, salePrice, marginPercent } = parsed.data

  await db.$transaction([
    db.vehicle.update({
      where: { id: vehicleId },
      data: {
        ...(purchasePrice !== undefined ? { purchasePrice } : {}),
        ...(salePrice !== undefined ? { salePrice } : {}),
        ...(marginPercent !== undefined ? { marginPercent } : {}),
      },
    }),
    db.activity.create({
      data: {
        type: 'PRECIO_VENTA_AJUSTADO',
        content: [
          purchasePrice !== undefined
            ? `Precio compra: ${purchasePrice?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) ?? 'borrado'}`
            : null,
          salePrice !== undefined
            ? `Precio venta: ${salePrice?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) ?? 'borrado'}`
            : null,
          marginPercent !== undefined ? `Margen objetivo: ${marginPercent}%` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        agentId: actor.id,
        sellerLeadId,
      },
    }),
  ])

  revalidateVehiclePage(sellerLeadId)
  return { ok: true }
}

export async function updateNaveLocation(
  vehicleId: string,
  formData: unknown
): Promise<ActionResult> {
  await requireAdmin()

  const parsed = naveSchema.safeParse(formData)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos' }
  }

  const sellerLeadId = await getSellerLeadId(vehicleId)
  if (!sellerLeadId) return { ok: false, error: 'Vehículo no encontrado' }

  await db.vehicle.update({
    where: { id: vehicleId },
    data: {
      entryDate: parsed.data.entryDate ? new Date(parsed.data.entryDate) : null,
      naveLocation: parsed.data.naveLocation ?? null,
    },
  })

  revalidateVehiclePage(sellerLeadId)
  return { ok: true }
}
