import type { Prisma } from '@prisma/client'

/**
 * PR4 — Conversión atómica de captaciones y trade-ins (núcleo transaccional).
 *
 * Corrige NEG-03: antes, `sellerLead.create` (con vehículo + actividad anidados) se
 * ejecutaba FUERA de transacción y solo después una transacción separada marcaba/vinculaba
 * la fuente (captación o comprador). Un fallo intermedio dejaba vendedores/vehículos
 * huérfanos, y dos conversiones concurrentes creaban dos vendedores (la segunda escritura
 * de enlace pisaba a la primera).
 *
 * Aquí toda la conversión vive en la MISMA transacción y la exclusión se decide con una
 * escritura condicional (compare-and-swap) sobre el campo de enlace ÚNICO de la fuente:
 *  - captación: `VehicleCapture.sellerLeadId @unique` (se reclama antes de crear nada);
 *  - trade-in:  `BuyerLead.tradeInSellerLeadId @unique` (se vincula tras crear, en la misma tx).
 * Si el CAS afecta 0 filas, otra ejecución ganó la carrera → `ConversionConflictError` y la
 * transacción revierte por completo (sin vendedor/vehículo/actividad parciales).
 */

export type ConversionConflictReason = 'capture' | 'tradein'

export const CONVERSION_CONFLICT_MESSAGES: Record<ConversionConflictReason, string> = {
  capture: 'La captación ya ha sido convertida o su estado ha cambiado.',
  tradein: 'El vehículo entregado como parte de pago ya ha sido procesado.',
}

/** Conflicto de negocio esperado por concurrencia / doble ejecución (NO un error técnico). */
export class ConversionConflictError extends Error {
  readonly reason: ConversionConflictReason
  constructor(
    reason: ConversionConflictReason,
    message: string = CONVERSION_CONFLICT_MESSAGES[reason]
  ) {
    super(message)
    this.name = 'ConversionConflictError'
    this.reason = reason
  }
}

/** Semillas de test para forzar carrera o fallo determinista (sin efecto en producción). */
export type ConversionHooks = {
  beforeCaptureClaim?: () => Promise<void>
  beforeSellerWrite?: () => Promise<void>
  beforeLinkWrite?: () => Promise<void>
}

export type ConvertCaptureParams = {
  captureId: string
  /** `data` completo para crear el vendedor (con vehículo + actividad de origen anidados). */
  sellerData: Prisma.SellerLeadUncheckedCreateInput
  /** Prefijo de la nota de enlace; se le añade " Ficha: /vendedores/<id>". */
  linkingNotePrefix: string
}

/**
 * Convierte una captación en lead de vendedor de forma ATÓMICA dentro de `tx`.
 * Debe invocarse dentro de `db.$transaction(...)`. Reclama la captación con un CAS ANTES
 * de crear nada (evita que un perdedor concurrente cree un vendedor huérfano). Lanza
 * `ConversionConflictError('capture')` si pierde el CAS → la transacción revierte.
 *
 * Orden: 1) CAS reclama la captación → 2) crea vendedor+vehículo(+actividad de origen) →
 * 3) vincula `sellerLeadId` en la captación → 4) actividad de enlace.
 */
export async function convertCaptureTx(
  tx: Prisma.TransactionClient,
  p: ConvertCaptureParams,
  hooks: ConversionHooks = {}
): Promise<{ sellerLeadId: string; vehicleId: string }> {
  await hooks.beforeCaptureClaim?.()

  // 1) CAS: reclama la captación aún sin vincular (solo si sigue sin vendedor). count 0 →
  //    ya fue convertida o hay una conversión concurrente en curso → conflicto.
  const claim = await tx.vehicleCapture.updateMany({
    where: { id: p.captureId, sellerLeadId: null },
    data: { status: 'CONVERTIDO' },
  })
  if (claim.count === 0) throw new ConversionConflictError('capture')

  // 2) Crea el vendedor + vehículo + actividad de origen (anidados, mismo tx).
  await hooks.beforeSellerWrite?.()
  const seller = await tx.sellerLead.create({ data: p.sellerData, include: { vehicle: true } })

  // 3) Vincula la captación con el vendedor recién creado.
  await hooks.beforeLinkWrite?.()
  await tx.vehicleCapture.update({
    where: { id: p.captureId },
    data: { sellerLeadId: seller.id },
  })

  // 4) Traza de enlace en el timeline del vendedor.
  await tx.activity.create({
    data: {
      type: 'NOTA',
      content: `${p.linkingNotePrefix} Ficha: /vendedores/${seller.id}`,
      sellerLeadId: seller.id,
    },
  })

  return { sellerLeadId: seller.id, vehicleId: seller.vehicle!.id }
}

export type ConvertTradeInParams = {
  buyerLeadId: string
  /** `data` completo para crear el vendedor (con vehículo + actividad de origen anidados). */
  sellerData: Prisma.SellerLeadUncheckedCreateInput
  /** Prefijo de la nota de enlace; se le añade " Ficha: /vendedores/<id>". */
  linkingNotePrefix: string
}

/**
 * Convierte el vehículo de parte de pago de un comprador en lead de vendedor, de forma
 * ATÓMICA dentro de `tx`. A diferencia de la captación, la fuente (BuyerLead) no tiene un
 * estado intermedio: el propio campo de enlace único `tradeInSellerLeadId` es el testigo,
 * y exige que el vendedor exista para vincularlo. Por eso se crea el vendedor y a
 * continuación se hace el CAS-vínculo (`tradeInSellerLeadId: null` → id); si el CAS pierde
 * (`count 0`), la transacción revierte y deshace la creación del vendedor → sin huérfanos.
 *
 * Orden: 1) crea vendedor+vehículo(+actividad de origen) → 2) CAS-vincula el comprador →
 * 3) actividad de enlace.
 */
export async function convertTradeInTx(
  tx: Prisma.TransactionClient,
  p: ConvertTradeInParams,
  hooks: ConversionHooks = {}
): Promise<{ sellerLeadId: string; vehicleId: string }> {
  // 1) Crea el vendedor + vehículo + actividad de origen (anidados, mismo tx).
  await hooks.beforeSellerWrite?.()
  const seller = await tx.sellerLead.create({ data: p.sellerData, include: { vehicle: true } })

  // 2) CAS-vínculo: enlaza el trade-in del comprador solo si aún no tenía uno. count 0 →
  //    ya procesado o carrera concurrente → conflicto → revierte (deshace el vendedor).
  await hooks.beforeLinkWrite?.()
  const claim = await tx.buyerLead.updateMany({
    where: { id: p.buyerLeadId, tradeInSellerLeadId: null },
    data: { tradeInSellerLeadId: seller.id },
  })
  if (claim.count === 0) throw new ConversionConflictError('tradein')

  // 3) Traza de enlace en el timeline del comprador.
  await tx.activity.create({
    data: {
      type: 'NOTA',
      content: `${p.linkingNotePrefix} Ficha: /vendedores/${seller.id}`,
      buyerLeadId: p.buyerLeadId,
    },
  })

  return { sellerLeadId: seller.id, vehicleId: seller.vehicle!.id }
}
