import { beforeEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import Page from './page'
const find = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth', () => ({
  requireAgente: async () => ({ id: 'a', role: 'AGENTE', name: 'Comercial' }),
}))
vi.mock('@/lib/db', () => ({
  db: {
    sellerLead: { findUnique: find },
    user: { findMany: async () => [] },
    activity: { findMany: async () => [] },
    workOrder: { count: async () => 0 },
  },
}))
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({}),
  usePathname: () => '/vendedores/qa',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/lib/trust-passport/prisma-deps', () => ({ getTrustPassportInput: async () => null }))
vi.mock('@/lib/entry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/entry')>()),
  getEntryChecklistSignals: async () => [],
}))
const seller = {
  id: 'qa',
  createdAt: new Date(),
  name: 'Vendedora QA',
  agent: { name: 'Comercial' },
  intakeStatus: 'ADMITIDO',
  status: 'CONTACTADO',
  calendarEvents: [],
  vehicle: null,
  canal: 'PRO',
}
const vehicle = {
  id: 'v',
  status: 'PUBLICADO',
  type: 'CAMPER',
  brand: 'Sunlight',
  model: 'Cliff',
  updatedAt: new Date(),
  publishedAt: new Date(),
  salePrice: 49900,
  desiredPrice: 50000,
  photos: [],
  matches: [],
  valuationAttempts: [],
  workOrders: [],
  documents: [],
  costs: [],
  valuations: [],
  offers: [],
  ads: [],
  deliveries: [],
}
const render = async (tab?: string) =>
  renderToStaticMarkup(await Page({ params: { id: 'qa' }, searchParams: { tab } }))
beforeEach(() => find.mockResolvedValue(seller))
it('abre en Seguimiento y conserva el acceso al expediente sin vehículo', async () => {
  const html = await render()
  for (const text of [
    'Vendedora QA',
    'Sin próxima acción programada',
    'Programar',
    'Registrar llamada',
    'Vehículo y documentos',
    'Sin vehículo vinculado',
  ])
    expect(html).toContain(text)
})
it.each(['PENDIENTE', 'RECHAZADO'])(
  'la captación %s se revisa incluso desde un acceso antiguo de venta',
  async (intakeStatus) => {
    find.mockResolvedValue({ ...seller, intakeStatus, vehicle })
    const html = await render('economia')
    expect(html).toContain('Datos de la solicitud')
    expect(html).not.toContain('Costes y margen')
    expect(html).not.toContain('Registrar llamada')
  }
)
it('distingue precios y muestra primero la cita anterior al recordatorio', async () => {
  find.mockResolvedValue({
    ...seller,
    vehicle,
    nextActionType: 'LLAMAR',
    nextActionDueAt: new Date('2027-01-02T09:00Z'),
    calendarEvents: [
      {
        id: 'e',
        title: 'Comentar la oferta',
        startAt: new Date('2027-01-01T09:00Z'),
        assignedTo: { name: 'Comercial' },
      },
    ],
  })
  const html = await render()
  for (const text of [
    'Precio anunciado',
    'Precio deseado',
    '/calendario/e',
    'Otras acciones pendientes',
    'Editar recordatorio',
    'Ver venta',
    'Historial de actividad',
  ])
    expect(html).toContain(text)
  expect(html.indexOf('Comentar la oferta')).toBeLessThan(html.indexOf('Editar recordatorio'))
})
it.each([
  ['publicacion', 'Anuncios y publicación'],
  ['economia', 'Tasación oficial'],
  ['compradores', 'Ofertas'],
  ['actividad', 'Actividad del lead'],
  ['preparacion', 'Documentos vinculados al vendedor'],
])('conserva el acceso directo a %s', async (tab, title) => {
  find.mockResolvedValue({ ...seller, vehicle })
  const html = await render(tab)
  expect(html).toContain(title)
  expect(html).not.toContain('Costes y margen')
})
