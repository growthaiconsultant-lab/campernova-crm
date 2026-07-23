/**
 * Tests de integración con PostgreSQL REAL (PR I0) — clasificación de compromiso en eventos.
 *
 * Verifican sobre una base efímera migrada que:
 *  · el enum `EventCommitment` tiene exactamente los tres valores acordados;
 *  · la columna existe, es NOT NULL y su default es `INDETERMINADO`;
 *  · el backfill de la migración mapea cada tipo como se decidió, y en particular NO clasifica
 *    `LLAMADA`, `OTRO` ni `SEGUIMIENTO` como internos (eso ocultaría compromisos reales);
 *  · el backfill no toca ninguna otra columna: mismos ids, vínculos, estados y fechas.
 *
 * El SQL del backfill NO se copia aquí: se lee del fichero de migración real, de modo que si
 * alguien cambia el mapeo, este test falla.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PrismaClient, CalendarEventType, EventCommitment } from '@prisma/client'
import { createGuardedTestPrisma, uniqueSuffix } from './db'

let prisma: PrismaClient
const cleanups: Array<() => Promise<void>> = []

const MIGRATION_SQL = join(
  process.cwd(),
  'prisma/migrations/20260720000000_add_calendar_event_commitment/migration.sql'
)

const ALL_TYPES: CalendarEventType[] = ['CITA', 'LLAMADA', 'LIMPIEZA', 'SEGUIMIENTO', 'OTRO']

/** Mapeo esperado, escrito a mano a propósito para no repetir la lógica del código. */
const EXPECTED: Record<CalendarEventType, EventCommitment> = {
  CITA: 'EXTERNO',
  LIMPIEZA: 'INTERNO',
  LLAMADA: 'INDETERMINADO',
  OTRO: 'INDETERMINADO',
  SEGUIMIENTO: 'INDETERMINADO',
}

/** Sentencias `UPDATE` del backfill, extraídas del fichero de migración real. */
function backfillStatements(): string[] {
  return readFileSync(MIGRATION_SQL, 'utf8')
    .split('\n')
    .filter((line) => line.trim().toUpperCase().startsWith('UPDATE '))
    .map((line) => line.trim())
}

async function seedEventsOfEveryType(): Promise<{ ids: Record<CalendarEventType, string> }> {
  const s = uniqueSuffix()
  const user = await prisma.user.create({
    data: { name: `U ${s}`, email: `u_${s}@integ.test`, role: 'AGENTE' },
  })
  const ids = {} as Record<CalendarEventType, string>
  for (const type of ALL_TYPES) {
    const ev = await prisma.calendarEvent.create({
      data: {
        type,
        title: `Evento ${type} ${s}`,
        startAt: new Date('2026-09-01T10:00:00.000Z'),
        createdById: user.id,
        // Se fuerza el estado de partida del histórico: sin clasificar.
        commitment: 'INDETERMINADO',
      },
    })
    ids[type] = ev.id
  }
  cleanups.push(async () => {
    await prisma.calendarEvent.deleteMany({ where: { createdById: user.id } })
    await prisma.user.deleteMany({ where: { id: user.id } })
  })
  return { ids }
}

beforeAll(() => {
  prisma = createGuardedTestPrisma()
})

afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('esquema de EventCommitment', () => {
  it('el enum tiene exactamente EXTERNO, INTERNO e INDETERMINADO', async () => {
    const rows = await prisma.$queryRaw<Array<{ label: string }>>`
      SELECT e.enumlabel AS label
      FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'EventCommitment'
      ORDER BY e.enumsortorder
    `
    expect(rows.map((r) => r.label)).toEqual(['EXTERNO', 'INTERNO', 'INDETERMINADO'])
  })

  it('la columna es NOT NULL con default INDETERMINADO', async () => {
    const rows = await prisma.$queryRaw<
      Array<{ is_nullable: string; column_default: string | null }>
    >`
      SELECT is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'calendar_events' AND column_name = 'commitment'
    `
    expect(rows).toHaveLength(1)
    expect(rows[0].is_nullable).toBe('NO')
    // El default permite que el código anterior al despliegue siga insertando sin la columna.
    expect(rows[0].column_default).toContain('INDETERMINADO')
  })

  it('un insert que omite la columna cae en INDETERMINADO, nunca en INTERNO', async () => {
    const s = uniqueSuffix()
    const user = await prisma.user.create({
      data: { name: `U ${s}`, email: `u_${s}@integ.test`, role: 'AGENTE' },
    })
    cleanups.push(async () => {
      await prisma.$executeRawUnsafe(
        `DELETE FROM calendar_events WHERE created_by_id = $1`,
        user.id
      )
      await prisma.user.deleteMany({ where: { id: user.id } })
    })
    await prisma.$executeRawUnsafe(
      `INSERT INTO calendar_events (id, type, title, start_at, created_by_id, created_at, updated_at)
       VALUES ($1, 'OTRO', 'Sin columna', now(), $2, now(), now())`,
      `ev_${s}`,
      user.id
    )
    const ev = await prisma.calendarEvent.findUniqueOrThrow({ where: { id: `ev_${s}` } })
    expect(ev.commitment).toBe('INDETERMINADO')
  })
})

describe('backfill de la migración', () => {
  it('mapea cada tipo según lo acordado y deja sin clasificar lo ambiguo', async () => {
    const { ids } = await seedEventsOfEveryType()

    for (const stmt of backfillStatements()) await prisma.$executeRawUnsafe(stmt)

    for (const type of ALL_TYPES) {
      const ev = await prisma.calendarEvent.findUniqueOrThrow({ where: { id: ids[type] } })
      expect(ev.commitment, `tipo ${type}`).toBe(EXPECTED[type])
    }
  })

  it('nunca clasifica LLAMADA, OTRO ni SEGUIMIENTO como tarea interna', async () => {
    const { ids } = await seedEventsOfEveryType()

    for (const stmt of backfillStatements()) await prisma.$executeRawUnsafe(stmt)

    for (const type of ['LLAMADA', 'OTRO', 'SEGUIMIENTO'] as CalendarEventType[]) {
      const ev = await prisma.calendarEvent.findUniqueOrThrow({ where: { id: ids[type] } })
      expect(ev.commitment, `tipo ${type}`).not.toBe('INTERNO')
    }
  })

  it('no altera ninguna otra columna: ids, vínculos, estados ni fechas', async () => {
    const { ids } = await seedEventsOfEveryType()
    const before = await prisma.calendarEvent.findMany({
      where: { id: { in: Object.values(ids) } },
      orderBy: { id: 'asc' },
    })

    for (const stmt of backfillStatements()) await prisma.$executeRawUnsafe(stmt)

    const after = await prisma.calendarEvent.findMany({
      where: { id: { in: Object.values(ids) } },
      orderBy: { id: 'asc' },
    })

    // Se compara todo MENOS la columna nueva: cualquier otro cambio haría fallar el test.
    const withoutCommitment = (row: Record<string, unknown>) => {
      const copy = { ...row }
      delete copy.commitment
      return copy
    }

    expect(after).toHaveLength(before.length)
    for (let i = 0; i < before.length; i++) {
      expect(withoutCommitment(after[i])).toEqual(withoutCommitment(before[i]))
    }
  })

  it('es idempotente: repetirlo no cambia el resultado', async () => {
    const { ids } = await seedEventsOfEveryType()
    const stmts = backfillStatements()

    for (const stmt of stmts) await prisma.$executeRawUnsafe(stmt)
    const first = await prisma.calendarEvent.findMany({
      where: { id: { in: Object.values(ids) } },
      orderBy: { id: 'asc' },
      select: { id: true, commitment: true },
    })

    for (const stmt of stmts) await prisma.$executeRawUnsafe(stmt)
    const second = await prisma.calendarEvent.findMany({
      where: { id: { in: Object.values(ids) } },
      orderBy: { id: 'asc' },
      select: { id: true, commitment: true },
    })

    expect(second).toEqual(first)
  })
})
