/**
 * check-delivery-offer-nulls — preflight READ-ONLY previo a aplicar la migración contract I3C1B
 * (`deliveries.offer_id SET NOT NULL`) en un entorno remoto.
 *
 * `I3C1B REQUIRES ZERO NULL offer_id ROWS BEFORE REMOTE APPLICATION`
 * `THE I3C1B REMOTE PREFLIGHT VALIDATES DATA AND EXPAND-SCHEMA STRUCTURE`
 *
 * Comprueba, además de los datos, la ESTRUCTURA del expand schema (columna, FK, índices, historial)
 * para que la migración remota parta de un estado conocido y seguro:
 *  Datos: cero `offer_id IS NULL`, cero huérfanas, coherencia Offer↔Delivery, cero vehículos con >1
 *         Delivery activa, cero migraciones fallidas activas.
 *  Estructura: tabla y columna `offer_id` existen; tipo text; sin default; FK `deliveries_offer_id_fkey`
 *         validada (NO ACTION / CASCADE); índice `deliveries_offer_id_idx`; índice único parcial
 *         `deliveries_active_vehicle_key` (predicado PROGRAMADA/EN_CURSO); I3C1A aplicada.
 *  Contrato de nullability (env `CHECK_DELIVERY_OFFER_EXPECT_NULLABLE`):
 *         '1' (por defecto) → PREFLIGHT: `offer_id` NULLABLE + I3C1B NO aplicada.
 *         '0'               → POSTFLIGHT: `offer_id` NOT NULL + I3C1B aplicada.
 *
 * GARANTÍAS
 *  - SOLO LECTURA: únicamente SELECT. No DDL/DML, ni migraciones, ni backfills, ni reparaciones.
 *  - No conecta salvo activación explícita (`CHECK_DELIVERY_OFFER_NULLS=1`). No cableado a builds.
 *  - Reutiliza la resolución de URL + marcador anti-confusión de `lib/deploy/migration-guard`
 *    (`REMOTE_MIGRATION_GUARD_*`): la URL resuelta debe contener el marcador o falla ANTES de conectar.
 *  - Nunca imprime URLs, credenciales, hosts, ids, PII ni SQL con datos.
 *  - La decisión (código de salida) la fija `lib/deploy/delivery-offer-preflight` (puro y testeado).
 *
 * Variables de entorno:
 *  - CHECK_DELIVERY_OFFER_NULLS=1                   → activa el preflight (sin ella: SKIP).
 *  - CHECK_DELIVERY_OFFER_EXPECT_NULLABLE=1|0       → contrato de nullability (por defecto 1).
 *  - REMOTE_MIGRATION_GUARD_ENV=staging|production  → entorno declarado.
 *  - REMOTE_MIGRATION_GUARD_DATABASE_URL            → URL a comprobar (fallback: DIRECT_URL, DATABASE_URL).
 *  - REMOTE_MIGRATION_GUARD_EXPECT_URL_CONTAINS     → marcador inequívoco del entorno (obligatorio).
 *  - REMOTE_MIGRATION_GUARD_TIMEOUT_MS              → timeout (por defecto 15000).
 *
 * Códigos de salida: 0 = PASS (o SKIP) · 1 = preflight NO superado · 2 = config/conexión.
 */
import { PrismaClient } from '@prisma/client'
import {
  preflight,
  describeConnectionFailure,
  safeErrorCode,
  FAIL_REASON_LABELS,
} from '../lib/deploy/migration-guard'
import {
  evaluateDeliveryOfferPreflight,
  I3C1A_EXPAND_MIGRATION,
  I3C1B_CONTRACT_MIGRATION,
  type DeliveryOfferChecks,
} from '../lib/deploy/delivery-offer-preflight'

const TAG = 'check-delivery-offer-nulls'

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout tras ${ms}ms (${label})`)), ms).unref?.()
    ),
  ])
}

async function gatherChecks(
  prisma: PrismaClient,
  timeoutMs: number,
  expectNullable: boolean
): Promise<DeliveryOfferChecks> {
  const q = <T>(p: Promise<T>, label: string) => withTimeout(p, timeoutMs, label)
  const num = async (p: Promise<Array<{ n: bigint | number }>>): Promise<number> =>
    Number((await p)[0]?.n ?? 0)

  const [
    nullOfferIds,
    orphans,
    incoherent,
    dupActive,
    tableRows,
    colRows,
    fkRows,
    normalIdxRows,
    partialIdxRows,
    migrationRows,
  ] = await Promise.all([
    num(
      q(
        prisma.$queryRaw`SELECT count(*)::int AS n FROM "deliveries" WHERE "offer_id" IS NULL`,
        'nulls'
      )
    ),
    num(
      q(
        prisma.$queryRaw`
          SELECT count(*)::int AS n FROM "deliveries" d
          LEFT JOIN "offers" o ON o."id" = d."offer_id"
          WHERE d."offer_id" IS NOT NULL AND o."id" IS NULL`,
        'orphans'
      )
    ),
    num(
      q(
        prisma.$queryRaw`
          SELECT count(*)::int AS n FROM "deliveries" d
          JOIN "offers" o ON o."id" = d."offer_id"
          WHERE o."vehicle_id" <> d."vehicle_id" OR o."buyer_lead_id" <> d."buyer_lead_id"`,
        'incoherent'
      )
    ),
    num(
      q(
        prisma.$queryRaw`
          SELECT count(*)::int AS n FROM (
            SELECT "vehicle_id" FROM "deliveries"
            WHERE "status" IN ('PROGRAMADA','EN_CURSO')
            GROUP BY "vehicle_id" HAVING count(*) > 1
          ) x`,
        'dupActive'
      )
    ),
    q(
      prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='deliveries'
        ) AS exists`,
      'table'
    ),
    q(
      prisma.$queryRaw<
        Array<{ is_nullable: string; data_type: string; column_default: string | null }>
      >`
        SELECT is_nullable, data_type, column_default FROM information_schema.columns
        WHERE table_schema='public' AND table_name='deliveries' AND column_name='offer_id'`,
      'column'
    ),
    q(
      prisma.$queryRaw<
        Array<{ confdeltype: string; confupdtype: string; convalidated: boolean }>
      >`SELECT confdeltype, confupdtype, convalidated FROM pg_constraint
        WHERE conname='deliveries_offer_id_fkey' AND contype='f'`,
      'fk'
    ),
    q(
      prisma.$queryRaw<Array<{ indexdef: string }>>`
        SELECT indexdef FROM pg_indexes
        WHERE schemaname='public' AND tablename='deliveries' AND indexname='deliveries_offer_id_idx'`,
      'normalIdx'
    ),
    q(
      prisma.$queryRaw<Array<{ indexdef: string }>>`
        SELECT indexdef FROM pg_indexes
        WHERE schemaname='public' AND tablename='deliveries' AND indexname='deliveries_active_vehicle_key'`,
      'partialIdx'
    ),
    q(
      prisma.$queryRaw<
        Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>
      >`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`,
      'migrations'
    ),
  ])

  const col = colRows[0]
  const fk = fkRows[0]
  const normalDef = normalIdxRows[0]?.indexdef ?? ''
  const partialDef = partialIdxRows[0]?.indexdef ?? ''
  const isFinished = (name: string) =>
    migrationRows.some((m) => m.migration_name === name && m.finished_at != null)
  const failedMigrations = migrationRows.filter(
    (m) => m.finished_at == null && m.rolled_back_at == null
  ).length

  return {
    nullOfferIds,
    orphans,
    incoherent,
    dupActive,
    failedMigrations,
    tableExists: tableRows[0]?.exists === true,
    offerIdColumnExists: col != null,
    offerIdIsNullable: col?.is_nullable === 'YES',
    offerIdType: col?.data_type ?? '',
    offerIdHasDefault: col?.column_default != null,
    fkPresentValid: fk != null && fk.convalidated === true,
    fkOnDeleteNoAction: fk?.confdeltype === 'a',
    fkOnUpdateCascade: fk?.confupdtype === 'c',
    normalIndexPresent: /offer_id/i.test(normalDef) && !/UNIQUE/i.test(normalDef),
    partialIndexPresent: partialDef.length > 0,
    partialIndexUnique: /UNIQUE/i.test(partialDef),
    partialIndexPredicateOk: /PROGRAMADA/i.test(partialDef) && /EN_CURSO/i.test(partialDef),
    i3c1aApplied: isFinished(I3C1A_EXPAND_MIGRATION),
    i3c1bApplied: isFinished(I3C1B_CONTRACT_MIGRATION),
    expectNullable,
  }
}

async function main(): Promise<number> {
  if (process.env.CHECK_DELIVERY_OFFER_NULLS !== '1') {
    console.log(
      `${TAG}: SKIP — establece CHECK_DELIVERY_OFFER_NULLS=1 para ejecutar el preflight read-only.`
    )
    return 0
  }
  const expectNullable = process.env.CHECK_DELIVERY_OFFER_EXPECT_NULLABLE !== '0'

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
  let checks: DeliveryOfferChecks
  try {
    checks = await gatherChecks(prisma, timeoutMs, expectNullable)
  } catch (err) {
    console.error(`${TAG}: FALLO — ${describeConnectionFailure(pre.declaredEnv, err)}`)
    return 2
  } finally {
    await prisma.$disconnect().catch(() => {})
  }

  const verdict = evaluateDeliveryOfferPreflight(checks)
  console.log(
    `${TAG}: entorno=${pre.declaredEnv} · modo=${expectNullable ? 'preflight(nullable)' : 'postflight(not-null)'}`
  )
  console.log(
    `  datos → nulls=${checks.nullOfferIds} huérfanas=${checks.orphans} incoherentes=${checks.incoherent} dupActivas=${checks.dupActive} migFallidas=${checks.failedMigrations}`
  )
  console.log(
    `  estructura → tabla=${checks.tableExists} columna=${checks.offerIdColumnExists} nullable=${checks.offerIdIsNullable} fk=${checks.fkPresentValid} idxParcial=${checks.partialIndexPresent} I3C1A=${checks.i3c1aApplied} I3C1B=${checks.i3c1bApplied}`
  )

  if (verdict.code === 0) {
    console.log(`${TAG}: PASS — estado seguro para la migración contract I3C1B.`)
    return 0
  }
  console.error(`${TAG}: FALLO — ${verdict.failed.length} comprobación(es) no superadas:`)
  for (const f of verdict.failed) console.error(`  - ${f}`)
  console.error(
    `${TAG}: NO apliques el contract hasta resolverlas con un procedimiento autorizado (sin backfill automático).`
  )
  return 1
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`${TAG}: error inesperado. code=${safeErrorCode(err)}`)
    process.exit(2)
  })
