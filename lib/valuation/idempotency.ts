/**
 * A3 · Binding de la idempotencia oficial a la petición concreta.
 *
 * La `idempotencyKey` sola no basta: dos peticiones distintas (otro vehículo, otro modo AUTO/MANUAL,
 * otro rango/confianza/motivo) NUNCA deben compartir resultado. `officialRequestFingerprint` produce
 * una huella determinista del payload **normalizado** de la tasación oficial; el dominio y el server
 * action comparan `(idempotencyKey → requestFingerprint + vehicleId)`:
 *   · huella + vehículo coinciden  → es el MISMO intento (retry legítimo) → se devuelve el registrado;
 *   · cualquier diferencia         → reutilización incompatible → rechazo de dominio
 *     (`IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST`), sin devolver datos ajenos.
 *
 * Normalización (para que diferencias irrelevantes no cambien la huella y diferencias materiales sí):
 *   · dinero → cadena canónica con 2 decimales;
 *   · strings → `trim`, vacío ⇒ null;
 *   · nulls consistentes; enums canónicos; orden de campos ESTABLE (literal de orden fijo).
 * La huella es **no sensible** (no incluye PII: ni nombres, ni contacto, ni ids de vendedor).
 */
import { createHash } from 'node:crypto'
import type { ValuationConfidence } from '@prisma/client'

/** Versión del protocolo de huella. Súbela si cambia el conjunto de campos canónicos. */
export const OFFICIAL_REQUEST_FINGERPRINT_VERSION = 1

/**
 * Modo relevante para la huella. Para AUTO basta el discriminante (las cifras se derivan del
 * vehículo, no del cliente). `OfficialValuationMode` es asignable a este tipo (estructural).
 */
export type FingerprintMode =
  | { kind: 'AUTO' }
  | {
      kind: 'MANUAL'
      min: number
      recommended: number
      max: number
      confidence: ValuationConfidence
      reason: string
      referenceUsed?: string | null
    }

/** Dinero canónico: 2 decimales fijos (45000 y 45000.00 ⇒ "45000.00"). */
function canonicalMoney(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : 'NaN'
}

/** String canónico: recortado; vacío ⇒ null. */
function canonicalString(s: string | null | undefined): string | null {
  if (s == null) return null
  const trimmed = s.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Huella determinista de una tasación OFICIAL. El orden de las claves del objeto canónico es fijo
 * (JS preserva el orden de inserción de claves string) → `JSON.stringify` es estable.
 */
export function officialRequestFingerprint(input: {
  vehicleId: string
  mode: FingerprintMode
}): string {
  const { vehicleId, mode } = input
  // Para AUTO, el "payload" que identifica la petición es vehículo + purpose + modo: las cifras se
  // derivan del vehículo (no las aporta el cliente). Para MANUAL se incluyen las cifras declaradas.
  const canonical =
    mode.kind === 'AUTO'
      ? {
          v: OFFICIAL_REQUEST_FINGERPRINT_VERSION,
          vehicleId,
          purpose: 'OFICIAL',
          mode: 'AUTO' as const,
        }
      : {
          v: OFFICIAL_REQUEST_FINGERPRINT_VERSION,
          vehicleId,
          purpose: 'OFICIAL',
          mode: 'MANUAL' as const,
          method: 'MANUAL' as const,
          min: canonicalMoney(mode.min),
          recommended: canonicalMoney(mode.recommended),
          max: canonicalMoney(mode.max),
          confidence: mode.confidence,
          reason: canonicalString(mode.reason),
          referenceUsed: canonicalString(mode.referenceUsed ?? null),
        }
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}
