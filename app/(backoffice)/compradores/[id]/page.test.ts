import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Page from './page'

const mocks = vi.hoisted(() => ({
  buyer: vi.fn(),
  activities: vi.fn(),
  first: vi.fn(),
  calendarFirst: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({ requireAgente: async () => ({ id: 'test-agent' }) }))
vi.mock('@/lib/db', () => ({
  db: {
    buyerLead: { findUnique: mocks.buyer },
    user: { findMany: async () => [] },
    calendarEvent: { findFirst: mocks.calendarFirst },
    activity: { findMany: mocks.activities, findFirst: mocks.first },
  },
}))
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({}),
}))
// This async server child has a separate stock query. Assert its position via the rendered label.
vi.mock('@/components/buyer-catalog-results', () => ({
  BuyerCatalogResults: () => 'Comparación con el stock',
}))
const base = {
  id: 'test-buyer',
  name: 'Compradora de prueba',
  status: 'CONTACTADO',
  archivedAt: null,
  temperature: 'TEMPLADO',
  vehicleType: 'CAMPER',
  minSeats: 4,
  email: 'compradora@example.test',
  phone: null,
  chatSessions: [],
  matches: [],
  _count: { calendarEvents: 0 },
  calendarEvents: [],
  deliveries: [],
  offers: [],
  createdAt: new Date('2026-01-01'),
  maxBudget: 45000,
}
const params = { id: base.id }
async function render(searchParams: Parameters<typeof Page>[0]['searchParams'] = {}) {
  return renderToStaticMarkup(await Page({ params, searchParams }))
}

describe('navegación de la ficha integral', () => {
  beforeEach(() => {
    mocks.buyer.mockResolvedValue(base)
    mocks.activities.mockResolvedValue([])
    mocks.first.mockResolvedValue(null)
  })

  it('muestra cuatro apartados en una compra en curso y conserva llamada, notas, agenda y contacto', async () => {
    const html = await render()
    expect(html).toContain('Registrar llamada')
    expect(html).toContain('Programar acción')
    expect(html).toContain('Información comercial')
    expect(html).toContain('Historial de notas')
    expect(html).toContain('mailto:compradora@example.test')
    for (const tab of ['ficha', 'busqueda', 'vehiculos', 'documentos'])
      expect(html).toContain(`href="/compradores/test-buyer?tab=${tab}"`)
    expect(html).not.toContain('?tab=postventa')
  })

  it.each(['busqueda', 'vehiculos', 'documentos', 'postventa'])(
    'presenta una sola franja de llamada y cita antes de la navegación en %s',
    async (tab) => {
      mocks.buyer.mockResolvedValue({
        ...base,
        phone: '600000000',
        calendarEvents: [
          { id: 'event-qa', title: 'Enviar opciones', startAt: new Date('2026-11-15T11:30:00Z') },
        ],
      })
      const html = await render({ tab })
      const header = html.split('</header>')[0]
      expect(header).toContain('href="/calendario/event-qa"')
      expect(header).toContain('Enviar opciones')
      expect(header).toContain('tel:600000000')
      expect(header).toContain('Contactar')
      expect(header).toContain('WhatsApp')
      expect(header).toContain('Gestionar ficha')
      expect(header).not.toContain('Marcar como perdido')
      expect(html.match(/Registrar llamada/g)).toHaveLength(1)
      expect(header.indexOf('Registrar llamada')).toBeLessThan(
        header.indexOf('Apartados de la ficha')
      )
    }
  )

  it('presenta la primera acción una vez, con llamada y edición en la agenda antes del historial', async () => {
    mocks.buyer.mockResolvedValue({
      ...base,
      _count: { calendarEvents: 1 },
      nextActionType: 'WHATSAPP',
      nextActionDueAt: null,
      calendarEvents: [
        {
          id: 'evento',
          title: 'Confirmar visita',
          description: 'Quiere probar la cama',
          assignedTo: { name: 'Ana' },
          startAt: new Date('2026-11-15T10:00:00Z'),
        },
      ],
    })
    const html = await render()
    expect(html.match(/Confirmar visita/g)).toHaveLength(1)
    expect(html.match(/Registrar llamada/g)).toHaveLength(1)
    expect(html).toContain('2 pendientes')
    expect(html).toContain('Sin fecha')
    expect(html).toContain('Editar recordatorio')
    expect(html).toContain('Quiere probar la cama')
    expect(html).toContain('Responsable · Ana')
    expect(html.indexOf('Agenda del comprador')).toBeLessThan(html.indexOf('id="historial"'))
    expect(html).not.toContain('Próximo paso')
  })

  it('conserva el editor de un recordatorio sin fecha en una ficha archivada', async () => {
    mocks.buyer.mockResolvedValue({
      ...base,
      archivedAt: base.createdAt,
      nextActionType: 'LLAMAR',
      nextActionDueAt: null,
    })
    const html = await render()
    expect(html).toContain('1 pendiente')
    expect(html).toContain('Sin fecha')
    expect(html).toContain('Editar recordatorio')
    expect(html).toContain('Reactiva el comprador para programar')
    expect(html).not.toContain('otras acciones pendientes')
  })

  it('destaca el recordatorio anterior a una cita también desde otras pestañas', async () => {
    mocks.buyer.mockResolvedValue({
      ...base,
      _count: { calendarEvents: 1 },
      nextActionType: 'WHATSAPP',
      nextActionDueAt: base.createdAt,
      calendarEvents: [
        { id: 'evento', title: 'Confirmar visita', startAt: new Date('2026-11-15T10:00:00Z') },
      ],
    })
    const html = await render()
    expect(html.indexOf('Recordatorio de la ficha')).toBeLessThan(html.indexOf('Confirmar visita'))
    expect(await render({ tab: 'documentos' })).toContain(
      'href="/compradores/test-buyer?tab=ficha#buyer-actions-title"'
    )
  })

  it('conserva la primera acción y abre las restantes al paginar', async () => {
    mocks.calendarFirst.mockResolvedValue({
      id: 'primero',
      title: 'Primera cita',
      startAt: base.createdAt,
    })
    mocks.buyer.mockResolvedValue({
      ...base,
      _count: { calendarEvents: 11 },
      calendarEvents: [{ id: 'otro', title: 'Otra cita', startAt: new Date('2027-01-01') }],
    })
    const html = await render({ actionsPage: '2' })
    expect(html).toMatch(/<details[^>]*open[^>]*>[\s\S]*Otra cita/)
    expect(html).toContain('href="/calendario/primero"')
    expect(html).toContain('Páginas de acciones')
  })

  it('muestra un recordatorio heredado sin fecha desde Documentos', async () => {
    mocks.buyer.mockResolvedValue({ ...base, nextActionType: 'LLAMAR', nextActionDueAt: null })
    const html = await render({ tab: 'documentos', actionsPage: '3' })
    expect(html).toContain('Sin fecha')
    expect(html).toContain('Registrar llamada')
    expect(html).toContain('Presupuestos y documentos operativos')
  })

  it('mantiene el formulario editable, el catálogo, la solicitud original y el vehículo a cambio', async () => {
    mocks.first.mockResolvedValue({ content: 'Formulario histórico', createdAt: base.createdAt })
    const html = await render({ tab: 'busqueda', ver: 'editar' })
    expect(html).toMatch(/id="editar" open/)
    for (const text of [
      'Editar búsqueda',
      'Condiciones de compra',
      '¿Cómo la va a usar?',
      '¿Qué necesita el vehículo?',
      'Añadir característica',
      'Solicitud original',
      'Vehículo de parte de pago',
    ])
      expect(html).toContain(text)
  })

  it('distingue plazas, prioridad y altura pendiente con los datos actuales', async () => {
    const buyer = {
      ...base,
      minSeats: 4,
      sleepingPlacesRequired: 2,
      maxLengthM: 6,
      maxHeightM: null,
      criticalEquipment: { bathroom: true },
      matchCatalog: { heating: { values: ['Sí'], required: false } },
    }
    mocks.buyer.mockResolvedValue(buyer)
    const html = await render({ tab: 'busqueda' })
    const summary = html.split('id="busqueda"')[1].split('id="editar"')[0]
    expect(summary).toContain('45.000')
    expect(summary).toMatch(/Para viajar<\/dt>.*?4 plazas mín\./)
    expect(summary).toMatch(/Para dormir<\/dt>.*?2 plazas mín\./)
    expect(html).toContain('¿Hay también un límite de altura para aparcar?')
    mocks.buyer.mockResolvedValue({ ...buyer, maxHeightM: 2.65 })
    const updated = await render({ tab: 'busqueda' })
    expect(updated).toContain('Altura máxima de 2,65 m')
    expect(updated).not.toContain('¿Hay también un límite de altura')
  })
  it('muestra los datos desconocidos sin asumir que necesita aparcamiento', async () => {
    mocks.buyer.mockResolvedValue({
      ...base,
      minSeats: 1,
      vehicleType: null,
      maxBudget: null,
      sleepingPlacesRequired: null,
      needsGarage: true,
    })
    const html = await render({ tab: 'busqueda' })
    expect(html).toContain('Tipo por confirmar')
    expect(html).toContain('1 plaza mín.')
    expect(html).toMatch(/Para dormir<\/dt>.*?Por confirmar/)
    expect(html).toContain('Garaje para equipaje en el vehículo')
    expect(html).not.toContain('límite de altura para aparcar')
    expect(html).not.toContain('Formulario bajo pedido')
  })
  it('muestra el uso residencial en el resumen sin convertirlo en equipamiento', async () => {
    mocks.buyer.mockResolvedValue({ ...base, intendedUse: 'VIVIENDA_TEMPORADAS' })
    const html = await render({ tab: 'busqueda' })
    expect(html.split('id="editar"')[0]).toContain('Vivir en ella · Por temporadas')
    expect(html).toContain('¿Durante cuánto tiempo?')
    expect(html).toContain('Sin preferencias registradas.')
  })

  it('reúne interés, comparación y oferta, y conserva la restricción de una ficha archivada', async () => {
    const html = await render({ tab: 'vehiculos' })
    for (const text of ['Asociar vehículo', 'Comparación con el stock', 'Ofertas y reservas'])
      expect(html).toContain(text)
    mocks.buyer.mockResolvedValue({ ...base, archivedAt: new Date() })
    const archived = await render({ tab: 'vehiculos' })
    expect(archived).toContain('No admite nuevos intereses')
    expect(archived).not.toContain('Comparación con el stock')
  })

  it('recupera la conversación original abierta desde un enlace guardado', async () => {
    mocks.buyer.mockResolvedValue({
      ...base,
      chatSessions: [
        { id: 'chat-qa', messages: [{ role: 'user', content: 'Necesito cuatro plazas' }] },
      ],
    })
    const html = await render({ tab: 'ficha', ver: 'chat' })
    expect(html).toMatch(/id="conversacion" open/)
    expect(html).toContain('Necesito cuatro plazas')
  })

  it('conserva los documentos operativos', async () => {
    expect(await render({ tab: 'documentos' })).toContain('Presupuestos y documentos operativos')
  })

  it('da acceso a una entrega histórica sin garantía ni cierre comercial', async () => {
    const delivery = {
      id: 'entrega-qa',
      vehicle: {
        id: 'vehiculo-qa',
        brand: 'Marca de prueba',
        model: 'Camper',
        sellerLead: { id: 'seller-qa', name: 'Vendedor de prueba' },
      },
    }
    mocks.buyer.mockResolvedValue({ ...base, deliveries: [delivery] })
    expect(await render()).toContain('?tab=postventa')
    const html = await render({ tab: 'postventa' })
    expect(html).toContain('Marca de prueba')
    expect(html).toContain('Sin garantía activa')
  })

  it('muestra garantía e incidencias aun con una ficha sin entregas enlazadas', async () => {
    mocks.buyer.mockResolvedValue({
      ...base,
      warranty: {
        id: 'w-qa',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-09-01'),
        tickets: [
          { id: 'ticket', title: 'Incidencia de prueba', status: 'ABIERTO', priority: 'ALTA' },
        ],
      },
    })
    const html = await render({ tab: 'postventa' })
    for (const text of ['Garantía vencida', 'Incidencia de prueba', '/postventa/w-qa'])
      expect(html).toContain(text)
  })

  it('filtra el historial conservando las anotaciones del sistema en cambios', async () => {
    const activities = ['Origen cambiado: prueba', 'Nota del equipo'].map((content, index) => ({
      id: String(index),
      type: 'NOTA',
      agentId: 'qa',
      agent: { name: 'Agente de prueba' },
      content,
      createdAt: base.createdAt,
    }))
    mocks.activities.mockImplementation(async ({ where }) => (where.type ? [] : activities))
    const notes = await render({ historial: 'Notas' })
    expect(notes).toContain('Nota del equipo')
    expect(notes).not.toContain('Origen cambiado: prueba')
    expect(await render({ historial: 'Cambios' })).toContain('Origen cambiado: prueba')
  })

  it.each([
    ['matches', 'vehiculos#intereses'],
    ['ofertas', 'vehiculos#ofertas'],
    ['actividad', 'ficha#historial'],
    ['conversacion', 'ficha&ver=chat#conversacion'],
  ])('abre el destino del antiguo enlace %s', async (tab, target) => {
    await expect(render({ tab })).rejects.toMatchObject({
      digest: expect.stringContaining(`/compradores/test-buyer?tab=${target};`),
    })
  })
})
