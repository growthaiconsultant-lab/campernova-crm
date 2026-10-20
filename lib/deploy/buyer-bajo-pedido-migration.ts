import { evaluateMigrations, type LocalMigration, type RemoteMigrationRow } from './migration-guard'

export const BUYER_STATUS_MIGRATION = '20261020180000_add_buyer_bajo_pedido_status'
const PREVIOUS_VALUES = [
  'NUEVO',
  'CONTACTADO',
  'CUALIFICADO',
  'EN_NEGOCIACION',
  'CERRADO',
  'PERDIDO',
  'NO_CONTESTA',
]

export { buyerStatusMigrationIdentity } from './buyer-status-migration'

export function buyerStatusMigrationSnapshot(
  local: LocalMigration[],
  remote: RemoteMigrationRow[],
  values: string[]
): 'already-applied' | 'pending' {
  if (!local.some((migration) => migration.name === BUYER_STATUS_MIGRATION))
    throw Error('MISSING_LOCAL_MIGRATION')
  const history = evaluateMigrations(local, remote)
  const pending =
    !history.ok &&
    history.problems.length === 1 &&
    history.problems[0].migration === BUYER_STATUS_MIGRATION &&
    history.problems[0].kind === 'MISSING_REMOTE'
  if (!history.ok && !pending) throw Error('UNEXPECTED_MIGRATION_HISTORY')
  const expected = pending ? PREVIOUS_VALUES : [...PREVIOUS_VALUES, 'BAJO_PEDIDO']
  if (JSON.stringify([...values].sort()) !== JSON.stringify([...expected].sort()))
    throw Error('UNEXPECTED_BUYER_ENUM')
  return pending ? 'pending' : 'already-applied'
}
