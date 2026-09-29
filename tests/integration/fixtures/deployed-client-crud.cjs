// Cliente histórico real en un proceso que termina antes de eliminar su DLL en Windows.
async function main() {
  const { default: assert } = await import('node:assert/strict')
  const { randomUUID } = await import('node:crypto')
  const { pathToFileURL } = await import('node:url')
  const { default: legacyClient } = await import(pathToFileURL(process.argv[2]).href)
  const { PrismaClient } = legacyClient
  const url = new URL(process.env.TEST_DATABASE_URL)
  // Defensa adicional al guard del padre: este helper sólo puede alcanzar loopback QA.
  assert(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  assert.equal(process.env.NODE_ENV, 'test')
  const db = new PrismaClient({ datasourceUrl: url.toString() })
  try {
    await db.$connect()
    if (process.argv[3] === 'connect') return
    assert.equal(process.argv[3], 'crud')
    const s = randomUUID()
    const cleanups = []
    try {
      const seller = await db.sellerLead.create({
        data: { name: `S ${s}`, email: `s_${s}@deployed.test`, phone: '600000000' },
      })
      cleanups.push(() => db.sellerLead.delete({ where: { id: seller.id } }))
      const vehicle = await db.vehicle.create({
        data: {
          sellerLeadId: seller.id,
          brand: 'Adria',
          model: 'Coral',
          year: 2020,
          km: 1000,
          seats: 4,
          type: 'AUTOCARAVANA',
          status: 'RESERVADO',
        },
      })
      cleanups.push(() => db.vehicle.delete({ where: { id: vehicle.id } }))
      const buyer = await db.buyerLead.create({
        data: { name: `B ${s}`, email: `b_${s}@deployed.test`, phone: '600000001' },
      })
      cleanups.push(() => db.buyerLead.delete({ where: { id: buyer.id } }))
      const user = await db.user.create({
        data: { name: `U ${s}`, email: `u_${s}@deployed.test`, role: 'AGENTE' },
      })
      cleanups.push(() => db.user.delete({ where: { id: user.id } }))
      const offer = await db.offer.create({
        data: {
          vehicleId: vehicle.id,
          buyerLeadId: buyer.id,
          amount: 25000,
          createdById: user.id,
          status: 'CONVERTIDA',
        },
      })
      cleanups.push(() => db.offer.delete({ where: { id: offer.id } }))
      const created = await db.delivery.create({
        data: {
          vehicleId: vehicle.id,
          buyerLeadId: buyer.id,
          offerId: offer.id,
          scheduledAt: new Date(),
          status: 'PROGRAMADA',
        },
      })
      cleanups.push(() => db.delivery.delete({ where: { id: created.id } }))
      assert.equal(created.offerId, offer.id)
      const read = await db.delivery.findUnique({ where: { id: created.id } })
      assert.ok(read)
      assert.equal(read.status, 'PROGRAMADA')
      assert.equal(read.offerId, offer.id)
      const updated = await db.delivery.update({
        where: { id: created.id },
        data: { notes: 'nota desplegada' },
      })
      assert.equal(updated.notes, 'nota desplegada')
      const rows =
        await db.$queryRaw`SELECT "offer_id" FROM "deliveries" WHERE "id" = ${created.id}`
      assert.equal(rows.length, 1)
      assert.equal(rows[0].offer_id, offer.id)
    } finally {
      // No silenciar errores de limpieza: deben hacer fallar el proceso y la prueba.
      for (const cleanup of cleanups.reverse()) await cleanup()
    }
  } finally {
    await db.$disconnect()
  }
}

main().catch(() => {
  // No imprimir URLs, credenciales ni filas del cliente; el padre ve un exit no cero.
  console.error('Fallo en comprobación aislada del cliente histórico QA')
  process.exitCode = 1
})
