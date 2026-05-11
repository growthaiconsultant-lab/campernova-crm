import { describe, expect, it, vi } from 'vitest'
import { imputeTicketCost } from './impute-ticket-cost'
import { Decimal } from '@prisma/client/runtime/library'

function makeDb() {
  return {
    postventaTicket: { findUnique: vi.fn() },
    vehicleCost: { create: vi.fn().mockResolvedValue({ id: 'cost-1' }) },
  }
}

const BASE_TICKET = {
  costReal: new Decimal('350.00'),
  title: 'Avería boiler',
  warranty: { vehicleId: 'vehicle-1' },
}

describe('imputeTicketCost', () => {
  it('crea VehicleCost cuando costReal > 0', async () => {
    const db = makeDb()
    db.postventaTicket.findUnique.mockResolvedValue(BASE_TICKET)

    await imputeTicketCost('ticket-1', 'actor-1', db as never)

    expect(db.vehicleCost.create).toHaveBeenCalledOnce()
    const { data } = db.vehicleCost.create.mock.calls[0][0]
    expect(data.vehicleId).toBe('vehicle-1')
    expect(data.category).toBe('POSTVENTA')
    expect(data.description).toContain('Avería boiler')
    expect(data.amount).toEqual(new Decimal('350.00'))
    expect(data.createdById).toBe('actor-1')
  })

  it('no crea coste cuando costReal es null', async () => {
    const db = makeDb()
    db.postventaTicket.findUnique.mockResolvedValue({ ...BASE_TICKET, costReal: null })

    await imputeTicketCost('ticket-1', 'actor-1', db as never)

    expect(db.vehicleCost.create).not.toHaveBeenCalled()
  })

  it('no crea coste cuando costReal es 0', async () => {
    const db = makeDb()
    db.postventaTicket.findUnique.mockResolvedValue({ ...BASE_TICKET, costReal: new Decimal('0') })

    await imputeTicketCost('ticket-1', 'actor-1', db as never)

    expect(db.vehicleCost.create).not.toHaveBeenCalled()
  })

  it('no crea coste si el ticket no existe', async () => {
    const db = makeDb()
    db.postventaTicket.findUnique.mockResolvedValue(null)

    await imputeTicketCost('ticket-1', 'actor-1', db as never)

    expect(db.vehicleCost.create).not.toHaveBeenCalled()
  })
})
