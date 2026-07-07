import type { CapturePortal, CaptureStatus } from '@prisma/client'
import { normalizePhone, phonesMatch } from './phone'

/**
 * Captación de vehículos de portales (fase 0 del vendedor).
 * Módulo puro: labels, opciones, estados y detección de duplicados.
 */

export const PORTAL_LABELS: Record<CapturePortal, string> = {
  COCHES_NET: 'Coches.net',
  WALLAPOP: 'Wallapop',
  MILANUNCIOS: 'Milanuncios',
  OTRO: 'Otro',
}

export const PORTAL_OPTIONS = (Object.entries(PORTAL_LABELS) as [CapturePortal, string][]).map(
  ([value, label]) => ({ value, label })
)

export const CAPTURE_STATUS_LABELS: Record<CaptureStatus, string> = {
  NO_CONTACTADO: 'No contactado',
  CONTACTADO: 'Contactado',
  EN_CURSO: 'En curso',
  ENTRADA_AGENDADA: 'Entrada agendada',
  CONVERTIDO: 'Convertido',
  RECHAZADO: 'Rechazado',
}

/** Colores por estado para el tablero (dot + acento). */
export const CAPTURE_STATUS_COLORS: Record<CaptureStatus, string> = {
  NO_CONTACTADO: '#94a3b8',
  CONTACTADO: '#2563eb',
  EN_CURSO: '#d97706',
  ENTRADA_AGENDADA: '#0891b2',
  CONVERTIDO: '#1f8a5b',
  RECHAZADO: '#dc2626',
}

/** Columnas del tablero, en orden de flujo. RECHAZADO va aparte (no es columna). */
export const CAPTURE_BOARD_COLUMNS: CaptureStatus[] = [
  'NO_CONTACTADO',
  'CONTACTADO',
  'EN_CURSO',
  'ENTRADA_AGENDADA',
  'CONVERTIDO',
]

export function isValidPortal(v: string): v is CapturePortal {
  return v in PORTAL_LABELS
}
export function isValidCaptureStatus(v: string): v is CaptureStatus {
  return v in CAPTURE_STATUS_LABELS
}

/** Estados en los que aún tiene sentido tocar la captación (no terminales de éxito). */
export function isTerminalCaptureStatus(s: CaptureStatus): boolean {
  return s === 'CONVERTIDO' || s === 'RECHAZADO'
}

/**
 * F3: parte el título libre del anuncio en marca / modelo para prellenar el
 * Vehicle. Heurística simple: primera palabra = marca, resto = modelo. El
 * comercial lo ajusta en la ficha. Si no hay título, deja placeholders editables.
 */
export function splitCaptureTitle(title: string | null | undefined): {
  brand: string
  model: string
} {
  const clean = (title ?? '').trim().replace(/\s+/g, ' ')
  if (!clean) return { brand: 'Por determinar', model: 'Por determinar' }
  const parts = clean.split(' ')
  if (parts.length === 1) return { brand: parts[0], model: 'Por determinar' }
  return { brand: parts[0], model: parts.slice(1).join(' ') }
}

export type CaptureRow = { id: string; phone: string; status: CaptureStatus }

/**
 * Detecta una captación existente con el mismo teléfono (normalizado) que siga
 * viva (no rechazada ni convertida). Evita que dos comerciales persigan el mismo.
 */
export function findDuplicateCaptureByPhone(phone: string, rows: CaptureRow[]): CaptureRow | null {
  if (normalizePhone(phone).length === 0) return null
  return rows.find((r) => !isTerminalCaptureStatus(r.status) && phonesMatch(r.phone, phone)) ?? null
}
