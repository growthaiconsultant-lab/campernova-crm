import { beforeAll, afterAll, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { createGuardedTestPrisma, uniqueSuffix } from './db'
import { listOperationalDocuments } from '@/app/(backoffice)/operaciones/documentos/actions'

let prisma: PrismaClient
vi.mock('@/lib/db', () => ({
  get db() {
    return prisma
  },
}))
vi.mock('@/lib/auth', () => ({ requireRole: async () => ({ role: 'AGENTE' }) }))
beforeAll(() => {
  prisma = createGuardedTestPrisma()
})
afterAll(async () => {
  await prisma?.$disconnect()
})

it('pagina presupuestos anteriores por comprador y categoría, sin modificar archivos', async () => {
  const suffix = uniqueSuffix()
  const user = await prisma.user.create({
    data: { name: 'Agente QA', role: 'AGENTE', email: suffix + '@integ.test' },
  })
  const makeBuyer = (name: string) =>
    prisma.buyerLead.create({
      data: { name, email: name + suffix + '@integ.test', phone: '000000000' },
    })
  const buyer = await makeBuyer('archivo'),
    other = await makeBuyer('otro')
  const base = {
    buyerLeadId: buyer.id,
    uploadedById: user.id,
    url: 'operational/fixture/prueba.pdf',
  }
  try {
    await prisma.vehicleDocument.createMany({
      data: [
        ...Array.from({ length: 23 }, (_, i) => ({
          ...base,
          name: 'Presupuesto ' + i,
          category: 'PRESUPUESTO' as const,
          createdAt: new Date(Date.UTC(2025, 1, i + 1)),
        })),
        { ...base, name: 'Hoja de trabajo', category: 'OPERATIVO' },
        { ...base, name: 'Otro cliente', buyerLeadId: other.id, category: 'PRESUPUESTO' },
      ],
    })
    const target = { type: 'buyerLead', id: buyer.id }
    const first = await listOperationalDocuments(target, 0, 'PRESUPUESTO'),
      next = await listOperationalDocuments(target, 1, 'PRESUPUESTO'),
      operations = await listOperationalDocuments(target, 0, 'OPERATIVO')
    if (!first.ok || !next.ok || !operations.ok) throw Error('La lectura del archivo ha fallado')
    expect(first.hasMore).toBe(true)
    expect(next.hasMore).toBe(false)
    expect([...first.items, ...next.items].map((d) => d.name)).toEqual(
      Array.from({ length: 23 }, (_, i) => 'Presupuesto ' + (22 - i))
    )
    expect(operations.items.map((d) => d.name)).toEqual(['Hoja de trabajo'])
    expect(await prisma.vehicleDocument.count({ where: { uploadedById: user.id } })).toBe(25)
  } finally {
    await prisma.vehicleDocument.deleteMany({ where: { uploadedById: user.id } })
    await prisma.buyerLead.deleteMany({ where: { id: { in: [buyer.id, other.id] } } })
    await prisma.user.delete({ where: { id: user.id } })
  }
})
