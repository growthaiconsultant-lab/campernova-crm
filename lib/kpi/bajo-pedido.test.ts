import { describe, expect, it, vi } from 'vitest'
import { buyerLeadStage } from './stage-map'
import { getDireccionKpis } from './direccion'

describe('COM-8 compradores bajo pedido', () => {
  it('cuenta como activo sin acreditar contacto, oferta ni reserva', async () => {
    expect(buyerLeadStage('BAJO_PEDIDO')).toBe('lead')
    const db = {
      buyerLead: {
        count: vi.fn().mockResolvedValue(0),
        groupBy: vi.fn().mockResolvedValue([
          { status: 'BAJO_PEDIDO', _count: { _all: 3 } },
          { status: 'CONTACTADO', _count: { _all: 2 } },
        ]),
      },
      vehicle: { count: vi.fn().mockResolvedValue(0), groupBy: vi.fn().mockResolvedValue([]) },
      match: { count: vi.fn().mockResolvedValue(0) },
    }
    const result = await getDireccionKpis(db as never, {})
    expect(db.buyerLead.count.mock.calls[0][0].where.status.in).toContain('BAJO_PEDIDO')
    expect(result.buyerFunnel.find((stage) => stage.label === 'Lead')?.count).toBe(5)
    expect(result.buyerFunnel.find((stage) => stage.label === 'Contactado')?.count).toBe(2)
    expect(result.buyerFunnel.find((stage) => stage.label === 'Oferta')?.count ?? 0).toBe(0)
  })
})
