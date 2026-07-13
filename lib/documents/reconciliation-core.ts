/**
 * PR5B3 — Núcleo de reconciliación de buckets/políticas (PURO, GENERA PLAN, no aplica nada).
 *
 * Compara la configuración ESPERADA (la de la migración de PR5B2) con la configuración REAL de un
 * entorno y clasifica acciones. NUNCA produce comandos destructivos automáticos ni elimina
 * `lead-documents`: solo lo marca para deprecación/revisión. La aplicación real es manual y queda
 * fuera de PR5B3.
 */

export const EXPECTED_BUCKETS = {
  'vehicle-documents': {
    public: false,
    fileSizeLimit: 10485760,
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ] as string[],
  },
  'vehicle-photos': {
    public: true,
    fileSizeLimit: 2097152,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] as string[],
  },
} as const

export type ActualBucket = {
  id: string
  public: boolean
  fileSizeLimit: number | null
  allowedMimeTypes: string[] | null
}

export type ReconciliationAction =
  | 'CREATE_BUCKET'
  | 'UPDATE_BUCKET_CONFIG'
  | 'DEPRECATE_BUCKET'
  | 'MANUAL_REVIEW'

export type ReconciliationItem = {
  bucketId: string
  action: ReconciliationAction
  differences: string[]
}

function sameMimeSet(a: string[] | null, b: string[]): boolean {
  if (!a) return false
  const sa = new Set(a)
  const sb = new Set(b)
  if (sa.size !== sb.size) return false
  return b.every((x) => sa.has(x))
}

/**
 * Genera el plan de reconciliación (lista de acciones). No aplica cambios. Determinista.
 */
export function planBucketReconciliation(actual: ActualBucket[]): ReconciliationItem[] {
  const actualById = new Map(actual.map((b) => [b.id, b]))
  const items: ReconciliationItem[] = []

  for (const [bucketId, expected] of Object.entries(EXPECTED_BUCKETS)) {
    const real = actualById.get(bucketId)
    if (!real) {
      items.push({ bucketId, action: 'CREATE_BUCKET', differences: ['el bucket no existe'] })
      continue
    }
    const diffs: string[] = []
    if (real.public !== expected.public)
      diffs.push(`public: real=${real.public} esperado=${expected.public}`)
    if (real.fileSizeLimit !== expected.fileSizeLimit) {
      diffs.push(`file_size_limit: real=${real.fileSizeLimit} esperado=${expected.fileSizeLimit}`)
    }
    if (!sameMimeSet(real.allowedMimeTypes, expected.allowedMimeTypes)) {
      diffs.push('allowed_mime_types difiere del esperado')
    }
    if (diffs.length > 0)
      items.push({ bucketId, action: 'UPDATE_BUCKET_CONFIG', differences: diffs })
  }

  // lead-documents: si existe, marcar para DEPRECACIÓN (nunca eliminar automáticamente).
  if (actualById.has('lead-documents')) {
    items.push({
      bucketId: 'lead-documents',
      action: 'DEPRECATE_BUCKET',
      differences: ['bucket legacy presente; revisión/migración manual (no se elimina aquí)'],
    })
  }

  // Buckets inesperados → revisión manual (no destructivo).
  for (const b of actual) {
    if (!(b.id in EXPECTED_BUCKETS) && b.id !== 'lead-documents') {
      items.push({
        bucketId: b.id,
        action: 'MANUAL_REVIEW',
        differences: ['bucket no contemplado por la configuración esperada'],
      })
    }
  }

  return items.sort((a, b) => a.bucketId.localeCompare(b.bucketId))
}
