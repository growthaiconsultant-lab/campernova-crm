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
 *  - Fail-closed en producción: si falta la URL, falta el marcador de identidad, la URL no coincide
 *    con el entorno declarado, la base no responde, no existe `_prisma_migrations`, o cualquier
 *    migración local no está aplicada/finalizada/con checksum correcto → exit != 0 (el build no
 *    publica una versión incompatible).
 *  - Nunca imprime URLs, credenciales, hosts, mensajes brutos de Prisma ni parámetros de conexión.
 *
 * Variables de entorno:
 *  - VERCEL_ENV                                    → 'production' activa el guard automáticamente.
 *  - REMOTE_MIGRATION_GUARD_ENV=staging|production → activa el modo manual (fuera de Vercel).
 *  - REMOTE_MIGRATION_GUARD_DATABASE_URL           → URL a comprobar (fallback: DIRECT_URL, DATABASE_URL).
 *  - REMOTE_MIGRATION_GUARD_EXPECT_URL_CONTAINS    → marcador inequívoco del entorno (p. ej. project
 *      ref). **OBLIGATORIO siempre que el guard esté activo** (Production y modo manual): la URL
 *      resuelta debe contenerlo o el guard falla ANTES de abrir conexión (anti-confusión de entornos).
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
  preflight,
  describeConnectionFailure,
  safeErrorCode,
  FAIL_REASON_LABELS,
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
  const pre = preflight({
    VERCEL_ENV: process.env.VERCEL_ENV,
    REMOTE_MIGRATION_GUARD_ENV: process.env.REMOTE_MIGRATION_GUARD_ENV,
    REMOTE_MIGRATION_GUARD_DATABASE_URL: process.env.REMOTE_MIGRATION_GUARD_DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    REMOTE_MIGRATION_GUARD_EXPECT_URL_CONTAINS:
      process.env.REMOTE_MIGRATION_GUARD_EXPECT_URL_CONTAINS,
  })

  if (pre.action === 'skip') {
    console.log(`${TAG}: SKIP (${pre.reason}) — no se comprueba la base remota.`)
    return 0
  }
  if (pre.action === 'fail') {
    // Se falla ANTES de crear PrismaClient: ninguna conexión abierta. Sin URL/host/credenciales.
    console.error(
      `${TAG}: FALLO de configuración (${pre.declaredEnv}) — ${FAIL_REASON_LABELS[pre.reason]}.`
    )
    return 2
  }

  const timeoutMs = Number(process.env.REMOTE_MIGRATION_GUARD_TIMEOUT_MS) || 15_000
  const prisma = new PrismaClient({ datasourceUrl: pre.url })
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
    // Sanitizado: solo código seguro + entorno. Nunca host/URL/usuario/contraseña/mensaje bruto.
    console.error(`${TAG}: FALLO — ${describeConnectionFailure(pre.declaredEnv, err)}`)
    return 2
  } finally {
    await prisma.$disconnect().catch(() => {})
  }

  const local = computeLocalMigrations(MIGRATIONS_DIR)
  const result = evaluateMigrations(local, remote)

  console.log(
    `${TAG}: entorno=${pre.declaredEnv} · commit=${shortCommit()} · locales=${result.localCount} · remotas=${result.remoteCount}`
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
    // Sanitizado: no se serializa el error (podría contener host/URL). Solo un código seguro.
    console.error(`${TAG}: error inesperado. code=${safeErrorCode(err)}`)
    process.exit(2)
  })
