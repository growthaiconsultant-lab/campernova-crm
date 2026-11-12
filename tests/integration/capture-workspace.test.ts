import { afterAll, expect, it, vi } from 'vitest'
import { uniqueSuffix } from './db'
import type { CaptureCardData } from '@/app/(backoffice)/captaciones/capture-card'
import { captureViewOf } from '@/lib/captacion'
vi.mock('@/lib/db', async () => ({ db: (await import('./db')).createGuardedTestPrisma() }))
vi.mock('@/lib/auth', () => ({ requireAgente: async () => ({ role: 'AGENTE' }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import { db } from '@/lib/db'
import Page from '@/app/(backoffice)/captaciones/page'
import {
  scheduleEntrada,
  updateCaptureStatus,
  updateCapture,
} from '@/app/(backoffice)/captaciones/actions'

afterAll(() => db.$disconnect())

it('clasifica sin reescribir las captaciones antiguas y mantiene el vínculo y el motivo de rechazo', async () => {
  const title = uniqueSuffix()
  const seller = await db.sellerLead.create({ data: { name: title } })
  const agent = await db.user.create({
    data: { name: 'Agente de prueba', email: title + '@example.test', role: 'AGENTE' },
  })
  try {
    const saved = await db.vehicleCapture.createManyAndReturn({
      data: [
        {
          title,
          createdById: agent.id,
          portal: 'WALLAPOP',
          status: 'NO_CONTACTADO',
          notes: 'Nota guardada',
        },
        {
          title,
          createdById: agent.id,
          portal: 'COCHES_NET',
          status: 'CONTACTADO',
          sellerLeadId: seller.id,
        },
        { title, createdById: agent.id, portal: 'OTRO', status: 'CONVERTIDO' },
        {
          title,
          createdById: agent.id,
          portal: 'OTRO',
          status: 'RECHAZADO',
          rejectionReason: 'PRECIO',
        },
      ],
    })
    const linked = saved.find((c) => c.sellerLeadId)!
    const rejected = saved.find((c) => c.status === 'RECHAZADO')!
    const open = saved.find((c) => c.status === 'NO_CONTACTADO')!
    const page = await Page({ searchParams: { focus: linked.id, portal: 'WALLAPOP' } })
    const rows = (page.props.cards as CaptureCardData[]).filter((c) => c.title === title)
    expect(rows.map(captureViewOf).sort()).toEqual([
      'abiertas',
      'convertidas',
      'convertidas',
      'rechazadas',
    ])
    expect(page.props).toMatchObject({ view: 'convertidas', focusId: linked.id, portal: '' })
    expect((await Page({ searchParams: { focus: rejected.id } })).props.view).toBe('rechazadas')
    expect(await updateCaptureStatus(linked.id, 'RECHAZADO', 'OTRO')).toHaveProperty('error')
    expect(await scheduleEntrada(linked.id, '2027-01-15T11:00:00Z')).toHaveProperty('error')
    expect(await db.vehicleCapture.findMany({ where: { title }, orderBy: { id: 'asc' } })).toEqual(
      saved.sort((a, b) => a.id.localeCompare(b.id))
    )
    expect(await updateCapture(open.id, { phone: '600000000' })).toEqual({})
    expect(await db.vehicleCapture.findUniqueOrThrow({ where: { id: open.id } })).toMatchObject({
      phone: '600000000',
      notes: 'Nota guardada',
      status: 'NO_CONTACTADO',
    })
  } finally {
    await db.vehicleCapture.deleteMany({ where: { title } })
    await db.sellerLead.delete({ where: { id: seller.id } })
    await db.user.delete({ where: { id: agent.id } })
  }
})
