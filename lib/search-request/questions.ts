/** Revised CampersNova questionnaire. Stable keys also identify the original CRM snapshot. */
export type Question = {
  key: string
  label: string
  kind: 'text' | 'textarea' | 'number' | 'date' | 'email' | 'tel' | 'single' | 'multi'
  options?: readonly string[]
  required?: boolean
  min?: number
  max?: number
  step?: number
  hint?: string
  autocomplete?: string
}
export type QuestionSection = { title: string; intro?: string; questions: Question[] }
const q = (
  key: string,
  label: string,
  kind: Question['kind'] = 'text',
  extra: Partial<Question> = {}
): Question => ({ key, label, kind, ...extra })
const single = (key: string, label: string, options: string[]) =>
  q(key, label, 'single', { options })
const multi = (key: string, label: string, options: string[]) => q(key, label, 'multi', { options })
const number = (key: string, label: string, max: number, step = 1, min = 0) =>
  q(key, label, 'number', { min, max, step })
export const EQUIPMENT = [
  ['heating', 'Calefacción en la vivienda'],
  ['aircon', 'Aire acondicionado en la vivienda'],
  ['solar', 'Placa solar'],
  ['lithium', 'Batería de vivienda de litio'],
  ['inverter', 'Enchufes de 230 V sin conexión exterior'],
  ['awning', 'Toldo exterior'],
  ['blinds', 'Mosquiteras y oscurecedores'],
  ['parking', 'Cámara o sensores de aparcamiento'],
  ['garage', 'Garaje o gran espacio de carga'],
  ['bikes', 'Portabicicletas'],
  ['towbar', 'Bola de remolque'],
  ['alarm', 'Alarma o sistema de seguridad'],
] as const
export const QUESTION_SECTIONS: QuestionSection[] = [
  {
    title: 'Tus datos y el vehículo que buscas',
    questions: [
      q('name', 'Nombre y apellidos', 'text', { required: true, autocomplete: 'name' }),
      q('phone', 'Teléfono', 'tel', { required: true, autocomplete: 'tel' }),
      q('email', 'Correo electrónico', 'email', { autocomplete: 'email' }),
      q('location', 'Localidad y provincia', 'text', { autocomplete: 'address-level2' }),
      single('vehicle', '¿Qué buscas?', ['Camper', 'Autocaravana', 'Necesito asesoramiento']),
      single('condition', 'Estado del vehículo', ['Nuevo', 'Usado', 'Indiferente']),
      q('deliveryDate', 'Fecha deseada de entrega', 'date'),
      q('deadline', 'Fecha límite, si la hay', 'date'),
      single('timing', 'Plazo', [
        'Puedo esperar la unidad adecuada',
        'Necesito cumplir la fecha límite',
      ]),
      single('tradeIn', '¿Tienes un vehículo para entregar?', ['Sí', 'No', 'Quiero valorarlo']),
      q('tradeInDetails', 'Vehículo para entregar: modelo, año y kilómetros'),
    ],
  },
  {
    title: 'Presupuesto',
    intro:
      'Importes en euros. Piensa en el total disponible para compra, servicio de búsqueda, transporte, trámites y mejoras.',
    questions: [
      number('budget', 'Presupuesto deseado (€)', 2000000),
      number('budgetLimit', 'Límite máximo total (€)', 2000000),
      single('finance', 'Financiación', [
        'La necesito',
        'No la necesito',
        'Quiero valorar opciones',
      ]),
      number('improvementsBudget', 'Presupuesto para mejoras, si procede (€)', 500000),
    ],
  },
  {
    title: 'Quién viajará',
    questions: [
      number('adults', 'Adultos habituales', 20),
      number('children', 'Niños habituales', 20),
      number('guests', 'Viajeros ocasionales', 20),
      number('seats', 'Plazas necesarias para viajar', 20, 1, 1),
      number('sleeping', 'Plazas necesarias para dormir', 20, 1, 1),
      q('childSeats', 'Sillas infantiles necesarias y edades de los niños'),
      q('pets', 'Mascotas y tamaño aproximado'),
    ],
  },
  {
    title: 'Conducción y dimensiones',
    questions: [
      number('maxLength', 'Longitud máxima cómoda (m)', 20, 0.01, 1),
      number('minInteriorHeight', 'Altura interior mínima deseada (m)', 4, 0.01, 0.5),
      single('gearbox', 'Cambio', ['Manual', 'Automático', 'Indiferente']),
      q('engine', 'Combustible, motorización o potencia que prefieres'),
      q('preferredModels', 'Marcas o modelos preferidos'),
      q('excludedModels', 'Marcas, modelos o tamaños que descartas'),
    ],
  },
  {
    title: 'Camas y descanso',
    intro: 'Marca las distribuciones que aceptarías. Indica al final si alguna es imprescindible.',
    questions: [
      multi('beds', 'Distribuciones que aceptarías', [
        'Cama doble fija',
        'Camas gemelas',
        'Cama isla',
        'Literas',
        'Cama elevable',
        'Techo elevable',
        'Salón convertible',
        'Necesito asesoramiento',
      ]),
      single('makeBed', 'Montar la cama del salón cada noche', [
        'Lo acepto',
        'No lo acepto',
        'Depende',
      ]),
      number('bedCount', 'Número de camas', 10, 1, 1),
      number('personHeight', 'Altura de la persona más alta (cm)', 250, 1, 50),
      q('bedNeeds', 'Medidas mínimas de cama o necesidades de acceso'),
    ],
  },
  {
    title: 'Baño, cocina y salón',
    questions: [
      single('bathroom', 'Baño', [
        'Interior imprescindible',
        'Puedo prescindir de él',
        'Necesito asesoramiento',
      ]),
      multi('shower', 'Ducha: opciones que aceptarías', [
        'Interior',
        'Separada del inodoro',
        'Exterior suficiente',
        'Indiferente',
      ]),
      single('toilet', 'Inodoro', ['Fijo', 'Portátil aceptable', 'Indiferente']),
      single('hotWater', 'Agua caliente', ['Imprescindible', 'Preferible', 'Indiferente']),
      single('cooking', 'Cocinaré dentro', ['Habitualmente', 'A veces', 'Poco o nada']),
      multi('fridge', 'Nevera', [
        'Compacta suficiente',
        'Grande',
        'Necesito congelador',
        'Necesito asesoramiento',
      ]),
    ],
  },
  {
    title: 'Equipamiento',
    intro:
      'Indica qué importancia tiene cada elemento. Puedes dejar en blanco lo que todavía no sepas.',
    questions: EQUIPMENT.map(([key, label]) =>
      single(`equipment_${key}`, label, [
        'Imprescindible',
        'Preferible',
        'Indiferente',
        'Necesito ayuda',
      ])
    ),
  },
  {
    title: 'Antigüedad, procedencia y mejoras',
    questions: [
      number('minYear', 'Año mínimo deseado', 2100, 1, 1950),
      number('maxKm', 'Kilometraje máximo deseado', 2000000),
      single('moreKm', '¿Aceptarías más kilómetros con buen estado e historial?', [
        'Sí',
        'No',
        'Lo valoraría',
      ]),
      single('origin', 'Procedencia', [
        'Solo España',
        'Acepto importación',
        'Necesito asesoramiento',
      ]),
      single('rental', 'Vehículo que haya sido de alquiler', [
        'Lo acepto',
        'Lo descarto',
        'Lo valoraría',
      ]),
      single('conversion', 'Camperización', [
        'De fábrica',
        'Profesional',
        'Indiferente',
        'Necesito asesoramiento',
      ]),
      single('cosmetic', 'Desperfectos estéticos', [
        'Acepto leves',
        'No los acepto',
        'Depende del precio',
      ]),
      single('repairs', 'Reparaciones o mejoras antes de la entrega', [
        'Acepto',
        'No acepto',
        'Según presupuesto',
      ]),
      q('improvements', 'Qué mejoras aceptarías y qué defectos descartarías', 'textarea'),
    ],
  },
  {
    title: 'Lo que decidirá tu compra',
    intro:
      'Escribe hasta cinco requisitos imprescindibles. Serán la referencia principal de la búsqueda.',
    questions: [
      ...[1, 2, 3, 4, 5].map((n) => q(`essential${n}`, `Requisito imprescindible ${n}`)),
      q('desirable', 'Características deseables, aunque no imprescindibles', 'textarea'),
      q('dealbreakers', 'Motivos por los que descartarías un vehículo', 'textarea'),
      multi('flexibility', 'Podría ceder en…', [
        'Antigüedad',
        'Kilómetros',
        'Tamaño',
        'Distribución',
        'Equipamiento',
        'Marca',
        'Precio dentro de mi límite',
        'Necesito valorarlo',
      ]),
      q('mostValued', 'Lo que más valoras al elegir'),
    ],
  },
  {
    title: 'Referencias y comentarios',
    questions: [
      q('comments', 'Enlaces, referencias o comentarios', 'textarea', {
        hint: 'Comparte enlaces a vehículos que te gusten y qué te atrae de ellos. Si ya has viajado en uno, cuéntanos qué repetirías o cambiarías. No incluyas documentos de identidad ni datos bancarios.',
      }),
    ],
  },
]
export const QUESTIONS = QUESTION_SECTIONS.flatMap((section) => section.questions)
export const FORM_STEPS = [
  { title: 'Tu búsqueda', sections: [0, 1, 2] },
  { title: 'Distribución', sections: [3, 4, 5] },
  { title: 'Equipamiento', sections: [6] },
  { title: 'Estado y prioridades', sections: [7, 8, 9] },
  { title: 'Revisar y enviar', sections: [] },
]
export type SearchAnswers = Record<string, string | string[]>
