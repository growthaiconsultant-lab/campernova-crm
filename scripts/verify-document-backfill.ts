/**
 * PR5B3 — Verificación POST-backfill (READ-ONLY). Comprueba, para los ítems de un plan, que la
 * migración dejó un estado coherente. No modifica nada. Exit != 0 si alguna invariante falla.
 *
 * Invariantes por ítem migrado: currentVersionId establecido y pertenece a la misma raíz; existe
 * exactamente una versión; version=1; versionSequence=1; objectPath == url; bucket correcto; sin
 * signed URL persistida (url es un path, no http).
 *
 * Uso: pnpm documents:verify-backfill -- --env local --plan <file>
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { parseCliFlags, readEnvSelector } from '../lib/documents/cli-support'
import { resolveMigrationTarget, MigrationGuardError } from '../lib/documents/migration-env-guard'
import { redactId, redactSecretsInText } from '../lib/documents/migration-redaction'
import type { BackfillPlanItem } from '../lib/documents/backfill-core'

async function main(): Promise<number> {
  const flags = parseCliFlags(process.argv.slice(2))
  const env = readEnvSelector(flags)
  if (typeof flags.plan !== 'string') {
    console.error('verify-document-backfill: falta --plan <file>.')
    return 1
  }
  const items = JSON.parse(readFileSync(flags.plan, 'utf8')).items as BackfillPlanItem[]

  let url: string
  try {
    url = resolveMigrationTarget({
      env,
      operation: 'audit',
      processEnv: process.env,
      confirm: typeof flags.ack === 'string' ? flags.ack : undefined,
    }).url
  } catch (err) {
    if (err instanceof MigrationGuardError) {
      console.error(err.message)
      return 1
    }
    throw err
  }

  const prisma = new PrismaClient({ datasourceUrl: url })
  const failures: string[] = []
  try {
    for (const item of items) {
      const root =
        item.rootType === 'vehicle'
          ? await prisma.vehicleDocument.findUnique({
              where: { id: item.rootId },
              select: {
                url: true,
                currentVersionId: true,
                versionSequence: true,
                _count: { select: { versions: true } },
                currentVersion: {
                  select: { id: true, version: true, objectPath: true, bucket: true },
                },
              },
            })
          : await prisma.deliveryDocument.findUnique({
              where: { id: item.rootId },
              select: {
                url: true,
                currentVersionId: true,
                versionSequence: true,
                _count: { select: { versions: true } },
                currentVersion: {
                  select: { id: true, version: true, objectPath: true, bucket: true },
                },
              },
            })

      const tag = `${item.rootType} ${redactId(item.rootId)}`
      if (!root) {
        failures.push(`${tag}: raíz no encontrada`)
        continue
      }
      const cv = root.currentVersion
      if (!root.currentVersionId || !cv) failures.push(`${tag}: sin currentVersionId`)
      if (cv && cv.id !== root.currentVersionId) failures.push(`${tag}: currentVersion no coincide`)
      if (root.versionSequence !== 1) failures.push(`${tag}: versionSequence != 1`)
      if (root._count.versions !== 1) failures.push(`${tag}: nº de versiones != 1`)
      if (cv && cv.version !== 1) failures.push(`${tag}: version != 1`)
      if (cv && cv.objectPath !== item.objectPath) failures.push(`${tag}: objectPath != plan`)
      if (cv && cv.bucket !== item.bucket) failures.push(`${tag}: bucket != plan`)
      if (root.url !== item.objectPath) failures.push(`${tag}: url no sincronizada con objectPath`)
      if (root.url && root.url.startsWith('http'))
        failures.push(`${tag}: url es una URL http (no debería)`)
    }

    if (failures.length > 0) {
      console.error(`verify-document-backfill: FALLO — ${failures.length} invariante(s):`)
      for (const f of failures.slice(0, 50)) console.error(`  - ${f}`)
      return 2
    }
    console.log(
      `verify-document-backfill: OK — ${items.length} ítem(s) verificado(s) sin incidencias.`
    )
    return 0
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`verify-document-backfill: error — ${redactSecretsInText(message)}`)
    return 2
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`verify-document-backfill: error inesperado — ${redactSecretsInText(message)}`)
    process.exit(2)
  })
