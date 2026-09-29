import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { operationalTargetSchema, documentTargetWhere } from './operations-input'
import { canUseOperationalDocuments, OPERATIONAL_DOCUMENT_CATEGORIES } from './operations-policy'
import { validateDocumentFile, DocumentValidationError } from './storage/private-documents'
import { createFirstVersionTx } from './storage/versioned-documents'
import { OperationalError } from './operational-deliveries'
import { MAX_OPERATIONAL_DOCUMENT_BYTES } from './operations-limits'

export const operationalDocumentInput = z.object({
  target: operationalTargetSchema,
  operationId: z.uuid(),
  category: z.enum(OPERATIONAL_DOCUMENT_CATEGORIES),
  name: z.string().trim().min(1).max(200),
})
export type OperationalDocumentInput = z.infer<typeof operationalDocumentInput>
export const OPERATIONAL_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
export function validateOperationalFile(
  file: { mimeType: string; fileName: string; size: number },
  bytes: Uint8Array
) {
  if (file.size > MAX_OPERATIONAL_DOCUMENT_BYTES)
    throw new DocumentValidationError(
      'too_large',
      'El archivo supera los 3 MiB permitidos para adjuntos operativos.'
    )
  const validated = validateDocumentFile(file)
  if (!OPERATIONAL_MIMES.includes(file.mimeType))
    throw new DocumentValidationError(
      'mime_not_allowed',
      'Utiliza PDF, JPEG, PNG o WebP (hasta 3 MiB).'
    )
  const prefix = (values: number[], offset = 0) => values.every((v, i) => bytes[offset + i] === v)
  const valid =
    file.mimeType === 'application/pdf'
      ? prefix([37, 80, 68, 70, 45])
      : file.mimeType === 'image/jpeg'
        ? prefix([255, 216, 255])
        : file.mimeType === 'image/png'
          ? prefix([137, 80, 78, 71, 13, 10, 26, 10])
          : prefix([82, 73, 70, 70]) && prefix([87, 69, 66, 80], 8)
  if (!valid || bytes.byteLength !== file.size)
    throw new DocumentValidationError(
      'extension_mismatch',
      'El contenido del archivo no coincide con su formato.'
    )
  return validated
}
export async function createOperationalDocumentTx(
  tx: Prisma.TransactionClient,
  input: OperationalDocumentInput,
  actorId: string,
  file: { path: string; size: number; mime: string; checksum: string; fingerprint: string }
) {
  const actor = await tx.user.findUnique({
    where: { id: actorId },
    select: { role: true, active: true },
  })
  if (!actor || !canUseOperationalDocuments(actor))
    throw new OperationalError('No tienes permiso para adjuntar documentos operativos.')
  const creationKey = `${actorId}:${input.operationId}`
  const previous = await tx.vehicleDocument.findUnique({
    where: { creationKey },
    select: { id: true, creationFingerprint: true, url: true },
  })
  if (previous) {
    if (previous.creationFingerprint !== file.fingerprint)
      throw new OperationalError('La solicitud ya se utilizó con otro archivo o destino.')
    return { id: previous.id, path: previous.url }
  }
  const target =
    input.target.type === 'vehicle'
      ? await tx.vehicle.findUnique({ where: { id: input.target.id }, select: { id: true } })
      : input.target.type === 'buyerLead'
        ? await tx.buyerLead.findUnique({ where: { id: input.target.id }, select: { id: true } })
        : await tx.sellerLead.findUnique({ where: { id: input.target.id }, select: { id: true } })
  if (!target) throw new OperationalError('El destino del documento no existe.')
  const root = await tx.vehicleDocument.create({
    data: {
      ...documentTargetWhere(input.target),
      category: input.category,
      creationKey,
      creationFingerprint: file.fingerprint,
      name: input.name,
      url: file.path,
      fileSize: file.size,
      mimeType: file.mime,
      uploadedById: actorId,
    },
  })
  await createFirstVersionTx(tx, 'vehicle', root.id, {
    bucket: 'vehicle-documents',
    objectPath: file.path,
    originalFilename: input.name,
    mimeType: file.mime,
    sizeBytes: file.size,
    checksum: file.checksum,
    uploadedById: actorId,
  })
  await tx.activity.create({
    data: {
      type: 'DOCUMENTO_SUBIDO',
      content: `Documento operativo adjuntado (${input.category}).`,
      agentId: actorId,
      buyerLeadId: input.target.type === 'buyerLead' ? input.target.id : null,
      sellerLeadId: input.target.type === 'sellerLead' ? input.target.id : null,
    },
  })
  return { id: root.id, path: file.path }
}
