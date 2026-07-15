/**
 * check-remote-migrations — guard de despliegue: bloquea un build de producción cuando alguna
 * migración local de Prisma NO está aplicada correctamente en la base de datos remota.
 *
 * Motivación: el 2026-07-15, Vercel desplegó un cliente Prisma que dependía de la migración
 * `20260712000000_add_versioned_document_model`, aún no aplicada en producción → `P2022` al
 * cargar fichas de vendedor/vehículo y entrega. Este guard impide repetir ese desfase.
 *
 * GARANTÍAS
 *  - SOLO LECTURA: únicamente ejecuta un SELECT sobre `_prisma_migrations`. No ejecuta DDL/DML,
 *    ni migraciones, ni backfills, ni escribe en `_prisma_migrations`.
 *  - Solo se conecta a remoto cuando el modo es activo (Vercel `production` o ejecución manual
 *    explícita). En Preview, build local y CI ordinaria NO se conecta (SKIP).
 *  - Fail-closed en producción: si falta la URL, la URL es ambigua, la base no responde, no existe
 *    `_prisma_migrations`, o cualquier migración local no está aplicada/finalizada/con checksum
 *    correcto → exit != 0 (el build no publica una versión incompatible).
 *  - Nunca imprime URLs, credenciales, hosts ni parámetros de conexión.
 *
 * Variables de entorno:
 *  - VERCEL_ENV                                    → 'production' activa el guard automáticamente.
 *  - REMOTE_MIGRATION_GUARD_ENV=staging|production → activa el modo manual (fuera de Vercel).
 *  - REMOTE_MIGRATION_GUARD_DATABASE_URL           → URL a comprobar (fallback: DIRECT_URL, DATABASE_URL).
 *  - REMOTE_MIGRATION_GUARD_EXPECT_URL_CONTAINS    → marcador inequívoco del entorno (p. ej. project
 *      ref). Obligatorio en modo manual; recomendado en Vercel production. Si se define, la URL
 *      resuelta debe contenerlo o el guard falla (anti-confusión de entornos).
 *  - REMOTE_MIGRATION_GUARD_TIMEOUT_MS             → timeout de conexión/consulta (por defecto 15000).
 *
 * Códigos de salida: 0 = PASS (o SKIP) · 1 = migración pendiente/incompatible · 2 = error de
 * configuración o de conexión.
 */
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import {
  computeLocalMigrations,
  evaluateMigrations,
  resolveGuardMode,
  urlMatchesExpectation,
  PROBLEM_LABELS,
  type RemoteMigrationRow,
} from '../lib/deploy/migration-guard'

const TAG = 'check-remote-migrations'
const MIGRATIONS_DIR = join(process.cwd(), 'prisma', 'migrations')

function shortCommit(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || ''
  return sha ? sha.slice(0, 7) : 'desconocido'
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout tras ${ms}ms (${label})`)), ms).unref?.()
    ),
  ])
}

async function main(): Promise<number> {
  const mode = resolveGuardMode({
    VERCEL_ENV: process.env.VERCEL_ENV,
    REMOTE_MIGRATION_GUARD_ENV: process.env.REMOTE_MIGRATION_GUARD_ENV,
  })
  if (!mode.active) {
    console.log(`${TAG}: SKIP (${mode.reason}) — no se comprueba la base remota.`)
    return 0
  }

  const url =
    process.env.REMOTE_MIGRATION_GUARD_DATABASE_URL ||
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL ||
    ''
  if (!url) {
    console.error(
      `${TAG}: FALLO de configuración — falta la URL de base de datos (REMOTE_MIGRATION_GUARD_DATABASE_URL / DIRECT_URL / DATABASE_URL). Entorno=${mode.declaredEnv}.`
    )
    return 2
  }

  const expect = process.env.REMOTE_MIGRATION_GUARD_EXPECT_URL_CONTAINS
  if (mode.source === 'manual' && !expect) {
    console.error(
      `${TAG}: FALLO de configuración — en modo manual debes declarar REMOTE_MIGRATION_GUARD_EXPECT_URL_CONTAINS (marcador del entorno, p. ej. el project ref) para evitar confundir staging con producción.`
    )
    return 2
  }
  if (!urlMatchesExpectation(url, expect).ok) {
    console.error(
      `${TAG}: FALLO de guarda de entorno — la URL resuelta no corresponde al entorno declarado (${mode.declaredEnv}). No se ejecuta ninguna comprobación remota.`
    )
    return 2
  }

  const timeoutMs = Number(process.env.REMOTE_MIGRATION_GUARD_TIMEOUT_MS) || 15_000
  const prisma = new PrismaClient({ datasourceUrl: url })
  let remote: RemoteMigrationRow[]
  try {
    remote = await withTimeout(
      prisma.$queryRaw<RemoteMigrationRow[]>`
        SELECT migration_name, checksum, started_at, finished_at, rolled_back_at
        FROM "_prisma_migrations"
      `,
      timeoutMs,
      'consulta _prisma_migrations'
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // No se imprime la URL. Un error aquí (BD inaccesible o sin _prisma_migrations) es fail-closed.
    console.error(
      `${TAG}: FALLO — no se pudo verificar el estado de migraciones remoto (entorno=${mode.declaredEnv}): ${message}`
    )
    return 2
  } finally {
    await prisma.$disconnect().catch(() => {})
  }

  const local = computeLocalMigrations(MIGRATIONS_DIR)
  const result = evaluateMigrations(local, remote)

  console.log(
    `${TAG}: entorno=${mode.declaredEnv} · commit=${shortCommit()} · locales=${result.localCount} · remotas=${result.remoteCount}`
  )

  if (result.ok) {
    console.log(`${TAG}: OK — todas las migraciones locales están aplicadas y son coherentes.`)
    return 0
  }

  console.error(`${TAG}: FALLO — ${result.problems.length} migración(es) bloquean el despliegue:`)
  for (const p of result.problems) {
    console.error(`  - ${p.migration}: ${PROBLEM_LABELS[p.kind]}`)
  }
  console.error(
    `${TAG}: aplica las migraciones pendientes con un procedimiento autorizado (p. ej. \`prisma migrate deploy\`) ANTES de desplegar el código dependiente.`
  )
  return 1
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`${TAG}: error inesperado: ${message}`)
    process.exit(2)
  })
