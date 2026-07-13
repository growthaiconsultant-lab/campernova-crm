import { describe, it, expect } from 'vitest'
import { auditLegacyDocuments, buildBackfillPlanItems, type AuditRootRow } from './audit-core'

function root(overrides: Partial<AuditRootRow> = {}): AuditRootRow {
  return {
    id: 'r',
    url: 'docs/v/a.pdf',
    currentVersionId: null,
    versionSequence: 0,
    versionCount: 0,
    currentVersion: null,
    ...overrides,
  }
}

describe('auditLegacyDocuments', () => {
  it('clasifica y agrega vehículos y entregas', async () => {
    const deps = {
      listVehicleRoots: async (): Promise<AuditRootRow[]> => [
        root({ id: 'v1', url: 'docs/v1/a.pdf' }), // VALID_PATH
        root({
          id: 'v2',
          url: 'https://p.supabase.co/storage/v1/object/sign/vehicle-documents/docs/v2/b.pdf?token=t',
        }), // VALID_LEGACY_SIGNED_URL
        root({ id: 'v3', url: 'https://evil.com/x.pdf' }), // EXTERNAL_URL
        root({
          id: 'v4',
          currentVersionId: 'ver',
          versionSequence: 1,
          versionCount: 1,
          url: 'docs/v4/d.pdf',
          currentVersion: {
            id: 'ver',
            version: 1,
            objectPath: 'docs/v4/d.pdf',
            status: 'ACTIVE',
            ownerRootId: 'v4',
          },
        }), // STRUCTURED
      ],
      listDeliveryRoots: async (): Promise<AuditRootRow[]> => [
        root({ id: 'd1', url: 'deliveries/d1/c.pdf' }), // VALID_PATH
      ],
    }

    const { rows, summary } = await auditLegacyDocuments(deps)
    expect(summary.totalVehicleDocuments).toBe(4)
    expect(summary.totalDeliveryDocuments).toBe(1)
    expect(summary.byClassification.VALID_PATH).toBe(2)
    expect(summary.byClassification.VALID_LEGACY_SIGNED_URL).toBe(1)
    expect(summary.byClassification.EXTERNAL_URL).toBe(1)
    expect(summary.byClassification.STRUCTURED).toBe(1)
    expect(summary.migratable).toBe(3)
    expect(summary.alreadyStructured).toBe(1)

    const items = buildBackfillPlanItems(rows)
    expect(items).toHaveLength(3) // solo migrables
    expect(items.every((i) => i.mimeType === null && i.sizeBytes === null)).toBe(true)
    // Los ítems traen el objectPath resuelto (incluida la extracción de la URL firmada).
    expect(items.map((i) => i.objectPath).sort()).toEqual([
      'deliveries/d1/c.pdf',
      'docs/v1/a.pdf',
      'docs/v2/b.pdf',
    ])
    // Reversibilidad: VALID_PATH conserva la url legacy (= objectPath); la URL firmada legacy no
    // se conserva (legacyUrl null → rollback bloqueado).
    const byPath = new Map(items.map((i) => [i.objectPath, i]))
    expect(byPath.get('docs/v1/a.pdf')!.legacyUrl).toBe('docs/v1/a.pdf') // VALID_PATH
    expect(byPath.get('deliveries/d1/c.pdf')!.legacyUrl).toBe('deliveries/d1/c.pdf') // VALID_PATH
    expect(byPath.get('docs/v2/b.pdf')!.legacyUrl).toBeNull() // VALID_LEGACY_SIGNED_URL
  })
})
