import { describe, expect, it, vi } from 'vitest'
import { buyerLeadStage } from './stage-map'
import { getDireccionKpis } from './direccion'

describe('COM-7 lead sin respuesta en indicadores', () => {
  it('No contesta no representa un contacto conseguido', () => {
    expect(buyerLeadStage('NO_CONTESTA')).toBe('lead')
    expect(buyerLeadStage('CONTACTADO')).toBe('contactado')
  })
  it('cuenta como lead activo y en Lead, pero no eleva el funnel Contactado', async () => {
    const db = {
      buyerLead: {
        count: vi.fn().mockResolvedValue(0),
        groupBy: vi.fn().mockResolvedValue([
          { status: 'NO_CONTESTA', _count: { _all: 3 } },
          { status: 'NUEVO', _count: { _all: 2 } },
          { status: 'CONTACTADO', _count: { _all: 5 } },
          { status: 'CERRADO', _count: { _all: 1 } },
        ]),
      },
      vehicle: { count: vi.fn().mockResolvedValue(0), groupBy: vi.fn().mockResolvedValue([]) },
      match: { count: vi.fn().mockResolvedValue(0) },
    }
    const result = await getDireccionKpis(db as never, {})
    expect(db.buyerLead.count.mock.calls[0][0].where.status.in).toContain('NO_CONTESTA')
    expect(result.buyerFunnel.find((stage) => stage.label === 'Lead')?.count).toBe(11)
    expect(result.buyerFunnel.find((stage) => stage.label === 'Contactado')?.count).toBe(6)
  })
})
