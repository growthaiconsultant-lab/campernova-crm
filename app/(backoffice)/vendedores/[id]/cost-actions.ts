'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { admittedVehicleWhere } from '@/lib/seller-intake'
import { revalidatePublicCatalog } from '@/lib/revalidate-public-catalog'
import { formatEur } from '@/lib/format/currency'

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

const publicAmountSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(',', '.'))
  .pipe(
    z
      .string()
      .regex(/^\d{1,8}(?:\.\d{1,2})?$/)
      .refine((value) => Number(value) > 0)
  )

const updateEconomicsSchema = z.object({
  monthlyPaymentFrom: publicAmountSchema.nullable().optional(),
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
    select: {
      workOrderId: true,
      postventaTicketId: true,
      vehicle: { select: { sellerLeadId: true } },
    },
  })
  if (!cost) return { ok: false, error: 'Coste no encontrado' }
  if (cost.workOrderId || cost.postventaTicketId) {
    return {
      ok: false,
      error: 'Este coste lo genera la operativa. Corrige y finaliza de nuevo su orden o ticket.',
    }
  }

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
    select: {
      workOrderId: true,
      postventaTicketId: true,
      vehicle: { select: { sellerLeadId: true } },
    },
  })
  if (!cost) return { ok: false, error: 'Coste no encontrado' }
  if (cost.workOrderId || cost.postventaTicketId) {
    return {
      ok: false,
      error: 'Este coste lo genera la operativa y no se puede eliminar manualmente.',
    }
  }

  await db.vehicleCost.delete({ where: { id: costId } })
  revalidateVehiclePage(cost.vehicle.sellerLeadId)
  return { ok: true }
}

export async function setMissingSalePrice(
  vehicleId: string,
  input: unknown
): Promise<ActionResult> {
  const actor = await requireAdmin()
  if (typeof vehicleId !== 'string' || !vehicleId.trim())
    return { ok: false, error: 'Vehículo no válido.' }
  const parsed = publicAmountSchema.safeParse(input)
  if (!parsed.success)
    return {
      ok: false,
      error:
        'Introduce un precio positivo, con hasta dos decimales y un máximo de 99.999.999,99 €.',
    }
  const price = parsed.data
  const target = { id: vehicleId, ...admittedVehicleWhere }
  const result = await db.$transaction(async (tx) => {
    const [changed] = await tx.vehicle.updateManyAndReturn({
      where: { ...target, salePrice: null },
      data: { salePrice: price },
      select: { sellerLeadId: true, status: true },
    })
    if (!changed) {
      const current = await tx.vehicle.findFirst({
        where: target,
        select: { sellerLeadId: true, status: true, salePrice: true },
      })
      if (!current) return { error: 'Este vehículo ya no está en el inventario.' }
      if (!current.salePrice?.equals(price))
        return {
          error: 'Este vehículo ya tiene otro precio de venta. Actualiza el listado para verlo.',
        }
      return current
    }
    await tx.activity.create({
      data: {
        type: 'PRECIO_VENTA_AJUSTADO',
        content: 'Precio venta: ' + formatEur(Number(price), 'cents'),
        agentId: actor.id,
        sellerLeadId: changed.sellerLeadId,
      },
    })
    return changed
  })
  if ('error' in result) return { ok: false, error: result.error }
  revalidateVehiclePage(result.sellerLeadId)
  revalidatePath('/vehiculos')
  if (result.status === 'PUBLICADO') revalidatePublicCatalog()
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

  if (!Object.values(parsed.data).some((value) => value !== undefined)) return { ok: true }

  const sellerLeadId = await getSellerLeadId(vehicleId)
  if (!sellerLeadId) return { ok: false, error: 'Vehículo no encontrado' }

  const { purchasePrice, salePrice, monthlyPaymentFrom, marginPercent } = parsed.data

  await db.$transaction([
    db.vehicle.update({
      where: { id: vehicleId },
      data: {
        ...(purchasePrice !== undefined ? { purchasePrice } : {}),
        ...(salePrice !== undefined ? { salePrice } : {}),
        ...(monthlyPaymentFrom !== undefined ? { monthlyPaymentFrom } : {}),
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
          monthlyPaymentFrom !== undefined
            ? 'Cuota mensual desde: ' +
              (monthlyPaymentFrom === null
                ? 'retirada'
                : formatEur(Number(monthlyPaymentFrom), 'cents') + '/mes')
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

  if (salePrice !== undefined || monthlyPaymentFrom !== undefined) {
    revalidatePublicCatalog()
    revalidatePath('/vehiculos')
  }
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
