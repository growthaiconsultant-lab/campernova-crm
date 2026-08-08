export type PersistedMatchVisibilityInput = {
  generatedBy: string
  manualLinkedAt: Date | null
}

/**
 * La elegibilidad gobierna las sugerencias automáticas, no el historial decidido por una persona.
 * También conserva los matches manuales legacy que aún no tienen metadata REL-1.
 */
export function shouldShowPersistedMatch(
  match: PersistedMatchVisibilityInput,
  automaticEligible: boolean
): boolean {
  return automaticEligible || match.manualLinkedAt !== null || match.generatedBy === 'manual'
}
