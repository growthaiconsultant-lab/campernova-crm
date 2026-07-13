import { describe, it, expect } from 'vitest'
import {
  planBucketReconciliation,
  EXPECTED_BUCKETS,
  type ActualBucket,
} from './reconciliation-core'

const matching: ActualBucket[] = [
  {
    id: 'vehicle-documents',
    public: false,
    fileSizeLimit: 10485760,
    allowedMimeTypes: [...EXPECTED_BUCKETS['vehicle-documents'].allowedMimeTypes],
  },
  {
    id: 'vehicle-photos',
    public: true,
    fileSizeLimit: 2097152,
    allowedMimeTypes: [...EXPECTED_BUCKETS['vehicle-photos'].allowedMimeTypes],
  },
]

describe('planBucketReconciliation', () => {
  it('sin drift → sin acciones', () => {
    expect(planBucketReconciliation(matching)).toEqual([])
  })

  it('detecta bucket inexistente → CREATE_BUCKET', () => {
    const plan = planBucketReconciliation([matching[1]]) // falta vehicle-documents
    expect(plan.find((p) => p.bucketId === 'vehicle-documents')?.action).toBe('CREATE_BUCKET')
  })

  it('detecta public/límite/MIME incorrectos → UPDATE_BUCKET_CONFIG', () => {
    const drift: ActualBucket[] = [
      { ...matching[0], public: true, fileSizeLimit: 999, allowedMimeTypes: ['text/html'] },
      matching[1],
    ]
    const item = planBucketReconciliation(drift).find((p) => p.bucketId === 'vehicle-documents')
    expect(item?.action).toBe('UPDATE_BUCKET_CONFIG')
    expect(item?.differences.length).toBeGreaterThanOrEqual(3)
  })

  it('marca lead-documents para DEPRECATE_BUCKET (nunca lo elimina)', () => {
    const withLead: ActualBucket[] = [
      ...matching,
      { id: 'lead-documents', public: false, fileSizeLimit: 10485760, allowedMimeTypes: [] },
    ]
    const item = planBucketReconciliation(withLead).find((p) => p.bucketId === 'lead-documents')
    expect(item?.action).toBe('DEPRECATE_BUCKET')
    // Nunca genera una acción de borrado.
    expect(planBucketReconciliation(withLead).some((p) => /DELETE|DROP/.test(p.action))).toBe(false)
  })

  it('bucket inesperado → MANUAL_REVIEW', () => {
    const extra: ActualBucket[] = [
      ...matching,
      { id: 'mystery', public: true, fileSizeLimit: null, allowedMimeTypes: null },
    ]
    expect(planBucketReconciliation(extra).find((p) => p.bucketId === 'mystery')?.action).toBe(
      'MANUAL_REVIEW'
    )
  })

  it('nunca aplica cambios (función pura, solo devuelve el plan)', () => {
    const before = JSON.stringify(matching)
    planBucketReconciliation(matching)
    expect(JSON.stringify(matching)).toBe(before)
  })
})
