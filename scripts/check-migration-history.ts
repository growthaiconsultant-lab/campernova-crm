/**
 * check-migration-history — invariante del historial de migraciones Prisma.
 *
 * Previene la regresión que motivó el squash (dos carpetas con el mismo prefijo de
 * timestamp, con una dependencia rota). Falla (exit != 0) ante cualquier incumplimiento.
 *
 * Comprueba (solo lectura de ficheros; NO accede a bases de datos, NO modifica nada,
 * NO muestra secretos):
 *  1. Existe `prisma/migrations/migration_lock.toml`.
 *  2. Cada carpeta de migración activa contiene `migration.sql`.
 *  3. Los nombres cumplen el formato `000000000000_<slug>` (baseline) o `<14 dígitos>_<slug>`.
 *  4. No hay dos carpetas con el mismo prefijo temporal (colisión).
 *  5. No hay carpetas duplicadas.
 *  6. La primera migración activa (orden lexicográfico) es la baseline.
 *  7. No conviven el historial antiguo y la baseline (se detecta vía formato + colisión).
 *
 * Código de salida: 0 = OK · 1 = incumplimiento.
 */
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS_DIR = join(process.cwd(), 'prisma', 'migrations')
const LOCK_FILE = join(MIGRATIONS_DIR, 'migration_lock.toml')
const BASELINE = '000000000000_squashed_migrations'
/** Baseline (12 ceros) o timestamp de 14 dígitos, seguido de un slug en minúsculas. */
const NAME_RE = /^(?:000000000000|\d{14})_[a-z0-9]+(?:_[a-z0-9]+)*$/

function main(): number {
  const errors: string[] = []

  if (!existsSync(MIGRATIONS_DIR)) {
    console.error('check-migration-history: FALLO\n  - no existe prisma/migrations/')
    return 1
  }

  if (!existsSync(LOCK_FILE)) {
    errors.push('falta prisma/migrations/migration_lock.toml')
  }

  const folders = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()

  if (folders.length === 0) {
    errors.push('no hay ninguna carpeta de migración activa')
  }

  if (folders.length > 0) {
    if (!folders.includes(BASELINE)) {
      errors.push(`falta la migración baseline "${BASELINE}"`)
    } else if (folders[0] !== BASELINE) {
      errors.push(
        `la primera migración debe ser la baseline "${BASELINE}", pero es "${folders[0]}"`
      )
    }
  }

  const prefixes = new Map<string, string[]>()
  for (const folder of folders) {
    if (!existsSync(join(MIGRATIONS_DIR, folder, 'migration.sql'))) {
      errors.push(`"${folder}": falta migration.sql`)
    }
    if (!NAME_RE.test(folder)) {
      errors.push(
        `"${folder}": nombre no válido (esperado 000000000000_<slug> o <14 dígitos>_<slug>)`
      )
    }
    const prefix = folder.split('_')[0]
    prefixes.set(prefix, [...(prefixes.get(prefix) ?? []), folder])
  }

  for (const [prefix, list] of Array.from(prefixes.entries())) {
    if (list.length > 1) {
      errors.push(`prefijo de timestamp duplicado "${prefix}": ${list.join(', ')}`)
    }
  }

  if (errors.length > 0) {
    console.error('check-migration-history: FALLO')
    for (const e of errors) console.error(`  - ${e}`)
    return 1
  }

  console.log(
    `check-migration-history: OK — ${folders.length} migración(es) activa(s); baseline presente y primera; sin colisiones de prefijo`
  )
  return 0
}

process.exit(main())
