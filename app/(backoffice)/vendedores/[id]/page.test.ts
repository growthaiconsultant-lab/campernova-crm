import { beforeEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import Page from './page'
import { PUBLICADO_REQUIRED_DOCS } from '@/lib/vehicle-legal'
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
  ['preparacion', 'Datos y documentos del vendedor'],
  ['vendedor', 'Documentos del vendedor'],
])('conserva el acceso directo a %s', async (tab, title) => {
  find.mockResolvedValue({ ...seller, vehicle })
  const html = await render(tab)
  expect(html).toContain(title)
  expect(html).not.toContain('Costes y margen')
})

const photos = Array.from({ length: 5 }, (_, i) => ({
  id: 'p' + i,
  order: i,
  url: '/qa-photo-' + i + '.jpg',
  category: null,
}))
const documents = PUBLICADO_REQUIRED_DOCS.map((category) => ({
  id: 'doc-' + category,
  category,
  name: category + '.pdf',
  url: 'private/' + category,
  fileSize: null,
  mimeType: null,
  createdAt: new Date(),
  uploadedBy: null,
}))
const prepared = {
  ...vehicle,
  status: 'TASADO',
  plate: '0000XXX',
  vin: 'TEST',
  chargeCheckedAt: new Date(),
  itvValidUntil: new Date(Date.now() + 20 * 86400000),
  purchasePrice: 42000,
  documents,
  photos,
}
it('presenta sólo bloqueos en el contador y mantiene los documentos anteriores, las fotos y los avisos', async () => {
  const original = documents[0]
  find.mockResolvedValue({
    ...seller,
    vehicle: {
      ...prepared,
      documents: [
        ...documents.filter((d) => d.category !== 'PERMISO_CIRCULACION'),
        { ...original, id: 'prev', name: 'Anterior.pdf' },
      ],
      photos: photos.slice(0, 3),
    },
  })
  const html = await render('preparacion')
  for (const value of [
    'Quedan 2 pendientes para publicar',
    'Adjuntar permiso',
    'Faltan 2 fotos',
    'Ya tenemos',
    '6 de 7 recibidos',
    'Anterior.pdf',
    original.name,
    'qa-photo-2',
    'La ITV vence el',
    'Más del expediente',
  ])
    expect(html).toContain(value)
  expect(html).not.toContain('Listo para publicar')
})
it('mantiene el aviso cuando está listo y evita invitar a publicar un vehículo ya publicado', async () => {
  find.mockResolvedValue({ ...seller, vehicle: prepared })
  const ready = await render('preparacion')
  for (const value of ['Listo para publicar', 'La ITV vence el', '7 de 7 recibidos', '>Publicar<'])
    expect(ready).toContain(value)
  find.mockResolvedValue({ ...seller, vehicle: { ...prepared, status: 'PUBLICADO' } })
  const published = await render('preparacion')
  expect(published).toContain('Vehículo publicado')
  expect(published).not.toContain('Listo para publicar')
})
it('enlaza al taller y conserva la distinción entre fecha de ITV vencida e informe guardado', async () => {
  find.mockResolvedValue({
    ...seller,
    vehicle: {
      ...prepared,
      itvValidUntil: new Date('2020-03-01'),
      workOrders: [
        { id: 'orden-qa', description: 'Revisar frenos', status: 'EN_CURSO', kind: 'REPARACION' },
      ],
    },
  })
  const html = await render('preparacion')
  for (const value of [
    'Quedan 2 pendientes',
    'ITV vencida',
    '7 de 7 recibidos',
    '/taller/orden-qa',
    'Lo completa Administración',
  ])
    expect(html).toContain(value)
})
it('sin vehículo mantiene accesibles los documentos del vendedor', async () => {
  const html = await render('preparacion')
  expect(html).toContain('Sin vehículo vinculado. Puedes consultar')
  expect(html).toContain('Datos y documentos del vendedor')
  expect(html).not.toContain('Listo para publicar')
})

it('un vendedor archivado no recibe una invitación de publicación aunque el expediente esté completo', async () => {
  find.mockResolvedValue({ ...seller, archivedAt: new Date(), vehicle: prepared })
  const html = await render('preparacion')
  expect(html).toContain('Ficha del vendedor archivada')
  expect(html).not.toContain('Listo para publicar')
  expect(html).not.toContain('>Publicar<')
})

it('la pestaña Vendedor muestra los datos y sus documentos aunque no haya vehículo', async () => {
  const html = await render('vendedor')
  for (const text of [
    'Datos del vendedor',
    'Editar datos del vendedor',
    'Documentos del vendedor',
    'Subir documento',
    'Contactar',
    'Gestionar ficha',
  ])
    expect(html).toContain(text)
  expect(html).not.toContain('Galería del vehículo')
})
it('una solicitud pendiente que intenta abrir Vendedor vuelve a revisión', async () => {
  find.mockResolvedValue({ ...seller, intakeStatus: 'PENDIENTE' })
  const html = await render('vendedor')
  expect(html).toContain('Datos de la solicitud')
  expect(html).not.toContain('Editar datos del vendedor')
})

it('la cabecera de Vehículo y documentos permite consultar la siguiente acción y volver a seguimiento', async () => {
  find.mockResolvedValue({
    ...seller,
    vehicle,
    calendarEvents: [
      {
        id: 'e',
        title: 'Revisar documentación',
        startAt: new Date('2028-02-14T11:30:00Z'),
        assignedTo: { name: 'Comercial' },
      },
    ],
  })
  const html = await render('preparacion')
  const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'))
  for (const item of [
    'Contactar',
    'Gestionar ficha',
    'Revisar documentación',
    '?tab=resumen#seller-next',
  ])
    expect(header).toContain(item)
})
