import type { Prisma } from '@prisma/client'
import { afterAll, expect, it, vi } from 'vitest'
import { createGuardedTestPrisma, uniqueSuffix, withRollbackTransaction } from './db'
import Page from '@/app/(backoffice)/ofertas/page'
import type { ListOffer } from '@/app/(backoffice)/ofertas/offers-list'

const client = createGuardedTestPrisma()
let connection: Prisma.TransactionClient
vi.mock('@/lib/db', () => ({
  get db() {
    return connection
  },
}))
vi.mock('@/lib/auth', () => ({ requireAgente: async () => ({ id: 'test' }) }))
afterAll(() => client.$disconnect())

it('consulta las dos vistas conservando las operaciones originales, las señales y los plazos', async () => {
  await withRollbackTransaction(client, async (tx) => {
    connection = tx
    const agent = await tx.user.create({
      data: { name: 'Agente de prueba', email: uniqueSuffix() + '@integ.test', role: 'AGENTE' },
    })
    const seller = await tx.sellerLead.create({ data: { name: 'Vendedor de prueba' } })
    const buyer = await tx.buyerLead.create({
      data: { name: 'Comprador de prueba', phone: '600000000' },
    })
    const vehicle = await tx.vehicle.create({
      data: {
        sellerLeadId: seller.id,
        brand: 'Ford',
        model: 'Transit',
        type: 'CAMPER',
        year: 2020,
        km: 50000,
        seats: 4,
      },
    })
    const common = {
      vehicleId: vehicle.id,
      buyerLeadId: buyer.id,
      createdById: agent.id,
      amount: '42500.25',
      notes: 'Condiciones originales',
    }
    const date = new Date('2025-10-26T00:00:00Z')
    await tx.offer.createMany({
      data: [
        { ...common, status: 'ACEPTADA', depositAmount: '1500.75', reservedUntil: date },
        { ...common, status: 'ACEPTADA', depositAmount: '0.00' },
        { ...common, status: 'CANCELADA', depositAmount: '0.01', reservedUntil: date },
        { ...common, status: 'PROPUESTA' },
      ],
    })
    const read = () =>
      tx.offer.findMany({ where: { vehicleId: vehicle.id }, orderBy: { id: 'asc' } })
    const before = await read()
    for (const vista of [undefined, 'historial']) {
      const page = await Page({ searchParams: { vista } })
      expect(page.props.history).toBe(vista === 'historial')
      const rows = (page.props.rows as ListOffer[]).filter((o) => o.buyerId === buyer.id)
      expect(rows).toHaveLength(before.length)
      for (const o of before) {
        expect(rows.find((r) => r.id === o.id)).toMatchObject({
          status: o.status,
          amount: Number(o.amount),
          depositAmount: o.depositAmount === null ? null : Number(o.depositAmount),
          reservedUntil: o.reservedUntil?.toISOString() ?? null,
        })
      }
    }
    expect(await read()).toEqual(before)
  })
})
