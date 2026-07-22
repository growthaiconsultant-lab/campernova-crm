/**
 * check-delivery-offer-nulls — preflight READ-ONLY previo a aplicar la migración contract I3C1B
 * (`deliveries.offer_id SET NOT NULL`) en un entorno remoto.
 *
 * `I3C1B REQUIRES ZERO NULL offer_id ROWS BEFORE REMOTE APPLICATION`
 *
 * Comprueba que la migración contract se puede aplicar con seguridad:
 *  1. cero filas con `offer_id IS NULL`;
 *  2. cero Deliveries huérfanas (offer_id apuntando a una Offer inexistente);
 *  3. coherencia Offer↔Delivery (mismo vehicle_id y buyer_lead_id);
 *  4. cero vehículos con más de una Delivery activa (PROGRAMADA/EN_CURSO);
 *  5. cero migraciones fallidas activas (`finished_at IS NULL AND rolled_back_at IS NULL`).
 *
 * GARANTÍAS
 *  - SOLO LECTURA: únicamente ejecuta SELECT. No ejecuta DDL/DML, ni migraciones, ni backfills, ni
 *    reparaciones, ni escribe en ninguna tabla.
 *  - No se conecta salvo activación explícita (`CHECK_DELIVERY_OFFER_NULLS=1`). No está cableado a
 *    ningún build ni CI: es una herramienta de preflight manual y autorizado.
 *  - Reutiliza la resolución de URL + marcador anti-confusión de `lib/deploy/migration-guard`
 *    (`REMOTE_MIGRATION_GUARD_*`): la URL resuelta debe contener el marcador declarado o falla ANTES
 *    de abrir conexión.
 *  - Nunca imprime URLs, credenciales, hosts ni mensajes brutos de Prisma.
 *
 * Variables de entorno:
 *  - CHECK_DELIVERY_OFFER_NULLS=1                   → activa el preflight (sin ella: SKIP, no conecta).
 *  - REMOTE_MIGRATION_GUARD_ENV=staging|production → entorno declarado.
 *  - REMOTE_MIGRATION_GUARD_DATABASE_URL           → URL a comprobar (fallback: DIRECT_URL, DATABASE_URL).
 *  - REMOTE_MIGRATION_GUARD_EXPECT_URL_CONTAINS    → marcador inequívoco del entorno (obligatorio).
 *  - REMOTE_MIGRATION_GUARD_TIMEOUT_MS             → timeout de conexión/consulta (por defecto 15000).
 *
 * Códigos de salida: 0 = PASS (o SKIP) · 1 = preflight NO superado (hay nulls/huérfanas/incoherencia)
 * · 2 = error de configuración o de conexión.
 */
import { PrismaClient } from '@prisma/client'
import {
  preflight,
  describeConnectionFailure,
  safeErrorCode,
  FAIL_REASON_LABELS,
} from '../lib/deploy/migration-guard'

const TAG = 'check-delivery-offer-nulls'

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout tras ${ms}ms (${label})`)), ms).unref?.()
    ),
  ])
}

type Check = { label: string; count: number }

async function main(): Promise<number> {
  if (process.env.CHECK_DELIVERY_OFFER_NULLS !== '1') {
    console.log(
      `${TAG}: SKIP — establece CHECK_DELIVERY_OFFER_NULLS=1 para ejecutar el preflight read-only.`
    )
    return 0
  }

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
    console.error(
      `${TAG}: FALLO de configuración — declara REMOTE_MIGRATION_GUARD_ENV + marcador de entorno.`
    )
    return 2
  }
  if (pre.action === 'fail') {
    console.error(
      `${TAG}: FALLO de configuración (${pre.declaredEnv}) — ${FAIL_REASON_LABELS[pre.reason]}.`
    )
    return 2
  }

  const timeoutMs = Number(process.env.REMOTE_MIGRATION_GUARD_TIMEOUT_MS) || 15_000
  const prisma = new PrismaClient({ datasourceUrl: pre.url })
  let checks: Check[]
  try {
    const q = <T>(p: Promise<T>, label: string) => withTimeout(p, timeoutMs, label)
    const one = async (sql: Promise<Array<{ n: bigint | number }>>): Promise<number> =>
      Number((await sql)[0]?.n ?? 0)

    // (1) filas con offer_id IS NULL.
    const nulls = await one(
      q(
        prisma.$queryRaw`SELECT count(*)::int AS n FROM "deliveries" WHERE "offer_id" IS NULL`,
        'nulls'
      )
    )
    // (2) Deliveries huérfanas: offer_id apunta a una Offer inexistente.
    const orphans = await one(
      q(
        prisma.$queryRaw`
          SELECT count(*)::int AS n
          FROM "deliveries" d
          LEFT JOIN "offers" o ON o."id" = d."offer_id"
          WHERE d."offer_id" IS NOT NULL AND o."id" IS NULL`,
        'orphans'
      )
    )
    // (3) incoherencia Offer↔Delivery (mismo vehículo y comprador).
    const incoherent = await one(
      q(
        prisma.$queryRaw`
          SELECT count(*)::int AS n
          FROM "deliveries" d
          JOIN "offers" o ON o."id" = d."offer_id"
          WHERE o."vehicle_id" <> d."vehicle_id" OR o."buyer_lead_id" <> d."buyer_lead_id"`,
        'incoherent'
      )
    )
    // (4) vehículos con más de una Delivery activa.
    const dupActive = await one(
      q(
        prisma.$queryRaw`
          SELECT count(*)::int AS n FROM (
            SELECT "vehicle_id" FROM "deliveries"
            WHERE "status" IN ('PROGRAMADA','EN_CURSO')
            GROUP BY "vehicle_id" HAVING count(*) > 1
          ) x`,
        'dupActive'
      )
    )
    // (5) migraciones fallidas activas.
    const failedMigrations = await one(
      q(
        prisma.$queryRaw`
          SELECT count(*)::int AS n FROM "_prisma_migrations"
          WHERE "finished_at" IS NULL AND "rolled_back_at" IS NULL`,
        'failedMigrations'
      )
    )

    checks = [
      { label: 'offer_id NULL', count: nulls },
      { label: 'Deliveries huérfanas', count: orphans },
      { label: 'incoherencia Offer↔Delivery', count: incoherent },
      { label: 'vehículos con >1 Delivery activa', count: dupActive },
      { label: 'migraciones fallidas activas', count: failedMigrations },
    ]
  } catch (err) {
    console.error(`${TAG}: FALLO — ${describeConnectionFailure(pre.declaredEnv, err)}`)
    return 2
  } finally {
    await prisma.$disconnect().catch(() => {})
  }

  console.log(`${TAG}: entorno=${pre.declaredEnv}`)
  for (const c of checks) console.log(`  - ${c.label}: ${c.count}`)

  const blocking = checks.filter((c) => c.count > 0)
  if (blocking.length === 0) {
    console.log(`${TAG}: PASS — seguro aplicar la migración contract I3C1B.`)
    return 0
  }
  console.error(
    `${TAG}: FALLO — ${blocking.length} comprobación(es) no superadas. NO apliques el contract hasta resolverlas con un procedimiento autorizado (sin backfill automático).`
  )
  return 1
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`${TAG}: error inesperado. code=${safeErrorCode(err)}`)
    process.exit(2)
  })
