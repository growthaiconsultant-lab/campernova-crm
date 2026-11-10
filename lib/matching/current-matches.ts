import { assessPair } from './assessment'
import { explainAssessment } from './explain'
import type { MatchingBuyerInput, MatchingVehicleInput } from './types'

// An older suggestion can still be in the database until either ficha is edited.
export async function currentMatches<
  T extends { id: string; status: string; generatedBy: string; score: number },
>(
  matches: T[],
  inputs: (row: T) => Promise<readonly [MatchingVehicleInput | null, MatchingBuyerInput | null]>
) {
  const evaluated = await Promise.all(
    matches.map(async (row) => {
      const [vehicle, buyer] = await inputs(row)
      if (!vehicle || !buyer) return null
      const assessment = assessPair(vehicle, buyer)
      if (
        row.status === 'SUGERIDO' &&
        row.generatedBy === 'auto' &&
        (assessment.state !== 'apto' || (!assessment.wanted.length && !assessment.met.length))
      )
        return null
      return {
        ...row,
        score: assessment.state === 'apto' ? assessment.score : 0,
        fit:
          assessment.met.length ||
          assessment.missing.length ||
          assessment.failed.length ||
          assessment.wanted.length
            ? assessment.state
            : null,
        explanation: explainAssessment(assessment),
      }
    })
  )
  return evaluated.filter((row) => row !== null).sort((a, b) => b.score - a.score)
}
