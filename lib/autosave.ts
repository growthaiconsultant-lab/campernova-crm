export type AutosaveState = {
  status: 'idle' | 'pending' | 'saving' | 'saved' | 'error'
  message?: string
}

/** Serializes writes and keeps edits made during a request for the next write. */
export function createAutosave<T extends object>(options: {
  initial: T
  validate: (value: T) => string | null
  save: (value: T, fields: (keyof T)[]) => Promise<string | null>
  onState: (state: AutosaveState) => void
  delay?: number
}) {
  let baseline = structuredClone(options.initial)
  let latest = structuredClone(options.initial)
  let timer: ReturnType<typeof setTimeout> | undefined
  let running: Promise<boolean> | null = null
  let active = true
  const changedFields = () =>
    (Object.keys(latest) as (keyof T)[]).filter(
      (key) => JSON.stringify(latest[key]) !== JSON.stringify(baseline[key])
    )
  const emit = (state: AutosaveState) => active && options.onState(state)
  const clearTimer = () => {
    clearTimeout(timer)
    timer = undefined
  }

  async function drain(): Promise<boolean> {
    while (active && changedFields().length) {
      const snapshot = structuredClone(latest)
      const fields = changedFields()
      const invalid = options.validate(snapshot)
      if (invalid) {
        emit({ status: 'error', message: invalid })
        return false
      }
      emit({ status: 'saving' })
      try {
        const error = await options.save(snapshot, fields)
        if (error) {
          emit({ status: 'error', message: error })
          return false
        }
        baseline = snapshot
      } catch {
        emit({
          status: 'error',
          message: 'No se ha podido guardar. Comprueba la conexión y reintenta.',
        })
        return false
      }
    }
    emit({ status: 'saved' })
    return true
  }

  function flush(): Promise<boolean> {
    clearTimer()
    if (running) return running
    // Start in a microtask so even synchronous validation has an assigned running promise.
    running = Promise.resolve()
      .then(drain)
      .finally(() => {
        running = null
      })
    return running
  }

  return {
    change(value: T) {
      latest = structuredClone(value)
      clearTimer()
      if (running) return
      if (!changedFields().length) {
        emit({ status: 'saved' })
        return
      }
      emit({ status: 'pending' })
      timer = setTimeout(() => {
        void flush()
      }, options.delay ?? 800)
    },
    flush,
    hasPending: () => running !== null || changedFields().length > 0,
    start() {
      active = true
    },
    stop() {
      active = false
      clearTimer()
    },
  }
}
