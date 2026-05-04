import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildZipFilename } from './download-photos'

// Unit tests for the pure helper — ZIP generation is covered separately (integration)
describe('buildZipFilename', () => {
  it('produces a slug with brand, model and year', () => {
    const name = buildZipFilename({
      brand: 'Adria',
      model: 'Matrix 650',
      year: 2019,
      id: 'abc123xyz',
    })
    expect(name).toBe('adria-matrix-650-2019-abc123.zip')
  })

  it('replaces special characters and spaces with hyphens', () => {
    const name = buildZipFilename({
      brand: 'Mc Louis',
      model: 'MC4 590',
      year: 2021,
      id: 'zzz111aaa',
    })
    expect(name).toBe('mc-louis-mc4-590-2021-zzz111.zip')
  })

  it('strips leading and trailing hyphens from the slug', () => {
    const name = buildZipFilename({ brand: 'Hymer', model: 'B-Class', year: 2018, id: 'qqqqqq' })
    expect(name).not.toMatch(/^-/)
    expect(name).not.toMatch(/-\.zip$/)
  })

  it('uses first 6 chars of id', () => {
    const name = buildZipFilename({ brand: 'Sunlight', model: 'T68', year: 2022, id: 'ABCDEFGHIJ' })
    expect(name).toContain('-abcdef.zip')
  })
})

// downloadVehiclePhotosZip integration test with mocks
describe('downloadVehiclePhotosZip', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.resetAllMocks()
  })

  it('builds a zip with photos in correct order', async () => {
    const mockPhotos = [
      {
        id: 'p1',
        vehicleId: 'v1',
        url: 'https://example.com/a.jpg',
        order: 0,
        altText: null,
        createdAt: new Date(),
      },
      {
        id: 'p2',
        vehicleId: 'v1',
        url: 'https://example.com/b.png',
        order: 1,
        altText: null,
        createdAt: new Date(),
      },
      {
        id: 'p3',
        vehicleId: 'v1',
        url: 'https://example.com/c.jpg',
        order: 2,
        altText: null,
        createdAt: new Date(),
      },
    ]
    const mockVehicle = { id: 'v1', brand: 'Adria', model: 'Matrix', year: 2020 }

    vi.doMock('@/lib/db', () => ({
      db: {
        vehiclePhoto: {
          findMany: vi.fn().mockResolvedValue(mockPhotos),
        },
        vehicle: {
          findUnique: vi.fn().mockResolvedValue(mockVehicle),
        },
      },
    }))

    // Mock fetch for photo downloads
    const fakeArrayBuffer = new ArrayBuffer(8)
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(fakeArrayBuffer),
    } as unknown as Response)

    const { downloadVehiclePhotosZip } = await import('./download-photos')
    const JSZip = (await import('jszip')).default

    const buffer = await downloadVehiclePhotosZip('v1')
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)

    // Verify the zip contains exactly 3 files
    const zip = await JSZip.loadAsync(buffer)
    const files = Object.keys(zip.files)
    expect(files).toHaveLength(3)
    expect(files).toContain('01-foto.jpg')
    expect(files).toContain('02-foto.png')
    expect(files).toContain('03-foto.jpg')
  })

  it('throws when vehicle is not found', async () => {
    vi.doMock('@/lib/db', () => ({
      db: {
        vehiclePhoto: { findMany: vi.fn().mockResolvedValue([]) },
        vehicle: { findUnique: vi.fn().mockResolvedValue(null) },
      },
    }))

    const { downloadVehiclePhotosZip } = await import('./download-photos')
    await expect(downloadVehiclePhotosZip('nonexistent')).rejects.toThrow('Vehicle not found')
  })

  it('skips photos with failed fetch', async () => {
    const mockPhotos = [
      {
        id: 'p1',
        vehicleId: 'v1',
        url: 'https://example.com/ok.jpg',
        order: 0,
        altText: null,
        createdAt: new Date(),
      },
      {
        id: 'p2',
        vehicleId: 'v1',
        url: 'https://example.com/fail.jpg',
        order: 1,
        altText: null,
        createdAt: new Date(),
      },
    ]

    vi.doMock('@/lib/db', () => ({
      db: {
        vehiclePhoto: { findMany: vi.fn().mockResolvedValue(mockPhotos) },
        vehicle: { findUnique: vi.fn().mockResolvedValue({ id: 'v1' }) },
      },
    }))

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
      } as unknown as Response)
      .mockResolvedValueOnce({ ok: false } as unknown as Response)

    const { downloadVehiclePhotosZip } = await import('./download-photos')
    const JSZip = (await import('jszip')).default

    const buffer = await downloadVehiclePhotosZip('v1')
    const zip = await JSZip.loadAsync(buffer)
    const files = Object.keys(zip.files)
    // Only 1 file since the second fetch failed
    expect(files).toHaveLength(1)
    expect(files).toContain('01-foto.jpg')
  })
})
