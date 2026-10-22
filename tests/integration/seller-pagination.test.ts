import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { uniqueSuffix } from './db'

vi.mock('@/lib/auth', () => ({ requireAgente: vi.fn() }))
vi.mock('@/app/(backoffice)/vendedores/leads-filters', () => ({ LeadsFilters: () => null }))
vi.mock('@/lib/db', async () => {
  const { createGuardedTestPrisma } = await import('./db')
  return { db: createGuardedTestPrisma() }
})

import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import VendedoresPage from '@/app/(backoffice)/vendedores/page'

const marker = `pagination-${uniqueSuffix()}`
const ids = Array.from({ length: 26 }, (_, index) => `${marker}-${String(index).padStart(2, '0')}`)

beforeAll(async () => {
  const actor = await db.user.create({
    data: { id: `${marker}-agent`, email: `${marker}@example.test`, name: 'Pagination agent' },
  })
  vi.mocked(requireAgente).mockResolvedValue(actor)
  await db.sellerLead.createMany({
    data: ids.map((id, index) => ({
      id,
      name: marker,
      canal: 'CN',
      intakeStatus: 'ADMITIDO',
      agentId: index === 0 ? actor.id : null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    })),
  })
})

afterAll(async () => {
  await db.sellerLead.deleteMany({ where: { id: { in: ids } } })
  await db.user.delete({ where: { id: `${marker}-agent` } })
  await db.$disconnect()
})

describe('seller list against PostgreSQL', () => {
  it('paginates equal names/dates without duplicating or omitting any seller', async () => {
    const render = async (page: string) =>
      renderToStaticMarkup(
        await VendedoresPage({ searchParams: { q: marker, page, view: 'todos' } })
      )
    const destinations = (html: string) =>
      Array.from(
        new Set(
          Array.from(html.matchAll(/href="\/vendedores\/([^"]+)"/g))
            .map((match) => match[1])
            .filter((id) => id.startsWith(marker))
        )
      )
    const first = await render('1')
    const second = await render('2')
    expect(destinations(first)).toEqual(ids.slice(0, 25))
    expect(destinations(second)).toEqual(ids.slice(25))
    expect(destinations(await render('999'))).toEqual(ids.slice(25))
    expect(first).toContain('1–25 de 26 vendedores')
    expect(second).toContain('26–26 de 26 vendedores')
  })
  it('opens only the authenticated agent portfolio by default', async () => {
    const html = renderToStaticMarkup(await VendedoresPage({ searchParams: { q: marker } }))
    expect(html).toContain(`/vendedores/${ids[0]}`)
    expect(html).not.toContain(`/vendedores/${ids[1]}`)
    expect(html).toContain('1–1 de 1 vendedores')
  })
})
