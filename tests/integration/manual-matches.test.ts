import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { PrismaClient, VehicleStatus, BuyerLeadStatus } from '@prisma/client'
import { createGuardedTestPrisma, uniqueSuffix } from './db'
import { associateManualMatch, searchManualMatchCandidates } from '@/lib/manual-matches'
import { withLockedRoots } from '@/lib/locking/with-locked-roots'
import {
  recalculateMatchesForBuyer,
  recalculateMatchesForVehicle,
} from '@/lib/matching/recalculate'
vi.mock('@/lib/matching/notify', () => ({ notifyHighScoreMatches: vi.fn() }))
let db: PrismaClient
const sellers: string[] = [],
  buyers: string[] = [],
  actors: string[] = []
beforeAll(() => {
  db = createGuardedTestPrisma()
})
afterEach(async () => {
  vi.restoreAllMocks()
  await db.buyerLead.deleteMany({ where: { id: { in: buyers.splice(0) } } })
  await db.sellerLead.deleteMany({ where: { id: { in: sellers.splice(0) } } })
  await db.user.deleteMany({ where: { id: { in: actors.splice(0) } } })
})
afterAll(() => db.$disconnect())
async function fixture(compatible = false) {
  const tag = uniqueSuffix()
  const actor = await db.user.create({
    data: { name: 'QA agente', email: `${tag}@example.test`, role: 'AGENTE' },
  })
  actors.push(actor.id)
  const seller = await db.sellerLead.create({ data: { name: 'QA vendedor' } })
  sellers.push(seller.id)
  const vehicle = await db.vehicle.create({
    data: {
      sellerLeadId: seller.id,
      brand: `QA${tag}`,
      model: 'Furgo',
      plate: `QA${tag}`,
      status: 'PUBLICADO',
      type: 'CAMPER',
      entryValidatedAt: new Date(),
    },
  })
  const buyer = await db.buyerLead.create({
    data: {
      name: `QA${tag} Persona`,
      email: `${tag}buyer@example.test`,
      phone: '600000000',
      vehicleType: compatible ? 'CAMPER' : 'AUTOCARAVANA',
      status: 'CUALIFICADO',
    },
  })
  buyers.push(buyer.id)
  return { actor, seller, vehicle, buyer, input: { vehicleId: vehicle.id, buyerLeadId: buyer.id } }
}

describe('COM-4 asociación manual — PostgreSQL real', () => {
  it('entidades inexistentes no generan asociaciones ni auditoría', async () => {
    const f = await fixture()
    await expect(
      associateManualMatch(db, f.actor.id, { ...f.input, vehicleId: 'missing' })
    ).rejects.toThrow('ya no existe')
    await expect(
      associateManualMatch(db, f.actor.id, { ...f.input, buyerLeadId: 'missing' })
    ).rejects.toMatchObject({ code: 'ROOT_NOT_FOUND' })
    expect(await db.match.count({ where: f.input })).toBe(0)
    expect(await db.activity.count({ where: { agentId: f.actor.id } })).toBe(0)
  })
  it('cambio de vendedor entre resolución de raíces y lock aborta sin auditar la ficha equivocada', async () => {
    const f = await fixture()
    const newSeller = await db.sellerLead.create({ data: { name: 'QA otra ficha' } })
    sellers.push(newSeller.id)
    const original = db.vehicle.findUnique.bind(db.vehicle)
    vi.spyOn(db.vehicle, 'findUnique').mockImplementationOnce((async (args) => {
      const previous = await original(args)
      await db.vehicle.update({ where: { id: f.vehicle.id }, data: { sellerLeadId: newSeller.id } })
      return previous
    }) as typeof db.vehicle.findUnique)
    await expect(associateManualMatch(db, f.actor.id, f.input)).rejects.toThrow('ha cambiado')
    expect(await db.match.count({ where: f.input })).toBe(0)
    expect(await db.activity.count({ where: { agentId: f.actor.id } })).toBe(0)
  })
  it('archivado gana: observa espera de lock y rechaza la selección obsoleta tras releer', async () => {
    const f = await fixture()
    let signalHeld!: () => void, release!: () => void
    const held = new Promise<void>((resolve) => {
      signalHeld = resolve
    })
    const waitRelease = new Promise<void>((resolve) => {
      release = resolve
    })
    const archive = withLockedRoots(
      [{ type: 'buyerLead', id: f.buyer.id }],
      async (tx) => {
        await tx.buyerLead.update({ where: { id: f.buyer.id }, data: { archivedAt: new Date() } })
        signalHeld()
        await waitRelease
      },
      { client: db }
    )
    await held
    const association = associateManualMatch(db, f.actor.id, f.input).then(
      () => 'saved',
      (err) => (err as Error).message
    )
    try {
      const deadline = Date.now() + 2000
      for (;;) {
        const rows = await db.$queryRaw<
          Array<{ n: number }>
        >`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND wait_event_type = 'Lock'`
        if (rows[0].n > 0) break
        if (Date.now() > deadline) throw new Error('No se observó contención del lock')
        await new Promise((resolve) => setTimeout(resolve, 25))
      }
    } finally {
      release()
    }
    await archive
    expect(await association).toContain('archivado')
    expect(await db.match.count({ where: f.input })).toBe(0)
    expect(await db.activity.count({ where: { agentId: f.actor.id } })).toBe(0)
  })
  it('asocia fuera de preferencias, ambos lectores ven el mismo Match y sobrevive ambos recálculos', async () => {
    const f = await fixture()
    expect(await associateManualMatch(db, f.actor.id, f.input)).toMatchObject({ saved: true })
    const match = await db.match.findUniqueOrThrow({ where: { vehicleId_buyerLeadId: f.input } })
    expect(match).toMatchObject({ generatedBy: 'manual', status: 'SUGERIDO' })
    await recalculateMatchesForBuyer(f.buyer.id, db)
    await recalculateMatchesForVehicle(f.vehicle.id, db)
    const b = await db.buyerLead.findUniqueOrThrow({
      where: { id: f.buyer.id },
      include: { matches: true },
    })
    const s = await db.sellerLead.findUniqueOrThrow({
      where: { id: f.seller.id },
      include: { vehicle: { include: { matches: true } } },
    })
    expect(b.matches.find((m) => m.id === match.id)).toMatchObject({
      generatedBy: 'manual',
      score: match.score,
    })
    expect(s.vehicle?.matches.find((m) => m.id === match.id)).toMatchObject({
      buyerLeadId: f.buyer.id,
      generatedBy: 'manual',
    })
    expect(await db.activity.count({ where: { agentId: f.actor.id, type: 'MATCH_CREADO' } })).toBe(
      2
    )
    expect(await db.vehicle.findUnique({ where: { id: f.vehicle.id } })).toMatchObject({
      status: 'PUBLICADO',
      soldAt: null,
    })
    expect(b.status).toBe('CUALIFICADO')
    expect(await db.offer.count({ where: { vehicleId: f.vehicle.id } })).toBe(0)
    expect(await db.delivery.count({ where: { vehicleId: f.vehicle.id } })).toBe(0)
    expect(await db.warranty.count({ where: { vehicleId: f.vehicle.id } })).toBe(0)
  })
  it.each(['VISITA', 'RECHAZADO'] as const)(
    'convierte sugerencia conservando %s y score; retry no repite auditoría',
    async (status) => {
      const f = await fixture()
      const previous = await db.match.create({
        data: { ...f.input, status, score: 81, generatedBy: 'auto' },
      })
      expect(await associateManualMatch(db, f.actor.id, f.input)).toMatchObject({ saved: true })
      expect(await associateManualMatch(db, f.actor.id, f.input)).toMatchObject({ saved: false })
      expect(await db.match.findUnique({ where: { id: previous.id } })).toMatchObject({
        generatedBy: 'manual',
        status,
        score: 81,
      })
      expect(await db.activity.count({ where: { agentId: f.actor.id } })).toBe(2)
    }
  )
  it('doble envío concurrente crea un interés y sólo dos actividades', async () => {
    const f = await fixture()
    const results = await Promise.all([
      associateManualMatch(db, f.actor.id, f.input),
      associateManualMatch(db, f.actor.id, f.input),
    ])
    expect(results.map((r) => r.saved).sort()).toEqual([false, true])
    expect(await db.match.count({ where: f.input })).toBe(1)
    expect(await db.activity.count({ where: { agentId: f.actor.id } })).toBe(2)
  })
  it('rechaza comprador terminal/archivado y vehículo fuera de stock/entrada activa sin escribir', async () => {
    const f = await fixture()
    for (const status of ['CERRADO', 'PERDIDO'] as BuyerLeadStatus[]) {
      await db.buyerLead.update({ where: { id: f.buyer.id }, data: { status } })
      await expect(associateManualMatch(db, f.actor.id, f.input)).rejects.toThrow('comprador')
    }
    await db.buyerLead.update({
      where: { id: f.buyer.id },
      data: { status: 'CUALIFICADO', archivedAt: new Date() },
    })
    await expect(associateManualMatch(db, f.actor.id, f.input)).rejects.toThrow('comprador')
    await db.buyerLead.update({ where: { id: f.buyer.id }, data: { archivedAt: null } })
    for (const status of ['NUEVO', 'RESERVADO', 'VENDIDO', 'DESCARTADO'] as VehicleStatus[]) {
      await db.vehicle.update({ where: { id: f.vehicle.id }, data: { status } })
      await expect(associateManualMatch(db, f.actor.id, f.input)).rejects.toThrow('vehículo')
    }
    await db.vehicle.update({
      where: { id: f.vehicle.id },
      data: { status: 'PUBLICADO', entryValidatedAt: null },
    })
    await expect(associateManualMatch(db, f.actor.id, f.input)).rejects.toThrow('vehículo')
    await db.vehicle.update({
      where: { id: f.vehicle.id },
      data: { entryValidatedAt: new Date(), entryAnnulledAt: new Date() },
    })
    await expect(associateManualMatch(db, f.actor.id, f.input)).rejects.toThrow('vehículo')
    await db.vehicle.update({ where: { id: f.vehicle.id }, data: { entryAnnulledAt: null } })
    await db.sellerLead.update({ where: { id: f.seller.id }, data: { archivedAt: new Date() } })
    await expect(associateManualMatch(db, f.actor.id, f.input)).rejects.toThrow('vehículo')
    expect(await db.match.count({ where: f.input })).toBe(0)
    expect(await db.activity.count({ where: { agentId: f.actor.id } })).toBe(0)
  })
  it.each(['buyer', 'vehicle'] as const)(
    'snapshot auto obsoleto no borra manual recién confirmado durante recálculo %s',
    async (side) => {
      const f = await fixture()
      const previous = await db.match.create({
        data: { ...f.input, score: 42, generatedBy: 'auto' },
      })
      const original = db.match.findMany.bind(db.match)
      vi.spyOn(db.match, 'findMany').mockImplementationOnce((async (args) => {
        const snapshot = await original(args)
        await associateManualMatch(db, f.actor.id, f.input)
        return snapshot
      }) as typeof db.match.findMany)
      if (side === 'buyer') await recalculateMatchesForBuyer(f.buyer.id, db)
      else await recalculateMatchesForVehicle(f.vehicle.id, db)
      expect(await db.match.findUnique({ where: { id: previous.id } })).toMatchObject({
        generatedBy: 'manual',
        score: 42,
      })
    }
  )
  it.each(['buyer', 'vehicle'] as const)(
    'snapshot auto en top no cambia score manual durante recálculo %s',
    async (side) => {
      const f = await fixture(true)
      const previous = await db.match.create({
        data: { ...f.input, score: 12, generatedBy: 'auto' },
      })
      const original = db.match.findMany.bind(db.match)
      vi.spyOn(db.match, 'findMany').mockImplementationOnce((async (args) => {
        const snapshot = await original(args)
        await associateManualMatch(db, f.actor.id, f.input)
        return snapshot
      }) as typeof db.match.findMany)
      if (side === 'buyer') await recalculateMatchesForBuyer(f.buyer.id, db)
      else await recalculateMatchesForVehicle(f.vehicle.id, db)
      expect(await db.match.findUnique({ where: { id: previous.id } })).toMatchObject({
        generatedBy: 'manual',
        score: 12,
      })
    }
  )
  it('busca/pagina en ambos sentidos y marca sólo la relación del sujeto, sin ocultar otras fichas', async () => {
    const f = await fixture()
    const other = await fixture()
    await associateManualMatch(db, f.actor.id, f.input)
    const byVehicle = await searchManualMatchCandidates(db, {
      side: 'buyer',
      fixedId: f.buyer.id,
      query: f.vehicle.plate!,
      page: 0,
    })
    expect(byVehicle.items).toEqual([
      expect.objectContaining({ id: f.vehicle.id, associated: true }),
    ])
    const otherBuyer = await searchManualMatchCandidates(db, {
      side: 'buyer',
      fixedId: other.buyer.id,
      query: f.vehicle.plate!,
      page: 0,
    })
    expect(otherBuyer.items[0].associated).toBe(false)
    const byBuyer = await searchManualMatchCandidates(db, {
      side: 'vehicle',
      fixedId: f.vehicle.id,
      query: f.buyer.name!,
      page: 0,
    })
    expect(byBuyer.items).toEqual([expect.objectContaining({ id: f.buyer.id, associated: true })])
    expect(byBuyer.items[0]).not.toHaveProperty('email')
    for (let i = 0; i < 7; i++) {
      const seller = await db.sellerLead.create({ data: { name: 'QA paginado' } })
      sellers.push(seller.id)
      await db.vehicle.create({
        data: {
          sellerLeadId: seller.id,
          brand: f.vehicle.brand,
          model: `Paged${i}`,
          status: 'TASADO',
          entryValidatedAt: new Date(),
        },
      })
    }
    const first = await searchManualMatchCandidates(db, {
      side: 'buyer',
      fixedId: f.buyer.id,
      query: `${f.vehicle.brand} Paged`,
      page: 0,
    })
    const second = await searchManualMatchCandidates(db, {
      side: 'buyer',
      fixedId: f.buyer.id,
      query: `${f.vehicle.brand} Paged`,
      page: 1,
    })
    expect(first.items).toHaveLength(6)
    expect(first.hasMore).toBe(true)
    expect(second.items).toHaveLength(1)
    expect(second.hasMore).toBe(false)
    expect(new Set([...first.items, ...second.items].map((i) => i.id)).size).toBe(7)
  })
})
