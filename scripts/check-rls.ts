/**
 * check-rls — invariante de seguridad (PR1 · Fase 0 · SEG-01).
 *
 * Falla (exit != 0) si alguna tabla ORDINARIA del esquema `public` tiene Row Level
 * Security DESHABILITADA. En este proyecto TODAS las tablas de `public` deben tener RLS
 * activada (deny-all para los roles PostgREST anon/authenticated; Prisma accede con un rol
 * BYPASSRLS). Esto cubre también las tablas FUTURAS sin necesidad de un event trigger.
 *
 * - Solo ejecuta consultas SELECT sobre el catálogo de PostgreSQL. No modifica datos ni
 *   configuración.
 * - La URL de base de datos se toma de una variable de entorno (no se imprime nunca).
 * - No muestra credenciales, URLs, secretos ni datos de negocio: solo el número de tablas
 *   inspeccionadas, los nombres de las tablas incumplidoras y el resultado final.
 *
 * Uso:  CHECK_RLS_DATABASE_URL=... pnpm check:rls
 *       (fallback: DIRECT_URL, luego DATABASE_URL)
 *
 * Códigos de salida: 0 = OK · 1 = hay tablas sin RLS · 2 = error de configuración/conexión.
 */
import { PrismaClient } from '@prisma/client'

type CatalogRow = { relname: string; relrowsecurity: boolean }

function resolveDatabaseUrl(): string | null {
  return (
    process.env.CHECK_RLS_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL || null
  )
}

async function main(): Promise<number> {
  const url = resolveDatabaseUrl()
  if (!url) {
    console.error(
      'check-rls: falta la URL de base de datos. Define CHECK_RLS_DATABASE_URL (o DIRECT_URL / DATABASE_URL).'
    )
    return 2
  }

  const prisma = new PrismaClient({ datasourceUrl: url })
  try {
    const rows = await prisma.$queryRaw<CatalogRow[]>`
      SELECT c.relname, c.relrowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
      ORDER BY c.relname
    `

    const total = rows.length
    const offenders = rows.filter((r) => !r.relrowsecurity).map((r) => r.relname)

    console.log(`check-rls: ${total} tablas inspeccionadas en el esquema public`)

    if (offenders.length > 0) {
      console.error(
        `check-rls: FALLO — ${offenders.length} tabla(s) sin RLS: ${offenders.join(', ')}`
      )
      return 1
    }

    console.log('check-rls: OK — todas las tablas de public tienen RLS habilitada')
    return 0
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`check-rls: error de conexión o de consulta: ${message}`)
    return 2
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .then((code) => {
    process.exit(code)
  })
  .catch((err) => {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`check-rls: error inesperado: ${message}`)
    process.exit(2)
  })
