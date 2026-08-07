import { describe, expect, it } from 'vitest'
import { technicalQuestionnaireSelect } from './load'

describe('loader técnico de recepción', () => {
  it('no selecciona PII ni condiciones comerciales para Taller', () => {
    const selected = technicalQuestionnaireSelect as Record<string, unknown>
    for (const forbidden of [
      'receptionDate',
      'previousOwners',
      'maintenanceHistoryAvailable',
      'saleReason',
      'commercialReviewedAt',
      'commercialReviewedById',
      'completedById',
    ]) {
      expect(selected).not.toHaveProperty(forbidden)
    }
  })
})
