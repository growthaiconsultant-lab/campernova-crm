import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ associate: vi.fn(), search: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAgente: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { marker: 'db' } }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/manual-matches', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  associateManualMatch: mocks.associate,
  searchManualMatchCandidates: mocks.search,
}))
import { requireAgente } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { createManualMatch, searchManualMatches } from './manual-actions'
import { ManualMatchError } from '@/lib/manual-matches'
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAgente).mockResolvedValue({ id: 'a1' } as never)
})
describe('COM-4 acciones autenticadas', () => {
  it.each([createManualMatch, searchManualMatches])(
    'auth denegada impide cualquier consulta/escritura',
    async (action) => {
      vi.mocked(requireAgente).mockRejectedValue(new Error('denegado'))
      await expect(action({})).rejects.toThrow('denegado')
      expect(mocks.associate).not.toHaveBeenCalled()
      expect(mocks.search).not.toHaveBeenCalled()
    }
  )
  it('valida entradas antes de DB', async () => {
    expect(await createManualMatch({ vehicleId: 'v1', buyerLeadId: '' })).toMatchObject({
      ok: false,
    })
    expect(await searchManualMatches({ side: 'vehicle', fixedId: '', page: -1 })).toMatchObject({
      ok: false,
    })
    expect(mocks.associate).not.toHaveBeenCalled()
    expect(mocks.search).not.toHaveBeenCalled()
  })
  it('usa actor autenticado e invalida ambas fichas tras commit, también retry', async () => {
    mocks.associate.mockResolvedValue({ saved: false, sellerLeadId: 's1' })
    expect(await createManualMatch({ vehicleId: 'v1', buyerLeadId: 'b1' })).toEqual({
      ok: true,
      saved: false,
    })
    expect(mocks.associate).toHaveBeenCalledWith(expect.anything(), 'a1', {
      vehicleId: 'v1',
      buyerLeadId: 'b1',
    })
    expect(vi.mocked(revalidatePath).mock.calls.map((c) => c[0])).toEqual(
      expect.arrayContaining(['/compradores/b1', '/vendedores/s1', '/matches', '/vehiculos'])
    )
  })
  it('conflicto no invalida y errores técnicos no filtran datos', async () => {
    mocks.associate
      .mockRejectedValueOnce(new ManualMatchError('No disponible'))
      .mockRejectedValueOnce(new Error('password private data'))
    expect(await createManualMatch({ vehicleId: 'v1', buyerLeadId: 'b1' })).toEqual({
      ok: false,
      error: 'No disponible',
    })
    expect(
      JSON.stringify(await createManualMatch({ vehicleId: 'v1', buyerLeadId: 'b1' }))
    ).not.toContain('private data')
    expect(revalidatePath).not.toHaveBeenCalled()
  })
  it('búsqueda aplica defaults y errores recuperables', async () => {
    mocks.search
      .mockResolvedValueOnce({ items: [], hasMore: false })
      .mockRejectedValueOnce(new Error('private contact'))
    expect(await searchManualMatches({ side: 'buyer', fixedId: 'b1' })).toEqual({
      ok: true,
      items: [],
      hasMore: false,
    })
    expect(mocks.search).toHaveBeenCalledWith(expect.anything(), {
      side: 'buyer',
      fixedId: 'b1',
      query: '',
      page: 0,
    })
    expect(await searchManualMatches({ side: 'buyer', fixedId: 'b1' })).toEqual({
      ok: false,
      error: 'No se pudo buscar. Inténtalo de nuevo.',
    })
  })
})
