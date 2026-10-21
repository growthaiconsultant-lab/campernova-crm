import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAutosave, type AutosaveState } from './autosave'

afterEach(() => vi.useRealTimers())

function setup(save = vi.fn(async () => null as string | null)) {
  vi.useFakeTimers()
  const states: AutosaveState[] = []
  const autosave = createAutosave({
    initial: { budget: 100, zone: '' },
    validate: (value) => (value.budget < 0 ? 'Presupuesto inválido' : null),
    save,
    onState: (value) => states.push(value),
  })
  return { autosave, save, states }
}

describe('autosave', () => {
  it('no escribe al cargar y agrupa pulsaciones guardando sólo campos cambiados', async () => {
    const { autosave, save, states } = setup()
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).not.toHaveBeenCalled()
    autosave.change({ budget: 200, zone: '' })
    await vi.advanceTimersByTimeAsync(400)
    autosave.change({ budget: 300, zone: '' })
    await vi.advanceTimersByTimeAsync(799)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledExactlyOnceWith({ budget: 300, zone: '' }, ['budget'])
    expect(states.at(-1)).toEqual({ status: 'saved' })
    expect(autosave.hasPending()).toBe(false)
  })

  it('serializa y conserva el valor revertido durante una petición lenta', async () => {
    let release!: (value: string | null) => void
    const save = vi
      .fn(async () => null as string | null)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve
          })
      )
    const { autosave } = setup(save)
    autosave.change({ budget: 200, zone: '' })
    const flushed = autosave.flush()
    await Promise.resolve()
    autosave.change({ budget: 100, zone: 'Costa' })
    await vi.advanceTimersByTimeAsync(1500)
    expect(save).toHaveBeenCalledTimes(1)
    release(null)
    expect(await flushed).toBe(true)
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith({ budget: 100, zone: 'Costa' }, ['budget', 'zone'])
  })

  it.each(['error', 'throw'])(
    'retiene cambios ante %s y permite reintentar sin bucle',
    async (mode) => {
      const save = vi.fn(async () => null as string | null)
      if (mode === 'error') save.mockResolvedValueOnce('Error servidor')
      else save.mockRejectedValueOnce(Error('offline'))
      const { autosave, states } = setup(save)
      autosave.change({ budget: 200, zone: '' })
      expect(await autosave.flush()).toBe(false)
      expect(states.at(-1)?.status).toBe('error')
      expect(autosave.hasPending()).toBe(true)
      await vi.advanceTimersByTimeAsync(10000)
      expect(save).toHaveBeenCalledTimes(1)
      expect(await autosave.flush()).toBe(true)
      expect(save).toHaveBeenLastCalledWith({ budget: 200, zone: '' }, ['budget'])
    }
  )

  it('no envía valores inválidos y permite corregirlos', async () => {
    const { autosave, save } = setup()
    autosave.change({ budget: -1, zone: '' })
    expect(await autosave.flush()).toBe(false)
    expect(save).not.toHaveBeenCalled()
    autosave.change({ budget: 300, zone: '' })
    expect(await autosave.flush()).toBe(true)
  })

  it('cancelar la edición antes del debounce no genera escritura', async () => {
    const { autosave, save } = setup()
    autosave.change({ budget: 200, zone: '' })
    autosave.change({ budget: 100, zone: '' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).not.toHaveBeenCalled()
  })

  it('limpia timers al desmontar, tolera montaje estricto y no duplica flush', async () => {
    const { autosave, save } = setup()
    autosave.stop()
    autosave.start()
    autosave.change({ budget: 200, zone: '' })
    await Promise.all([autosave.flush(), autosave.flush()])
    expect(save).toHaveBeenCalledTimes(1)
    autosave.change({ budget: 400, zone: '' })
    autosave.stop()
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).toHaveBeenCalledTimes(1)
  })
})
