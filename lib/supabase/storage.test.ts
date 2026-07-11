import { describe, it, expect } from 'vitest'
import { extractVehicleDocumentPath, extractVehiclePhotoPath } from './storage'

describe('extractVehicleDocumentPath · paths internos (documentos nuevos)', () => {
  it('devuelve el path tal cual si ya es un object path seguro', () => {
    expect(extractVehicleDocumentPath('docs/v-1/abc.pdf')).toBe('docs/v-1/abc.pdf')
    expect(extractVehicleDocumentPath('deliveries/d-1/abc.pdf')).toBe('deliveries/d-1/abc.pdf')
  })

  it('rechaza (null) un path con traversal, barra inicial o vacío', () => {
    expect(extractVehicleDocumentPath('docs/../secret.pdf')).toBeNull()
    expect(extractVehicleDocumentPath('/docs/v-1/abc.pdf')).toBeNull()
    expect(extractVehicleDocumentPath('')).toBeNull()
  })
})

describe('extractVehicleDocumentPath · URLs firmadas legacy', () => {
  it('extrae el path de una URL firmada legítima de Supabase (sin query string)', () => {
    const legacy =
      'https://proj.supabase.co/storage/v1/object/sign/vehicle-documents/docs/v-1/doc.pdf?token=OLD_1YEAR'
    expect(extractVehicleDocumentPath(legacy)).toBe('docs/v-1/doc.pdf')
  })

  it('extrae el path aunque la URL no lleve query string', () => {
    const url = 'https://proj.supabase.co/storage/v1/object/sign/vehicle-documents/docs/v-9/x.png'
    expect(extractVehicleDocumentPath(url)).toBe('docs/v-9/x.png')
  })
})

describe('extractVehicleDocumentPath · rechazos de seguridad', () => {
  it('rechaza un dominio externo aunque contenga el nombre del bucket', () => {
    expect(
      extractVehicleDocumentPath('https://evil.com/vehicle-documents/docs/v-1/doc.pdf')
    ).toBeNull()
  })

  it('rechaza una URL de OTRO bucket (p. ej. el público de fotos)', () => {
    expect(
      extractVehicleDocumentPath(
        'https://proj.supabase.co/storage/v1/object/public/vehicle-photos/v-1/foto.jpg'
      )
    ).toBeNull()
  })

  it('rechaza si el bucket aparece antes del marcador de objeto de Storage', () => {
    expect(
      extractVehicleDocumentPath('https://x/vehicle-documents/storage/v1/object/sign/x')
    ).toBeNull()
  })

  it('rechaza un path extraído con traversal', () => {
    expect(
      extractVehicleDocumentPath(
        'https://proj.supabase.co/storage/v1/object/sign/vehicle-documents/../../etc/passwd'
      )
    ).toBeNull()
  })
})

describe('extractVehiclePhotoPath', () => {
  it('extrae el path de una URL pública de foto', () => {
    const url = 'https://proj.supabase.co/storage/v1/object/public/vehicle-photos/v-1/uuid.jpg'
    expect(extractVehiclePhotoPath(url)).toBe('v-1/uuid.jpg')
  })

  it('devuelve null si no es una URL pública de fotos', () => {
    expect(extractVehiclePhotoPath('https://example.com/x.jpg')).toBeNull()
  })
})
