/**
 * Expediente mínimo para VALIDAR LA ENTRADA OFICIAL de un vehículo (PR-A2, corrección §7).
 *
 * Política PROPIA de la entrada oficial — NO reutiliza `isReadyForStatus(..., 'TASADO')`. La entrada
 * oficial es la aceptación en custodia de un vehículo que llega físicamente a la nave; su expediente
 * mínimo es la IDENTIFICACIÓN del vehículo (matrícula), no datos comerciales ni de preparación.
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
  /** Matrícula del vehículo. Identificación mínima para aceptarlo en custodia. */
  plate: string | null
}

export type OfficialEntryExpedienteResult = {
  ok: boolean
  /** Claves de lo que falta (para mensajes de UI / errores). */
  missing: string[]
}

/** Evalúa el expediente mínimo de entrada oficial y devuelve qué falta (si algo). */
export function evaluateOfficialEntryExpediente(
  input: OfficialEntryExpedienteInput
): OfficialEntryExpedienteResult {
  const missing: string[] = []
  if (input.plate == null || input.plate.trim().length === 0) missing.push('plate')
  return { ok: missing.length === 0, missing }
}

/** ¿Cumple el vehículo el expediente mínimo para validar su entrada oficial? */
export function isReadyForOfficialEntry(input: OfficialEntryExpedienteInput): boolean {
  return evaluateOfficialEntryExpediente(input).ok
}
