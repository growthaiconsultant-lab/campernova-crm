import { describe, expect, it } from 'vitest'
import { computeRecalcDiff } from './recalculate'

describe('computeRecalcDiff', () => {
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
      [{ otherId: 'a', status: 'SUGERIDO', manualLinkedAt: null }]
    )
    expect(diff.toCreate).toEqual([])
    expect(diff.toUpdateScore).toEqual([{ otherId: 'a', score: 95 }])
    expect(diff.toDeleteSuggested).toEqual([])
  })

  it('no toca matches en estado posterior aunque sigan en el top', () => {
    const diff = computeRecalcDiff(
      [{ otherId: 'a', score: 95 }],
      [{ otherId: 'a', status: 'PROPUESTO_CLIENTE', manualLinkedAt: null }]
    )
    expect(diff.toCreate).toEqual([])
    expect(diff.toUpdateScore).toEqual([])
    expect(diff.toDeleteSuggested).toEqual([])
  })

  it('borra SUGERIDO que ya no califica', () => {
    const diff = computeRecalcDiff(
      [{ otherId: 'a', score: 90 }],
      [
        { otherId: 'a', status: 'SUGERIDO', manualLinkedAt: null },
        { otherId: 'b', status: 'SUGERIDO', manualLinkedAt: null },
      ]
    )
    expect(diff.toUpdateScore).toEqual([{ otherId: 'a', score: 90 }])
    expect(diff.toDeleteSuggested).toEqual(['b'])
  })

  it('no borra estados posteriores aunque ya no califiquen', () => {
    const diff = computeRecalcDiff(
      [{ otherId: 'a', score: 90 }],
      [
        { otherId: 'a', status: 'SUGERIDO', manualLinkedAt: null },
        { otherId: 'b', status: 'VISITA', manualLinkedAt: null },
        { otherId: 'c', status: 'OFERTA', manualLinkedAt: null },
        { otherId: 'd', status: 'RECHAZADO', manualLinkedAt: null },
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
        { otherId: 'existe-sugerido', status: 'SUGERIDO', manualLinkedAt: null },
        { otherId: 'existe-avanzado', status: 'PROPUESTO_CLIENTE', manualLinkedAt: null },
        { otherId: 'desaparecido-sugerido', status: 'SUGERIDO', manualLinkedAt: null },
        { otherId: 'desaparecido-rechazado', status: 'RECHAZADO', manualLinkedAt: null },
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
        { otherId: 'a', status: 'SUGERIDO', manualLinkedAt: null },
        { otherId: 'b', status: 'SUGERIDO', manualLinkedAt: null },
        { otherId: 'c', status: 'CERRADO', manualLinkedAt: null },
      ]
    )
    expect(diff.toCreate).toEqual([])
    expect(diff.toUpdateScore).toEqual([])
    expect(diff.toDeleteSuggested).toEqual(['a', 'b'])
  })

  it('no borra una relación sugerida fijada manualmente aunque salga del top', () => {
    const diff = computeRecalcDiff(
      [],
      [{ otherId: 'manual', status: 'SUGERIDO', manualLinkedAt: new Date('2026-08-08') }]
    )

    expect(diff.toDeleteSuggested).toEqual([])
  })

  it('actualiza el score de una relación manual si vuelve a entrar en el top', () => {
    const diff = computeRecalcDiff(
      [{ otherId: 'manual', score: 82 }],
      [{ otherId: 'manual', status: 'SUGERIDO', manualLinkedAt: new Date('2026-08-08') }]
    )

    expect(diff.toUpdateScore).toEqual([{ otherId: 'manual', score: 82 }])
    expect(diff.toDeleteSuggested).toEqual([])
  })
})
