/**
 * Formateo de importes en euros — determinista entre servidor y cliente.
 *
 * `Intl.NumberFormat(..., { style: 'currency', currency: 'EUR' })` emite un
 * carácter de espacio entre el importe y el símbolo `EUR` que depende de la
 * versión de ICU/CLDR: U+00A0 (espacio duro) en unas builds y U+202F (espacio
 * duro estrecho) en otras. Cuando el servidor (ICU de Node) y el navegador del
 * visitante (ICU de Chrome) no coinciden en ese punto de código, React reporta
 * un error de hidratación aunque el texto se vea idéntico — origen del issue
 * de Sentry CAMPERNOVA-CRM-G (hydration error en la pestaña «Compradores» de la
 * ficha de vendedor).
 *
 * El separador de miles de `es-ES` (`.`) sí es estable entre versiones de ICU,
 * así que formateamos el número con él y controlamos nosotros el separador
 * importe↔símbolo con un espacio duro fijo (U+00A0). El resultado es idéntico
 * byte a byte en servidor y cliente, eliminando la discrepancia.
 */
const NBSP = String.fromCharCode(0xa0)

export function formatEur(value: number): string {
  return `${value.toLocaleString('es-ES', { maximumFractionDigits: 0 })}${NBSP}€`
}
