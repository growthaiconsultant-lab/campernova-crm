import { z } from 'zod'

/**
 * CAP-1 — Captación progresiva. Helpers para campos de NEGOCIO opcionales al crear/editar.
 *
 * Regla: **vacío es válido**; si el usuario aporta un valor, ese valor debe tener formato/dominio
 * válidos. La ausencia real se normaliza a `null` (nunca `''`, `0`, ni placeholders). El `z.input`
 * se mantiene amigable con react-hook-form (string/number | null | undefined); la normalización a
 * `null` ocurre en el `z.output` (transform), no cambia el tipo del formulario.
 */

/** Texto opcional: recorta; vacío/espacios → null. Con tope de longitud (protección de payload). */
export const optionalText = (max = 500) =>
  z
    .string()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .nullable()
    .transform((v) => {
      const t = v?.trim()
      return t && t.length > 0 ? t : null
    })

/** Email opcional: vacío → null; si se informa, debe ser un email válido. */
export const optionalEmail = () =>
  z
    .string()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => {
      const t = v?.trim()
      return t && t.length > 0 ? t : null
    })
    .refine((v) => v === null || z.string().email().safeParse(v).success, {
      message: 'Email no válido',
    })

/**
 * Normaliza un valor de formulario numérico a `number | null`. Vacío/espacios/undefined/NaN → null
 * (nunca 0). Acepta también strings numéricas (los inputs nativos emiten string).
 */
const toNumberOrNull = (v: unknown): number | null => {
  if (v === '' || v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isNaN(n) ? null : n
}

// El campo debe poder OMITIRSE del objeto (clave opcional). En Zod 4, `z.preprocess(...)` NO hace la
// clave opcional (falla con "expected nonoptional" si falta), así que se usa `.optional()` sobre una
// unión y la normalización va en el `.transform`. El `z.input` queda amigable con react-hook-form.
const numericInput = () => z.union([z.number(), z.nan(), z.string(), z.null()]).optional()

/**
 * Entero opcional dentro de un rango. Vacío → null (nunca 0). Si se informa, se valida entero + rango.
 */
export const optionalInt = (
  opts: { min?: number; max?: number; minMsg?: string; maxMsg?: string } = {}
) =>
  numericInput()
    .transform(toNumberOrNull)
    .refine((v) => v === null || Number.isInteger(v), 'Debe ser un número entero')
    .refine(
      (v) => v === null || opts.min === undefined || v >= opts.min,
      opts.minMsg ?? `Mínimo ${opts.min}`
    )
    .refine(
      (v) => v === null || opts.max === undefined || v <= opts.max,
      opts.maxMsg ?? `Máximo ${opts.max}`
    )

/** Número (decimal) opcional y positivo. Vacío → null (nunca 0). Si se informa, debe ser > 0. */
export const optionalPositive = (opts: { max?: number; msg?: string } = {}) =>
  numericInput()
    .transform(toNumberOrNull)
    .refine((v) => v === null || v > 0, opts.msg ?? 'Debe ser mayor que 0')
    .refine((v) => v === null || opts.max === undefined || v <= opts.max, `Máximo ${opts.max}`)
