import type { VehicleDocumentCategory } from '@prisma/client'

export const TASADO_REQUIRED_FIELDS: string[] = ['plate', 'desiredPrice']

export const PUBLICADO_REQUIRED_FIELDS: string[] = [
  'plate',
  'vin',
  'desiredPrice',
  'purchasePrice',
  'salePrice',
  'itvValidUntil',
  'chargeCheckedAt',
]

export const PUBLICADO_REQUIRED_DOCS: VehicleDocumentCategory[] = [
  'DNI_VENDEDOR',
  'CONTRATO_COMPRAVENTA',
  'FICHA_TECNICA',
  'PERMISO_CIRCULACION',
  'ITV_VIGENTE',
  'JUSTIFICANTE_PAGO',
  'INFORME_CARGAS_DGT',
]

export const PUBLICADO_MIN_PHOTOS = 5

export const TASADO_MIN_PHOTOS = 1

export const DOC_LABELS: Record<VehicleDocumentCategory, string> = {
  DNI_VENDEDOR: 'DNI/NIE del vendedor',
  CONTRATO_COMPRAVENTA: 'Contrato de compraventa firmado',
  FICHA_TECNICA: 'Ficha técnica / tarjeta ITV',
  PERMISO_CIRCULACION: 'Permiso de circulación',
  ITV_VIGENTE: 'Último informe ITV',
  JUSTIFICANTE_PAGO: 'Justificante de pago al vendedor',
  INFORME_CARGAS_DGT: 'Informe de cargas DGT',
  LIBRO_MANTENIMIENTO: 'Libro de mantenimiento',
  FACTURA_COMPRA_ORIGINAL: 'Factura de compra original',
  CONTRATO_FINAL_VENTA: 'Contrato final de venta al comprador',
  OTRO: 'Otro documento',
}
