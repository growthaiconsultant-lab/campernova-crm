import type {
  ChecklistItemCategory,
  ChecklistItemResult,
  VehicleDocumentCategory,
} from '@prisma/client'
import { PUBLICADO_REQUIRED_DOCS, DOC_LABELS } from '../vehicle-legal/requirements'
import { ITV_WARNING_DAYS } from '../vehicle-legal/types'

/**
 * Block 20 — Trust Passport unificado (Trust Layer).
 * Fusiona el expediente legal (Block 4) y el checklist técnico del taller en
 * una única vista de confianza con estados, un score y la elegibilidad para el
 * sello "Verificado por CampersNova". Módulo puro y determinista.
 */

export type CheckState = 'ok' | 'warn' | 'fail' | 'pending'

export type TrustCheck = { label: string; state: CheckState; detail?: string }
export type TrustSection = { key: string; title: string; checks: TrustCheck[] }

export type TrustPassportInput = {
  // Documental / legal
  vin: string | null
  itvValidUntil: Date | null
  chargeCheckedAt: Date | null // cargas DGT verificadas
  titleTransferredAt: Date | null // titularidad / reserva de dominio
  docs: { category: VehicleDocumentCategory; exists: boolean }[]
  // Técnico (último parte de taller)
  hasWorkOrder: boolean
  technicalChecks: { category: ChecklistItemCategory; result: ChecklistItemResult }[]
}

export type TrustPassport = {
  sections: TrustSection[]
  score: number // 0-100
  level: 'VERIFICADO' | 'PARCIAL' | 'INCOMPLETO'
  eligibleForSeal: boolean
  blockers: string[] // qué impide el sello
}

const TECH_CATEGORY_LABELS: Record<ChecklistItemCategory, string> = {
  MECANICA: 'Mecánica',
  CAMPER: 'Instalaciones camper (agua/gas/calefacción)',
  ELECTRICIDAD: 'Electricidad',
}

/** Estado agregado de una categoría técnica a partir de sus ítems de checklist. */
export function aggregateTechnicalCategory(results: ChecklistItemResult[]): CheckState {
  if (results.length === 0) return 'pending'
  if (results.some((r) => r === 'NECESITA_REPARACION')) return 'fail'
  if (results.some((r) => r === 'PENDIENTE')) return 'pending'
  // todo OK o NO_APLICA
  return 'ok'
}

function itvState(itvValidUntil: Date | null, now: Date): TrustCheck {
  if (!itvValidUntil) return { label: 'ITV vigente', state: 'pending', detail: 'Sin fecha de ITV' }
  if (itvValidUntil.getTime() < now.getTime())
    return { label: 'ITV vigente', state: 'fail', detail: 'ITV caducada' }
  const days = Math.ceil((itvValidUntil.getTime() - now.getTime()) / 86_400_000)
  if (days <= ITV_WARNING_DAYS)
    return { label: 'ITV vigente', state: 'warn', detail: `Caduca en ${days} días` }
  return { label: 'ITV vigente', state: 'ok' }
}

const STATE_SCORE: Record<CheckState, number> = { ok: 1, warn: 0.6, pending: 0, fail: 0 }

export function buildTrustPassport(
  input: TrustPassportInput,
  now: Date = new Date()
): TrustPassport {
  // ── Sección documental / legal ──
  const legal: TrustCheck[] = []
  legal.push(itvState(input.itvValidUntil, now))
  legal.push({
    label: 'Cargas DGT verificadas',
    state: input.chargeCheckedAt ? 'ok' : 'pending',
  })
  legal.push({
    label: 'Titularidad / reserva de dominio',
    state: input.titleTransferredAt ? 'ok' : 'pending',
  })
  legal.push({ label: 'Bastidor (VIN)', state: input.vin ? 'ok' : 'pending' })
  for (const cat of PUBLICADO_REQUIRED_DOCS) {
    const exists = input.docs.some((d) => d.category === cat && d.exists)
    legal.push({ label: DOC_LABELS[cat], state: exists ? 'ok' : 'pending' })
  }

  // ── Sección técnica (taller) ──
  const technical: TrustCheck[] = []
  const cats: ChecklistItemCategory[] = ['MECANICA', 'CAMPER', 'ELECTRICIDAD']
  for (const cat of cats) {
    const results = input.technicalChecks.filter((c) => c.category === cat).map((c) => c.result)
    const state = input.hasWorkOrder ? aggregateTechnicalCategory(results) : 'pending'
    technical.push({
      label: TECH_CATEGORY_LABELS[cat],
      state,
      detail: !input.hasWorkOrder ? 'Sin revisión de taller' : undefined,
    })
  }

  const sections: TrustSection[] = [
    { key: 'legal', title: 'Documentación legal', checks: legal },
    { key: 'tecnico', title: 'Estado técnico (taller)', checks: technical },
  ]

  // ── Score ──
  const all = [...legal, ...technical]
  const score = Math.round((all.reduce((s, c) => s + STATE_SCORE[c.state], 0) / all.length) * 100)

  // ── Elegibilidad para el sello ──
  // Requiere: nada en 'fail', ITV no caducada, cargas verificadas, VIN, todos los
  // docs obligatorios, y revisión de taller sin reparaciones pendientes.
  const blockers: string[] = []
  if (all.some((c) => c.state === 'fail'))
    blockers.push('Hay comprobaciones fallidas (revisa fallos)')
  if (!input.chargeCheckedAt) blockers.push('Faltan cargas DGT verificadas')
  if (!input.vin) blockers.push('Falta el bastidor (VIN)')
  if (!input.itvValidUntil || input.itvValidUntil.getTime() < now.getTime())
    blockers.push('ITV no vigente')
  const missingDocs = PUBLICADO_REQUIRED_DOCS.filter(
    (cat) => !input.docs.some((d) => d.category === cat && d.exists)
  )
  if (missingDocs.length > 0)
    blockers.push(`Faltan ${missingDocs.length} documento(s) obligatorio(s)`)
  if (!input.hasWorkOrder) blockers.push('Sin revisión de taller')
  else if (technical.some((c) => c.state === 'pending'))
    blockers.push('Revisión de taller incompleta')

  const eligibleForSeal = blockers.length === 0
  const level: TrustPassport['level'] =
    score >= 90 ? 'VERIFICADO' : score >= 55 ? 'PARCIAL' : 'INCOMPLETO'

  return { sections, score, level, eligibleForSeal, blockers }
}

export const CHECK_STATE_LABELS: Record<CheckState, string> = {
  ok: 'OK',
  warn: 'Aviso',
  fail: 'Falla',
  pending: 'Pendiente',
}

export const CHECK_STATE_COLORS: Record<CheckState, string> = {
  ok: '#1f8a5b',
  warn: '#d97706',
  fail: '#dc2626',
  pending: '#94a3b8',
}
