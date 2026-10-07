import { describe, expect, it } from 'vitest'
import { computeRecalcDiff } from './recalculate'

describe('computeRecalcDiff', () => {
  it('conserva manuales SUGERIDO dentro y fuera del top, sin cambiar su score', () => {
    const diff = computeRecalcDiff(
      [
        { otherId: 'manual-in', score: 99 },
        { otherId: 'auto-in', score: 85 },
      ],
      [
        { otherId: 'manual-in', status: 'SUGERIDO', generatedBy: 'manual' },
        { otherId: 'manual-out', status: 'SUGERIDO', generatedBy: 'manual' },
        { otherId: 'auto-in', status: 'SUGERIDO', generatedBy: 'auto' },
        { otherId: 'auto-out', status: 'SUGERIDO', generatedBy: 'auto' },
      ]
    )
    expect(diff).toEqual({
      toCreate: [],
      toUpdateScore: [{ otherId: 'auto-in', score: 85 }],
      toDeleteSuggested: ['auto-out'],
    })
  })
  it('inserta matches nuevos cuando no existen previos', () => {
    const diff = computeRecalcDiff(
      [
        { otherId: 'a', score: 90 },
        { otherId: 'b', score: 80 },
      ],
      []
    )
    expect(diff.toCreate).toEqual([
      { otherId: 'a', score: 90 },
      { otherId: 'b', score: 80 },
    ])
    expect(diff.toUpdateScore).toEqual([])
    expect(diff.toDeleteSuggested).toEqual([])
  })

  it('actualiza score de matches SUGERIDO existentes', () => {
    const diff = computeRecalcDiff(
      [{ otherId: 'a', score: 95 }],
      [{ otherId: 'a', status: 'SUGERIDO' }]
    )
    expect(diff.toCreate).toEqual([])
    expect(diff.toUpdateScore).toEqual([{ otherId: 'a', score: 95 }])
    expect(diff.toDeleteSuggested).toEqual([])
  })

  it('no toca matches en estado posterior aunque sigan en el top', () => {
    const diff = computeRecalcDiff(
      [{ otherId: 'a', score: 95 }],
      [{ otherId: 'a', status: 'PROPUESTO_CLIENTE' }]
    )
    expect(diff.toCreate).toEqual([])
    expect(diff.toUpdateScore).toEqual([])
    expect(diff.toDeleteSuggested).toEqual([])
  })

  it('borra SUGERIDO que ya no califica', () => {
    const diff = computeRecalcDiff(
      [{ otherId: 'a', score: 90 }],
      [
        { otherId: 'a', status: 'SUGERIDO' },
        { otherId: 'b', status: 'SUGERIDO' },
      ]
    )
    expect(diff.toUpdateScore).toEqual([{ otherId: 'a', score: 90 }])
    expect(diff.toDeleteSuggested).toEqual(['b'])
  })

  it('no borra estados posteriores aunque ya no califiquen', () => {
    const diff = computeRecalcDiff(
      [{ otherId: 'a', score: 90 }],
      [
        { otherId: 'a', status: 'SUGERIDO' },
        { otherId: 'b', status: 'VISITA' },
        { otherId: 'c', status: 'OFERTA' },
        { otherId: 'd', status: 'RECHAZADO' },
      ]
    )
    expect(diff.toDeleteSuggested).toEqual([])
  })

  it('mezcla compleja: crear, actualizar, mantener y borrar a la vez', () => {
    const diff = computeRecalcDiff(
      [
        { otherId: 'nuevo', score: 88 },
        { otherId: 'existe-sugerido', score: 75 },
        { otherId: 'existe-avanzado', score: 60 },
      ],
      [
        { otherId: 'existe-sugerido', status: 'SUGERIDO' },
        { otherId: 'existe-avanzado', status: 'PROPUESTO_CLIENTE' },
        { otherId: 'desaparecido-sugerido', status: 'SUGERIDO' },
        { otherId: 'desaparecido-rechazado', status: 'RECHAZADO' },
      ]
    )
    expect(diff.toCreate).toEqual([{ otherId: 'nuevo', score: 88 }])
    expect(diff.toUpdateScore).toEqual([{ otherId: 'existe-sugerido', score: 75 }])
    expect(diff.toDeleteSuggested).toEqual(['desaparecido-sugerido'])
  })

  it('top vacío: borra todos los SUGERIDO existentes pero respeta avanzados', () => {
    const diff = computeRecalcDiff(
      [],
      [
        { otherId: 'a', status: 'SUGERIDO' },
        { otherId: 'b', status: 'SUGERIDO' },
        { otherId: 'c', status: 'CERRADO' },
      ]
    )
    expect(diff.toCreate).toEqual([])
    expect(diff.toUpdateScore).toEqual([])
    expect(diff.toDeleteSuggested).toEqual(['a', 'b'])
  })
})
