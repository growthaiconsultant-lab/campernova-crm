import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { PrismaClient, User } from '@prisma/client'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { authHolder } = vi.hoisted(() => ({ authHolder: { user: null as unknown as User } }))
vi.mock('@/lib/auth', () => ({ requireAgente: async () => authHolder.user }))

vi.mock('@/lib/db', async () => {
  const { createGuardedTestPrisma } = await import('./db')
  return { db: createGuardedTestPrisma() }
})

import { db } from '@/lib/db'
import { decideSellerIntake } from '@/app/(backoffice)/vendedores/intake-actions'
import { buildAdmittedVehicleWhere } from '@/lib/seller-intake'
import { uniqueSuffix } from './db'

const prisma = db as PrismaClient
let leadId = ''
let vehicleId = ''
let internalLeadId = ''
let internalVehicleId = ''
let admittedWebLeadId = ''
let admittedWebVehicleId = ''

beforeAll(async () => {
  const suffix = uniqueSuffix()
  authHolder.user = await prisma.user.create({
    data: { email: `intake_${suffix}@integ.test`, name: `Intake ${suffix}`, role: 'AGENTE' },
  })
  const lead = await prisma.sellerLead.create({
    data: {
      name: `Solicitud ${suffix}`,
      email: `seller_${suffix}@integ.test`,
      phone: `622${suffix.slice(0, 6)}`,
      canal: 'PRO',
      intakeStatus: 'PENDIENTE',
      vehicle: {
        create: {
          brand: 'Adria',
          model: 'Coral',
          type: 'AUTOCARAVANA',
          year: 2021,
          km: 42000,
          seats: 4,
          status: 'NUEVO',
        },
      },
    },
    include: { vehicle: true },
  })
  leadId = lead.id
  vehicleId = lead.vehicle!.id

  const internalLead = await prisma.sellerLead.create({
    data: {
      name: `Alta interna ${suffix}`,
      email: `internal_${suffix}@integ.test`,
      phone: `633${suffix.slice(0, 6)}`,
      canal: 'CN',
      intakeStatus: 'ADMITIDO',
      vehicle: {
        create: {
          brand: 'Hymer',
          model: 'Grand Canyon',
          type: 'CAMPER',
          year: 2022,
          km: 24000,
          seats: 4,
          status: 'NUEVO',
        },
      },
    },
    include: { vehicle: true },
  })
  internalLeadId = internalLead.id
  internalVehicleId = internalLead.vehicle!.id

  const admittedWebLead = await prisma.sellerLead.create({
    data: {
      name: `Web admitida ${suffix}`,
      email: `web_admitted_${suffix}@integ.test`,
      phone: `644${suffix.slice(0, 6)}`,
      canal: 'PRO',
      intakeStatus: 'ADMITIDO',
      vehicle: {
        create: {
          brand: 'Knaus',
          model: 'Boxstar',
          type: 'CAMPER',
          year: 2023,
          km: 12000,
          seats: 4,
          status: 'NUEVO',
        },
      },
    },
    include: { vehicle: true },
  })
  admittedWebLeadId = admittedWebLead.id
  admittedWebVehicleId = admittedWebLead.vehicle!.id
})

afterAll(async () => {
  if (leadId) await prisma.activity.deleteMany({ where: { sellerLeadId: leadId } })
  await prisma.vehicle.deleteMany({
    where: { id: { in: [vehicleId, internalVehicleId, admittedWebVehicleId].filter(Boolean) } },
  })
  await prisma.sellerLead.deleteMany({
    where: { id: { in: [leadId, internalLeadId, admittedWebLeadId].filter(Boolean) } },
  })
  if (authHolder.user?.id) await prisma.user.deleteMany({ where: { id: authHolder.user.id } })
  await prisma.$disconnect()
})

describe('integración · admisión de solicitudes web', () => {
  it('una pendiente queda fuera del inventario operativo', async () => {
    expect(
      await prisma.vehicle.count({
        where: { id: vehicleId, sellerLead: { intakeStatus: 'ADMITIDO' } },
      })
    ).toBe(0)
  })

  it('segmenta el inventario admitido por origen sin dejar entrar solicitudes pendientes', async () => {
    const scopedVehicleIds = [vehicleId, internalVehicleId, admittedWebVehicleId]

    expect(
      await prisma.vehicle.count({
        where: {
          AND: [{ id: { in: scopedVehicleIds } }, buildAdmittedVehicleWhere('CN')],
        },
      })
    ).toBe(1)
    expect(
      await prisma.vehicle.count({
        where: {
          AND: [{ id: { in: scopedVehicleIds } }, buildAdmittedVehicleWhere('PRO')],
        },
      })
    ).toBe(1)
    expect(
      await prisma.vehicle.count({
        where: {
          AND: [{ id: { in: scopedVehicleIds } }, buildAdmittedVehicleWhere('desconocido')],
        },
      })
    ).toBe(2)
  })

  it('dos decisiones concurrentes admiten una sola vez y crean una sola Activity', async () => {
    const results = await Promise.all([
      decideSellerIntake({ leadId, target: 'ADMITIDO' }),
      decideSellerIntake({ leadId, target: 'ADMITIDO' }),
    ])

    expect(results.filter((r) => 'status' in r && r.status === 'admitted')).toHaveLength(1)
    expect(
      results.every(
        (r) =>
          ('status' in r && (r.status === 'admitted' || r.status === 'unchanged')) || 'error' in r
      )
    ).toBe(true)

    const lead = await prisma.sellerLead.findUniqueOrThrow({ where: { id: leadId } })
    expect(lead.intakeStatus).toBe('ADMITIDO')
    expect(lead.intakeReviewedById).toBe(authHolder.user.id)
    expect(lead.intakeReviewedAt).toBeInstanceOf(Date)
    expect(
      await prisma.activity.count({
        where: { sellerLeadId: leadId, type: 'SOLICITUD_WEB_ADMITIDA' },
      })
    ).toBe(1)
    expect(
      await prisma.vehicle.count({
        where: { id: vehicleId, sellerLead: { intakeStatus: 'ADMITIDO' } },
      })
    ).toBe(1)
  })
})
