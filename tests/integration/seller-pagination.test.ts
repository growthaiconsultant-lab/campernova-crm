import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { uniqueSuffix } from './db'

vi.mock('@/lib/auth', () => ({ requireAgente: async () => ({ id: 'qa-pagination' }) }))
vi.mock('@/app/(backoffice)/vendedores/leads-filters', () => ({ LeadsFilters: () => null }))
vi.mock('@/lib/db', async () => {
  const { createGuardedTestPrisma } = await import('./db')
  return { db: createGuardedTestPrisma() }
})

import { db } from '@/lib/db'
import VendedoresPage from '@/app/(backoffice)/vendedores/page'

const marker = `pagination-${uniqueSuffix()}`
const ids = Array.from({ length: 26 }, (_, index) => `${marker}-${String(index).padStart(2, '0')}`)

beforeAll(async () => {
  await db.sellerLead.createMany({
    data: ids.map((id) => ({
      id,
      name: marker,
      canal: 'CN',
      intakeStatus: 'ADMITIDO',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    })),
  })
})

afterAll(async () => {
  await db.sellerLead.deleteMany({ where: { id: { in: ids } } })
  await db.$disconnect()
})

describe('seller list against PostgreSQL', () => {
  it('paginates equal names/dates without duplicating or omitting any seller', async () => {
    const render = async (page: string) =>
      renderToStaticMarkup(await VendedoresPage({ searchParams: { q: marker, page } }))
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
})
