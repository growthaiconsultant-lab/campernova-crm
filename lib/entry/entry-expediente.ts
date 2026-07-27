/**
 * Expediente mínimo para VALIDAR LA ENTRADA OFICIAL de un vehículo (PR-A2, corrección §7).
 *
 * Política PROPIA de la entrada oficial — NO reutiliza `isReadyForStatus(..., 'TASADO')`. La entrada
 * oficial es la aceptación en custodia de un vehículo que llega físicamente a la nave; su expediente
 * mínimo es la IDENTIFICACIÓN del vehículo, no datos comerciales ni de preparación.
 *
 * IDENTIFICACIÓN = **matrícula O VIN** (bastidor). Basta uno de los dos: `Vehicle.plate` y
 * `Vehicle.vin` son ambos opcionales y un candidato legítimo puede llegar sin matrícula (captación de
 * portales, parte de pago, vehículo aún no matriculado). Exigir solo matrícula bloquearía esas
 * entradas legítimas; se acepta cualquiera de los dos identificadores estructurados. No se exigen los
 * dos ni se añade un campo nuevo.
 *
 * NO exige, por diseño explícito:
 *   - `desiredPrice` (precio que pide el vendedor);
 *   - `salePrice` / `purchasePrice`;
 *   - fotografías;
 *   - tasación / valoración;
 *   - inspección completada;
 *   - descripción pública;
 *   - Trust Passport;
 *   - porcentaje general del expediente;
 *   - requisitos de publicación o de entrega.
 * Esas condiciones pertenecen a fases posteriores (tasación A3, publicación PUB-1) y bloquearlas en la
 * entrada sería incorrecto: un vehículo se acepta físicamente antes de tasarlo, fotografiarlo o
 * publicarlo.
 *
 * El RESTO de precondiciones de entrada (llegada física persistida, comercial responsable, ubicación
 * de parking, llaves custodiadas, contrato de gestión vigente y checklist documental clasificado) se
 * comprueban por separado en `validate.ts`. Esta función es la ÚNICA fuente del «expediente mínimo del
 * vehículo» para la entrada; cubre solo la identificación.
 */

export type OfficialEntryExpedienteInput = {
  /** Matrícula del vehículo (identificador). */
  plate: string | null
  /** VIN / número de bastidor (identificador alternativo si no hay matrícula). */
  vin: string | null
}

export type OfficialEntryExpedienteResult = {
  ok: boolean
  /** Claves de lo que falta (para mensajes de UI / errores). */
  missing: string[]
}

const isPresent = (v: string | null): boolean => v != null && v.trim().length > 0

/** Evalúa el expediente mínimo de entrada oficial y devuelve qué falta (si algo). */
export function evaluateOfficialEntryExpediente(
  input: OfficialEntryExpedienteInput
): OfficialEntryExpedienteResult {
  const missing: string[] = []
  // Identificación mínima: matrícula O VIN. Basta uno.
  if (!isPresent(input.plate) && !isPresent(input.vin)) missing.push('identificacion')
  return { ok: missing.length === 0, missing }
}

/** ¿Cumple el vehículo el expediente mínimo para validar su entrada oficial? */
export function isReadyForOfficialEntry(input: OfficialEntryExpedienteInput): boolean {
  return evaluateOfficialEntryExpediente(input).ok
}
