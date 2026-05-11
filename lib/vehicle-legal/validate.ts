import type { VehicleDocumentCategory } from '@prisma/client'
import type { VehicleLegalInput, DocumentSummary, MissingRequirement, TargetStatus } from './types'
import { ITV_WARNING_DAYS } from './types'
import {
  TASADO_MIN_PHOTOS,
  PUBLICADO_REQUIRED_DOCS,
  PUBLICADO_MIN_PHOTOS,
  DOC_LABELS,
} from './requirements'

// ── Helpers ──────────────────────────────────────────────────────────────────

function hasValue(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim().length > 0
  return true
}

function itvDaysRemaining(itvValidUntil: Date, now: Date): number {
  return Math.floor((itvValidUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function docExists(docs: DocumentSummary[], category: VehicleDocumentCategory): boolean {
  return docs.some((d) => d.category === category && d.exists)
}

// ── Core functions ────────────────────────────────────────────────────────────

export function listMissingRequirements(
  vehicle: VehicleLegalInput,
  targetStatus: TargetStatus,
  docs: DocumentSummary[],
  now: Date = new Date()
): MissingRequirement[] {
  const missing: MissingRequirement[] = []

  if (targetStatus === 'TASADO') {
    // plate
    if (!hasValue(vehicle.plate)) {
      missing.push({
        field: 'plate',
        message: 'Matrícula obligatoria para tasar',
        severity: 'error',
      })
    }
    // desiredPrice
    if (!hasValue(vehicle.desiredPrice)) {
      missing.push({
        field: 'desiredPrice',
        message: 'Precio deseado del vendedor obligatorio para tasar',
        severity: 'error',
      })
    }
    // photos
    if (vehicle.photoCount < TASADO_MIN_PHOTOS) {
      missing.push({
        field: 'photos',
        message: `Al menos ${TASADO_MIN_PHOTOS} foto del vehículo`,
        severity: 'error',
      })
    }
  } else {
    // PUBLICADO — all TASADO checks plus more

    if (!hasValue(vehicle.plate)) {
      missing.push({ field: 'plate', message: 'Matrícula', severity: 'error' })
    }
    if (!hasValue(vehicle.vin)) {
      missing.push({ field: 'vin', message: 'VIN / número de bastidor', severity: 'error' })
    }
    if (!hasValue(vehicle.desiredPrice)) {
      missing.push({
        field: 'desiredPrice',
        message: 'Precio deseado del vendedor',
        severity: 'error',
      })
    }
    if (!hasValue(vehicle.purchasePrice)) {
      missing.push({
        field: 'purchasePrice',
        message: 'Precio de compra a Campers Nova',
        severity: 'error',
      })
    }
    if (!hasValue(vehicle.salePrice)) {
      missing.push({ field: 'salePrice', message: 'Precio de venta al público', severity: 'error' })
    }

    // ITV
    if (!vehicle.itvValidUntil) {
      missing.push({
        field: 'itvValidUntil',
        message: 'Fecha de caducidad de la ITV',
        severity: 'error',
      })
    } else {
      const daysLeft = itvDaysRemaining(vehicle.itvValidUntil, now)
      if (daysLeft < 0) {
        missing.push({
          field: 'itvValidUntil',
          message: `ITV vencida hace ${Math.abs(daysLeft)} días (renovar antes de publicar)`,
          severity: 'error',
        })
      } else if (daysLeft < ITV_WARNING_DAYS) {
        missing.push({
          field: 'itvValidUntil',
          message: `ITV vence en ${daysLeft} días (renovar antes de publicar)`,
          severity: 'warning',
        })
      }
    }

    // chargeCheckedAt
    if (!vehicle.chargeCheckedAt) {
      missing.push({
        field: 'chargeCheckedAt',
        message: 'Cargas DGT no verificadas',
        severity: 'error',
      })
    }

    // required documents
    for (const cat of PUBLICADO_REQUIRED_DOCS) {
      if (!docExists(docs, cat)) {
        missing.push({
          field: `doc_${cat}`,
          message: `Documento: ${DOC_LABELS[cat]}`,
          severity: 'error',
        })
      }
    }

    // photos
    if (vehicle.photoCount < PUBLICADO_MIN_PHOTOS) {
      missing.push({
        field: 'photos',
        message: `Pack visual incompleto (${vehicle.photoCount} de ${PUBLICADO_MIN_PHOTOS} fotos)`,
        severity: 'error',
      })
    }

    // active work orders
    if (vehicle.workOrdersBlockingCount > 0) {
      missing.push({
        field: 'workOrders',
        message: `Hay ${vehicle.workOrdersBlockingCount} orden${vehicle.workOrdersBlockingCount > 1 ? 'es' : ''} de taller sin completar`,
        severity: 'error',
      })
    }
  }

  return missing
}

export function isReadyForStatus(
  vehicle: VehicleLegalInput,
  targetStatus: TargetStatus,
  docs: DocumentSummary[],
  now: Date = new Date()
): boolean {
  const missing = listMissingRequirements(vehicle, targetStatus, docs, now)
  return missing.filter((r) => r.severity === 'error').length === 0
}

// ── Completion percent ────────────────────────────────────────────────────────

export function calculateCompletionPercent(
  vehicle: VehicleLegalInput,
  docs: DocumentSummary[]
): number {
  // Fields: plate, vin, itvValidUntil, chargeCheckedAt, purchasePrice, salePrice, desiredPrice = 7
  // Docs: 7 required
  // Photos: 1 point (has ≥5)
  // Total: 15 points

  let earned = 0
  const fields: (keyof VehicleLegalInput)[] = [
    'plate',
    'vin',
    'itvValidUntil',
    'chargeCheckedAt',
    'purchasePrice',
    'salePrice',
    'desiredPrice',
  ]
  for (const f of fields) {
    if (hasValue(vehicle[f])) earned++
  }
  for (const cat of PUBLICADO_REQUIRED_DOCS) {
    if (docExists(docs, cat)) earned++
  }
  if (vehicle.photoCount >= PUBLICADO_MIN_PHOTOS) earned++

  const total = fields.length + PUBLICADO_REQUIRED_DOCS.length + 1
  return Math.round((earned / total) * 100)
}
