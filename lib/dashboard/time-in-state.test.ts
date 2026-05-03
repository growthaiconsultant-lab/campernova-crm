import { describe, expect, it } from 'vitest'
import {
  parseDestinationLabel,
  durationsByStateForEntity,
  median,
  aggregateMediansByState,
  formatDuration,
  labelsToStatuses,
} from './time-in-state'

const LABELS = {
  NUEVO: 'Nuevo',
  CONTACTADO: 'Contactado',
  CUALIFICADO: 'Cualificado',
  CERRADO: 'Cerrado',
} as const
type S = keyof typeof LABELS

const labelToStatus = labelsToStatuses(LABELS)

describe('parseDestinationLabel', () => {
  it('parsea "Estado cambiado: Nuevo → Contactado"', () => {
    expect(parseDestinationLabel('Estado cambiado: Nuevo → Contactado')).toBe('Contactado')
  })
  it('parsea "Vehículo: Tasado → Publicado"', () => {
    expect(parseDestinationLabel('Vehículo: Tasado → Publicado')).toBe('Publicado')
  })
  it('null si no hay flecha', () => {
    expect(parseDestinationLabel('Cambio sin flecha')).toBeNull()
  })
  it('null si content es null', () => {
    expect(parseDestinationLabel(null)).toBeNull()
  })
  it('label con espacios extra', () => {
    expect(parseDestinationLabel('X →   En negociación   ')).toBe('En negociación')
  })
})

describe('durationsByStateForEntity', () => {
  it('una sola transición: tiempo en NUEVO', () => {
    const result = durationsByStateForEntity<S>(
      {
        initialStatus: 'NUEVO',
        createdAt: new Date('2026-05-01T10:00:00Z'),
        activities: [
          {
            createdAt: new Date('2026-05-01T11:00:00Z'),
            content: 'Estado cambiado: Nuevo → Contactado',
          },
        ],
      },
      labelToStatus
    )
    expect(result.get('NUEVO')).toEqual([60 * 60 * 1000])
    expect(result.has('CONTACTADO')).toBe(false) // sigue ahí, no medimos
  })

  it('cadena de transiciones', () => {
    const result = durationsByStateForEntity<S>(
      {
        initialStatus: 'NUEVO',
        createdAt: new Date('2026-05-01T10:00:00Z'),
        activities: [
          {
            createdAt: new Date('2026-05-01T11:00:00Z'),
            content: 'Estado cambiado: Nuevo → Contactado',
          },
          {
            createdAt: new Date('2026-05-01T13:00:00Z'),
            content: 'Estado cambiado: Contactado → Cualificado',
          },
          {
            createdAt: new Date('2026-05-01T18:00:00Z'),
            content: 'Estado cambiado: Cualificado → Cerrado',
          },
        ],
      },
      labelToStatus
    )
    expect(result.get('NUEVO')).toEqual([60 * 60 * 1000])
    expect(result.get('CONTACTADO')).toEqual([2 * 60 * 60 * 1000])
    expect(result.get('CUALIFICADO')).toEqual([5 * 60 * 60 * 1000])
    expect(result.has('CERRADO')).toBe(false)
  })

  it('ignora activities con content no parseable', () => {
    const result = durationsByStateForEntity<S>(
      {
        initialStatus: 'NUEVO',
        createdAt: new Date('2026-05-01T10:00:00Z'),
        activities: [
          { createdAt: new Date('2026-05-01T11:00:00Z'), content: 'Texto raro sin flecha' },
          {
            createdAt: new Date('2026-05-01T12:00:00Z'),
            content: 'Estado cambiado: Nuevo → Contactado',
          },
        ],
      },
      labelToStatus
    )
    expect(result.get('NUEVO')).toEqual([2 * 60 * 60 * 1000])
  })

  it('sin activities → mapa vacío', () => {
    const result = durationsByStateForEntity<S>(
      {
        initialStatus: 'NUEVO',
        createdAt: new Date('2026-05-01T10:00:00Z'),
        activities: [],
      },
      labelToStatus
    )
    expect(result.size).toBe(0)
  })
})

describe('median', () => {
  it('número impar de valores', () => {
    expect(median([1, 2, 3])).toBe(2)
  })
  it('número par de valores: media de los dos centrales', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })
  it('lista vacía → null', () => {
    expect(median([])).toBeNull()
  })
  it('un solo valor', () => {
    expect(median([42])).toBe(42)
  })
})

describe('aggregateMediansByState', () => {
  it('agrega varias entidades y devuelve mediana por estado', () => {
    const entities = [
      {
        initialStatus: 'NUEVO' as S,
        createdAt: new Date('2026-05-01T10:00:00Z'),
        activities: [
          {
            createdAt: new Date('2026-05-01T11:00:00Z'),
            content: 'Estado cambiado: Nuevo → Contactado',
          },
        ],
      },
      {
        initialStatus: 'NUEVO' as S,
        createdAt: new Date('2026-05-01T10:00:00Z'),
        activities: [
          {
            createdAt: new Date('2026-05-01T13:00:00Z'),
            content: 'Estado cambiado: Nuevo → Contactado',
          },
        ],
      },
      {
        initialStatus: 'NUEVO' as S,
        createdAt: new Date('2026-05-01T10:00:00Z'),
        activities: [
          {
            createdAt: new Date('2026-05-01T15:00:00Z'),
            content: 'Estado cambiado: Nuevo → Contactado',
          },
        ],
      },
    ]
    const rows = aggregateMediansByState(entities, LABELS)
    const nuevoRow = rows.find((r) => r.status === 'NUEVO')!
    expect(nuevoRow.medianMs).toBe(3 * 60 * 60 * 1000) // mediana de [1h, 3h, 5h]
    expect(nuevoRow.sampleSize).toBe(3)
  })

  it('entidades sin transiciones → tabla vacía', () => {
    const rows = aggregateMediansByState(
      [
        {
          initialStatus: 'NUEVO' as S,
          createdAt: new Date(),
          activities: [],
        },
      ],
      LABELS
    )
    expect(rows).toEqual([])
  })
})

describe('formatDuration', () => {
  it('minutos', () => {
    expect(formatDuration(15 * 60 * 1000)).toBe('15m')
  })
  it('horas y minutos', () => {
    expect(formatDuration(2 * 60 * 60 * 1000 + 30 * 60 * 1000)).toBe('2h 30m')
  })
  it('horas exactas', () => {
    expect(formatDuration(3 * 60 * 60 * 1000)).toBe('3h')
  })
  it('días y horas', () => {
    expect(formatDuration((2 * 24 + 5) * 60 * 60 * 1000)).toBe('2d 5h')
  })
  it('días exactos', () => {
    expect(formatDuration(3 * 24 * 60 * 60 * 1000)).toBe('3d')
  })
})
