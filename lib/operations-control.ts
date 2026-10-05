/** Interruptor de contingencia server-side: mantiene lectores compatibles sin nuevos writes. */
export function operationalWritesPaused() {
  return process.env.OPS1_PAUSE_WRITES === 'true'
}
export const OPS1_PAUSED_MESSAGE =
  'Las escrituras operativas están temporalmente pausadas. Puedes consultar los datos existentes.'
