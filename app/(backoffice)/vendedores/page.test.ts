import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn(),
  agents: vi.fn(),
  auth: vi.fn(),
}))
vi.mock('@/lib/db', () => ({
  db: {
    sellerLead: { count: mocks.count, findMany: mocks.findMany },
    user: { findMany: mocks.agents },
  },
}))
vi.mock('@/lib/auth', () => ({ requireAgente: mocks.auth }))
vi.mock('./leads-filters', () => ({ LeadsFilters: () => null }))

import VendedoresPage from './page'
import { landingAttributionLine, landingCaptureSelection } from '@/lib/landing/attribution'

function lead(id: string) {
  return {
    id,
    name: 'Vendedor de prueba',
    createdAt: new Date('2026-01-01'),
    canal: 'CN',
    status: 'NUEVO',
    agent: null,
    vehicle: null,
    dealType: null,
    calendarEvents: [],
    nextActionType: null,
    nextActionDueAt: null,
    activities: [
      {
        agentId: null,
        content: landingAttributionLine(
          '/vende-tu-camper.html',
          { utm_source: 'instagram', utm_campaign: 'qa_seller_campaign' },
          'directo'
        ),
      },
    ],
  }
}

describe('seller list', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.auth.mockResolvedValue({ id: 'qa' })
    mocks.count.mockResolvedValue(61)
    mocks.findMany.mockResolvedValue([lead('seller-a'), lead('seller-b')])
    mocks.agents.mockResolvedValue([])
  })

  it('keeps distinct destinations even for sellers with identical names, in table and cards', async () => {
    const html = renderToStaticMarkup(await VendedoresPage({ searchParams: {} }))
    const tableRows = html.match(/<tbody>([\s\S]*?)<\/tbody>/)![1].match(/<tr\b[\s\S]*?<\/tr>/g)!
    expect(tableRows).toHaveLength(2)
    const cards = html.slice(0, html.indexOf('<table'))
    ;['seller-a', 'seller-b'].forEach((id, index) => {
      // Every informative cell may link, but all links in a row must target that seller.
      const links = tableRows[index].match(/href="\/vendedores\/[^"?]+"/g)!
      expect(links.length).toBeGreaterThan(0)
      expect(new Set(links)).toEqual(new Set([`href="/vendedores/${id}"`]))
      expect(cards.match(new RegExp(`href="/vendedores/${id}"`, 'g'))).toHaveLength(1)
    })
    expect(html).toContain('Paginación de vendedores superior')
    expect(html).toContain('Paginación de vendedores inferior')
    expect(html).toContain('Vende tu camper')
    expect(html).toContain('Instagram')
    expect(html).toContain('Campaña: qa_seller_campaign')
    expect(html).not.toContain('__CN_ATTRIBUTION')
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 25,
        skip: 0,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        include: expect.objectContaining({ activities: landingCaptureSelection }),
      })
    )
  })

  it('muestra la portada y una galería independiente por vehículo en tabla y móvil', async () => {
    const vehicle = {
      id: 'unit-a',
      brand: 'Ford',
      model: 'Nugget',
      year: 2020,
      type: 'CAMPER',
      status: 'NUEVO',
      photos: [{ url: '/ford.jpg', altText: 'Portada Ford' }],
      _count: { photos: 3 },
    }
    mocks.findMany.mockResolvedValue([
      { ...lead('seller-a'), vehicle },
      {
        ...lead('seller-b'),
        vehicle: { ...vehicle, id: 'unit-b', brand: 'Fiat', photos: [], _count: { photos: 0 } },
      },
      lead('seller-c'),
    ])
    const html = renderToStaticMarkup(await VendedoresPage({ searchParams: {} }))
    expect(mocks.findMany.mock.calls[0][0].include.vehicle.select).toMatchObject({
      id: true,
      photos: { take: 1, orderBy: [{ order: 'asc' }, { id: 'asc' }] },
      _count: { select: { photos: true } },
    })
    for (const view of html.split('<table')) {
      expect(view.match(/aria-label="Abrir galería de [^"]+"/g)).toHaveLength(2)
      expect(view).toMatch(/Abrir galería de Ford [^"]+3 fotos/)
      expect(view).toMatch(/Abrir galería de Fiat [^"]+0 fotos/)
      expect(view).toContain('alt="Portada Ford"')
      expect(view).toContain('href="/vendedores/seller-c"')
      for (const link of view.match(/<a\b[^>]*>[\s\S]*?<\/a>/g) ?? [])
        expect(link).not.toContain('Abrir galería')
    }
  })

  it('muestra la acción de calendario anterior al recordatorio tanto en tarjetas como en tabla', async () => {
    mocks.findMany.mockResolvedValue([
      {
        ...lead('qa'),
        nextActionType: 'LLAMAR',
        nextActionDueAt: new Date('2030-03-04'),
        calendarEvents: [
          {
            id: 'e',
            startAt: new Date('2030-03-01'),
            title: 'Revisar la oferta',
            assignedTo: null,
          },
        ],
      },
    ])
    const html = renderToStaticMarkup(await VendedoresPage({ searchParams: { view: 'todos' } }))
    expect(html.match(/Revisar la oferta/g)).toHaveLength(2)
    expect(html).toContain('Estado del contacto')
  })
  it('clamps a stale page and preserves filters on the previous link', async () => {
    const html = renderToStaticMarkup(
      await VendedoresPage({ searchParams: { page: '99', brand: 'Ford', sort: 'updatedAt' } })
    )
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 25,
        skip: 50,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      })
    )
    expect(html).toContain('51–61 de 61 vendedores')
    expect(html).toContain('brand=Ford&amp;sort=updatedAt&amp;page=2')
    expect(html).not.toContain('page=4')
    expect(mocks.count.mock.calls[0][0].where).toEqual(mocks.findMany.mock.calls[0][0].where)
  })

  it('shows an empty range without invalid pages or navigation links', async () => {
    mocks.count.mockResolvedValue(0)
    mocks.findMany.mockResolvedValue([])
    const html = renderToStaticMarkup(await VendedoresPage({ searchParams: { page: '9' } }))
    expect(html).toContain('0–0 de 0 vendedores')
    expect(html).toContain('Sin vendedores que mostrar')
    expect(html).not.toContain('Paginación de vendedores inferior')
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0 }))
  })

  it('does not read records when authorization fails', async () => {
    mocks.auth.mockRejectedValue(new Error('denied'))
    await expect(VendedoresPage({ searchParams: {} })).rejects.toThrow('denied')
    expect(mocks.count).not.toHaveBeenCalled()
    expect(mocks.findMany).not.toHaveBeenCalled()
  })
})
