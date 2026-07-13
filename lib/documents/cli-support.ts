/**
 * PR5B3 — Utilidades PURAS para los scripts de auditoría/backfill (parseo de flags + artefactos).
 * Sin efectos: el parseo es determinista y testeable. La escritura de artefactos la hace el script.
 */
import { createHash } from 'node:crypto'

export type CliFlags = Record<string, string | boolean>

/**
 * Parseo mínimo de flags: `--flag value`, `--flag=value` y `--flag` (booleano). Ignora
 * posicionales. No interpreta valores (los scripts los validan).
 */
export function parseCliFlags(argv: string[]): CliFlags {
  const flags: CliFlags = {}
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const body = token.slice(2)
    const eq = body.indexOf('=')
    if (eq !== -1) {
      flags[body.slice(0, eq)] = body.slice(eq + 1)
      continue
    }
    const next = argv[i + 1]
    if (next !== undefined && !next.startsWith('--')) {
      flags[body] = next
      i++
    } else {
      flags[body] = true
    }
  }
  return flags
}

/** Devuelve el entorno declarado (`--env`), validado, con `local` por defecto. */
export function readEnvSelector(flags: CliFlags): 'local' | 'staging' | 'production' {
  const raw = typeof flags.env === 'string' ? flags.env : 'local'
  if (raw === 'local' || raw === 'staging' || raw === 'production') return raw
  throw new Error(`--env inválido: ${raw} (usa local|staging|production)`)
}

/** Hash corto de un contenido serializable (para nombrar/verificar artefactos). */
export function contentHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}
